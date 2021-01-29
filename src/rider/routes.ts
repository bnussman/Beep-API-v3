import express from 'express';
import * as r from 'rethinkdb';
import { Cursor } from 'rethinkdb';
import database from '../utils/db';
import { sendNotification } from '../utils/notifications';
import { Validator } from "node-input-validator";
import * as Sentry from "@sentry/node";
import { Response, Controller, Post, Route, Security, Tags, Request, Body, Get, Example, Patch, Delete } from 'tsoa';
import { BeeperListItem, BeeperListResult, ChooseBeepParams, ChooseBeepResponse, LeaveQueueParams, RiderStatusResult } from "./rider";
import { APIResponse, APIStatus } from '../utils/Error';
import { BeepORM } from '../app';
import { wrap } from '@mikro-orm/core';
import { User } from '../entities/User';
import { QueueEntry } from '../entities/QueueEntry';
import {ObjectId} from '@mikro-orm/mongodb';
    
@Tags("Rider")
@Route("rider")
export class RiderController extends Controller {

    /**
     * A user can use this 'rider' endpoint to to choose a beep to join their queue
     * This endpoint handles inserting into the queue table and updating user fields
     * @param {ChooseBeepParams} requestBody - The client must send their groupSize, origin and destination, and the beepersid
     * @returns {ChooseBeepResponse | APIResponse}
     */
    @Example<ChooseBeepResponse>({
        status: APIStatus.Success,
        beeper: new User()
    })
    @Response<APIResponse>(422, "Invalid Input", {
        status: APIStatus.Error, 
        message: {
            origin: {
                message: "The origin field is mandatory.",
                rule: "required"
            }
        }
    })
    @Response<APIResponse>(410, "Beeper is not beeping", {
        status: APIStatus.Error, 
        message: "The user you have chosen is no longer beeping at this time."
    })
    @Security("token")
    @Patch("choose")
    public async chooseBeep (@Request() request: express.Request, @Body() requestBody: ChooseBeepParams): Promise<ChooseBeepResponse | APIResponse> {
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

        const beeper: User | null = await BeepORM.userRepository.findOne(requestBody.beepersID);

        if (!beeper) {
            this.setStatus(500);
            return new APIResponse(APIStatus.Error, "Yikes");
        }

        //make sure beeper is still beeping. This case WILL happen because a beeper may turn off isBeeping and rider's client may have not updated
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

        beeper.queueSize++;
        await BeepORM.userRepository.persistAndFlush(beeper);

        //Tell Beeper someone entered their queue asyncronously
        sendNotification(beeper, "A rider has entered your queue", "Please open your app to accept or deny them.", "enteredBeeperQueue");

        //if we made it to this point, user has found a beep and it has been
        //registered in our db. Send output with nessesary data to rider.
        //Notice no need to send beeper's venmo of phone number because rider is not accepted as they just now joined the queue
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
    @Response<APIResponse>(200, "No body is beeping", {
        status: APIStatus.Error,
        message: "Nobody is beeping at the moment! Try to find a ride later."
    })
    @Security("token")
    @Get("find")
    public async findBeep (@Request() request: express.Request): Promise<APIResponse | ChooseBeepResponse> {
        const r = await BeepORM.userRepository.findOneOrFail({ isBeeping: true });

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
    @Example<RiderStatusResult>({
        beeper: new User(),
        origin: "place",
        destination: "other place",
        groupSize: 1,
        isAccepted: true,
        ridersQueuePosition: 0,
        state: 1,
        status: APIStatus.Success
    })
    @Response<APIResponse>(410, "User not found", {
        status: APIStatus.Error, 
        message: "You are trying to get your rider status of an account that no longer exists"
    })
    @Security("token")
    @Get("status")
    public async getRiderStatus (@Request() request: express.Request): Promise<APIResponse | RiderStatusResult> {
        const r = await BeepORM.queueEntryRepository.findOne({ rider: request.user.user }, {populate: true});

        if (!r) {
            this.setStatus(200);
            return new APIResponse(APIStatus.Error, "Currently, user is not getting a beep.");
        }


        //get rider's position in the queue by using a count query where we count entries where they entered the queue earlier
        //(they have an earlier timestamp)
        //const ridersQueuePosition = await r.table(beepersID).filter(r.row('timeEnteredQueue').lt(queueEntry.timeEnteredQueue).and(r.row('isAccepted').eq(true))).count().run((await database.getConnQueues()));
        const ridersQueuePosition = 0;

        let output: RiderStatusResult;

        if (r.isAccepted) {
            //if rider is accepted by beeper, give them data along with more personal info like full name and phone number
            output = {
                status: APIStatus.Success,
                groupSize: r.groupSize,
                isAccepted: r.isAccepted,
                ridersQueuePosition: ridersQueuePosition,
                state: r.state,
                origin: r.origin,
                destination: r.destination,
                beeper: r.beeper
            };
        }
        else {
            //rider is not yet accepted, give them info, but exclude less personal info
            output = {
                status: APIStatus.Success,
                groupSize: r.groupSize,
                isAccepted: r.isAccepted,
                origin: r.origin,
                destination: r.destination,
                beeper: r.beeper
            };
        }
        //respond with appropriate output
        return output;
    }

    /**
     * A user can remove themselves from a queue. 
     * We send beepersID so we can perfrom one less query to find that value
     * @param {LeaveQueueParams} requestBody - user sends the beepersID so we can skip the step of finding beeperID from users table
     * @returns {APIResponse}
     */
    @Example<APIResponse>({
        status: APIStatus.Success,
        message: "Successfully removed user from queue"
    })
    @Security("token")
    @Delete("leave")
    public async riderLeaveQueue (@Request() request: express.Request, @Body() requestBody: LeaveQueueParams): Promise<APIResponse> {

        const entry = await BeepORM.queueEntryRepository.findOne({ rider: request.user.user });

        if (!entry) {
            this.setStatus(500);
            return new APIResponse(APIStatus.Error, "Unable to leave queue");
        }
        
        entry.beeper.queueSize--;
        await BeepORM.userRepository.persistAndFlush(entry.beeper);

        await BeepORM.queueEntryRepository.removeAndFlush(entry);


        //if we made it to this point, we successfully removed a user from the queue.
        this.setStatus(200);
        return new APIResponse(APIStatus.Success, "Successfully removed user from queue");
    }
    
    /**
     * Provides client with a list of all people currently beeping
     * @returns {APIResponse | BeeperListResult}
     */
    /*
    @Example<BeeperListResult>({
        status: APIStatus.Success,
        beeperList: [{
            capacity: 4,
            first: "Banks",
            groupRate: 2,
            id: "22192b90-54f8-49b5-9dcf-26049454716b",
            isStudent: true,
            last: "Nussman",
            masksRequired: true,
            queueSize: 0,
            singlesRate: 3,
            userLevel: 0,
            photoUrl: "https://ridebeepapp.s3.amazonaws.com/images/22192b90-54f8-49b5-9dcf-26049454716b-1604517623067.jpg"
        }]
    })
    */
    @Get("list")
    public async getBeeperList(): Promise<APIResponse | BeeperListResult> {
        return {
            status: APIStatus.Success,
            beeperList: await BeepORM.userRepository.find({ isBeeping: true })
        };
    }
}
