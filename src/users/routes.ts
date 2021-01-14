import * as r from 'rethinkdb';
import { Cursor } from 'rethinkdb';
import express from 'express';
import database from'../utils/db';
import * as Sentry from "@sentry/node";
import { Response, Controller, Request, Route, Get, Example, Security, Tags, Query, Path, Delete, Patch, Body } from 'tsoa';
import { APIStatus, APIResponse } from "../utils/Error";
import { DetailedUser, EditUserParams, LocationEntry, LocationResponse, UserResult, UsersResult } from "../users/users";
import { deleteUser } from '../account/helpers';
import { getNumLocations, getNumUsers } from './helpers';
import { BeeperHistoryResult, RiderHistoryResult, RiderHistoryWithBeeperData } from '../account/account';
import { hasUserLevel } from '../auth/helpers';
import { withouts } from '../utils/config';
import { BeepQueueTableEntry, GetBeeperQueueResult } from '../beeper/beeper';
import { getPersonalInfo } from '../beeper/helpers';

@Tags("Users")
@Route("users")
export class UsersController extends Controller {

    /**
     * Get public information about any user by providing their user id,
     * if user has admin permission (auth is OPTIONAL), they will get more personal information about the user
     * @returns {UserResult | APIResponse}
     */
    @Example<UserResult>({
        status: APIStatus.Success, 
        user: {
            first: "Banks",
            last: "Last",
            capacity: 4,
            isStudent: true,
            masksRequired: false,
            queueSize: 0,
            singlesRate: 2.99,
            groupRate: 1.99,
            venmo: "banksnussman",
            isBeeping: false,
            photoUrl: "https://ridebeepapp.s3.amazonaws.com/images/22192b90-54f8-49b5-9dcf-26049454716b.JPG"
        }
    })
    @Response<APIResponse>(404, "User not found", {
        status: APIStatus.Error, 
        message: "That user does not exist"
    })
    @Response<APIResponse>(500, "Server Error", {
        status: APIStatus.Error, 
        message: "Unable to get user profile"
    })
    @Security("optionalAdmin")
    @Get("{id}")
    public async getUser(@Request() request: express.Request, @Path() id: string): Promise<UserResult | APIResponse> {
        try {
            let result;

            if (request.user?.id) {
                result = await r.table("users").get(id).without('password').run((await database.getConn()));
            }
            else {
                const userItems = ['first', 'last', 'capacity', 'isStudent', 'masksRequired', 'queueSize', 'singlesRate', 'groupRate', 'venmo', 'isBeeping', 'photoUrl', 'userLevel'];
                result = await r.table("users").get(id).pluck(...userItems).run((await database.getConn()));
            }

            this.setStatus(200);
            return {
                status: APIStatus.Success,
                user: result
            };
        }
        catch (error) {
            console.log(error);
            if (error.name == "ReqlNonExistenceError") {
                this.setStatus(404);
                return new APIResponse(APIStatus.Error, "That user does not exist");
            }
            Sentry.captureException(error);
            this.setStatus(500);
            return new APIResponse(APIStatus.Error, "Unable to get user profile");
        }
    }

    /**
     * Delete an account by user id
     * @returns {APIResponse}
     */
    @Example<APIResponse>({
        status: APIStatus.Success,
        message: "Successfully deleted user"
    })
    @Response<APIResponse>(500, "Server Error", {
        status: APIStatus.Error,
        message: "Unable to delete user"
    })
    @Security("token", ["admin"])
    @Delete("{id}")
    public async removeUser(@Path() id: string): Promise<APIResponse> {
        if (await deleteUser(id)) {
            this.setStatus(200);
            return new APIResponse(APIStatus.Success, "Successfully deleted user");
        }
        this.setStatus(500);
        return new APIResponse(APIStatus.Error, "Unable to delete user");
    }

    /**
     * Edit a user account
     * @param {EditUserParams} requestBody - user can send any or all account params
     * @returns {APIResponse}
     */
    @Example<APIResponse>({
        status: APIStatus.Success,
        message: "Successfully edited profile."
    })
    @Response<APIResponse>(500, "Server Error", {
        status: APIStatus.Error,
        message: "Unable to edit account"
    })
    @Security("token", ["admin"])
    @Patch("{id}")
    public async editUser(@Path() id: string, @Body() requestBody: EditUserParams): Promise<APIResponse> {
        try {
            const result: r.WriteResult = await r.table("users").get(id).update(requestBody).run((await database.getConn()));

            if (result.unchanged > 0) {
                return new APIResponse(APIStatus.Warning, "Nothing was changed about the user's profile");
            }
           
            return new APIResponse(APIStatus.Success, "Successfully edited user");
        }
        catch (error) {
            Sentry.captureException(error);
            this.setStatus(500);
            return new APIResponse(APIStatus.Error, "Unable to edit account");
        }
    }

