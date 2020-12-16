import * as r from 'rethinkdb';
import * as express from 'express';
import database from'../utils/db';
import { Validator } from "node-input-validator";
import * as Sentry from "@sentry/node";
import { Response, Request, Controller, Route, Example, Post, Security, Body, Tags, Get } from 'tsoa';
import { APIStatus, APIResponse } from "../utils/Error";
import { Report, ReportsResponse, ReportUserParams } from "./report";

@Tags("Report")
@Route("report")
export class ReportController extends Controller {

    /**
     * Report a user
     * @returns {APIResponse}
     */
    @Example<APIResponse>({
        status: APIStatus.Success,
        message: "Successfully reported user"
    })
    @Response<APIResponse>(500, "Server Error", {
        status: APIStatus.Error, 
        message: "Unable to resport user"
    })
    @Security("token")
    @Post()
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

    @Example<ReportsResponse>({
        status: APIStatus.Success,
        reports: [
            {
                id: "0c4dd21b-54bc-4e51-bed7-a7fd1ade00fe",
                reason: "Actual sexiest beeper 🤤",
                reportedId: "22192b90-54f8-49b5-9dcf-26049454716b",
                reporterId: "de623bd0-c000-4f74-a342-2620da1c6e9f",
                timestamp: 1603395053099
            },
            {
                id: "c5008c11-d7ea-4f69-9b42-6698237d15bb",
                reason: "hhgfh",
                reportedId: "22192b90-54f8-49b5-9dcf-26049454716b",
                reporterId: "ca34cc7b-de97-40b7-a1ab-148f6c43d073",
                timestamp: 1607803770171
            }
        ]
    })
    @Response<APIResponse>(500, "Server error", {
        status: APIStatus.Error,
        message: "Unable to get reports list"
    })
    @Security("token", ["admin"])
    @Get()
    public async getReports(): Promise<ReportsResponse | APIResponse> {
        try {
            const cursor = await r.table("userReports").run((await database.getConn()));        

            const data: Report[] = await cursor.toArray();

            this.setStatus(200);

            return {
                status: APIStatus.Success,
                reports: data
            };
        }
        catch (error) {
            Sentry.captureException(error);
            this.setStatus(500);
            return new APIResponse(APIStatus.Error, "Unable to get reports list");
        }
    }
}
