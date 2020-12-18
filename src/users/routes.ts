import * as r from 'rethinkdb';
import express from 'express';
import database from'../utils/db';
import * as Sentry from "@sentry/node";
import { Response, Controller, Request, Route, Get, Example, Security, Tags, Query, Path, Delete, Patch, Body } from 'tsoa';
import { APIStatus, APIResponse } from "../utils/Error";
import { DetailedUser, EditUserParams, UserResult, UsersResult } from "../users/users";
import { deleteUser } from '../account/helpers';
import { getNumUsers } from './helpers';

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
                //@ts-ignore this is valid, the typings are wrong
                result = await r.table("users").get(id).without('password').run((await database.getConn()));
            }
            else {
                const userItems = ['first', 'last', 'capacity', 'isStudent', 'masksRequired', 'queueSize', 'singlesRate', 'groupRate', 'venmo', 'isBeeping', 'photoUrl'];
                result = await r.table("users").get(id).pluck(...userItems).run((await database.getConn()));
            }

            this.setStatus(200);
            return {
                'status': APIStatus.Success,
                'user': result
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
    public async getUsers(@Query() offset?: number, @Query() show?: number): Promise<UsersResult | APIResponse> {
        const numberOfUsers: number = await getNumUsers();

        try {
            let cursor;

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
}
