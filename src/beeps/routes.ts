import { APIStatus, APIResponse } from '../utils/Error';
import { Get, Response, Tags, Route, Controller, Security, Query, Example } from 'tsoa';
import { getNumBeeps } from './helpers';
import * as Sentry from "@sentry/node";
import * as r from 'rethinkdb';
import { BeepsResponse } from './beeps';
import database from '../utils/db';

@Tags("beeps")
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
        total: 20,
        beeps: [
            {
                beepersid: "22192b90-54f8-49b5-9dcf-26049454716b",
                destination: "Gvyog",
                groupSize: 1,
                id: "09055a14-b719-41a4-ad2b-59487ea457a3",
                isAccepted: true,
                origin: "Hourse",
                riderid: "e263518b-d14f-4461-8a57-2b6c4fa9c456",
                state: 3,
                timeEnteredQueue: 1604551229988
            },
            {
                beepersid: "22192b90-54f8-49b5-9dcf-26049454716b",
                destination: "Mars",
                groupSize: 1,
                id: "0aaa93ae-aad1-4198-a719-49cb9a47754c",
                isAccepted: true,
                origin: "Hoey ",
                riderid: "de623bd0-c000-4f74-a342-2620da1c6e9f",
                state: 3,
                timeEnteredQueue: 1604813923542
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
                    cursor = await r.table("beeps").orderBy(r.desc('timeEnteredQueue')).slice(offset, offset + show).run((await database.getConnHistory()));
                }
                else {
                    cursor = await r.table("beeps").orderBy(r.desc('timeEnteredQueue')).slice(offset).run((await database.getConnHistory()));
                }
            }
            else {
                if (show) {
                    cursor = await r.table("beeps").orderBy(r.desc('timeEnteredQueue')).limit(show).run((await database.getConnHistory()));
                }
                else {
                    cursor = await r.table("beeps").orderBy(r.desc('timeEnteredQueue')).run((await database.getConnHistory()));
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
            Sentry.captureException(error);
            this.setStatus(500);
            return new APIResponse(APIStatus.Error, "Unable to get reports list");
        }
    }

}
