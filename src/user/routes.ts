import * as r from 'rethinkdb';
import * as express from 'express';
import { makeJSONError, makeJSONSuccess } from '../utils/json';
import { BeepError } from "../types/beep";
import { conn } from '../utils/db';
import { Validator } from "node-input-validator";
import * as Sentry from "@sentry/node";
import { Request, Controller, Route, Get, Path, Example, Post, Security, Body } from 'tsoa';
import {APIError} from '../utils/Error';

interface PublicUser {
    first: string;
    last: string;
    capacity: number;
    isStudent: boolean;
    masksRequired: boolean;
    queueSize: number;
    singlesRate: number | string;
    groupRate: number | string;
    venmo: string;
    isBeeping: boolean;
}

interface UserResult {
    status: string;
    user: PublicUser;
}

interface ReportUserParams {
    id: string;
    reason: string;
}

interface RequestUser {
    id: string;
}

@Route("user")
export class UserController extends Controller {
    @Example<PublicUser>({
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
    })
    
    @Get("{id}")
    public async getUser(@Path() id: string): Promise<UserResult | BeepError> {
        const userItems = ['first', 'last', 'capacity', 'isStudent', 'masksRequired', 'queueSize', 'singlesRate', 'groupRate', 'venmo', 'isBeeping'];
        
        try {
            const result = await r.table("users").get(id).pluck(...userItems).run(conn);

            this.setStatus(200);
            return {
                'status': 'success',
                'user': result
            };
        }
        catch (error) {
            Sentry.captureException(error);
            this.setStatus(500);
            return makeJSONError("Unable to get user profile");
        }
    }

    @Security("token")
    @Post("report")
    public async reportUser(@Request() request: express.Request, @Body() requestBody: ReportUserParams): Promise<BeepError| APIError | void> {
        console.log("ran");
        const v = new Validator(requestBody, {
            id: "required",
            reason: "required"
        });

        const matched = await v.check();

        if (!matched) {
            //users input did not match our criteria, send the validator's error
            //this.setStatus(422)
            console.log(v.errors);
            return new APIError(422, v.errors);
        }

        const document = {
            reporterId: request.user.id,
            reportedId: requestBody.id,
            reason: requestBody.reason,
            timestamp: Date.now()
        };
        
        try {
            const result = await r.table("userReports").insert(document).run(conn);

            console.log(result);

            if (result.inserted == 1) {
                return(makeJSONSuccess("Successfully reported user"));
            }
            else {
                Sentry.captureException("Nothing was inserted into the databse when reporting a user");
                return(makeJSONError("Unable to report user"));
            }
        }
        catch (error) {
            console.error(error);
            Sentry.captureException(error);
            this.setStatus(500);
            return(makeJSONError("Unable to insert into reports table"));
        }
    }
}
