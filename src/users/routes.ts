import express from 'express';
import * as Sentry from "@sentry/node";
import { Response, Controller, Request, Route, Get, Example, Security, Tags, Query, Path, Delete, Patch, Body } from 'tsoa';
import { APIStatus, APIResponse } from "../utils/Error";
import { EditUserParams, UserResult, UsersResult } from "../users/users";
import { deleteUser } from '../account/helpers';
import { BeeperHistoryResult, RiderHistoryResult } from '../account/account';
import { BeepORM } from '../app';
import { ObjectId } from '@mikro-orm/mongodb';
import { wrap } from '@mikro-orm/core';
import { User } from '../entities/User';

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
        user: new User()
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
        const user = await BeepORM.userRepository.findOne(new ObjectId(id));

        if (!user) {
            this.setStatus(404);
            return new APIResponse(APIStatus.Error, "User not found");
        }

        this.setStatus(200);
        return {
            status: APIStatus.Success,
            user: user
        };
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
        const user = BeepORM.em.getReference(User, new ObjectId(id));

        if (!user) {
            this.setStatus(404);
            return new APIResponse(APIStatus.Error, "User not found");
        }

        if (await deleteUser(user)) {
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

        const user = await BeepORM.userRepository.findOne(new ObjectId(id));

        if (!user) {
            this.setStatus(404);
            return new APIResponse(APIStatus.Error, "User not found");
        }

        wrap(user).assign(requestBody);

        await BeepORM.userRepository.persistAndFlush(user);

        return new APIResponse(APIStatus.Success, "Successfully edited user");
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
    /*
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
    */
    @Response<APIResponse>(500, "Server Error", {
        status: APIStatus.Error,
        message: "Unable to get users"
    })
    @Security("token", ["admin"])
    @Get()
    public async getUsers(@Query() offset?: number, @Query() show?: number): Promise<UsersResult | APIResponse> {
        const [users, count] = await BeepORM.em.findAndCount(User, {}, { limit: show, offset: offset });

        return {
            status: APIStatus.Success,
            total: count,
            users: users
        };
    }

    /**
     * Get all of the rides of this user in the history table
     * @returns {RiderHistoryResult | APIResponse}
     */
    /*
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
    */
    @Response<APIResponse>(500, "Server Error", {
        status: APIStatus.Error,
        message: "Unable to get rider history"
    })
    @Security("token")
    @Get("{id}/history/rider")
    public async getRideHistory(@Request() request: express.Request, @Path() id: string): Promise<APIResponse | RiderHistoryResult> {
        /*
        if (request.user.user._id != id) {
            const isAdmin = await hasUserLevel(request.user.user, 1);
            console.log(isAdmin);

            if (!isAdmin) return new APIResponse(APIStatus.Error, "You must be an admin to view other peoples history");
        }
        */
        
        const r = await BeepORM.beepRepository.find({ rider: new ObjectId(id) }, { populate: true });

        return {
            status: APIStatus.Success,
            data: r
        };
    }

    /**
     * Get all of the beeps of this user in the history table
     * @returns {BeeperHistoryResult | APIResponse}
     */
    /*
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
    */
    @Response<APIResponse>(500, "Server Error", {
        status: APIStatus.Error,
        message: "Unable to get beeper history"
    })
    @Security("token")
    @Get("{id}/history/beeper")
    public async getBeepHistory(@Request() request: express.Request, @Path() id: string): Promise<APIResponse | BeeperHistoryResult> {
        /*
        if (request.user.user._id != new ObjectId(id)) {
            const isAdmin = await hasUserLevel(request.user.user, 1);

            if (!isAdmin) return new APIResponse(APIStatus.Error, "You must be an admin to view other peoples history");
        }
        */

        const r = await BeepORM.beepRepository.find({ beeper: new ObjectId(id) }, { populate: true });

        return {
            status: APIStatus.Success,
            data: r
        };
    }


    /**
     * User calls this to get there queue when beeping.
     * Our Socket server is responcible for telling a client a change occoured, it will prompt
     * a call to this endpoint to get the queue and data
     * @returns {GetBeeperQueueResult} 
     */
    @Security("token")
    @Get("{id}/queue")
    public async getQueue(@Request() request: express.Request, @Path() id: string): Promise<APIResponse | any> {
        //TODO: figure this out
        /*
        if (request.user.user._id != id) {
            const isAdmin = await hasUserLevel(request.user.user._id, 1);

            if (!isAdmin) return new APIResponse(APIStatus.Error, "You must be an admin to view other peoples queue");
        }
        */

        const r = await BeepORM.queueEntryRepository.find({ beeper: id }, { populate: true });
        console.log(r);
        
        for (let i = 0; i < r.length; i++) {
           if (r[i].state == -1) {
               BeepORM.queueEntryRepository.remove(r[i]);
           }
        }

        await BeepORM.em.flush();

        return {
            status: APIStatus.Success,
            queue: r.filter(entry => entry.state != -1)
        };
    }
}
