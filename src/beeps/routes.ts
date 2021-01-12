import { APIStatus, APIResponse } from '../utils/Error';
import { Get, Response, Tags, Route, Controller, Security, Query, Example, Path } from 'tsoa';
import { getNumBeeps } from './helpers';
import * as Sentry from "@sentry/node";
import * as r from 'rethinkdb';
import { BeepEntry, BeepResponse, BeepsResponse } from './beeps';
import database from '../utils/db';
import { withouts } from '../utils/config';

@Tags("Beeps")
@Route("beeps")
export class BeepsController extends Controller {

    /**
     * Allow admins to get beeps list
     *
     * You can specify and offset and show to get pagination. Ex: https://ridebeep.app/v1/beeps?offset=10&show=10
     *
     * If you do not specify an offset or a show ammount, the API will return EVERY beep event
     *
     * @param {number} [offset] where to start in the DB
     * @param {number} [show] how many to show from start
     * @returns {BeepsResponse | APIResponse} [result]
     */
    @Example<BeepsResponse>({
        status: APIStatus.Success,
        total: 1,
        beeps: [
            {
                beep: {
                    beepersid: "ca34cc7b-de97-40b7-a1ab-148f6c43d073",
                    destination: "Hoey Hall",
                    doneTime: 1608484088896,
                    groupSize: 1,
                    id: "58be9754-d973-42a7-ab6c-682ff41d7da9",
                    isAccepted: true,
                    origin: "5617 Camelot Dr Camelot Dr Charlotte, NC 28270",
                    riderid: "22192b90-54f8-49b5-9dcf-26049454716b",
                    state: 3,
                    timeEnteredQueue: 1608484062417
                },
                beeper: {
                    first: "Test",
                    id: "ca34cc7b-de97-40b7-a1ab-148f6c43d073",
                    last: "User",
                    photoUrl: "https://ridebeepapp.s3.amazonaws.com/images/ca34cc7b-de97-40b7-a1ab-148f6c43d073-1607039319321.jpg",
                    username: "test"
                },
                rider: {
                    first: "Banks",
                    id: "22192b90-54f8-49b5-9dcf-26049454716b",
                    last: "Nussman",
                    photoUrl: "https://ridebeepapp.s3.amazonaws.com/images/22192b90-54f8-49b5-9dcf-26049454716b-1608086704764.jpg",
                    username: "banks"
                }
            }
        ]
    })
    @Response<APIResponse>(500, "Server error", {
        status: APIStatus.Error,
        message: "Unable to get beeps"
    })
    @Security("token", ["admin"])
    @Get()
    public async getBeeps(@Query() offset?: number, @Query() show?: number): Promise<BeepsResponse | APIResponse> {
        const numberOfBeeps: number = await getNumBeeps();

        try {
            let cursor

            if (offset) {
                if (show) {
                    cursor = await r.table("beeps")
                        .eqJoin("riderid", r.table("users")).without({ right: { ...withouts } })
                        .map((doc) => ({
                            beep: doc("left"),
                            rider: doc("right")
                        }))
                        .eqJoin(r.row("beep")("beepersid"), r.table("users")).without({ right: { ...withouts } })
                        .map((doc) => ({
                            beep: doc("left")("beep"),
                            rider: doc("left")("rider"),
                            beeper: doc("right")
                        }))
                        .orderBy(r.desc(r.row('beep')('timeEnteredQueue'))).slice(offset, offset + show).run((await database.getConn()));
                }
                else {
                    cursor = await r.table("beeps")
                        .eqJoin("riderid", r.table("users")).without({ right: { ...withouts } })
                        .map((doc) => ({
                            beep: doc("left"),
                            rider: doc("right")
                        }))
                        .eqJoin(r.row("beep")("beepersid"), r.table("users")).without({ right: { ...withouts } })
                        .map((doc) => ({
                            beep: doc("left")("beep"),
                            rider: doc("left")("rider"),
                            beeper: doc("right")
                        }))
                        .orderBy(r.desc(r.row('beep')('timeEnteredQueue'))).slice(offset).run((await database.getConn()));
                }
            }
            else {
                if (show) {
                    cursor = await r.table("beeps")
                        .eqJoin("riderid", r.table("users")).without({ right: {password: true}})
                        .map((doc) => ({
                            beep: doc("left"),
                            rider: doc("right")
                        }))
                        .eqJoin(r.row("beep")("beepersid"), r.table("users")).without({ right: { ...withouts } })
                        .map((doc) => ({
                            beep: doc("left")("beep"),
                            rider: doc("left")("rider"),
                            beeper: doc("right")
                        }))
                        .orderBy(r.desc(r.row('beep')('timeEnteredQueue'))).limit(show).run((await database.getConn()));
                }
                else {
                    cursor = await r.table("beeps")
                        .eqJoin("riderid", r.table("users")).without({ right: { ...withouts} })
                        .map((doc) => ({
                            beep: doc("left"),
                            rider: doc("right")
                        }))
                        .eqJoin(r.row("beep")("beepersid"), r.table("users")).without({ right: { ...withouts } })
                        .map((doc) => ({
                            beep: doc("left")("beep"),
                            rider: doc("left")("rider"),
                            beeper: doc("right")
                        }))
                        .orderBy(r.desc(r.row('beep')('timeEnteredQueue'))).run((await database.getConn()));
                }
            }

            const result = await cursor.toArray();

            this.setStatus(200);

            return {
                status: APIStatus.Success,
                total: numberOfBeeps,
                beeps: result
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
     * Get a beep entry
     *
     * An admin can get the details of a single beep
     *
     * @returns {BeepResponse | APIResponse}
     */
    /*
    @Example<BeepResponse>({
        status: APIStatus.Success,
        beep: {
        }
    })
    */
    @Response<APIResponse>(404, "Not found", {
        status: APIStatus.Error,
        message: "This beep entry does not exist"
    })
    @Response<APIResponse>(500, "Server Error", {
        status: APIStatus.Error,
        message: "Unable to get beep entry"
    })
    @Security("token", ["admin"])
    @Get("{id}")
    public async getBeep(@Path() id: string): Promise<BeepResponse | APIResponse> {
        try {
            const result = await r.table("beeps").get(id).run((await database.getConn())) as BeepEntry;

            if (!result) {
                this.setStatus(404);
                return new APIResponse(APIStatus.Error, "This beep entry does not exist");
            }

            return {
                status: APIStatus.Success, 
                beep: result
            };
        }
        catch (error) {
            Sentry.captureException(error);
            this.setStatus(500);
            return new APIResponse(APIStatus.Error, error);
        }
    }
}
