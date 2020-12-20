import * as r from 'rethinkdb';
import * as express from 'express';
import database from'../utils/db';
import { Validator } from "node-input-validator";
import * as Sentry from "@sentry/node";
import { Response, Controller, Request, Post, Body, Route, Example, Security, Tags, Get, Query, Patch, Path } from 'tsoa';
import { APIStatus, APIResponse } from "../utils/Error";
import { Report, ReportResponse, ReportsResponse, ReportUserParams, UpdateReportParams } from "../reports/reports";
import { getNumReports } from "./helpers";
import { withouts } from '../utils/config';

@Tags("Reports")
@Route("reports")
export class ReportsController extends Controller {

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

        const document: Report = {
            reporterId: request.user.id,
            reportedId: requestBody.id,
            reason: requestBody.reason,
            timestamp: Date.now(),
            adminNotes: null,
            handled: false,
            handledBy: null
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
     * Allow admins to get reports made by users
     *
     * You can specify and offset and show to get pagination. Ex: https://ridebeep.app/v1/reports?offset=10&show=10
     *
     * If you do not specify an offset or a show ammount, the API will return EVERY report
     *
     * @param {number} [offset] where to start in the DB
     * @param {number} [show] how many to show from start
     * @returns {ReportsResponse | APIResponse} [result]
     */
    @Example<ReportsResponse>({
        status: APIStatus.Success,
        total: 18,
        reports: [
            {
                report: {
                    adminNotes: null,
                    handled: false,
                    handledBy: null,
                    id: "540ad73c-875a-4ac9-b067-b9d7b02eccf9",
                    reason: "This is a test report after lots of changes recently!!",
                    reportedId: "22192b90-54f8-49b5-9dcf-26049454716b",
                    reporterId: "ca34cc7b-de97-40b7-a1ab-148f6c43d073",
                    timestamp: 1608178391732
                },
                reported: {
                    first: "Banks",
                    id: "22192b90-54f8-49b5-9dcf-26049454716b",
                    last: "Nussman",
                    photoUrl: "https://ridebeepapp.s3.amazonaws.com/images/22192b90-54f8-49b5-9dcf-26049454716b-1608086704764.jpg",
                    username: "banks"
                },
                reporter: {
                    first: "Test",
                    id: "ca34cc7b-de97-40b7-a1ab-148f6c43d073",
                    last: "User",
                    photoUrl: "https://ridebeepapp.s3.amazonaws.com/images/ca34cc7b-de97-40b7-a1ab-148f6c43d073-1607039319321.jpg",
                    username: "test"
                }
            }
        ]
    })
    @Response<APIResponse>(500, "Server error", {
        status: APIStatus.Error,
        message: "Unable to get reports list"
    })
    @Security("token", ["admin"])
    @Get()
    public async getReports(@Query() offset?: number, @Query() show?: number): Promise<ReportsResponse | APIResponse> {
        const numberOfReports: number = await getNumReports();

        try {
            let cursor

            if (offset) {
                if (show) {
                    cursor = await r.table("userReports")
                        //@ts-ignore
                        .eqJoin("reporterId", r.table("users")).without({ right: { ...withouts} })
                        //@ts-ignore
                        .map((doc) => ({
                            report: doc("left"),
                            reporter: doc("right")
                        }))
                        //@ts-ignore
                        .eqJoin(r.row("report")("reportedId"), r.table("users")).without({ right: { ...withouts } })
                        //@ts-ignore
                        .map((doc) => ({
                            report: doc("left")("report"),
                            reporter: doc("left")("reporter"),
                            reported: doc("right")
                        }))

                        //@ts-ignore
                        .orderBy(r.desc(r.row("report")("timestamp"))).slice(offset, offset + show).run((await database.getConn()));
                }
                else {
                    cursor = await r.table("userReports")
                        //@ts-ignore
                        .eqJoin("reporterId", r.table("users")).without({ right: { ...withouts} })
                        //@ts-ignore
                        .map((doc) => ({
                            report: doc("left"),
                            reporter: doc("right")
                        }))
                        //@ts-ignore
                        .eqJoin(r.row("report")("reportedId"), r.table("users")).without({ right: { ...withouts } })
                        //@ts-ignore
                        .map((doc) => ({
                            report: doc("left")("report"),
                            reporter: doc("left")("reporter"),
                            reported: doc("right")
                        }))

                        //@ts-ignore
                        .orderBy(r.desc(r.row("report")("timestamp"))).slice(offset).run((await database.getConn()));
                }
            }
            else {
                if (show) {
                    cursor = await r.table("userReports")
                        //@ts-ignore
                        .eqJoin("reporterId", r.table("users")).without({ right: { ...withouts} })
                        //@ts-ignore
                        .map((doc) => ({
                            report: doc("left"),
                            reporter: doc("right")
                        }))
                        //@ts-ignore
                        .eqJoin(r.row("report")("reportedId"), r.table("users")).without({ right: { ...withouts } })
                        //@ts-ignore
                        .map((doc) => ({
                            report: doc("left")("report"),
                            reporter: doc("left")("reporter"),
                            reported: doc("right")
                        }))

                        //@ts-ignore
                        .orderBy(r.desc(r.row("report")("timestamp"))).limit(show).run((await database.getConn()));
                }
                else {
                    cursor = await r.table("userReports")
                        //@ts-ignore
                        .eqJoin("reporterId", r.table("users")).without({ right: { ...withouts} })
                        //@ts-ignore
                        .map((doc) => ({
                            report: doc("left"),
                            reporter: doc("right")
                        }))
                        //@ts-ignore
                        .eqJoin(r.row("report")("reportedId"), r.table("users")).without({ right: { ...withouts } })
                        //@ts-ignore
                        .map((doc) => ({
                            report: doc("left")("report"),
                            reporter: doc("left")("reporter"),
                            reported: doc("right")
                        }))

                        //@ts-ignore
                        .orderBy(r.desc(r.row("report")("timestamp"))).run((await database.getConn()));
                }
            }

            const result = await cursor.toArray();

            this.setStatus(200);

            return {
                status: APIStatus.Success,
                total: numberOfReports,
                reports: result
            };
        }
        catch (error) {
            console.log(error);
            Sentry.captureException(error);
            this.setStatus(500);
            return new APIResponse(APIStatus.Error, "Unable to get reports list");
        }
    }

    /**
     * Edit a report entry
     *
     * An admin can mark the report as handled and add notes
     *
     * @param {UpdateReportParams} requestBody - user can send any or all update report params
     * @returns {APIResponse}
     */
    @Example<APIResponse>({
        status: APIStatus.Success,
        message: "Successfully updated report"
    })
    @Response<APIResponse>(500, "Server Error", {
        status: APIStatus.Error,
        message: "Unable to edit report"
    })
    @Security("token", ["admin"])
    @Patch("{id}")
    public async updateReport(@Request() request: express.Request, @Path() id: string, @Body() requestBody: UpdateReportParams): Promise<APIResponse> {
        try {
            let toUpdateData;

            if (requestBody.handled) {
                toUpdateData = { ...requestBody, handledBy: request.user.id};
            }
            else {
                toUpdateData = requestBody;
            }

            const result: r.WriteResult = await r.table("userReports").get(id).update(toUpdateData).run((await database.getConn()));

            if (result.unchanged > 0) {
                return new APIResponse(APIStatus.Warning, "Nothing was changed about the report");
            }
           
            return new APIResponse(APIStatus.Success, "Successfully updated report");
        }
        catch (error) {
            Sentry.captureException(error);
            this.setStatus(500);
            return new APIResponse(APIStatus.Error, "Unable to edit report");
        }

    }

    /**
     * Get a report entry
     *
     * An admin can get the details of a single report
     *
     * @returns {ReportResponse | APIResponse}
     */
    @Example<ReportResponse>({
        status: APIStatus.Success,
        report: {
            adminNotes: "I called the guy and took care of it. ",
            handled: true,
            handledBy: "22192b90-54f8-49b5-9dcf-26049454716b",
            id: "c5008c11-d7ea-4f69-9b42-6698237d15bb",
            reason: "hhgfh",
            reportedId: "22192b90-54f8-49b5-9dcf-26049454716b",
            reporterId: "ca34cc7b-de97-40b7-a1ab-148f6c43d073",
            timestamp: 1607803770171
        }
    })
    @Response<APIResponse>(404, "Not found", {
        status: APIStatus.Error,
        message: "This report entry does not exist"
    })
    @Response<APIResponse>(500, "Server Error", {
        status: APIStatus.Error,
        message: "Unable to get report"
    })
    @Security("token", ["admin"])
    @Get("{id}")
    public async getReport(@Path() id: string): Promise<ReportResponse | APIResponse> {
        try {
            const result = await r.table("userReports").get(id).run((await database.getConn())) as Report;

            if (!result) {
                this.setStatus(404);
                return new APIResponse(APIStatus.Error, "This report entry does not exist");
            }

            return {
                status: APIStatus.Success, 
                report: result
            };
        }
        catch (error) {
            Sentry.captureException(error);
            this.setStatus(500);
            return new APIResponse(APIStatus.Error, error);
        }

    }
}
