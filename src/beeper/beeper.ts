import { APIStatus } from "../utils/Error";
import { QueueEntry } from '../entities/QueueEntry';

/**
 * Set Beeprs Status Paramaters
 *
 * @example {
 *   "isBeeping": true,
 *   "singlesRate": "3",
 *   "groupRate": "2",
 *   "capacity": "4",
 *   "masksRequired": true
 * }
 */
export interface SetBeeperStatusParams {
    singlesRate: string | number;
    groupRate: string | number;
    capacity: number;
    isBeeping: boolean;
    masksRequired: boolean;
}

export interface GetBeeperQueueResult {
    status: APIStatus,
    queue: QueueEntry[]; 
}

/**
 * Set Beepers Queue Params
 *
 * @example {
 *   "value": "accept",
 *   "queueID": "b500bb45-094e-437c-887b-e6b6d815ba12",
 *   "riderID": "22192b90-54f8-49b5-9dcf-26049454716b"
 * }
 */
export interface SetBeeperQueueParams {
    value: string;
    riderID: string;
    queueID: string;
}
