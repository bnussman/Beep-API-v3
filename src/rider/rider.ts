import { APIStatus } from "../utils/Error";

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

/**
 * Choose Beep Response
 *
 * @example {
 *  "status": "success",
 *  "beeper": {
 *    "id": "22192b90-54f8-49b5-9dcf-26049454716b",
 *    "first": "Banks",
 *    "last": "Nussman",
 *    "queueSize": 1,
 *    "singlesRate": "3",
 *    "groupRate": "2",
 *    "userLevel": 0,
 *    "isStudent": true,
 *    "capacity": 4,
 *    "masksRequired": true
 *  }
 * } 
 */
export interface ChooseBeepResponse {
    status: APIStatus,
    beeper: BeeperData
}

/**
 * Beeper Data
 *
 * @example {
 *    "id": "22192b90-54f8-49b5-9dcf-26049454716b",
 *    "first": "Banks",
 *    "last": "Nussman",
 *    "queueSize": 1,
 *    "singlesRate": "3",
 *    "groupRate": "2",
 *    "userLevel": 0,
 *    "isStudent": true,
 *    "capacity": 4,
 *    "masksRequired": true,
 *    "photoUrl": "https://ridebeepapp.s3.amazonaws.com/images/22192b90-54f8-49b5-9dcf-26049454716b-1604517623067.jpg"
 * } 
 */
export interface BeeperData {
    id: string;
    first: string;
    last: string;
    queueSize: number;
    singlesRate: number | string;
    groupRate: number | string;
    userLevel: number;
    isStudent: boolean;
    capacity: number;
    masksRequired: boolean;
    phone?: string;
    venmo?: string;
    photoUrl: string | null;
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
    beeper: BeeperData
    origin: string;
    destination: string;
}

/**
 * Leave Queue Paramaters
 *
 * @example {
 *   "beepersID": "22192b90-54f8-49b5-9dcf-26049454716b"
 * }
 */
export interface LeaveQueueParams {
    beepersID: string;
}

/**
 * Beeper List Result 
 *
 * @example {
 *   "status": "success",
 *   "beeperList": [
 *     {
 *       "capacity": 4,
 *       "first": "Banks",
 *       "groupRate": "2",
 *       "id": "22192b90-54f8-49b5-9dcf-26049454716b",
 *       "isStudent": true,
 *       "last": "Nussman",
 *       "masksRequired": true,
 *       "queueSize": 0,
 *       "singlesRate": "3",
 *       "userLevel": 0
 *     }
 *   ]
 * }
 */
export interface BeeperListResult {
    status: APIStatus,
    beeperList: BeeperListItem[];
}

/**
 * Beeper List Item 
 *
 * @example {
 *   "capacity": 4,
 *   "first": "Banks",
 *   "groupRate": "2",
 *   "id": "22192b90-54f8-49b5-9dcf-26049454716b",
 *   "isStudent": true,
 *   "last": "Nussman",
 *   "masksRequired": true,
 *   "queueSize": 0,
 *   "singlesRate": "3",
 *   "userLevel": 0
 *   "photoUrl": "https://ridebeepapp.s3.amazonaws.com/images/22192b90-54f8-49b5-9dcf-26049454716b-1604517623067.jpg"
 * }
 */
export interface BeeperListItem {
    first: string;
    last: string;
    queueSize: number;
    id: string;
    singlesRate: string | number;
    groupRate: string | number;
    capacity: number;
    userLevel: number;
    isStudent: boolean;
    masksRequired: boolean;
    photoUrl: string | null;
}