    /**
     * Get a list of every Beep App User for admins.
     *
     * You can specify and offset and show to get pagination. Ex: https://ridebeep.app/v1/users?offset=10&show=10
     *
     * If you do not specify an offset or a show ammount, the API will return EVERY user
     *
     * @param {number} [offset] where to start in the DB
     * @param {number} [show] how many to show from start
     * @returns {UsersResponse | APIResponse} [result]
     */
    @Example<UsersResult>({
        status: APIStatus.Success,
        total: 128,
        users: [
            {
                capacity: 4,
                email: "Johnsonna4@appstate.edu",
                first: "Noah",
                groupRate: 2,
                id: "084b0675-16d3-44cb-ba45-37bfb1af629f",
                inQueueOfUserID: null,
                isBeeping: false,
                isEmailVerified: false,
                isStudent: false,
                last: "Johnson",
                masksRequired: false,
                phone: "7047518820",
                photoUrl: "https://ridebeepapp.s3.amazonaws.com/images/084b0675-16d3-44cb-ba45-37bfb1af629f-1607225573321.jpg",
                pushToken: "ExponentPushToken[W7I1iPJejTZzuCbW07g7ZL]",
                queueSize: 0,
                singlesRate: 3,
                userLevel: 0,
                username: "Naj251",
                venmo: "Noah-Johnson-234"
            }
        ]
    })
    @Response<APIResponse>(500, "Server Error", {
        status: APIStatus.Error,
        message: "Unable to get users"
    })
    @Security("token", ["admin"])
    @Get()
    public async getUsers(@Query() offset?: number, @Query() show?: number, @Query() search?: string): Promise<UsersResult | APIResponse> {
        let numberOfUsers: number = await getNumUsers();

        try {
            let cursor;
            
            if (search) {
                if (offset) {
                    if (show) {
                        //@ts-ignore
                        cursor = await r.table("users").without('password').filter(function(doc) { return doc.coerceTo('string').match(search); }).slice(offset, offset + show).run((await database.getConn()));
                    }
                    else {
                        //@ts-ignore
                        cursor = await r.table("users").without('password').filter(function(doc) { return doc.coerceTo('string').match(search); }).slice(offset).run((await database.getConn()));
                    }
                }
                else {
                    if (show) {
                        //@ts-ignore
                        cursor = await r.table("users").without('password').filter(function(doc) { return doc.coerceTo('string').match(search); }).limit(show).run((await database.getConn()));
                    }
                    else {
                        //@ts-ignore
                        cursor = await r.table("users").without('password').filter(function(doc) { return doc.coerceTo('string').match(search); }).run((await database.getConn()));
                    }
                }
                //@ts-ignore
                numberOfUsers =  await r.table("users").filter(function(doc) { return doc.coerceTo('string').match(search); }).count().run((await database.getConn()));
            }
            else {
                if (offset) {
                    if (show) {
                        cursor = await r.table("users").without('password').slice(offset, offset + show).run((await database.getConn()));
                    }
                    else {
                        cursor = await r.table("users").without('password').slice(offset).run((await database.getConn()));
                    }
                }
                else {
                    if (show) {
                        cursor = await r.table("users").without('password').limit(show).run((await database.getConn()));
                    }
                    else {
                        cursor = await r.table("users").without('password').run((await database.getConn()));
                    }
                }
            }

            const data: DetailedUser[] = await cursor.toArray();

            this.setStatus(200);

            return {
                status: APIStatus.Success,
                total: numberOfUsers,
                users: data
            };
        }
        catch (error) {
            Sentry.captureException(error);
            this.setStatus(500);
            return new APIResponse(APIStatus.Error, "Unable to get users list");
        }
    }

