import * as express from 'express';
import * as r from 'rethinkdb';
import { WriteResult } from 'rethinkdb';
import database from '../utils/db';
import { sendNotification } from '../utils/notifications';
import { getQueueSize, getPersonalInfo, storeBeepEvent } from './helpers';
import { Validator } from 'node-input-validator';
import * as Sentry from "@sentry/node";
import { Response, Controller, Request, Body, Tags, Security, Post, Route, Example, Get, Patch } from 'tsoa';
import { APIResponse, APIStatus } from '../utils/Error';
import { BeepQueueTableEntry, GetBeeperQueueResult, SetBeeperQueueParams, SetBeeperStatusParams } from './beeper';
import {wrap} from '@mikro-orm/core';
import {BeepORM} from '../app';
import {ObjectId} from '@mikro-orm/mongodb';
import { User } from '../entities/User';

@Tags("Beeper")
@Route("beeper")
export class BeeperController extends Controller {

    /**
     * Users use this to set if they are beeping or not
     * It also allows them to update their rates and mask settings
     * @param {SetBeeperStatusParams} requestBody - client sends rates, isBeeping status, mask setting, and capacity
     * @returns {APIResponse} 
     */
    @Example<APIResponse>({
        status: APIStatus.Success,
        message: "Successfully updated beeping status."
    })
    @Response<APIResponse>(400, "Bad Request", {
        status: APIStatus.Error, 
        message: "You can't stop beeping when you still have beeps to complete or riders in your queue"
    })
    @Response<APIResponse>(422, "Validation Error", {
        status: APIStatus.Error,
        message: {
            singlesRate: {
                message: "The singles rate must be a number.",
                rule: "numeric"
            }
        }
    })
    @Response<APIResponse>(500, "Server Error", {
        status: APIStatus.Error, 
        message: "Unable to set beeper status"
    })
    @Security("token")
    @Patch("status")
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
            const queueSize = request.user.user.queueSize;
            //we must make sure their queue is empty before they stop beeping
            if (queueSize > 0) {
                this.setStatus(400);
                return new APIResponse(APIStatus.Error, "You can't stop beeping when you still have beeps to complete or riders in your queue");
            }
        }

        wrap(request.user.user).assign(requestBody);

        await BeepORM.userRepository.persistAndFlush(request.user.user);

        this.setStatus(200);
        return new APIResponse(APIStatus.Success, "Successfully updated beeping status.");
    }


    /**
     * User calls this to get there queue when beeping.
     * Our Socket server is responcible for telling a client a change occoured, it will prompt
     * a call to this endpoint to get the queue and data
     * @returns {GetBeeperQueueResult} 
     */
    @Example<GetBeeperQueueResult>({
        status: APIStatus.Success,
        queue: [
            {
                beeper: new User(),
                destination: "Tasty",
                groupSize: 1,
                id: new ObjectId(),
                isAccepted: true,
                origin: "241 Marich Ln Marich Ln Boone, NC 28607",
                rider: new User(),
                state: 0,
                timeEnteredQueue: 1603318791872
            }
        ]
    })
    @Response<APIResponse>(500, "Server Error", {
        status: APIStatus.Error, 
        message: "Unable to get beeper queue"
    })
    @Security("token")
    @Get("queue")
    public async getBeeperQueue(@Request() request: express.Request): Promise<APIResponse | GetBeeperQueueResult> {

        const result = await BeepORM.queueEntryRepository.find({ beeper: request.user.user });

        //after processing, send data.
        this.setStatus(200);
        return {
            status: APIStatus.Success,
            queue: result
        };
    }
    
    /**
     * A beeper calls this to set the status of one entry in their queue
     * @param {SetBeeperQueueParams} requestBody - beeper sends the status they want to set, the rider's id, and the queue entry id
     * @returns {APIResponse}
     */
    /*
    @Example<APIResponse>({
        status: APIStatus.Success,
        message: "Successfully removed user from queue."
    })
    @Response<APIResponse>(400, "Bad Request", {
        status: APIStatus.Error, 
        message: "You must respond to the rider who first joined your queue."
    })
    @Response<APIResponse>(500, "Server Error", {
        status: APIStatus.Error, 
        message: "Unable to set beeper status"
    })
    @Security("token")
    @Patch("queue/status")
    public async setBeeperQueue (@Request() request: express.Request, @Body() requestBody: SetBeeperQueueParams): Promise<APIResponse> {
        //if the beeper is accepting or denying a rider, run this code to ensure that beeper is
        //acceping or denying the rider that was first to request a ride (amung the isAccepted == false) beeps
        if (requestBody.value == 'accept' || requestBody.value == 'deny') {
            try {
                //in beeper's queue table, get the time the rider entered the queue
                //we need this to count the number of people before this rider in the queue
                const cursor = await r.table(request.user.id).filter({'riderid': requestBody.riderID}).pluck('timeEnteredQueue').run((await database.getConnQueues()));

                //const a = await BeepORM.queueEntryRepository.findOne({ rider: requestBody.riderID, beeper: request.user.user });

                //resolve the query and get the time this rider entered the queue as a const
                const timeEnteredQueue = a?.timeEnteredQueue;

                //const b = await BeepORM.queueEntryRepository.count();

                //query to get rider's actual position in the queue
                const ridersQueuePosition = await r.table(request.user.id).filter(r.row('timeEnteredQueue').lt(timeEnteredQueue).and(r.row('isAccepted').eq(false))).count().run((await database.getConnQueues()));

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
                const cursor = await r.table(request.user.id).filter({'riderid': requestBody.riderID}).pluck('timeEnteredQueue').run((await database.getConnQueues()));

                //resolve the query and get the time this rider entered the queue as a const
                const timeEnteredQueue = (await cursor.next()).timeEnteredQueue;

                //query to get rider's actual position in the queue
                const ridersQueuePosition = await r.table(request.user.id).filter(r.row('timeEnteredQueue').lt(timeEnteredQueue).and(r.row('isAccepted').eq(true))).count().run((await database.getConnQueues()));

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
                const result: WriteResult = await r.table(request.user.id).get(requestBody.queueID).update({'isAccepted': true}).run((await database.getConnQueues()));

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
                const result: WriteResult = await r.table(request.user.id).get(requestBody.queueID).delete({ returnChanges: true }).run((await database.getConnQueues()));

                //ensure we actually deleted something
                if (result.deleted != 1) {
                    return new APIResponse(APIStatus.Error, "Nothing was deleted into beeper's queue table. This should not have happended...");
                }
                else {
                    const finishedBeep = result.changes[0].old_val;
                    finishedBeep.beepersid = request.user.id;
                    finishedBeep.doneTime = Date.now();

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
                const result: WriteResult = await r.table('users').get(request.user.id).update({'queueSize': r.row('queueSize').sub(1)}).run((await database.getConn()));
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
                const result: WriteResult = await r.table('users').get(requestBody.riderID).update({'inQueueOfUserID': null}).run((await database.getConn()));
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
                const result: WriteResult = await r.table(request.user.id).get(requestBody.queueID).update({'state': r.row('state').add(1)}, {returnChanges: true}).run((await database.getConnQueues()));

                const newState = result.changes[0].new_val.state;

                switch(newState) {
                    case 1:
                        sendNotification(requestBody.riderID, "Your beeper is on their way!", "Your beeper is on their way to pick you up.");
                        break;
                    case 2:
                        sendNotification(requestBody.riderID, "Your beeper is here!", "Your beeper is here to pick you up.");
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
    */
}
