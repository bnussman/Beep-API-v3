import express = require('express');
import { Router, Request, Response } from 'express';
import * as r from 'rethinkdb';
import { CursorError, WriteResult, Cursor } from 'rethinkdb';
import { makeJSONSuccess, makeJSONError } from '../utils/json';
import { isTokenValid } from "../auth/helpers";
import { conn, connQueues } from '../utils/db';
import { sendNotification } from '../utils/notifications';

const router: Router = express.Router();

router.post('/find', findBeep);
router.post('/choose', chooseBeep);
router.post('/status', getRiderStatus);
router.post('/leave', riderLeaveQueue);
router.get('/list', getBeeperList);

async function chooseBeep (req: Request, res: Response): Promise<void> {
    //get user's id
    const id = await isTokenValid(req.body.token);

    //if id is null, user's token is not valid
    if (!id) {
        res.send(makeJSONError("Your token is not valid."));
        return;
    }
    
    const result = await r.table('users').get(req.body.beepersID).pluck('first', 'last', 'queueSize', 'singlesRate', 'groupRate', 'isBeeping', 'capacity', 'isStudent', 'userLevel').run(conn);

    if (!result.isBeeping) {
        res.send(makeJSONError("The user you have chosen is no longer beeping at this time."));
        return;
    }

    //if there was no error, construct our new entry for beeper's queue table
    const newEntry = {
        'riderid': id,
        'timeEnteredQueue': Date.now(),
        'isAccepted': false,
        'groupSize': req.body.groupSize,
        'origin': req.body.origin,
        'destination': req.body.destination,
        'state': 0
    };

    try {
        //insert newEntry into beeper's queue table
        r.table(req.body.beepersID).insert(newEntry).run(connQueues);
    }
    catch (error) {
        throw new error;
    }

    try {
        //update beeper's queue size in the users table
        r.table('users').get(req.body.beepersID).update({'queueSize': r.row('queueSize').add(1)}).run(conn);
    }
    catch (error) {
        throw new error;
    }

    try {
        //update rider's inQueueOfUserID
        r.table('users').get(id).update({'inQueueOfUserID': req.body.beepersID}).run(conn);
    }
    catch (error) {
        throw new error;
    }

    //Tell Beeper someone entered their queue
    sendNotification(req.body.beepersID, "A rider has entered your queue", "Please open your app to accept or deny them.");

    //if we made it to this point, user has found a beep and it has been
    //registered in our db. Send output with nessesary data to rider.
    res.send({
        'status': 'success',
        'beeper': {
            'id': req.body.beepersID,
            'first': result.first,
            'last': result.last,
            'queueSize': result.queueSize + 1,
            'singlesRate': result.singlesRate,
            'groupRate': result.groupRate,
            'userLevel': result.userLevel,
            'isStudent': result.isStudent,
            'capacity': result.capacity
        }
    });
}

/**
 * API function that allows user to find a ride with a beeper
 */
async function findBeep (req: Request, res: Response): Promise<void> {
    //get user's id
    const id = await isTokenValid(req.body.token);

    //if id is null, user's token is not valid
    if (!id) {
        res.send(makeJSONError("Your token is not valid."));
        return;
    }

    //rethinkdb query to search users table (in acending order by queueSize) for users where isBeeping is true
    //and id is not equal to requester's, and limit by 1 to decide a riders beeper
    r.table('users').orderBy({'index': 'queueSize'}).filter(r.row('isBeeping').eq(true).and(r.row('id').ne(id))).limit(1).run(conn, function (error: Error, cursor: Cursor) {
        //Handle any RethinkDB error
        if (error) {
            throw error;
        }

        //this paticular RethinkDB query will return an iterable object, so use next to get the beeper
        cursor.next(function(error: CursorError, result: any) {
            //Handle RethinkDB cursour error
            if (error) {
                //If rethinkdb says there are not more rows, no one is beeping!
                if (error.msg == "No more rows in the cursor.") {
                    //Return error to REST API
                    res.send(makeJSONError("Nobody is beeping at the moment! Try to find a ride later."));
                    //close the RethinkDB cursor to prevent leak
                    cursor.close();
                    return;
                }
            }

            //if we made it to this point, user has found a beep and it has been
            //registered in our db. Send output with nessesary data to rider.
            res.send({
                'status': 'success',
                'beeper': {
                    'id': result.id,
                    'first': result.first,
                    'last': result.last,
                    'queueSize': result.queueSize,
                    'singlesRate': result.singlesRate,
                    'groupRate': result.groupRate,
                    'capacity': result.capacity,
                    'userLevel': result.userLevel,
                    'isStudent': result.isStudent
                }
            });
        });
    });
}

