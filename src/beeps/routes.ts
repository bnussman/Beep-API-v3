import { APIStatus, APIResponse } from '../utils/Error';
import { Get, Response, Tags, Route, Controller, Security, Query, Path } from 'tsoa';
import * as Sentry from "@sentry/node";
import { BeepResponse, BeepsResponse } from './beeps';
import {BeepORM} from '../app';
import {Beep} from '../entities/Beep';
import {QueryOrder} from '@mikro-orm/core';

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
    @Security("token", ["admin"])
    @Get()
    public async getBeeps(@Query() offset?: number, @Query() show?: number): Promise<BeepsResponse | APIResponse> {
        const [beeps, count] = await BeepORM.beepRepository.findAndCount({}, { orderBy: { doneTime: QueryOrder.DESC }, limit: show, offset: offset, populate: ['beeper', 'rider'] });

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
