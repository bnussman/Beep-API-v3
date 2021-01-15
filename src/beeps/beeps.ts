import {LimitedUser} from 'src/users/users';
import { APIStatus } from '../utils/Error';

/**
 * Get List of Beeps Example Response
 *
 * @example {
 *      "status": "success",
 *      "total": 1,
 *      "beeps": [
 *          {
 *              "beep": {
 *                  "beepersid": "ca34cc7b-de97-40b7-a1ab-148f6c43d073",
 *                  "destination": "Hoey Hall",
 *                  "doneTime": 1608484088896,
 *                  "groupSize": 1,
 *                  "id": "58be9754-d973-42a7-ab6c-682ff41d7da9",
 *                  "isAccepted": true,
 *                  "origin": "5617 Camelot Dr Camelot Dr Charlotte, NC 28270",
 *                  "riderid": "22192b90-54f8-49b5-9dcf-26049454716b",
 *                  "state": 3,
 *                  "timeEnteredQueue": 1608484062417
 *              },
 *              "beeper": {
 *                  "first": "Test",
 *                  "id": "ca34cc7b-de97-40b7-a1ab-148f6c43d073",
 *                  "last": "User",
 *                  "photoUrl": "https://ridebeepapp.s3.amazonaws.com/images/ca34cc7b-de97-40b7-a1ab-148f6c43d073-1607039319321.jpg",
 *                  "username": "test"
 *              },
 *              "rider": {
 *                  "first": "Banks",
 *                  "id": "22192b90-54f8-49b5-9dcf-26049454716b",
 *                  "last": "Nussman",
 *                  "photoUrl": "https://ridebeepapp.s3.amazonaws.com/images/22192b90-54f8-49b5-9dcf-26049454716b-1608086704764.jpg",
 *                  "username": "banks"
 *              }
 *          }
 *      ]
 *  } 
 */
export interface BeepsResponse {
    status: APIStatus,
    total: number;
    beeps: BeepEntryWithUsers[]
}

export interface BeepEntryWithUsers {
    beep: BeepEntry;
    beeper: LimitedUser;
    rider: LimitedUser;
}

export interface BeepResponse {
    status: APIStatus;
    beep: BeepEntry;
}

/**
 * Beep Entry Example
 *
 * @example {
 *      "beepersid": "22192b90-54f8-49b5-9dcf-26049454716b",
 *      "destination": "Mars",
 *      "groupSize": 1,
 *      "id": "0aaa93ae-aad1-4198-a719-49cb9a47754c",
 *      "isAccepted": true,
 *      "origin": "Hoey ",
 *      "riderid": "de623bd0-c000-4f74-a342-2620da1c6e9f",
 *      "state": 3,
 *      "timeEnteredQueue": 1604813923542
 *  }
 */
export interface BeepEntry {
    id: string;
    beepersid: string;
    riderid: string;
    origin: string;
    destination: string;
    groupSize: number;
    isAccepted: boolean;
    state: number;
    timeEnteredQueue: number;
    doneTime?: number;
}
