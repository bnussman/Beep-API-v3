import { APIStatus } from '../utils/Error';

/**
 * Get List of Beeps Example Response
 *
 * @example {
 *      "status": "success",
 *      "total": 137,
 *      "beeps": [
 *          {
 *              "beepersid": "22192b90-54f8-49b5-9dcf-26049454716b",
 *              "destination": "Gvyog",
 *              "groupSize": 1,
 *              "id": "09055a14-b719-41a4-ad2b-59487ea457a3",
 *              "isAccepted": true,
 *              "origin": "Hourse",
 *              "riderid": "e263518b-d14f-4461-8a57-2b6c4fa9c456",
 *              "state": 3,
 *              "timeEnteredQueue": 1604551229988
 *          },
 *          {
 *              "beepersid": "22192b90-54f8-49b5-9dcf-26049454716b",
 *              "destination": "Mars",
 *              "groupSize": 1,
 *              "id": "0aaa93ae-aad1-4198-a719-49cb9a47754c",
 *              "isAccepted": true,
 *              "origin": "Hoey ",
 *              "riderid": "de623bd0-c000-4f74-a342-2620da1c6e9f",
 *              "state": 3,
 *              "timeEnteredQueue": 1604813923542
 *          }
 *      ]
 *  }
 */
export interface BeepsResponse {
    status: APIStatus,
    total: number;
    beeps: BeepEntry[]
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
    timeDone?: number;
}
