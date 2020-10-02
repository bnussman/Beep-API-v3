import * as express from 'express';
import { Router, Request, Response } from 'express';
import * as r from 'rethinkdb';
import { CursorError, Cursor } from 'rethinkdb';
import { makeJSONSuccess, makeJSONError } from '../utils/json';
import { isAuthenticated } from "../auth/helpers";
import { db } from '../utils/db';
import { sendNotification } from '../utils/notifications';
import { Validator } from "node-input-validator";
import * as Sentry from "@sentry/node";

const router: Router = express.Router();

router.post('/find', isAuthenticated, findBeep);
router.post('/choose', isAuthenticated, chooseBeep);
router.post('/status', isAuthenticated, getRiderStatus);
router.post('/leave', isAuthenticated, riderLeaveQueue);
router.get('/list', getBeeperList);

async function chooseBeep (req: Request, res: Response): Promise<Response | void> {
    //validate input
    const v = new Validator(req.body, {
        groupSize: "required|numeric",
        origin: "required",
        destination: "required",
    });

    const matched = await v.check();

    if (!matched) {
        //input from the client does not match validation criteria
        return res.status(422).send(makeJSONError(v.errors));
    }
   
    //get beeper's information
    const result = await r.table('users').get(req.body.beepersID).pluck('first', 'last', 'queueSize', 'singlesRate', 'groupRate', 'isBeeping', 'capacity', 'isStudent', 'userLevel', 'masksRequired').run(db.getConn());

    //make sure beeper is still beeping. This case WILL happen because a beeper may turn off isBeeping and rider's client may have not updated
    if (!result.isBeeping) {
        return res.status(410).send(makeJSONError("The user you have chosen is no longer beeping at this time."));
    }

    //if there was no error, construct our new entry for beeper's queue table
    const newEntry = {
        'riderid': req.user.id,
        'timeEnteredQueue': Date.now(),
        'isAccepted': false,
        'groupSize': req.body.groupSize,
        'origin': req.body.origin,
        'destination': req.body.destination,
        'state': 0
    };

    try {
        //insert newEntry into beeper's queue table
        r.table(req.body.beepersID).insert(newEntry).run(db.getConnQueues());
    }
    catch (error) {
        //RethinkDB error while inserting beep entery into beeper's queue table
        Sentry.captureException(error);
        return res.status(500).send(makeJSONError("Unable to choose beep"));
    }

    try {
        //update beeper's queue size in the users table
        r.table('users').get(req.body.beepersID).update({'queueSize': r.row('queueSize').add(1)}).run(db.getConn());
    }
    catch (error) {
        //RethinkDB error while trying to increment beeper's queue size in the users table
        Sentry.captureException(error);
        return res.status(500).send(makeJSONError("Unable to choose beep"));
    }

    try {
        //update rider's inQueueOfUserID
        r.table('users').get(req.user.id).update({'inQueueOfUserID': req.body.beepersID}).run(db.getConn());
    }
    catch (error) {
        //unable to set inQueueOfUserID for rider in users table
        Sentry.captureException(error);
        return res.status(500).send(makeJSONError("Unable to choose beep"));
    }

    //Tell Beeper someone entered their queue asyncronously
    sendNotification(req.body.beepersID, "A rider has entered your queue", "Please open your app to accept or deny them.", "enteredBeeperQueue");

    //if we made it to this point, user has found a beep and it has been
    //registered in our db. Send output with nessesary data to rider.
    //Notice no need to send beeper's venmo of phone number because rider is not accepted as they just now joined the queue
    return res.send({
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
            'capacity': result.capacity,
            'masksRequired': result.masksRequired
        }
    });
}

/**
 * API function that allows user to find a ride with a beeper
 */
async function findBeep (req: Request, res: Response): Promise<Response | void> {
    //rethinkdb query to search users table (in acending order by queueSize) for users where isBeeping is true
    //and id is not equal to requester's, and limit by 1 to decide a riders beeper
    r.table('users').orderBy({'index': 'queueSize'}).filter(r.row('isBeeping').eq(true).and(r.row('id').ne(req.user.id))).limit(1).run(db.getConn(), function (error: Error, cursor: Cursor) {
        //Handle any RethinkDB error
        if (error) {
            Sentry.captureException(error);
            return res.status(500).send(makeJSONError("Unable to find beep"));
        }

        //this paticular RethinkDB query will return an iterable object, so use next to get the beeper
        cursor.next(function(error: CursorError, result: any) {
            //Handle RethinkDB cursour error
            if (error) {
                //If rethinkdb says there are not more rows, no one is beeping!
                if (error.msg == "No more rows in the cursor.") {
                    //close the RethinkDB cursor to prevent leak
                    cursor.close();
                    //Return error to REST API
                    return res.send(makeJSONError("Nobody is beeping at the moment! Try to find a ride later."));
                }
                else {
                    //the error was proabably serious, log it
                    Sentry.captureException(error);
                    return res.status(500).send(makeJSONError("Unable to find beep"));
                }
            }

            //if we made it to this point, user has found a beep and it has been
            //registered in our db. Send output with nessesary data to rider.
            return res.send({
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
                    'isStudent': result.isStudent,
                    'masksRequired': result.masksRequired
                }
            });
        });
    });
}

