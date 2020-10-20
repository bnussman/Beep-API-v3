import * as express from 'express';
import * as r from 'rethinkdb';
import { WriteResult } from 'rethinkdb';
import { conn, connQueues } from '../utils/db';
import { sendNotification } from '../utils/notifications';
import { getQueueSize, getPersonalInfo, storeBeepEvent } from './helpers';
import { Validator } from 'node-input-validator';
import * as Sentry from "@sentry/node";
import { Controller, Request, Body, Tags, Security, Post, Route } from 'tsoa';
import { APIResponse, APIStatus } from '../utils/Error';
import { BeepQueueTableEntry, GetBeeperQueueResult, SetBeeperQueueParams, SetBeeperStatusParams } from './beeper';

@Tags("Beeper")
@Route("beeper")
export class BeeperController extends Controller {

    @Security("token")
    @Post("status")
    public async setBeeperStatus (@Request() request: express.Request, @Body() requestBody: SetBeeperStatusParams): Promise<APIResponse> {
        const v = new Validator(requestBody, {
            singlesRate: "required|numeric",
            groupRate: "required|numeric",
            capacity: "required|numeric",
            isBeeping: "boolean",
            masksRequired: "boolean"
        });

        const matched = await v.check();

        if (!matched) {
            this.setStatus(422);
            return new APIResponse(APIStatus.Error, v.errors);
        }

        //if beeper is setting isBeeping to false
        if (requestBody.isBeeping == false) {
            //get beepers queue size
            const queueSize = await getQueueSize(request.user.id);
            //we must make sure their queue is empty before they stop beeping
            if (queueSize > 0) {
                this.setStatus(400);
                return new APIResponse(APIStatus.Error, "You can't stop beeping when you still have beeps to complete or riders in your queue");
            }
        }

        try {
            const result: WriteResult = await r.table('users').get(request.user.id).update({ isBeeping: requestBody.isBeeping, singlesRate: requestBody.singlesRate, groupRate: requestBody.groupRate, capacity: requestBody.capacity, masksRequired: requestBody.masksRequired }).run(conn);
            //TODO check result 
            //If there was no DB error, our update query was successful. return success with REST API
            this.setStatus(200);
            return new APIResponse(APIStatus.Success, "Successfully updated beeping status.");
        }
        catch (error) {
            Sentry.captureException(error);
            this.setStatus(500);
            return new APIResponse(APIStatus.Error, "Unable to set beeper status");
        }
    }


    @Security("token")
    @Post("queue")
    public async getBeeperQueue(@Request() request: express.Request): Promise<APIResponse | GetBeeperQueueResult> {
        try {
            //TODO whattt
            //@ts-ignore
            const result: BeepQueueTableEntry[] = await r.table(request.user.id).orderBy('timeEnteredQueue').run(connQueues);

            //for every entry in a beeper's queue, add personal info
            for (const doc of result) {
                //for every queue entry, add personal info of the rider
                doc['personalInfo'] = await getPersonalInfo(doc.riderid);
            }

            //after processing, send data.
            this.setStatus(200);
            return {
                'status': APIStatus.Success,
                'queue': result
            };
        }
        catch (error) {
            Sentry.captureException(error);
            this.setStatus(500);
            return new APIResponse(APIStatus.Error, "Unable to get beeper queue");
        }
    }


