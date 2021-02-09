import * as express from 'express';
import { sendNotification } from '../utils/notifications';
import { Validator } from 'node-input-validator';
import * as Sentry from "@sentry/node";
import { Response, Controller, Request, Body, Tags, Security, Route, Example, Get, Patch } from 'tsoa';
import { APIResponse, APIStatus } from '../utils/Error';
import { GetBeeperQueueResult, SetBeeperQueueParams, SetBeeperStatusParams } from './beeper';
import { wrap } from '@mikro-orm/core';
import { BeepORM } from '../app';
import { Beep } from '../entities/Beep';

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
    /*
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
    */
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
        const queueEntry = await BeepORM.queueEntryRepository.findOneOrFail(requestBody.queueID, { populate: true });

        if (requestBody.value == 'accept' || requestBody.value == 'deny') {
            const numRidersBefore = await BeepORM.queueEntryRepository.count({ timeEnteredQueue: { $lt: queueEntry.timeEnteredQueue }, isAccepted: false });

            if (numRidersBefore != 0) {
                this.setStatus(400);
                return new APIResponse(APIStatus.Error, "You must respond to the rider who first joined your queue.");
            }
        }
        else {
            const numRidersBefore = await BeepORM.queueEntryRepository.count({ timeEnteredQueue: { $lt: queueEntry.timeEnteredQueue }, isAccepted: true });

            if (numRidersBefore != 0) {
                this.setStatus(400);
                return new APIResponse(APIStatus.Error, "You must respond to the rider who first joined your queue.");
            }
        }

        if (requestBody.value == 'accept') {
            queueEntry.isAccepted = true;

            request.user.user.queueSize++;

            sendNotification(queueEntry.rider, "A beeper has accepted your beep request", "You will recieve another notification when they are on their way to pick you up.");

            await BeepORM.queueEntryRepository.persistAndFlush(queueEntry);
            await BeepORM.userRepository.persistAndFlush(request.user.user);

            return new APIResponse(APIStatus.Success, "Successfully accepted rider in queue.");
        }
        else if (requestBody.value == 'deny' || requestBody.value == 'complete') {
            const finishedBeep = new Beep();

            wrap(finishedBeep).assign(queueEntry, { em: BeepORM.em });

            finishedBeep.doneTime = Date.now();

            finishedBeep._id = queueEntry._id;
            finishedBeep.id = queueEntry.id;

            await BeepORM.beepRepository.persistAndFlush(finishedBeep);

            if (queueEntry.isAccepted) request.user.user.queueSize--;

            await BeepORM.userRepository.persistAndFlush(request.user.user);

            queueEntry.state = -1;

            await BeepORM.queueEntryRepository.persistAndFlush(queueEntry);

            if (requestBody.value == "deny") {
                sendNotification(queueEntry.rider, "A beeper has denied your beep request", "Open your app to find a diffrent beeper.");
            }

            //if we reached this point, operation was successful
            this.setStatus(200);
            return new APIResponse(APIStatus.Success, "Successfully removed user from queue.");
        }
        else {
            queueEntry.state++;

            switch(queueEntry.state) {
                case 1:
                    sendNotification(queueEntry.rider, "Your beeper is on their way!", "Your beeper is on their way to pick you up.");
                break;
                case 2:
                    sendNotification(queueEntry.rider, "Your beeper is here!", "Your beeper is here to pick you up.");
                break;
                case 3:
                    break;
                default: 
                    Sentry.captureException("Our beeper's state notification switch statement reached a point that is should not have");
            }

            await BeepORM.queueEntryRepository.persistAndFlush(queueEntry);

            this.setStatus(200);
            return new APIResponse(APIStatus.Success, "Successfully changed ride state.");
        }
    }
}
