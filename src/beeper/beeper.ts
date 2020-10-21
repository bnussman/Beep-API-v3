import { UserPluckResult } from "../types/beep";
import { APIStatus } from "../utils/Error";

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

/**
 * Beepers Queue Response
 *
 * @example {
 *   "status": "success",
 *   "queue": [
 *     {
 *       "destination": "Tasty",
 *       "groupSize": 1,
 *       "id": "b500bb45-094e-437c-887b-e6b6d815ba12",
 *       "isAccepted": true,
 *       "origin": "241 Marich Ln Marich Ln Boone, NC 28607",
 *       "riderid": "22192b90-54f8-49b5-9dcf-26049454716b",
 *       "state": 0,
 *       "timeEnteredQueue": 1603318791872,
 *       "personalInfo": {
 *         "first": "Banks",
 *         "isStudent": true,
 *         "last": "Nussman",
 *         "phone": "7049968597",
 *         "venmo": "banksnussman"
 *       }
 *     }
 *   ]
 * }
 */
export interface GetBeeperQueueResult {
    status: APIStatus,
    queue: BeepQueueTableEntry[]; 
}

/**
 * Beeper Queue Entry
 *
 * @example {
 *   "destination": "Hoey",
 *   "groupSize": 1,
 *   "id": "b500bb45-094e-437c-887b-e6b6d815ba12",
 *   "isAccepted": true,
 *   "origin": "241 Marich Ln Marich Ln Boone, NC 28607",
 *   "riderid": "22192b90-54f8-49b5-9dcf-26049454716b",
 *   "state": 0,
 *   "timeEnteredQueue": 1603318791872,
 *   "personalInfo": {
 *     "first": "Banks",
 *     "isStudent": true,
 *     "last": "Nussman",
 *     "phone": "7049968597",
 *     "venmo": "banksnussman"
 *   }
 * }
 */
export interface BeepQueueTableEntry {
    id: string;
    destination: string;
    origin: string;
    groupSize: number;
    isAccepted: boolean;
    riderid: string;
    state: number;
    timeEnteredQueue: number;
    personalInfo?: UserPluckResult;
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
