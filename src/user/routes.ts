import * as r from 'rethinkdb';
import * as express from 'express';
import { conn } from '../utils/db';
import { Validator } from "node-input-validator";
import * as Sentry from "@sentry/node";
import { Request, Controller, Route, Get, Path, Example, Post, Security, Body, Tags } from 'tsoa';
import { APIStatus, APIResponse } from "../utils/Error";
import { ReportUserParams, UserResult } from "../user/user";

@Tags("User")
@Route("user")
export class UserController extends Controller {
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
            isBeeping: false
        }
    })
    @Example<APIResponse>({
        status: APIStatus.Error, 
        message: "Unable to get user profile"
    })
    
    @Get("{id}")
    public async getUser(@Path() id: string): Promise<UserResult | APIResponse> {
        const userItems = ['first', 'last', 'capacity', 'isStudent', 'masksRequired', 'queueSize', 'singlesRate', 'groupRate', 'venmo', 'isBeeping'];
        
        try {
            const result = await r.table("users").get(id).pluck(...userItems).run(conn);

            this.setStatus(200);
            return {
                'status': APIStatus.Success,
                'user': result
            };
        }
        catch (error) {
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
            const result = await r.table("userReports").insert(document).run(conn);

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
}