async function getRiderStatus (req: Request, res: Response): Promise<Response | void> {
    let result;

    //get rider's inQueueOfUserID in our user's db so we know what queue to look into
    try {
        result = await r.table('users').get(req.user.id).pluck('inQueueOfUserID').run(db.getConn());
    } 
    catch (error) {
        //TODO: user's account was deleted, we need to somehow get the client to logout
        //keep in mind that getRiderStatus returns with error status code just because
        //rider is not in a queue
        return res.status(404).send(makeJSONError("You are trying to get your rider status of an account that no longer exists"));
    }

    //we will be using the rider's beeper's id a lot, so make it a const
    const beepersID = result.inQueueOfUserID;

    //if user is in a queue...
    if (beepersID) {
        try {
            //since we are in a queue, we need to find the db entry where the rider has you id
            const result = await r.table(beepersID).filter({ riderid: req.user.id }).run(db.getConnQueues());

            //resolve the next element so we have a const of the db entry
            const queueEntry = await result.next();

            //get rider's position in the queue by using a count query where we count entries where they entered the queue earlier
            //(they have an earlier timestamp)
            const ridersQueuePosition = await r.table(beepersID).filter(r.row('timeEnteredQueue').lt(queueEntry.timeEnteredQueue).and(r.row('isAccepted').eq(true))).count().run(db.getConnQueues());

            //get beeper's information
            const beepersInfo = await r.table('users').get(beepersID).pluck('first', 'last', 'phone', 'venmo', 'singlesRate', 'groupRate', 'queueSize', 'userLevel', 'isStudent', 'capacity', 'masksRequired').run(db.getConn());

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
                        'isStudent': beepersInfo.isStudent,
                        'masksRequired': beepersInfo.masksRequired
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
                        'isStudent': beepersInfo.isStudent,
                        'masksRequired': beepersInfo.masksRequired
                    }
                };
            }
            //respond with appropriate output
            return res.send(output);
        }
        catch (error) {
            Sentry.captureException(error);
            return res.status(500).send(makeJSONError("Unable to get rider status"));
        }
    }
    else {
        //if beeper's id is not defined, they are not getting a beep
        return res.send(makeJSONError("Currently, user is not getting a beep."));
    }
}

/**
 * API function that is invoked when a rider wants to leave the queue they are in
 */
async function riderLeaveQueue (req: Request, res: Response): Promise<Response | void> {
    try {
        //delete entry in beeper's queue table
        r.table(req.body.beepersID).filter({'riderid': req.user.id}).delete().run(db.getConnQueues());
    }
    catch (error) {
        Sentry.captureException(error);
        return res.status(500).send(makeJSONError("Unable to leave queue"));
    }
    
    try {
        //decreace beeper's queue size
        r.table('users').get(req.body.beepersID).update({'queueSize': r.row('queueSize').sub(1)}).run(db.getConn());
    }
    catch (error) {
        Sentry.captureException(error);
        return res.status(500).send(makeJSONError("Unable to leave queue"));
    }

    try {
        //set rider's inQueueOfUserID value to null because they are no longer in a queue
        r.table('users').get(req.user.id).update({'inQueueOfUserID': null}).run(db.getConn());
    }
    catch (error) {
        Sentry.captureException(error);
        return res.status(500).send(makeJSONError("Unable to leave queue"));
    }

    //if we made it to this point, we successfully removed a user from the queue.
    return res.send(makeJSONSuccess("Successfully removed user from queue."));
}

/**
 * API endpoint to return a JSON responce with a status and list of all users beeping
 */
function getBeeperList (req: Request, res: Response): Response | void {
    r.table("users").filter({ isBeeping: true }).pluck('first', 'last', 'queueSize', 'id', 'singlesRate', 'groupRate', 'capacity', 'userLevel', 'isStudent', 'masksRequired').run(db.getConn(), async function (error: Error, result) {
        if (error) {
            Sentry.captureException(error);
            return res.status(500).send(makeJSONError("Unable to get beeper list"));
        }

        const list = await result.toArray();

        return res.send({
            "status": "success",
            "beeperList": list
        });
    });
}

export = router;
