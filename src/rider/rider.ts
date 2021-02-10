import { APIStatus } from "../utils/Error";
import { User } from "../entities/User";

/**
 * Choose Beep Params
 * 
 * @example {
 *   "origin": "397 Perkinsville Dr Perkinsville Drive Boone, North Carolina 28607",
 *   "destination": "Test",
 *   "groupSize": "1",
 *   "beepersID": "22192b90-54f8-49b5-9dcf-26049454716b"
 * }
 */
export interface ChooseBeepParams {
    groupSize: number;
    origin: string;
    destination: string;
    beepersID: string;
}

export interface ChooseBeepResponse {
    status: APIStatus,
    beeper: User
}

/**
 * Rider Status Response
 *
 * @example {
 *   "status": "success",
 *   "groupSize": 1,
 *   "isAccepted": true,
 *   "ridersQueuePosition": 0,
 *   "state": 0,
 *   "beeper": {
 *     "id": "22192b90-54f8-49b5-9dcf-26049454716b",
 *     "first": "Banks",
 *     "last": "Nussman",
 *     "phone": "7049968597",
 *     "venmo": "banksnussman",
 *     "queueSize": 1,
 *     "singlesRate": "3",
 *     "groupRate": "2",
 *     "capacity": 4,
 *     "userLevel": 0,
 *     "isStudent": true,
 *     "masksRequired": true
 *   }
 * }
 */
export interface RiderStatusResult {
    status: APIStatus;
    groupSize: number;
    isAccepted: boolean;
    ridersQueuePosition?: number;
    state?: number;
    beeper: User;
    origin: string;
    destination: string;
}

export interface BeeperListResult {
    status: APIStatus,
    beepers: User[];
}
