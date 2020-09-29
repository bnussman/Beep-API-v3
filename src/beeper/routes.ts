import * as express from 'express';
import { Router, Request, Response } from 'express';
import * as r from 'rethinkdb';
import { ReqlError, WriteResult } from 'rethinkdb';
import { makeJSONSuccess, makeJSONError } from '../utils/json';
import { isAuthenticated } from "../auth/helpers";
import { db } from '../utils/db';
import { sendNotification } from '../utils/notifications';
import { getQueueSize, getPersonalInfo, storeBeepEvent } from './helpers';
import { UserPluckResult } from "../types/beep";
import {Validator} from 'node-input-validator';
import * as Sentry from "@sentry/node";

const router: Router = express.Router();

router.get('/status/:id', getBeeperStatus);
router.post('/status', isAuthenticated, setBeeperStatus);
router.post('/queue', isAuthenticated, getBeeperQueue);
router.post('/queue/status', isAuthenticated, setBeeperQueue);

/**
 * API function that returns a beeper's isBeeing status
 */
function getBeeperStatus (req: Request, res: Response): Response | void {
    //get isBeeping from user with id GET param in users db
    r.table("users").get(req.params.id).pluck('isBeeping').run(db.getConn(), function (error: ReqlError, result: UserPluckResult) {
        //if there was an error, notify user with REST API.
        if (error) {
            Sentry.captureException(error);
            return res.status(500).send(makeJSONError("Unable to get beeper status"));
        }
        //We have no error, send the resulting data from query.
        return res.send({
            'status': 'success',
            'isBeeping': result.isBeeping
        });
    });
}

/**
 * API function that allows beeper to update isBeeping
 */
async function setBeeperStatus (req: Request, res: Response): Promise<Response | void> {
    const v = new Validator(req.body, {
        singlesRate: "required|numeric",
        groupRate: "required|numeric",
        capacity: "required|numeric",
        isBeeping: "boolean"
    });

    const matched = await v.check();

    if (!matched) {
        return res.status(422).send(makeJSONError(v.errors));
    }

    //if beeper is setting isBeeping to false
    if (req.body.isBeeping == false) {
        //get beepers queue size
        const queueSize = await getQueueSize(req.user.id);
        //we must make sure their queue is empty before they stop beeping
        if (queueSize > 0) {
            return res.status(400).send(makeJSONError("You can't stop beeping when you still have beeps to complete or riders in your queue"));
        }
    }

    //query updates beepers isBeeping, singlesRate, and groupRate values, and capacity
    r.table('users').get(req.user.id).update({isBeeping: req.body.isBeeping, singlesRate: req.body.singlesRate, groupRate: req.body.groupRate, capacity: req.body.capacity}).run(db.getConn(), function(error: Error) {
        //handle any RethinkDB error
        if (error) {
            Sentry.captureException(error);
            return res.status(500).send(makeJSONError("Unable to set beeper status"));
        }
        //If there was no DB error, our update query was successful. return success with REST API
        return res.send(makeJSONSuccess("Successfully updated beeping status."));
    });
}


/**
 * API function that gets a beeper's queue as an array
 */
async function getBeeperQueue (req: Request, res: Response): Promise<Response | void> {
    //get beeper's queue ordered by the time each rider entered the queue so the order makes sence for the beeper
    r.table(req.user.id).orderBy('timeEnteredQueue').run(db.getConnQueues(), async function (error: Error, result: any) {
        //Handle any RethinkDB error
        if (error) {
            Sentry.captureException(error);
            return res.status(500).send(makeJSONError("Unable to get beeper queue"));
        }

        //for every entry in a beeper's queue, add personal info
        for (const doc of result) {
            //for every queue entry, add personal info of the rider
            doc['personalInfo'] = await getPersonalInfo(doc.riderid);
        }

        //after processing, send data.
        return res.send({
            'status': 'success',
            'queue': result
        });
    });
}

/**
 * API function that allows beeper to modify the status of a rider in their queue
 */
