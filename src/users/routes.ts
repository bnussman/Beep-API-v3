import * as r from 'rethinkdb';
import database from'../utils/db';
import * as Sentry from "@sentry/node";
import { Response, Controller, Route, Get, Example, Security, Tags, Query } from 'tsoa';
import { APIStatus, APIResponse } from "../utils/Error";
import { DetailedUser, UsersResult } from "../user/user";

@Tags("Users")
@Route("users")
export class UsersController extends Controller {

    /**
     * Get a list of every Beep App User for admins.
     *
     * You can specify and offset and show to get pagination. Ex: https://ridebeep.app/v1/users?offset=10&show=10
     *
     * If you do not specify an offset or a show ammount, the API will return EVERY user
     *
     * @param {number} [offset] where to start in the DB
     * @param {number} [show] how many to show from start
     * @returns {UsersResponse | APIResponse} [result]
     */
    @Example<UsersResult>({
        status: APIStatus.Success,
        users: [
            {
                capacity: 4,
                email: "Johnsonna4@appstate.edu",
                first: "Noah",
                groupRate: 2,
                id: "084b0675-16d3-44cb-ba45-37bfb1af629f",
                inQueueOfUserID: null,
                isBeeping: false,
                isEmailVerified: false,
                isStudent: false,
                last: "Johnson",
                masksRequired: false,
                phone: "7047518820",
                photoUrl: "https://ridebeepapp.s3.amazonaws.com/images/084b0675-16d3-44cb-ba45-37bfb1af629f-1607225573321.jpg",
                pushToken: "ExponentPushToken[W7I1iPJejTZzuCbW07g7ZL]",
                queueSize: 0,
                singlesRate: 3,
                userLevel: 0,
                username: "Naj251",
                venmo: "Noah-Johnson-234"
            }
        ]
    })
    @Response<APIResponse>(500, "Server Error", {
        status: APIStatus.Error,
        message: "Unable to get users"
    })
    @Security("token", ["admin"])
    @Get()
    public async getUsers(@Query() offset?: number, @Query() show?: number): Promise<UsersResult | APIResponse> {
        try {
            let cursor;

            if (offset) {
                if (show) {
                    cursor = await r.table("users").without('password').slice(offset, offset + show).run((await database.getConn()));
                }
                else {
                    cursor = await r.table("users").without('password').slice(offset).run((await database.getConn()));
                }
            }
            else {
                if (show) {
                    cursor = await r.table("users").without('password').limit(show).run((await database.getConn()));
                }
                else {
                    cursor = await r.table("users").without('password').run((await database.getConn()));
                }
            }

            const data: DetailedUser[] = await cursor.toArray();

            this.setStatus(200);

            return {
                status: APIStatus.Success,
                users: data
            };
        }
        catch (error) {
            Sentry.captureException(error);
            this.setStatus(500);
            return new APIResponse(APIStatus.Error, "Unable to get users list");
        }
    }
}
