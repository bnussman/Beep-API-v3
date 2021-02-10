import * as express from 'express';
import { Validator } from "node-input-validator";
import * as Sentry from "@sentry/node";
import { Controller, Request, Post, Body, Route, Security, Tags, Get, Query, Patch, Path, Delete } from 'tsoa';
import { APIStatus, APIResponse } from "../utils/Error";
import { ReportResponse, ReportsResponse, ReportUserParams, UpdateReportParams } from "../reports/reports";
import { Report } from '../entities/Report';
import { ObjectId } from '@mikro-orm/mongodb';
import { BeepORM } from '../app';
import { QueryOrder, wrap } from '@mikro-orm/core';
import { User } from '../entities/User';

@Tags("Reports")
@Route("reports")
export class ReportsController extends Controller {

    /**
     * Report a user
     * @returns {APIResponse}
     */
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

        const user = BeepORM.em.getReference(User, requestBody.id);
        
        let report;

        if (requestBody.beep) {
            report = new Report(request.user.user, user, requestBody.reason, new ObjectId(requestBody.beep));
        }
        else {
            report = new Report(request.user.user, user, requestBody.reason);
        }

        await BeepORM.reportRepository.persistAndFlush(report);

        return new APIResponse(APIStatus.Success, "Successfully reported user");
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
    @Security("token", ["admin"])
    @Get()
    public async getReports(@Query() offset?: number, @Query() show?: number): Promise<ReportsResponse | APIResponse> {
        const [reports, count] = await BeepORM.reportRepository.findAndCount({}, { orderBy: { timestamp: QueryOrder.DESC }, limit: show, offset: offset, populate: ['reporter', 'reported'] });

        return {
            status: APIStatus.Success,
            total: count,
            reports: reports
        };
    }

    /**
     * Edit a report entry
     *
     * An admin can mark the report as handled and add notes
     *
     * @param {UpdateReportParams} requestBody - user can send any or all update report params
     * @returns {APIResponse}
     */
    @Security("token", ["admin"])
    @Patch("{id}")
    public async updateReport(@Request() request: express.Request, @Path() id: string, @Body() requestBody: UpdateReportParams): Promise<APIResponse> {
        let update = requestBody as unknown;

        if (requestBody.handled) {
            update = { ...requestBody, handledBy: request.user.user };
        }
        else {
            update = { ...requestBody, handledBy: null };
        }

        const report = BeepORM.reportRepository.getReference(id);

        wrap(report).assign(update);

        await BeepORM.reportRepository.persistAndFlush(report);

        return new APIResponse(APIStatus.Success, "Successfully updated report");
    }

    /**
     * Get a report entry
     *
     * An admin can get the details of a single report
     *
     * @returns {ReportResponse | APIResponse}
     */
    @Security("token", ["admin"])
    @Get("{id}")
    public async getReport(@Path() id: string): Promise<ReportResponse | APIResponse> {
        const report = await BeepORM.reportRepository.findOne(id, { populate: true, refresh: true });

        if (!report) {
            this.setStatus(404);
            return new APIResponse(APIStatus.Error, "This report entry does not exist");
        }

        return {
            status: APIStatus.Success, 
            report: report
        };
    }

    /**
     * Delete a report entry by id
     * @returns {APIResponse}
     */
    @Security("token", ["admin"])
    @Delete("{id}")
    public async deleteReport(@Path() id: string): Promise<APIResponse> {
        const report = BeepORM.reportRepository.getReference(id);

        await BeepORM.reportRepository.removeAndFlush(report);

        return new APIResponse(APIStatus.Success, "Successfully deleted report");
    }
}
