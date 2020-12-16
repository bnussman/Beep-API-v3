import * as r from 'rethinkdb';
import database from'../utils/db';
import * as Sentry from "@sentry/node";
import { Response, Controller, Route, Get, Example, Security, Tags } from 'tsoa';
import { APIStatus, APIResponse } from "../utils/Error";
import { DetailedUser, UsersResult } from "../user/user";

@Tags("Users")
@Route("users")
export class UsersController extends Controller {

    /**
     * Get a list of every Beep App User for admins
     * @returns {UsersResponse | APIResponse}
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
    public async getUsers(): Promise<UsersResult | APIResponse> {
        try {
            const cursor = await r.table("users").without('password').run((await database.getConn()));        

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
