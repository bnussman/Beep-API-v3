import express = require('express');
import { Router, Request, Response } from 'express';
import * as r from 'rethinkdb';
import { ReqlError } from 'rethinkdb';
import { makeJSONSuccess, makeJSONError } from '../utils/json';
import { isTokenValid } from "../auth/helpers";
import { conn, connQueues } from '../utils/db';
import { sendNotification } from '../utils/notifications';
import { getQueueSize, getPersonalInfo } from './helpers';
import { UserPluckResult } from "../types/beep";

const router: Router = express.Router();

router.get('/status/:id', getBeeperStatus);
router.post('/status', setBeeperStatus);
router.post('/queue', getBeeperQueue);
router.post('/queue/status', setBeeperQueue);

/**
 * API function that returns a beeper's isBeeing status
 */
function getBeeperStatus (req: Request, res: Response): void {
    //get isBeeping from user with id GET param in users db
    r.table("users").get(req.params.id).pluck('isBeeping').run(conn, function (error: ReqlError, result: UserPluckResult) {
        //if there was an error, notify user with REST API.
        if (error) {
            throw error;
        }
        //We have no error, send the resulting data from query.
        res.send({
            'status': 'success',
            'isBeeping': result.isBeeping
        });
    });
}

/**
 * API function that allows beeper to update isBeeping
 */
async function setBeeperStatus (req: Request, res: Response): Promise<void> {
    //get user's id
    const id = await isTokenValid(req.body.token);

    //if id is null, user's token is not valid
    if (!id) {
        res.send(makeJSONError("Your token is not valid."));
        return;
    }

    //if beeper is setting isBeeping to false
    if (req.body.isBeeping == false) {
        //get beepers queue size
        const queueSize = await getQueueSize(id);
        //we must make sure their queue is empty before they stop beeping
        if (queueSize > 0) {
            res.send(makeJSONError("You can't stop beeping when you still have beeps to complete or riders in your queue"));
            return;
        }
    }

    //query updates beepers isBeeping, singlesRate, and groupRate values
    r.table('users').get(id).update({isBeeping: req.body.isBeeping, singlesRate: req.body.singlesRate, groupRate: req.body.groupRate, capacity: req.body.capacity}).run(conn, function(error: Error) {
        //handle any RethinkDB error
        if (error) {
            res.send(makeJSONError("Unable to update beeping status."));
            console.log(error);
            return;
        }
        //If there was no DB error, our update query was successful. return success with REST API
        res.send(makeJSONSuccess("Successfully updated beeping status."));
    });
}


/**
 * API function that gets a beeper's queue as an array
 */
async function getBeeperQueue (req: Request, res: Response): Promise<void> {
    //get user's id
    const id = await isTokenValid(req.body.token);

    //if id is null, user's token is not valid
    if (!id) {
        res.send(makeJSONError("Your token is not valid."));
        return;
    }

    //get beeper's queue ordered by the time each rider entered the queue so the order makes sence for the beeper
    r.table(id).orderBy('timeEnteredQueue').run(connQueues, async function (error: Error, result: any) {
        //Handle any RethinkDB error
        if (error) {
            throw error;
        }

        //for every entry in a beeper's queue, add personal info
        for (let doc of result) {
            //for every queue entry, add personal info of the rider
            doc['personalInfo'] = await getPersonalInfo(doc.riderid);
        }

        //after processing, send data.
        res.send({
            'status': 'success',
            'queue': result
        });
    });
}

/**
 * API function that allows beeper to modify the status of a rider in their queue
 */