async function getRiderStatus (req: Request, res: Response): Promise<void> {
    //get user's id
    const id = await isTokenValid(req.body.token);

    //if id is null, user's token is not valid
    if (!id) {
        res.send(makeJSONError("Your token is not valid."));
        return;
    }

    let result;
    //get rider's entry in our user's db
    try {
        result = await r.table('users').get(id).pluck('inQueueOfUserID').run(conn);
    } 
    catch (error) {
        //TODO: user's account was deleted, we need to somehow get the client to logout
        //keep in mind that getRiderStatus returns with error status code just because
        //rider is not in a queue
    }

    //we will be using the rider's beeper's id a lot, so make it a const
    const beepersID = result.inQueueOfUserID;

    //if user is in a queue...
    if (beepersID) {
        //since we are in a queue, we need to find the db entry where the rider has you id
        const result = await r.table(beepersID).filter({riderid: id}).run(connQueues);

        //resolve the next element so we have a const of the db entry
        const queueEntry = await result.next();

        //get rider's position in the queue by using a count query where we count entries where they entered the queue earlier
        //(they have an earlier timestamp)
        let ridersQueuePosition = await r.table(beepersID).filter(r.row('timeEnteredQueue').lt(queueEntry.timeEnteredQueue).and(r.row('isAccepted').eq(true))).count().run(connQueues);

        //get beeper's information
        let beepersInfo = await r.table('users').get(beepersID).pluck('first', 'last', 'phone', 'venmo', 'singlesRate', 'groupRate', 'queueSize', 'userLevel', 'isStudent', 'capacity').run(conn);

        let output;

        if (queueEntry.isAccepted) {
            //if rider is accepted by beeper, give them data along with more personal info like full name and phone number
            output = {
                "status": "success",
                "groupSize": queueEntry.groupSize,
                "isAccepted": queueEntry.isAccepted,
                "ridersQueuePosition": ridersQueuePosition,
                "state": queueEntry.state,
                "beeper": {
                    "id": beepersID,
                    "first": beepersInfo.first,
                    "last": beepersInfo.last,
                    "phone": beepersInfo.phone,
                    "venmo": beepersInfo.venmo,
                    "queueSize": beepersInfo.queueSize,
                    "singlesRate": beepersInfo.singlesRate,
                    "groupRate": beepersInfo.groupRate,
                    'capacity': beepersInfo.capacity,
                    'userLevel': beepersInfo.userLevel,
                    'isStudent': beepersInfo.isStudent
                }
            };
        }
        else {
            //rider is not yet accepted, give them info, but exclude less personal info
            output = {
                "status": "success",
                "groupSize": queueEntry.groupSize,
                "isAccepted": queueEntry.isAccepted,
                "beeper": {
                    "id": beepersID,
                    "first": beepersInfo.first,
                    "last": beepersInfo.last,
                    "queueSize": beepersInfo.queueSize,
                    "singlesRate": beepersInfo.singlesRate,
                    "groupRate": beepersInfo.groupRate,
                    'capacity': beepersInfo.capacity,
                    'userLevel': beepersInfo.userLevel,
                    'isStudent': beepersInfo.isStudent
                }
            };
        }
        //respond with appropriate output
        res.send(output);
    }
    else {
        //if beeper's id is not defined, they are not getting a beep
        res.send(makeJSONError("Currently, user is not getting a beep."));
    }
}

/**
 * API function that is invoked when a rider wants to leave the queue they are in
 */
async function riderLeaveQueue (req: Request, res: Response): Promise<void> {
    //get user's id
    const id = await isTokenValid(req.body.token);

    //if id is null, user's token is not valid
    if (!id) {
        res.send(makeJSONError("Your token is not valid."));
        return;
    }
    
    try {
        //delete entry in beeper's queue table
        r.table(req.body.beepersID).filter({'riderid': id}).delete().run(connQueues);
    } catch (error) {
        throw new error;
    }
    
    try {
        //decreace beeper's queue size
        r.table('users').get(req.body.beepersID).update({'queueSize': r.row('queueSize').sub(1)}).run(conn);
    } catch (error) {
        throw new error;
    }

    try {
        //set rider's inQueueOfUserID value to null because they are no longer in a queue
        r.table('users').get(id).update({'inQueueOfUserID': null}).run(conn);
    } catch (error) {
        throw new error;
    }

    //if we made it to this point, we successfully removed a user from the queue.
    res.send(makeJSONSuccess("Successfully removed user from queue."));
}

/**
 * API endpoint to return a JSON responce with a status and list of all users beeping
 */
function getBeeperList (req: Request, res: Response): void {
    r.table("users").filter({isBeeping: true}).pluck('first', 'last', 'queueSize', 'id', 'singlesRate', 'groupRate', 'capacity', 'userLevel', 'isStudent').run(conn, async function (error: Error, result) {
        if (error) {
            throw error;
        }

        const list = await result.toArray();

        res.send({
            "status": "success",
            "beeperList": list
        });
    });
}

export = router;
