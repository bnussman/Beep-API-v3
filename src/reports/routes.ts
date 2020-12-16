import * as r from 'rethinkdb';
import database from'../utils/db';
import * as Sentry from "@sentry/node";
import { Response, Controller, Route, Example, Security, Tags, Get, Query } from 'tsoa';
import { APIStatus, APIResponse } from "../utils/Error";
import { Report, ReportsResponse } from "../report/report";

@Tags("Reports")
@Route("reports")
export class ReportsController extends Controller {

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
    public async getReports(@Query() offset?: number, @Query() show?: number): Promise<ReportsResponse | APIResponse> {
        try {
            let cursor

            if (offset) {
                if (show) {
                    cursor = await r.table("userReports").slice(offset, offset + show).run((await database.getConn()));
                }
                else {
                    cursor = await r.table("userReports").slice(offset).run((await database.getConn()));
                }
            }
            else {
                if (show) {
                    cursor = await r.table("userReports").limit(show).run((await database.getConn()));
                }
                else {
                    cursor = await r.table("userReports").run((await database.getConn()));
                }
            }

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
