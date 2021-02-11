import * as express from 'express';
import { Validator } from "node-input-validator";
import * as Sentry from "@sentry/node";
import { APIStatus, APIResponse } from "../utils/Error";
import { ReportResponse, ReportsResponse, ReportUserParams, UpdateReportParams } from "../reports/reports";
import { Report } from '../entities/Report';
import { ObjectId } from '@mikro-orm/mongodb';
import { BeepORM } from '../app';
import { QueryOrder, wrap } from '@mikro-orm/core';
import { User } from '../entities/User';

export class ReportsController {


    public async reportUser(request: express.Request, requestBody: ReportUserParams): Promise<APIResponse> {
        const v = new Validator(requestBody, {
            id: "required",
            reason: "required"
        });

        const matched = await v.check();

        if (!matched) {
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

    public async getReports(offset?: number, show?: number): Promise<ReportsResponse | APIResponse> {
        const [reports, count] = await BeepORM.reportRepository.findAndCount({}, { orderBy: { timestamp: QueryOrder.DESC }, limit: show, offset: offset, populate: ['reporter', 'reported'] });

        return {
            status: APIStatus.Success,
            total: count,
            reports: reports
        };
    }

    public async updateReport(request: express.Request, id: string, requestBody: UpdateReportParams): Promise<APIResponse> {
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

    public async getReport(id: string): Promise<ReportResponse | APIResponse> {
        const report = await BeepORM.reportRepository.findOne(id, { populate: true, refresh: true });

        if (!report) {
            return new APIResponse(APIStatus.Error, "This report entry does not exist");
        }

        return {
            status: APIStatus.Success, 
            report: report
        };
    }

    public async deleteReport(id: string): Promise<APIResponse> {
        const report = BeepORM.reportRepository.getReference(id);

        await BeepORM.reportRepository.removeAndFlush(report);

        return new APIResponse(APIStatus.Success, "Successfully deleted report");
    }
}
