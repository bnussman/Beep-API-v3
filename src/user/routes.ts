import * as r from 'rethinkdb';
import * as express from 'express';
import database from'../utils/db';
import { Validator } from "node-input-validator";
import * as Sentry from "@sentry/node";
import { Response, Request, Controller, Route, Get, Path, Example, Post, Security, Body, Tags, Delete } from 'tsoa';
import { APIStatus, APIResponse } from "../utils/Error";
import { ReportUserParams, UserResult } from "../user/user";
import { deleteUser } from "../account/helpers";

@Tags("User")
@Route("user")
export class UserController extends Controller {

    /**
     * Get public information about any user by providing their user id
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
    
    @Get("{id}")
    public async getUser(@Path() id: string): Promise<UserResult | APIResponse> {
        const userItems = ['first', 'last', 'capacity', 'isStudent', 'masksRequired', 'queueSize', 'singlesRate', 'groupRate', 'venmo', 'isBeeping', 'photoUrl'];
        
        try {
            const result = await r.table("users").get(id).pluck(...userItems).run((await database.getConn()));

            this.setStatus(200);
            return {
                'status': APIStatus.Success,
                'user': result
            };
        }
        catch (error) {
            if (error.name == "ReqlNonExistenceError") {
                this.setStatus(404);
                return new APIResponse(APIStatus.Error, "That user does not exist");
            }
            Sentry.captureException(error);
            this.setStatus(500);
            return new APIResponse(APIStatus.Error, "Unable to get user profile");
        }
    }

    @Security("token")
    @Post("report")
    public async reportUser(@Request() request: express.Request, @Body() requestBody: ReportUserParams): Promise<APIResponse> {
        const v = new Validator(requestBody, {
            id: "required",
            reason: "required"
        });

        const matched = await v.check();

        if (!matched) {
            this.setStatus(422);
            return new APIResponse(APIStatus.Error, v.errors);
        }

        const document = {
            reporterId: request.user.id,
            reportedId: requestBody.id,
            reason: requestBody.reason,
            timestamp: Date.now()
        };
        
        try {
            const result = await r.table("userReports").insert(document).run((await database.getConn()));

            if (result.inserted == 1) {
                this.setStatus(200);
                return new APIResponse(APIStatus.Success, "Successfully reported user");
            }
            else {
                Sentry.captureException("Nothing was inserted into the databse when reporting a user");
                this.setStatus(500);
                return new APIResponse(APIStatus.Error, "Your report was not inserted");
            }
        }
        catch (error) {
            Sentry.captureException(error);
            this.setStatus(500);
            return new APIResponse(APIStatus.Error, error);
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
}