    @Security("token")
    @Post("queue/status")
    public async setBeeperQueue (@Request() request: express.Request, @Body() requestBody: SetBeeperQueueParams): Promise<APIResponse> {
        //if the beeper is accepting or denying a rider, run this code to ensure that beeper is
        //acceping or denying the rider that was first to request a ride (amung the isAccepted == false) beeps
        if (requestBody.value == 'accept' || requestBody.value == 'deny') {
            try {
                //in beeper's queue table, get the time the rider entered the queue
                //we need this to count the number of people before this rider in the queue
                const cursor = await r.table(request.user.id).filter({'riderid': requestBody.riderID}).pluck('timeEnteredQueue').run(connQueues);

                //resolve the query and get the time this rider entered the queue as a const
                const timeEnteredQueue = (await cursor.next()).timeEnteredQueue;

                //query to get rider's actual position in the queue
                const ridersQueuePosition = await r.table(request.user.id).filter(r.row('timeEnteredQueue').lt(timeEnteredQueue).and(r.row('isAccepted').eq(false))).count().run(connQueues);

                //if there are riders before this rider that have not been accepted,
                //tell the beeper they must respond to them first.
                if (ridersQueuePosition != 0) {
                    this.setStatus(400);
                    return new APIResponse(APIStatus.Error, "You must respond to the rider who first joined your queue.");
                }
            }
            catch (error) {
                Sentry.captureException(error);
                this.setStatus(500);
                return new APIResponse(APIStatus.Error, "Unable set beeper queue item");
            }
        }
        else {
            try {
                //in beeper's queue table, get the time the rider entered the queue
                //we need this to count the number of people before this rider in the queue
                const cursor = await r.table(request.user.id).filter({'riderid': requestBody.riderID}).pluck('timeEnteredQueue').run(connQueues);

                //resolve the query and get the time this rider entered the queue as a const
                const timeEnteredQueue = (await cursor.next()).timeEnteredQueue;

                //query to get rider's actual position in the queue
                const ridersQueuePosition = await r.table(request.user.id).filter(r.row('timeEnteredQueue').lt(timeEnteredQueue).and(r.row('isAccepted').eq(true))).count().run(connQueues);

                //if there are riders before this rider that have been accepted,
                //tell the beeper they must respond to them first.
                if (ridersQueuePosition != 0) {
                    this.setStatus(400);
                    return new APIResponse(APIStatus.Error, "You must respond to the rider who first joined your queue.");
                }
            }
            catch (error) {
                Sentry.captureException(error);
                return new APIResponse(APIStatus.Error, "Unable set beeper queue item");
            }
        }

        if (requestBody.value == 'accept') {
            try {
                const result: WriteResult = await r.table(request.user.id).get(requestBody.queueID).update({'isAccepted': true}).run(connQueues);

                //TODO check write result
                
                sendNotification(requestBody.riderID, "A beeper has accepted your beep request", "You will recieve another notification when they are on their way to pick you up.");

                return new APIResponse(APIStatus.Success, "Successfully accepted rider in queue.");
            }
            catch (error) {
                Sentry.captureException(error);
                this.setStatus(500);
                return new APIResponse(APIStatus.Error, "Unable set beeper queue item");
            }
        }
        else if (requestBody.value == 'deny' || requestBody.value == 'complete') {
            try {
                //delete entry in beeper's queues table
                const result: WriteResult = await r.table(request.user.id).get(requestBody.queueID).delete({ returnChanges: true }).run(connQueues);

                //ensure we actually deleted something
                if (result.deleted != 1) {
                    return new APIResponse(APIStatus.Error, "Nothing was deleted into beeper's queue table. This should not have happended...");
                }
                else {
                    const finishedBeep = result.changes[0].old_val;
                    finishedBeep.beepersid = request.user.id;

                    storeBeepEvent(finishedBeep);
                }
            }
            catch (error) {
                Sentry.captureException(error);
                this.setStatus(500);
                return new APIResponse(APIStatus.Error, "Unable set beeper queue item");
            }
            
            try {
                //decrease beeper's queue size
                const result: WriteResult = await r.table('users').get(request.user.id).update({'queueSize': r.row('queueSize').sub(1)}).run(conn);
                //handle any RethinkDB error
                //ensure we actually updated something
                if (result.replaced != 1) {
                    this.setStatus(500);
                    return new APIResponse(APIStatus.Error, "Nothing was changed in beeper's queue table. This should not have happended...");
                }
            }
            catch (error) {
                Sentry.captureException(error);
                this.setStatus(500);
                return new APIResponse(APIStatus.Error, "Unable set beeper queue item");
            }

            try {
                //set rider's inQueueOfUserID value to null because they are no longer in a queue
                const result: WriteResult = await r.table('users').get(requestBody.riderID).update({'inQueueOfUserID': null}).run(conn);
                //ensure we actually updated something
                if (result.replaced != 1) {
                    this.setStatus(500);
                    return new APIResponse(APIStatus.Error, "Nothing was changed in beeper's queue table. This should not have happended...");
                }
            }
            catch (error) {
                Sentry.captureException(error);
                this.setStatus(500);
                return new APIResponse(APIStatus.Error, "Unable set beeper queue item");
            }

            if (requestBody.value == "deny") {
                //if the command sent to the api was deny, let the rider know they were denied
                sendNotification(requestBody.riderID, "A beeper has denied your beep request", "Open your app to find a diffrent beeper.");
            }

            //if we reached this point, operation was successful
            this.setStatus(200);
            return new APIResponse(APIStatus.Success, "Successfully removed user from queue.");
        }
        else {
            try {
                //we can just increment the state number in the queue doccument
                const result: WriteResult = await r.table(request.user.id).get(requestBody.queueID).update({'state': r.row('state').add(1)}, {returnChanges: true}).run(connQueues);

                const newState = result.changes[0].new_val.state;

                switch(newState) {
                    case 1:
                        sendNotification(requestBody.riderID, "Your beeper is on their way!", "Your beepr is on their way to pick you up.");
                        break;
                    case 2:
                        sendNotification(requestBody.riderID, "Your beeper is here!", "Your beepr is here to pick you up.");
                        break;
                    case 3:
                        break;
                   default: 
                       Sentry.captureException("Our beeper's state notification switch statement reached a point that is should not have");
                }
                
                this.setStatus(200);
                return new APIResponse(APIStatus.Success, "Successfully changed ride state.");
            }
            catch (error) {
                Sentry.captureException(error);
                this.setStatus(500);
                return new APIResponse(APIStatus.Error, "Unable set beeper queue item");
            }
        }
    }
}
