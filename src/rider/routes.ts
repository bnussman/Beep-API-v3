import express from 'express';
import * as r from 'rethinkdb';
import { Cursor } from 'rethinkdb';
import { conn, connQueues } from '../utils/db';
import { sendNotification } from '../utils/notifications';
import { Validator } from "node-input-validator";
import * as Sentry from "@sentry/node";
import { Controller, Post, Route, Security, Tags, Request, Body, Get } from 'tsoa';
import { BeeperListItem, BeeperListResult, ChooseBeepParams, ChooseBeepResponse, LeaveQueueParams, RiderStatusResult } from "./rider";
import { APIResponse, APIStatus } from '../utils/Error';
    
@Tags("Rider")
@Route("rider")
export class RiderController extends Controller {

    @Security("token")
    @Post("choose")
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
       
        //get beeper's information
        const result = await r.table('users').get(requestBody.beepersID).pluck('first', 'last', 'queueSize', 'singlesRate', 'groupRate', 'isBeeping', 'capacity', 'isStudent', 'userLevel', 'masksRequired').run(conn);

        //make sure beeper is still beeping. This case WILL happen because a beeper may turn off isBeeping and rider's client may have not updated
        if (!result.isBeeping) {
            this.setStatus(410);
            return new APIResponse(APIStatus.Error, "The user you have chosen is no longer beeping at this time.");
        }

        //if there was no error, construct our new entry for beeper's queue table
        const newEntry = {
            'riderid': request.user.id,
            'timeEnteredQueue': Date.now(),
            'isAccepted': false,
            'groupSize': requestBody.groupSize,
            'origin': requestBody.origin,
            'destination': requestBody.destination,
            'state': 0
        };

        try {
            //insert newEntry into beeper's queue table
            r.table(requestBody.beepersID).insert(newEntry).run(connQueues);
        }
        catch (error) {
            //RethinkDB error while inserting beep entery into beeper's queue table
            Sentry.captureException(error);
            this.setStatus(500);
            return new APIResponse(APIStatus.Error, "Unable to choose beep");
        }

        try {
            //update beeper's queue size in the users table
            r.table('users').get(requestBody.beepersID).update({'queueSize': r.row('queueSize').add(1)}).run(conn);
        }
        catch (error) {
            //RethinkDB error while trying to increment beeper's queue size in the users table
            Sentry.captureException(error);
            this.setStatus(500);
            return new APIResponse(APIStatus.Error, "Unable to choose beep");
        }

        try {
            //update rider's inQueueOfUserID
            r.table('users').get(request.user.id).update({'inQueueOfUserID': requestBody.beepersID}).run(conn);
        }
        catch (error) {
            //unable to set inQueueOfUserID for rider in users table
            Sentry.captureException(error);
            this.setStatus(500);
            return new APIResponse(APIStatus.Error, "Unable to choose beep");
        }

        //Tell Beeper someone entered their queue asyncronously
        sendNotification(requestBody.beepersID, "A rider has entered your queue", "Please open your app to accept or deny them.", "enteredBeeperQueue");

        //if we made it to this point, user has found a beep and it has been
        //registered in our db. Send output with nessesary data to rider.
        //Notice no need to send beeper's venmo of phone number because rider is not accepted as they just now joined the queue
        this.setStatus(200);
        return {
            'status': APIStatus.Success,
            'beeper': {
                'id': requestBody.beepersID,
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
        };
    }
    
    @Security("token")
    @Post("find")
    public async findBeep (@Request() request: express.Request): Promise<APIResponse | ChooseBeepResponse> {
        //rethinkdb query to search users table (in acending order by queueSize) for users where isBeeping is true
        //and id is not equal to requester's, and limit by 1 to decide a riders beeper
        try {
            const cursor: Cursor = await r.table('users').orderBy({'index': 'queueSize'}).filter(r.row('isBeeping').eq(true).and(r.row('id').ne(request.user.id))).limit(1).run(conn);

            try {
                const result = await cursor.next();

                //if we made it to this point, user has found a beep and it has been
                //registered in our db. Send output with nessesary data to rider.
                return {
                    'status': APIStatus.Success,
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
                };
            }
            catch (error) {
                cursor.close();
                //If rethinkdb says there are not more rows, no one is beeping!
                if (error.msg == "No more rows in the cursor.") {
                    //close the RethinkDB cursor to prevent leak
                    //Return error to REST API
                    this.setStatus(200);
                    return new APIResponse(APIStatus.Error, "Nobody is beeping at the moment! Try to find a ride later.");
                }
                else {
                    //the error was proabably serious, log it
                    Sentry.captureException(error);
                    this.setStatus(500);
                    return new APIResponse(APIStatus.Error, "Unable to find beep");
                }
            }
        }
        catch (error) {
            Sentry.captureException(error);
            this.setStatus(500);
            return new APIResponse(APIStatus.Error, "Unable to find beep");
        }
    }

