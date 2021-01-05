import express from 'express';
import * as r from 'rethinkdb';
import { Cursor } from 'rethinkdb';
import database from '../utils/db';
import { sendNotification } from '../utils/notifications';
import { Validator } from "node-input-validator";
import * as Sentry from "@sentry/node";
import { Response, Controller, Route, Security, Tags, Request, Body, Get, Example, Patch, Delete } from 'tsoa';
import { BeeperListItem, BeeperListResult, ChooseBeepParams, ChooseBeepResponse, LeaveQueueParams, RiderStatusResult } from "./rider";
import { APIResponse, APIStatus } from '../utils/Error';
import { getUsersCurrentLocation } from './helpers';
    
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
        beeper: {
            capacity: 4,
            first: "Banks",
            groupRate: "2",
            id: "22192b90-54f8-49b5-9dcf-26049454716b",
            isStudent: true,
            last: "Nussman",
            masksRequired: true,
            queueSize: 1,
            singlesRate: "3",
            userLevel: 0,
            photoUrl: "https://ridebeepapp.s3.amazonaws.com/images/22192b90-54f8-49b5-9dcf-26049454716b-1604517623067.jpg"
        }
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
       
        //get beeper's information
        const result = await r.table('users').get(requestBody.beepersID).pluck('first', 'last', 'queueSize', 'singlesRate', 'groupRate', 'isBeeping', 'capacity', 'isStudent', 'userLevel', 'masksRequired', 'photoUrl').run((await database.getConn()));

        //make sure beeper is still beeping. This case WILL happen because a beeper may turn off isBeeping and rider's client may have not updated
        if (!result.isBeeping) {
            this.setStatus(410);
            return new APIResponse(APIStatus.Error, "The user you have chosen is no longer beeping at this time.");
        }

        //if there was no error, construct our new entry for beeper's queue table
        const newEntry = {
            riderid: request.user.id,
            timeEnteredQueue: Date.now(),
            isAccepted: false,
            groupSize: requestBody.groupSize,
            origin: requestBody.origin,
            destination: requestBody.destination,
            state: 0
        };

        try {
            //insert newEntry into beeper's queue table
            await r.table(requestBody.beepersID).insert(newEntry).run((await database.getConnQueues()));
        }
        catch (error) {
            //RethinkDB error while inserting beep entery into beeper's queue table
            Sentry.captureException(error);
            this.setStatus(500);
            return new APIResponse(APIStatus.Error, "Unable to choose beep");
        }

        try {
            //update rider's inQueueOfUserID
            await r.table('users').get(request.user.id).update({'inQueueOfUserID': requestBody.beepersID}).run((await database.getConn()));
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
            status: APIStatus.Success,
            beeper: { id: requestBody.beepersID, ...result }
        };
    }
    
    /**
     * The endpoint will serve the user with data of the most avalible beeper
     * This will NOT initiate a beep, but will simplily give the client data of an avalible beeper
     * @returns {ChooseBeepResponse | APIResponse}
     */
    @Example<ChooseBeepResponse>({
        status: APIStatus.Success,
        beeper: {
            capacity: 4,
            first: "Banks",
            groupRate: "2",
            id: "22192b90-54f8-49b5-9dcf-26049454716b",
            isStudent: true,
            last: "Nussman",
            masksRequired: true,
            queueSize: 1,
            singlesRate: "3",
            userLevel: 0,
            photoUrl: "https://ridebeepapp.s3.amazonaws.com/images/22192b90-54f8-49b5-9dcf-26049454716b-1604517623067.jpg"
        }
    })
    @Response<APIResponse>(200, "No body is beeping", {
        status: APIStatus.Error,
        message: "Nobody is beeping at the moment! Try to find a ride later."
    })
    @Security("token")
    @Get("find")
    public async findBeep(@Request() request: express.Request): Promise<APIResponse | ChooseBeepResponse> {
        const items: string[] = ['id', 'first', 'last', 'queueSize', 'singlesRate', 'groupRate', 'capacity', 'userLevel', 'isStudent', 'masksRequired', 'photoUrl'];
        //rethinkdb query to search users table (in acending order by queueSize) for users where isBeeping is true
        //and id is not equal to requester's, and limit by 1 to decide a riders beeper
        try {
            const cursor: Cursor = await r.table('users').orderBy({'index': 'queueSize'}).filter(r.row('isBeeping').eq(true).and(r.row('id').ne(request.user.id))).pluck(...items).limit(1).run((await database.getConn()));

            try {
                const result = await cursor.next();

                //if we made it to this point, user has found a beep and it has been
                //registered in our db. Send output with nessesary data to rider.
                return {
                    status: APIStatus.Success,
                    beeper: { ...result }
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

    /**
     * Gets the current status as a rider at any given time. This is how they know anything about their current beep
     * Our socket currently will tell clients a change happend, and this endpoint will be called to get the data
     * @returns {RiderStatusResult | APIResponse}
     */
    @Example<RiderStatusResult>({
        beeper: {
            capacity: 4,
            first: "Banks",
            groupRate: "2",
            id: "22192b90-54f8-49b5-9dcf-26049454716b",
            isStudent: true,
            last: "Nussman",
            masksRequired: true,
            phone: "7049968597",
            queueSize: 1,
            singlesRate: "3",
            userLevel: 0,
            venmo: "banksnussman",
            photoUrl: "https://ridebeepapp.s3.amazonaws.com/images/22192b90-54f8-49b5-9dcf-26049454716b-1604517623067.jpg"
        },
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
    public async getRiderStatus(@Request() request: express.Request): Promise<APIResponse | RiderStatusResult> {
        let result;

        //get rider's inQueueOfUserID in our user's db so we know what queue to look into
        try {
            result = await r.table('users').get(request.user.id).pluck('inQueueOfUserID').run((await database.getConn()));
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
        if (beepersID != null) {
            try {
                //since we are in a queue, we need to find the db entry where the rider has you id
                const cursor = await r.table(beepersID).filter({ riderid: request.user.id }).run((await database.getConnQueues()));
                
                let queueEntry = null;
                
                try {
                    //resolve the next element so we have a const of the db entry
                    queueEntry = await cursor.next();
                }
                catch (error) {
                    //if is no "next" entry exists in beeper's queue table, no way rider is in their queue or getting or a beep
                    //if we hit this error, this means that the db says that the rider still has beeper's id in their user's table row.
                    //Because rider is expected to be in a queue, when we try to get the entry from the beeper's queue table, it is not there because
                    //it has since then been deleted. We can conclude that the rider is not getting a beep
                    this.setStatus(200);
                    return new APIResponse(APIStatus.Error, "Currently, user is not getting a beep.");
                }

                //get rider's position in the queue by using a count query where we count entries where they entered the queue earlier
                //(they have an earlier timestamp)
                const ridersQueuePosition = await r.table(beepersID).filter(r.row('timeEnteredQueue').lt(queueEntry.timeEnteredQueue)).count().run((await database.getConnQueues()));

                let keys: string[];

                if (queueEntry.isAccepted) {
                    keys = ['first', 'last', 'phone', 'venmo', 'singlesRate', 'groupRate', 'queueSize', 'userLevel', 'isStudent', 'capacity', 'masksRequired', 'photoUrl'];
                } 
                else {
                    keys = ['first', 'last', 'singlesRate', 'groupRate', 'queueSize', 'userLevel', 'isStudent', 'capacity', 'masksRequired', 'photoUrl'];
                }

                //get beeper's information
                const beepersInfo = await r.table('users').get(beepersID).pluck(...keys).run((await database.getConn()));

                //if rider is accepted by beeper, give them data along with more personal info like full name and phone number
                const output: RiderStatusResult = {
                    status: APIStatus.Success,
                    ridersQueuePosition: ridersQueuePosition,
                    beeper: { id: beepersID, ...beepersInfo },
                    ...queueEntry
                };

                if (queueEntry.state == 1) {
                    //if beep is in state 1 (which is on the way), attack the locarion of the beeper in the response
                    //this allows the rider client to get the initial ETA, the socket will handle updates
                    const locationData = await getUsersCurrentLocation(beepersID);
                    if (locationData) output['beeper']['location'] = locationData;
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
    public async leaveQueue(@Request() request: express.Request, @Body() requestBody: LeaveQueueParams): Promise<APIResponse> {
        //if rider wants to leave a queue, they must not be at the top of the queue
        //
        // Rider can leave queue if:
        // 1. they are not accepted
        // 2. they are not at the top of the queue 
        
        
        //in beeper's queue table, get the time the rider entered the queue
        //we need this to count the number of people before this rider in the queue
        const cursor = await r.table(requestBody.beepersID).filter({ riderid: request.user.id }).pluck('timeEnteredQueue', 'isAccepted').run((await database.getConnQueues()));
        
        const data = await cursor.next();

        //query to get rider's actual position in the queue
        const ridersQueuePosition = await r.table(requestBody.beepersID).filter(r.row('timeEnteredQueue').lt(data.timeEnteredQueue)).count().run((await database.getConnQueues()));

        //if there are riders before this rider that have not been accepted,
        //tell the beeper they must respond to them first.
        if (ridersQueuePosition == 0 && data.isAccepted) {
            this.setStatus(400);
            return new APIResponse(APIStatus.Error, "You can not leave a queue when you are currenly being served");
        }

        try {
            //delete entry in beeper's queue table
            const result = await r.table(requestBody.beepersID).filter({ riderid: request.user.id }).delete({ returnChanges: true }).run((await database.getConnQueues()));

            const entry = result.changes[0].old_val;

            if (entry.isAccepted) {
                try {
                    await r.table("users").get(requestBody.beepersID).update({ queueSize: r.row('queueSize').sub(1) }).run((await database.getConn()));
                }
                catch(error) {
                    Sentry.captureException(error);
                    this.setStatus(500);
                    return new APIResponse(APIStatus.Error, "Unable to leave queue");
                }
            }
        }
        catch (error) {
            Sentry.captureException(error);
            this.setStatus(500);
            return new APIResponse(APIStatus.Error, "Unable to leave queue");
        }

        try {
            //set rider's inQueueOfUserID value to null because they are no longer in a queue
            await r.table('users').get(request.user.id).update({'inQueueOfUserID': null}).run((await database.getConn()));
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
    
    /**
     * Provides client with a list of all people currently beeping
     * @returns {APIResponse | BeeperListResult}
     */
    @Example<BeeperListResult>({
        status: APIStatus.Success,
        beeperList: [{
            capacity: 4,
            first: "Banks",
            groupRate: "2",
            id: "22192b90-54f8-49b5-9dcf-26049454716b",
            isStudent: true,
            last: "Nussman",
            masksRequired: true,
            queueSize: 0,
            singlesRate: "3",
            userLevel: 0,
            photoUrl: "https://ridebeepapp.s3.amazonaws.com/images/22192b90-54f8-49b5-9dcf-26049454716b-1604517623067.jpg"
        }]
    })
    @Get("list")
    public async getBeeperList(): Promise<APIResponse | BeeperListResult> {
        try {
            const cursor: Cursor = await r.table("users").filter({ isBeeping: true }).pluck('first', 'last', 'queueSize', 'id', 'singlesRate', 'groupRate', 'capacity', 'userLevel', 'isStudent', 'masksRequired', 'photoUrl').run((await database.getConn()));

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