async function setBeeperQueue (req: Request, res: Response): Promise<void> {
    //get user's id
    const id = await isTokenValid(req.body.token);

    //if id is null, user's token is not valid
    if (!id) {
        res.send(makeJSONError("Your token is not valid."));
        return;
    }

    //if the beeper is accepting or denying a rider, run this code to ensure that beeper is
    //acceping or denying the rider that was first to request a ride (amung the isAccepted == false) beeps
    if (req.body.value == 'accept' || req.body.value == 'deny') {
        //in beeper's queue table, get the time the rider entered the queue
        //we need this to count the number of people before this rider in the queue
        let result = await r.table(id).filter({'riderid': req.body.riderID}).pluck('timeEnteredQueue').run(connQueues);

        //resolve the query and get the time this rider entered the queue as a const
        const timeEnteredQueue = (await result.next()).timeEnteredQueue;

        //query to get rider's actual position in the queue
        let ridersQueuePosition = await r.table(id).filter(r.row('timeEnteredQueue').lt(timeEnteredQueue).and(r.row('isAccepted').eq(false))).count().run(connQueues);

        //if there are riders before this rider that have not been accepted,
        //tell the beeper they must respond to them first.
        if (ridersQueuePosition != 0) {
            res.send(makeJSONError("You must respond to the rider who first joined your queue."));
            return;
        }
    }
    else {
        //in beeper's queue table, get the time the rider entered the queue
        //we need this to count the number of people before this rider in the queue
        let result = await r.table(id).filter({'riderid': req.body.riderID}).pluck('timeEnteredQueue').run(connQueues);

        //resolve the query and get the time this rider entered the queue as a const
        const timeEnteredQueue = (await result.next()).timeEnteredQueue;

        //query to get rider's actual position in the queue
        let ridersQueuePosition = await r.table(id).filter(r.row('timeEnteredQueue').lt(timeEnteredQueue).and(r.row('isAccepted').eq(true))).count().run(connQueues);

        //if there are riders before this rider that have been accepted,
        //tell the beeper they must respond to them first.
        if (ridersQueuePosition != 0) {
            res.send(makeJSONError("You must respond to the rider who first joined your queue."));
            return;
        }
    }

    if (req.body.value == 'accept') {
        //RethinkDB query that modifies record in beeper's queue, setting isAccepted to true for specific rider
        r.table(id).get(req.body.queueID).update({'isAccepted': true}).run(connQueues, function (error: Error) {
            //handle RethinkDB errors
            if (error) {
                throw error;
            }

            //if we made it here, accept occoured successfully
            res.send(makeJSONSuccess("Successfully accepted rider in queue."));
        });

        //Notify the rider that they were accepted into a queue
        sendNotification(req.body.riderID, "A beeper has accepted your beep request", "You will recieve another notification when they are on their way to pick you up.");
    }
    else if (req.body.value == 'deny' || req.body.value == 'complete') {
        //delete entry in beeper's queues table
        r.table(id).get(req.body.queueID).delete().run(connQueues, function (error, result) {
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

        //decrease beeper's queue size
        r.table('users').get(id).update({'queueSize': r.row('queueSize').sub(1)}).run(conn, function (error, result) {
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
        r.table('users').get(req.body.riderID).update({'inQueueOfUserID': null}).run(conn, function (error, result) {
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

        if (req.body.value == "deny") {
            //if the command sent to the api was deny, let the rider know they were denied
            sendNotification(req.body.riderID, "A beeper has denied your beep request", "Open your app to find a diffrent beeper.");
        }

        //if we reached this point, operation was successful
        res.send(makeJSONSuccess("Successfully removed user from queue."));
    }
    else {
        //we can just increment the state number in the queue doccument
        r.table(id).get(req.body.queueID).update({'state': r.row('state').add(1)}, {returnChanges: true}).run(connQueues, function (error, result) {
            //handle any RethinkDB error
            if (error) {
                res.send(makeJSONError("Server error while updating incrementing state in rider's queue doccument"));
                console.log(error);
                return;
            }
           
            let newState = result.changes[0].new_val.state;

            switch(newState) {
                case 1:
                    sendNotification(req.body.riderID, "Your beeper is on their way!", "Your beepr is on their way to pick you up.");
                    break;
                case 2:
                    sendNotification(req.body.riderID, "Your beeper is here!", "Your beepr is here to pick you up.");
                    break;
                case 3:
                    break;
               default: 
                   throw new Error("this should never happen");
            }
            
            res.send(makeJSONSuccess("Successfully changed ride state."));
        });
    }
}

export = router;
