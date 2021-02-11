import express from 'express';
import { sendNotification } from '../utils/notifications';
import { Validator } from "node-input-validator";
import * as Sentry from "@sentry/node";
import { BeeperListResult, ChooseBeepParams, ChooseBeepResponse, RiderStatusResult } from "./rider";
import { APIResponse, APIStatus } from '../utils/Error';
import { BeepORM } from '../app';
import { QueryOrder, wrap } from '@mikro-orm/core';
import { QueueEntry } from '../entities/QueueEntry';
    
export class RiderController {

    public async chooseBeep(request: express.Request, requestBody: ChooseBeepParams): Promise<ChooseBeepResponse | APIResponse> {
        const v = new Validator(requestBody, {
            groupSize: "required|numeric",
            origin: "required",
            destination: "required",
        });

        const matched = await v.check();

        if (!matched) {
            return new APIResponse(APIStatus.Error, v.errors);
        }

        const beeper = await BeepORM.userRepository.findOne(requestBody.beepersID);

        if (!beeper) {
            return new APIResponse(APIStatus.Error, "Beeper not found");
        }

        if (!beeper.isBeeping) {
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

        return {
            status: APIStatus.Success,
            beeper: beeper
        };
    }
    
    public async findBeep(): Promise<APIResponse | ChooseBeepResponse> {
        const r = await BeepORM.userRepository.findOne({ isBeeping: true });

        if (!r) {
            return new APIResponse(APIStatus.Error, "Nobody is beeping right now!");
        }

        return {
            status: APIStatus.Success,
            beeper: r
        };
    }

    public async getRiderStatus(request: express.Request): Promise<APIResponse | RiderStatusResult> {
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

    public async riderLeaveQueue(request: express.Request): Promise<APIResponse> {

        const entry = await BeepORM.queueEntryRepository.findOne({ rider: request.user.user });

        if (!entry) {
            return new APIResponse(APIStatus.Error, "Unable to leave queue");
        }

        if (entry.isAccepted) entry.beeper.queueSize--;

        await BeepORM.userRepository.persistAndFlush(entry.beeper);

        entry.state = -1;

        await BeepORM.queueEntryRepository.persistAndFlush(entry);

        sendNotification(entry.beeper, `${request.user.user.name} left your queue`, "They decided they did not want a beep from you! :(");

        return new APIResponse(APIStatus.Success, "Successfully removed user from queue");
    }
    
    public async getBeeperList(): Promise<APIResponse | BeeperListResult> {
        return {
            status: APIStatus.Success,
            beepers: await BeepORM.userRepository.find({ isBeeping: true })
        };
    }
}