    /**
     * Get all of the rides of this user in the history table
     * @returns {RiderHistoryResult | APIResponse}
     */
    @Example<RiderHistoryResult>({
        status: APIStatus.Success,
        data: [
            {
                beep: {
                    beepersid: "ca34cc7b-de97-40b7-a1ab-148f6c43d073",
                    destination: "Hoey Hall",
                    doneTime: 1608484088896,
                    groupSize: 1,
                    id: "58be9754-d973-42a7-ab6c-682ff41d7da9",
                    isAccepted: true,
                    origin: "5617 Camelot Dr Camelot Dr Charlotte, NC 28270",
                    riderid: "22192b90-54f8-49b5-9dcf-26049454716b",
                    state: 3,
                    timeEnteredQueue: 1608484062417
                },
                beeper: {
                    first: "Test",
                    id: "ca34cc7b-de97-40b7-a1ab-148f6c43d073",
                    last: "User",
                    photoUrl: "https://ridebeepapp.s3.amazonaws.com/images/ca34cc7b-de97-40b7-a1ab-148f6c43d073-1607039319321.jpg",
                    username: "test"
                }
            }
        ]
    })
    @Response<APIResponse>(500, "Server Error", {
        status: APIStatus.Error,
        message: "Unable to get rider history"
    })
    @Security("token")
    @Get("{id}/history/rider")
    public async getRideHistory(@Request() request: express.Request, @Path() id: string): Promise<APIResponse | RiderHistoryResult> {
        if (request.user.id != id) {
            const isAdmin = await hasUserLevel(request.user.id, 1);

            if (!isAdmin) return new APIResponse(APIStatus.Error, "You must be an admin to view other peoples history");
        }

        try {
            const cursor: Cursor = await r.table("beeps")
                .filter({ riderid: id })
                .eqJoin('beepersid', r.table("users")).without({ right: { ...withouts } })
                .map((doc) => ({
                    beep: doc("left"),
                    beeper: doc("right")
                }))
                .orderBy(r.desc(r.row('beep')('timeEnteredQueue')))
                .run((await database.getConn()));

            const result: RiderHistoryWithBeeperData[] = await cursor.toArray();
            
            this.setStatus(200);
            return {
                status: APIStatus.Success, 
                data: result
            };
        }
        catch (error) {
            console.log(error);
            Sentry.captureException(error);
            this.setStatus(500);
            return new APIResponse(APIStatus.Error, "Unable to get rider history");
        }
    }

