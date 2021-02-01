import { APIStatus, APIResponse } from '../utils/Error';
import { Get, Response, Tags, Route, Controller, Security, Query, Example, Path } from 'tsoa';
import * as Sentry from "@sentry/node";
import { BeepResponse, BeepsResponse } from './beeps';
import {BeepORM} from '../app';
import {Beep} from '../entities/Beep';

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
    /*
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
    */
    @Response<APIResponse>(500, "Server error", {
        status: APIStatus.Error,
        message: "Unable to get beeps"
    })
    @Security("token", ["admin"])
    @Get()
    public async getBeeps(@Query() offset?: number, @Query() show?: number): Promise<BeepsResponse | APIResponse> {
        const [beeps, count] = await BeepORM.em.findAndCount(Beep, {}, { limit: show, offset: offset });

        return {
            status: APIStatus.Success,
            total: count,
            beeps: beeps
        };
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
        const result = await BeepORM.beepRepository.findOne(id);

        if (!result) {
            this.setStatus(404);
            return new APIResponse(APIStatus.Error, "This beep entry does not exist");
        }

        return {
            status: APIStatus.Success, 
            beep: result
        };
    }
}
