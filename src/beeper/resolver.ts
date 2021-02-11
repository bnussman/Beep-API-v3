import * as express from 'express';
import { sendNotification } from '../utils/notifications';
import { Validator } from 'node-input-validator';
import * as Sentry from "@sentry/node";
import { APIResponse, APIStatus } from '../utils/Error';
import { GetBeeperQueueResult, SetBeeperQueueParams, SetBeeperStatusParams } from './beeper';
import { wrap } from '@mikro-orm/core';
import { BeepORM } from '../app';
import { Beep } from '../entities/Beep';

export class BeeperController {

    public async setBeeperStatus(request: express.Request, requestBody: SetBeeperStatusParams): Promise<APIResponse> {
        const v = new Validator(requestBody, {
            singlesRate: "required|numeric",
            groupRate: "required|numeric",
            capacity: "required|numeric",
            isBeeping: "boolean",
            masksRequired: "boolean"
        });

        const matched = await v.check();

        if (!matched) {
            return new APIResponse(APIStatus.Error, v.errors);
        }

        if ((requestBody.isBeeping == false) && (request.user.user.queueSize > 0)) {
            return new APIResponse(APIStatus.Error, "You can't stop beeping when you still have beeps to complete or riders in your queue");
        }

        wrap(request.user.user).assign(requestBody);

        await BeepORM.userRepository.persistAndFlush(request.user.user);

        return new APIResponse(APIStatus.Success, "Successfully updated beeping status");
    }

    public async getBeeperQueue(request: express.Request): Promise<APIResponse | GetBeeperQueueResult> {
        return {
            status: APIStatus.Success,
            queue: await BeepORM.queueEntryRepository.find({ beeper: request.user.user })
        };
    }
    
    public async setBeeperQueue(request: express.Request, requestBody: SetBeeperQueueParams): Promise<APIResponse> {
        const queueEntry = await BeepORM.queueEntryRepository.findOneOrFail(requestBody.queueID, { populate: true });

        if (requestBody.value == 'accept' || requestBody.value == 'deny') {
            const numRidersBefore = await BeepORM.queueEntryRepository.count({ timeEnteredQueue: { $lt: queueEntry.timeEnteredQueue }, isAccepted: false });

            if (numRidersBefore != 0) {
                return new APIResponse(APIStatus.Error, "You must respond to the rider who first joined your queue.");
            }
        }
        else {
            const numRidersBefore = await BeepORM.queueEntryRepository.count({ timeEnteredQueue: { $lt: queueEntry.timeEnteredQueue }, isAccepted: true });

            if (numRidersBefore != 0) {
                return new APIResponse(APIStatus.Error, "You must respond to the rider who first joined your queue.");
            }
        }

        if (requestBody.value == 'accept') {
            queueEntry.isAccepted = true;

            request.user.user.queueSize++;

            sendNotification(queueEntry.rider, `${request.user.user.name} has accepted your beep request`, "You will recieve another notification when they are on their way to pick you up.");

            BeepORM.queueEntryRepository.persist(queueEntry);
            BeepORM.userRepository.persist(request.user.user);

            await BeepORM.em.flush();

            return new APIResponse(APIStatus.Success, "Successfully accepted rider in queue.");
        }
        else if (requestBody.value == 'deny' || requestBody.value == 'complete') {
            const finishedBeep = new Beep();

            wrap(finishedBeep).assign(queueEntry, { em: BeepORM.em });

            finishedBeep.doneTime = Date.now();

            finishedBeep._id = queueEntry._id;
            finishedBeep.id = queueEntry.id;

            BeepORM.beepRepository.persist(finishedBeep);

            if (queueEntry.isAccepted) request.user.user.queueSize--;

            BeepORM.userRepository.persist(request.user.user);

            queueEntry.state = -1;

            BeepORM.queueEntryRepository.persist(queueEntry);

            await BeepORM.em.flush();

            if (requestBody.value == "deny") {
                sendNotification(queueEntry.rider, `${request.user.user.name} has denied your beep request`, "Open your app to find a diffrent beeper.");
            }

            return new APIResponse(APIStatus.Success, "Successfully removed user from queue.");
        }
        else {
            queueEntry.state++;

            switch(queueEntry.state) {
                case 1:
                    sendNotification(queueEntry.rider, `${request.user.user.name} is on their way!`, "Your beeper is on their way to pick you up.");
                break;
                case 2:
                    sendNotification(queueEntry.rider, `${request.user.user.name} is here!`, "Your beeper is here to pick you up.");
                break;
                case 3:
                    break;
                default: 
                    Sentry.captureException("Our beeper's state notification switch statement reached a point that is should not have");
            }

            await BeepORM.queueEntryRepository.persistAndFlush(queueEntry);

            return new APIResponse(APIStatus.Success, "Successfully changed ride state.");
        }
    }
}
