import express from 'express';
import { sendNotification } from '../utils/notifications';
import { Validator } from "node-input-validator";
import * as Sentry from "@sentry/node";
import { Controller, Route, Security, Tags, Request, Body, Get, Patch, Delete } from 'tsoa';
import { BeeperListResult, ChooseBeepParams, ChooseBeepResponse, RiderStatusResult } from "./rider";
import { APIResponse, APIStatus } from '../utils/Error';
import { BeepORM } from '../app';
import { QueryOrder, wrap } from '@mikro-orm/core';
import { QueueEntry } from '../entities/QueueEntry';
    
@Tags("Rider")
@Route("rider")
export class RiderController extends Controller {

    /**
     * A user can use this 'rider' endpoint to to choose a beep to join their queue
     * This endpoint handles inserting into the queue table and updating user fields
     * @param {ChooseBeepParams} requestBody - The client must send their groupSize, origin and destination, and the beepersid
     * @returns {ChooseBeepResponse | APIResponse}
     */
    @Security("token")
    @Patch("choose")
    public async chooseBeep(@Request() request: express.Request, @Body() requestBody: ChooseBeepParams): Promise<ChooseBeepResponse | APIResponse> {
        const v = new Validator(requestBody, {
            groupSize: "required|numeric",
            origin: "required",
            destination: "required",
        });

        const matched = await v.check();

        if (!matched) {
            this.setStatus(422);
            return new APIResponse(APIStatus.Error, v.errors);
        }

        const beeper = await BeepORM.userRepository.findOne(requestBody.beepersID);

        if (!beeper) {
            this.setStatus(500);
            return new APIResponse(APIStatus.Error, "Beeper not found");
        }

        if (!beeper.isBeeping) {
            this.setStatus(410);
            return new APIResponse(APIStatus.Error, "The user you have chosen is no longer beeping at this time.");
        }

        const entry = {
            timeEnteredQueue: Date.now(),
            isAccepted: false,
            groupSize: requestBody.groupSize,
            origin: requestBody.origin,
            destination: requestBody.destination,
            state: 0,
            rider: request.user.user
        };

        const q = new QueueEntry();

        wrap(q).assign(entry, { em: BeepORM.em });

        beeper.queue.add(q);

        await BeepORM.userRepository.persistAndFlush(beeper);

        sendNotification(beeper, `${request.user.user.name} has entered your queue`, "Please open your app to accept or deny this rider.", "enteredBeeperQueue");

        this.setStatus(200);
        return {
            status: APIStatus.Success,
            beeper: beeper
        };
    }
    
    /**
     * The endpoint will serve the user with data of the most avalible beeper
     * This will NOT initiate a beep, but will simplily give the client data of an avalible beeper
     * @returns {ChooseBeepResponse | APIResponse}
     */
    @Security("token")
    @Get("find")
    public async findBeep(): Promise<APIResponse | ChooseBeepResponse> {
        const r = await BeepORM.userRepository.findOne({ isBeeping: true });

        if (!r) {
            this.setStatus(404);
            return new APIResponse(APIStatus.Error, "Nobody is beeping right now!");
        }

        return {
            status: APIStatus.Success,
            beeper: r
        };
    }

    /**
     * Gets the current status as a rider at any given time. This is how they know anything about their current beep
     * Our socket currently will tell clients a change happend, and this endpoint will be called to get the data
     * @returns {RiderStatusResult | APIResponse}
     */
    @Security("token")
    @Get("status")
    public async getRiderStatus(@Request() request: express.Request): Promise<APIResponse | RiderStatusResult> {
        const entry = await BeepORM.queueEntryRepository.findOne({ rider: request.user.user }, { populate: ['beeper'] });

        if (!entry) {
            return new APIResponse(APIStatus.Error, "Currently, user is not getting a beep.");
        }

        if (entry.state == -1) {
            return new APIResponse(APIStatus.Error, "Currently, user is not getting a beep.");
        }


        const ridersQueuePosition = await BeepORM.queueEntryRepository.count({ beeper: entry.beeper, timeEnteredQueue: { $lt: entry.timeEnteredQueue } });

        const output = {
            status: APIStatus.Success,
            ridersQueuePosition: ridersQueuePosition,
            ...entry
        };

        if (entry.state == 1) {
            const location = await BeepORM.locationRepository.findOne({ user: entry.beeper }, {}, { timestamp: QueryOrder.DESC });
            if (location) {
                //@ts-ignore
                output['beeper']['location'] = location;
            }
        }

        return output;
    }

    /**
     * A user can remove themselves from a queue. 
     * We send beepersID so we can perfrom one less query to find that value
     * @param {LeaveQueueParams} requestBody - user sends the beepersID so we can skip the step of finding beeperID from users table
     * @returns {APIResponse}
     */
    @Security("token")
    @Delete("leave")
    public async riderLeaveQueue(@Request() request: express.Request): Promise<APIResponse> {

        const entry = await BeepORM.queueEntryRepository.findOne({ rider: request.user.user });

        if (!entry) {
            this.setStatus(500);
            return new APIResponse(APIStatus.Error, "Unable to leave queue");
        }

        if (entry.isAccepted) entry.beeper.queueSize--;

        await BeepORM.userRepository.persistAndFlush(entry.beeper);

        entry.state = -1;

        await BeepORM.queueEntryRepository.persistAndFlush(entry);

        sendNotification(entry.beeper, `${request.user.user.name} left your queue`, "They decided they did not want a beep from you! :(");

        this.setStatus(200);
        return new APIResponse(APIStatus.Success, "Successfully removed user from queue");
    }
    
    /**
     * Provides client with a list of all people currently beeping
     * @returns {BeeperListResult | APIResponse}
     */
    @Get("list")
    public async getBeeperList(): Promise<APIResponse | BeeperListResult> {
        return {
            status: APIStatus.Success,
            beepers: await BeepORM.userRepository.find({ isBeeping: true })
        };
    }
}
