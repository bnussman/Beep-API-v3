import * as r from 'rethinkdb';
import * as express from 'express';
import database from'../utils/db';
import * as Sentry from "@sentry/node";
import { Response, Request, Controller, Route, Get, Path, Example, Security, Body, Tags, Delete, Patch } from 'tsoa';
import { APIStatus, APIResponse } from "../utils/Error";
import { UserResult, EditUserParams } from "../user/user";
import { deleteUser } from "../account/helpers";

@Tags("User")
@Route("user")
export class UserController extends Controller {

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
}