    @Security("token")
    @Post("status")
    public async getRiderStatus (@Request() request: express.Request): Promise<APIResponse | RiderStatusResult> {
        let result;

        //get rider's inQueueOfUserID in our user's db so we know what queue to look into
        try {
            result = await r.table('users').get(request.user.id).pluck('inQueueOfUserID').run(conn);
        } 
        catch (error) {
            //TODO: user's account was deleted, we need to somehow get the client to logout
            //keep in mind that getRiderStatus returns with error status code just because
            //rider is not in a queue
            this.setStatus(404);
            return new APIResponse(APIStatus.Error, "You are trying to get your rider status of an account that no longer exists");
        }

        //we will be using the rider's beeper's id a lot, so make it a const
        const beepersID = result.inQueueOfUserID;

        //if user is in a queue...
        if (beepersID) {
            try {
                //since we are in a queue, we need to find the db entry where the rider has you id
                const result = await r.table(beepersID).filter({ riderid: request.user.id }).run(connQueues);

                //resolve the next element so we have a const of the db entry
                const queueEntry = await result.next();

                //get rider's position in the queue by using a count query where we count entries where they entered the queue earlier
                //(they have an earlier timestamp)
                const ridersQueuePosition = await r.table(beepersID).filter(r.row('timeEnteredQueue').lt(queueEntry.timeEnteredQueue).and(r.row('isAccepted').eq(true))).count().run(connQueues);

                //get beeper's information
                const beepersInfo = await r.table('users').get(beepersID).pluck('first', 'last', 'phone', 'venmo', 'singlesRate', 'groupRate', 'queueSize', 'userLevel', 'isStudent', 'capacity', 'masksRequired').run(conn);

                let output: RiderStatusResult;

                if (queueEntry.isAccepted) {
                    //if rider is accepted by beeper, give them data along with more personal info like full name and phone number
                    output = {
                        "status": APIStatus.Success,
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
                        "status": APIStatus.Success,
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
                return output;
            }
            catch (error) {
                Sentry.captureException(error);
                this.setStatus(500);
                return new APIResponse(APIStatus.Error, "Unable to get rider status");
            }
        }
        else {
            //if beeper's id is not defined, they are not getting a beep
            this.setStatus(200);
            return new APIResponse(APIStatus.Error, "Currently, user is not getting a beep.");
        }
    }

    @Security("token")
    @Post("leave")
    public async riderLeaveQueue (@Request() request: express.Request, @Body() requestBody: LeaveQueueParams): Promise<APIResponse> {
        try {
            //delete entry in beeper's queue table
            r.table(requestBody.beepersID).filter({'riderid': request.user.id}).delete().run(connQueues);
        }
        catch (error) {
            Sentry.captureException(error);
            this.setStatus(500);
            return new APIResponse(APIStatus.Error, "Unable to leave queue");
        }
        
        try {
            //decreace beeper's queue size
            r.table('users').get(requestBody.beepersID).update({'queueSize': r.row('queueSize').sub(1)}).run(conn);
        }
        catch (error) {
            Sentry.captureException(error);
            this.setStatus(500);
            return new APIResponse(APIStatus.Error, "Unable to leave queue");
        }

        try {
            //set rider's inQueueOfUserID value to null because they are no longer in a queue
            r.table('users').get(request.user.id).update({'inQueueOfUserID': null}).run(conn);
        }
        catch (error) {
            Sentry.captureException(error);
            this.setStatus(500);
            return new APIResponse(APIStatus.Error, "Unable to leave queue");
        }

        //if we made it to this point, we successfully removed a user from the queue.
        this.setStatus(200);
        return new APIResponse(APIStatus.Success, "Successfully removed user from queue");
    }

    @Get("list")
    public async getBeeperList(): Promise<APIResponse | BeeperListResult> {
        try {
            const cursor: Cursor = await r.table("users").filter({ isBeeping: true }).pluck('first', 'last', 'queueSize', 'id', 'singlesRate', 'groupRate', 'capacity', 'userLevel', 'isStudent', 'masksRequired').run(conn);

            const list: BeeperListItem[] = await cursor.toArray();

            this.setStatus(200);
            return {
                "status": APIStatus.Success,
                "beeperList": list
            };
        }
        catch (error) {
            Sentry.captureException(error);
            this.setStatus(500);
            return new APIResponse(APIStatus.Error, "Unable to get beeper list");
        }
    }
}