    /**
     * Get all of the beeps of this user in the history table
     * @returns {BeeperHistoryResult | APIResponse}
     */
    @Example<BeeperHistoryResult>({
        status: APIStatus.Success,
        data: [
            {
                beep: {
                    beepersid: "22192b90-54f8-49b5-9dcf-26049454716b",
                    destination: "5617 Camelot Dr. Chatlotte, NC",
                    doneTime: 1608504258230,
                    groupSize: 3,
                    id: "9f109d79-d494-4e81-91c8-20cc95edc6f8",
                    isAccepted: true,
                    origin: "1586-B U.S. Hwy 421 S U.S. Highway 421 South Boone, North Carolina 28607",
                    riderid: "ca34cc7b-de97-40b7-a1ab-148f6c43d073",
                    state: 3,
                    timeEnteredQueue: 1608504246661
                },
                rider: {
                    first: "Test",
                    id: "ca34cc7b-de97-40b7-a1ab-148f6c43d073",
                    last: "User",
                    photoUrl: "https://ridebeepapp.s3.amazonaws.com/images/ca34cc7b-de97-40b7-a1ab-148f6c43d073-1607039319321.jpg",
                    username: "test"
                }
            }
        ]
    })
    @Response<APIResponse>(500, "Server Error", {
        status: APIStatus.Error,
        message: "Unable to get beeper history"
    })
    @Security("token")
    @Get("{id}/history/beeper")
    public async getBeepHistory(@Request() request: express.Request, @Path() id: string): Promise<APIResponse | BeeperHistoryResult> {
        if (request.user.id != id) {
            const isAdmin = await hasUserLevel(request.user.id, 1);

            if (!isAdmin) return new APIResponse(APIStatus.Error, "You must be an admin to view other peoples history");
        }

        try {
            const cursor: Cursor = await r.table("beeps")
                .filter({ beepersid: id })
                .eqJoin('riderid', r.table("users")).without({ right: { ...withouts } })
                .map((doc) => ({
                    beep: doc("left"),
                    rider: doc("right")
                }))
                .orderBy(r.desc(r.row('beep')('timeEnteredQueue')))
                .run((await database.getConn()));

            const result = await cursor.toArray();
            
            this.setStatus(200);
            return {
                status: APIStatus.Success, 
                data: result
            };
        }
        catch (error) {
            Sentry.captureException(error);
            this.setStatus(500);
            return new APIResponse(APIStatus.Error, "Unable to get beeper history");
        }
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
                destination: "Tasty",
                groupSize: 1,
                id: "b500bb45-094e-437c-887b-e6b6d815ba12",
                isAccepted: true,
                origin: "241 Marich Ln Marich Ln Boone, NC 28607",
                riderid: "22192b90-54f8-49b5-9dcf-26049454716b",
                state: 0,
                timeEnteredQueue: 1603318791872,
                personalInfo: {
                    first: "Banks",
                    isStudent: true,
                    last: "Nussman",
                    phone: "7049968597",
                    venmo: "banksnussman"
                }
            }
        ]
    })
    @Response<APIResponse>(500, "Server Error", {
        status: APIStatus.Error, 
        message: "Unable to get beeper queue"
    })
    @Security("token")
    @Get("{id}/queue")
    public async getQueue(@Request() request: express.Request, @Path() id: string): Promise<APIResponse | GetBeeperQueueResult> {
        if (request.user.id != id) {
            const isAdmin = await hasUserLevel(request.user.id, 1);

            if (!isAdmin) return new APIResponse(APIStatus.Error, "You must be an admin to view other peoples history");
        }

        try {
            const result: BeepQueueTableEntry[] = await r.table(id).orderBy('timeEnteredQueue').run((await database.getConnQueues())) as unknown as BeepQueueTableEntry[];

            //for every entry in a beeper's queue, add personal info
            //TODO use a table join insted
            for (const doc of result) {
                //for every queue entry, add personal info of the rider
                doc['personalInfo'] = await getPersonalInfo(doc.riderid);
            }

            //after processing, send data.
            this.setStatus(200);
            return {
                status: APIStatus.Success,
                queue: result
            };
        }
        catch (error) {
            Sentry.captureException(error);
            this.setStatus(500);
            return new APIResponse(APIStatus.Error, "Unable to get beeper queue");
        }
    }

    @Example<LocationResponse>({
        status: APIStatus.Success,
        total: 1,
        locations: [
            {
                id: "03770e5f-c2a9-4134-a724-0d5bb6ac2865",
                accuracy: 5,
                altitude: 963.446349948066,
                altitudeAccuracy: 3,
                heading: 41.47227478027344,
                latitude: 36.206469442729095,
                longitude: -81.668430576177,
                speed: 14.369999885559082,
                timestamp: 1609808229233
            }
        ]
    })
    @Response<APIResponse>(500, "Server Error", {
        status: APIStatus.Error, 
        message: "Unable to user's location"
    })
    @Security("token")
    @Get("{id}/location")
    public async getLocation(@Request() request: express.Request, @Path() id: string, @Query() offset?: number, @Query() show?: number): Promise<LocationResponse | APIResponse> {
        if (request.user.id != id) {
            const isAdmin = await hasUserLevel(request.user.id, 1);

            if (!isAdmin) return new APIResponse(APIStatus.Error, "You must be an admin to view other peoples history");
        }

        const numberOfLocationEntries: number = await getNumLocations(id);

        try {
            let cursor;

            if (offset) {
                if (show) {
                    cursor = await r.table(id).orderBy(r.desc('timestamp')).slice(offset, offset + show).run((await database.getConnLocations()));
                }
                else {
                    cursor = await r.table(id).orderBy(r.desc('timestamp')).slice(offset).run((await database.getConnLocations()));
                }
            }
            else {
                if (show) {
                    cursor = await r.table(id).orderBy(r.desc('timestamp')).limit(show).run((await database.getConnLocations()));
                }
                else {
                    cursor = await r.table(id).orderBy(r.desc('timestamp')).run((await database.getConnLocations()));
                }
            }


            const data: LocationEntry[] = await cursor.toArray();

            this.setStatus(200);

            return {
                status: APIStatus.Success,
                total: numberOfLocationEntries,
                locations: data
            };
        }
        catch (error) {
            Sentry.captureException(error);
            this.setStatus(500);
            return new APIResponse(APIStatus.Error, "Unable to user's location");
        }
    }
}
