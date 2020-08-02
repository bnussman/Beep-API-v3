import express = require('express');
import { Router, Request, Response } from 'express';
import * as r from 'rethinkdb';
import { CursorError } from 'rethinkdb';
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
    let id = await isTokenValid(req.body.token);

    //if id is null, user's token is not valid
    if (!id) {
        res.send(makeJSONError("Your token is not valid."));
        return;
    }

    const result = await r.table('users').get(req.body.beepersID).pluck('first', 'last', 'queueSize', 'singlesRate', 'groupRate', 'isBeeping').run(conn);

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

    //insert newEntry into beeper's queue table
    r.table(req.body.beepersID).insert(newEntry).run(connQueues, function (error, result) {
        //handle any RethinkDB error
        if (error) {
            res.send(makeJSONError("Server error while creating new entry in beeper's queue table."));
            console.log(error);
            return;
        }
        //ensure we actually inserted something
        if (result.inserted != 1) {
            res.send(makeJSONError("Nothing was inserted into beeper's queue table. This should not have happended..."));
            return;
        }
    });

    //update beeper's queue size in the users table
    r.table('users').get(req.body.beepersID).update({'queueSize': r.row('queueSize').add(1)}).run(conn, function (error, result) {
        //handle any RethinkDB error
        if (error) {
            res.send(makeJSONError("Server error while incrementing beeper's queue size"));
            console.log(error);
            return;
        }
        //ensure we actually updated something
        if (result.replaced != 1) {
            res.send(makeJSONError("Nothing was changed in beeper's queue table. This should not have happended..."));
            return;
        }
    });

    //update rider's inQueueOfUserID
    r.table('users').get(id).update({'inQueueOfUserID': req.body.beepersID}).run(conn, function (error, result) {
        //handle any RethinkDB error
        if (error) {
            res.send(makeJSONError("Server error while updating 'inQueueOfUserID' for rider"));
            console.log(error);
            return;
        }
        //ensure we actually updated something
        if (result.replaced != 1) {
            res.send(makeJSONError("Nothing was changed in beeper's queue table. This should not have happended..."));
            return;
        }
    });

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
            'groupRate': result.groupRate
        }
    });
}

/**
 * API function that allows user to find a ride with a beeper
 */
async function findBeep (req: Request, res: Response): Promise<void> {
    //get user's id
    let id = await isTokenValid(req.body.token);

    //if id is null, user's token is not valid
    if (!id) {
        res.send(makeJSONError("Your token is not valid."));
        return;
    }

    //rethinkdb query to search users table (in acending order by queueSize) for users where isBeeping is true
    //and id is not equal to requester's, and limit by 1 to decide a riders beeper
    r.table('users').orderBy({'index': 'queueSize'}).filter(r.row('isBeeping').eq(true).and(r.row('id').ne(id))).limit(1).run(conn, function (error, cursor) {
        //Handle any RethinkDB error
        if (error) {
            res.send(makeJSONError("Unable to find a beep due to a backend error."));
            console.log(error);
            return;
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
                    'capacity': result.capacity
                }
            });
        });
    });
}

async function getRiderStatus (req: Request, res: Response): Promise<void> {
    //get user's id
    let id = await isTokenValid(req.body.token);

    //if id is null, user's token is not valid
    if (!id) {
        res.send(makeJSONError("Your token is not valid."));
        return;
    }

    //get rider's entry in our user's db
    let result = await r.table('users').get(id).pluck('inQueueOfUserID').run(conn);

    //we will be using the rider's beeper's id a lot, so make it a const
    const beepersID = result.inQueueOfUserID;

    //if user is in a queue...
    if (beepersID) {
        //since we are in a queue, we need to find the db entry where the rider has you id
        let result = await r.table(beepersID).filter({riderid: id}).run(connQueues);

        //resolve the next element so we have a const of the db entry
        const queueEntry = await result.next();

        //get rider's position in the queue by using a count query where we count entries where they entered the queue earlier
        //(they have an earlier timestamp)
        let ridersQueuePosition = await r.table(beepersID).filter(r.row('timeEnteredQueue').lt(queueEntry.timeEnteredQueue).and(r.row('isAccepted').eq(true))).count().run(connQueues);

        //get beeper's information
        let beepersInfo = await r.table('users').get(beepersID).pluck('first', 'last', 'phone', 'venmo', 'singlesRate', 'groupRate', 'queueSize').run(conn);

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
                    "groupRate": beepersInfo.groupRate
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
                    "groupRate": beepersInfo.groupRate
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
    let id = await isTokenValid(req.body.token);

    //if id is null, user's token is not valid
    if (!id) {
        res.send(makeJSONError("Your token is not valid."));
        return;
    }

    //delete entry in beeper's queue table
    r.table(req.body.beepersID).filter({'riderid': id}).delete().run(connQueues, function (error, result) {
        //handle any RethinkDB error
        if (error) {
            res.send(makeJSONError("Server error while deleting queue entry in beeper's queue table"));
            console.log(error);
            return;
        }
        //ensure we actually deleted something
        if (result.deleted != 1) {
            res.send(makeJSONError("Nothing was deleted into beeper's queue table. This should not have happended..."));
            return;
        }
    });

    //decreace beeper's queue size
    r.table('users').get(req.body.beepersID).update({'queueSize': r.row('queueSize').sub(1)}).run(conn, function (error, result) {
        //handle any RethinkDB error
        if (error) {
            res.send(makeJSONError("Server error while decrementing beeper's queue size"));
            console.log(error);
            return;
        }
        //ensure we actually updated something
        if (result.replaced != 1) {
            res.send(makeJSONError("Nothing was changed in beeper's queue table. This should not have happended..."));
            return;
        }
    });

    //set rider's inQueueOfUserID value to null because they are no longer in a queue
    r.table('users').get(id).update({'inQueueOfUserID': null}).run(conn, function (error, result) {
        //handle any RethinkDB error
        if (error) {
            res.send(makeJSONError("Server error while updating 'inQueueOfUserID' for rider"));
            console.log(error);
            return;
        }
        //ensure we actually updated something
        if (result.replaced != 1) {
            res.send(makeJSONError("Nothing was changed in beeper's queue table. This should not have happended..."));
            return;
        }
    });

    //if we made it to this point, we successfully removed a user from the queue.
    res.send(makeJSONSuccess("Successfully removed user from queue."));
}

/**
 * API endpoint to return a JSON responce with a status and list of all users beeping
 */
function getBeeperList (req: Request, res: Response): void {
    r.table("users").filter({isBeeping: true}).pluck('first', 'last', 'queueSize', 'id', 'singlesRate', 'groupRate', 'capacity').run(conn, async function (error: Error, result) {
        if (error) {
            console.log(error);
            return;
        }

        const list = await result.toArray();

        res.send({
            "status": "success",
            "beeperList": list
        });
    });
}

export = router;
