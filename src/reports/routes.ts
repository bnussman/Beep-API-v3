import * as r from 'rethinkdb';
import database from'../utils/db';
import * as Sentry from "@sentry/node";
import { Response, Controller, Route, Example, Security, Tags, Get } from 'tsoa';
import { APIStatus, APIResponse } from "../utils/Error";
import { Report, ReportsResponse } from "../report/report";

@Tags("Reports")
@Route("reports")
export class ReportsController extends Controller {

    /**
     * Allow admins to get reports made by users
     * @returns {ReportsResponse | APIResponse}
     */
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
