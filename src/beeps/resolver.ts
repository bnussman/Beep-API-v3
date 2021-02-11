import { APIStatus, APIResponse } from '../utils/Error';
import * as Sentry from "@sentry/node";
import { BeepResponse, BeepsResponse } from './beeps';
import {BeepORM} from '../app';
import {Beep} from '../entities/Beep';
import {QueryOrder} from '@mikro-orm/core';

export class BeepsController {

    public async getBeeps(offset?: number, show?: number): Promise<BeepsResponse | APIResponse> {
        const [beeps, count] = await BeepORM.beepRepository.findAndCount({}, { orderBy: { doneTime: QueryOrder.DESC }, limit: show, offset: offset, populate: ['beeper', 'rider'] });

        return {
            status: APIStatus.Success,
            total: count,
            beeps: beeps
        };
    }

    public async getBeep(id: string): Promise<BeepResponse | APIResponse> {
        const result = await BeepORM.beepRepository.findOne(id);

        if (!result) {
            return new APIResponse(APIStatus.Error, "This beep entry does not exist");
        }

        return {
            status: APIStatus.Success, 
            beep: result
        };
    }
}