async function setBeeperQueue (req: Request, res: Response): Promise<Response | void> {
    //if the beeper is accepting or denying a rider, run this code to ensure that beeper is
    //acceping or denying the rider that was first to request a ride (amung the isAccepted == false) beeps
    if (req.body.value == 'accept' || req.body.value == 'deny') {
        try {
            //in beeper's queue table, get the time the rider entered the queue
            //we need this to count the number of people before this rider in the queue
            const cursor = await r.table(req.user.id).filter({'riderid': req.body.riderID}).pluck('timeEnteredQueue').run(db.getConnQueues());

            //resolve the query and get the time this rider entered the queue as a const
            const timeEnteredQueue = (await cursor.next()).timeEnteredQueue;

            //query to get rider's actual position in the queue
            const ridersQueuePosition = await r.table(req.user.id).filter(r.row('timeEnteredQueue').lt(timeEnteredQueue).and(r.row('isAccepted').eq(false))).count().run(db.getConnQueues());

            //if there are riders before this rider that have not been accepted,
            //tell the beeper they must respond to them first.
            if (ridersQueuePosition != 0) {
                return res.status(400).send(makeJSONError("You must respond to the rider who first joined your queue."));
            }
        }
        catch (error) {
            Sentry.captureException(error);
            return res.status(500).send(makeJSONError("Unable set beeper queue item"));
        }
    }
    else {
        try {
            //in beeper's queue table, get the time the rider entered the queue
            //we need this to count the number of people before this rider in the queue
            const cursor = await r.table(req.user.id).filter({'riderid': req.body.riderID}).pluck('timeEnteredQueue').run(db.getConnQueues());

            //resolve the query and get the time this rider entered the queue as a const
            const timeEnteredQueue = (await cursor.next()).timeEnteredQueue;

            //query to get rider's actual position in the queue
            const ridersQueuePosition = await r.table(req.user.id).filter(r.row('timeEnteredQueue').lt(timeEnteredQueue).and(r.row('isAccepted').eq(true))).count().run(db.getConnQueues());

            //if there are riders before this rider that have been accepted,
            //tell the beeper they must respond to them first.
            if (ridersQueuePosition != 0) {
                return res.status(400).send(makeJSONError("You must respond to the rider who first joined your queue."));
            }
        }
        catch (error) {
            Sentry.captureException(error);
            return res.status(500).send(makeJSONError("Unable set beeper queue item"));
        }
    }

    if (req.body.value == 'accept') {
        //RethinkDB query that modifies record in beeper's queue, setting isAccepted to true for specific rider
        r.table(req.user.id).get(req.body.queueID).update({'isAccepted': true}).run(db.getConnQueues(), function (error: Error) {
            //handle RethinkDB errors
            if (error) {
                Sentry.captureException(error);
                return res.status(500).send(makeJSONError("Unable set beeper queue item"));
            }

            //if we made it here, accept occoured successfully
            res.send(makeJSONSuccess("Successfully accepted rider in queue."));
        });

        //Notify the rider that they were accepted into a queue
        return sendNotification(req.body.riderID, "A beeper has accepted your beep request", "You will recieve another notification when they are on their way to pick you up.");
    }
    else if (req.body.value == 'deny' || req.body.value == 'complete') {
        //delete entry in beeper's queues table
        r.table(req.user.id).get(req.body.queueID).delete({ returnChanges: true }).run(db.getConnQueues(), function (error: Error, result: WriteResult) {
            //handle any RethinkDB error
            if (error) {
                Sentry.captureException(error);
                return res.status(500).send(makeJSONError("Unable set beeper queue item"));
            }

            //ensure we actually deleted something
            if (result.deleted != 1) {
                return res.status(500).send(makeJSONError("Nothing was deleted into beeper's queue table. This should not have happended..."));
            }
            else {
                const finishedBeep = result.changes[0].old_val;
                finishedBeep.beepersid = req.user.id;

                storeBeepEvent(finishedBeep);
            }
        });

        //decrease beeper's queue size
        r.table('users').get(req.user.id).update({'queueSize': r.row('queueSize').sub(1)}).run(db.getConn(), function (error: Error, result: WriteResult) {
            //handle any RethinkDB error
            if (error) {
                Sentry.captureException(error);
                return res.status(500).send(makeJSONError("Unable set beeper queue item"));
            }

            //ensure we actually updated something
            if (result.replaced != 1) {
                return res.status(500).send(makeJSONError("Nothing was changed in beeper's queue table. This should not have happended..."));
            }
        });

        //set rider's inQueueOfUserID value to null because they are no longer in a queue
        r.table('users').get(req.body.riderID).update({'inQueueOfUserID': null}).run(db.getConn(), function (error: Error, result: WriteResult) {
            //handle any RethinkDB error
            if (error) {
                Sentry.captureException(error);
                return res.status(500).send(makeJSONError("Unable set beeper queue item"));
            }

            //ensure we actually updated something
            if (result.replaced != 1) {
                return res.status(500).send(makeJSONError("Nothing was changed in beeper's queue table. This should not have happended..."));
            }
        });

        if (req.body.value == "deny") {
            //if the command sent to the api was deny, let the rider know they were denied
            sendNotification(req.body.riderID, "A beeper has denied your beep request", "Open your app to find a diffrent beeper.");
        }

        //if we reached this point, operation was successful
        return res.send(makeJSONSuccess("Successfully removed user from queue."));
    }
    else {
        //we can just increment the state number in the queue doccument
        r.table(req.user.id).get(req.body.queueID).update({'state': r.row('state').add(1)}, {returnChanges: true}).run(db.getConnQueues(), function (error: Error, result: WriteResult) {
            //handle any RethinkDB error
            if (error) {
                Sentry.captureException(error);
                return res.status(500).send(makeJSONError("Unable set beeper queue item"));
            }
           
            const newState = result.changes[0].new_val.state;

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
                   Sentry.captureException("Our beeper's state notification switch statement reached a point that is should not have");
            }
            
            return res.send(makeJSONSuccess("Successfully changed ride state."));
        });
    }
}

export = router;
