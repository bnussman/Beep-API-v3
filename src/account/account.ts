import {ObjectId} from "@mikro-orm/mongodb";
import { BeepEntry, MinimalUser } from "../beeps/beeps";
import { BeepTableResult } from "../types/beep";
import { APIStatus } from "../utils/Error";

/**
 * Edit User Account Paramaters
 *
 * @example {
 *   "first": "Test",
 *   "last": "User",
 *   "email": "bnussman@gmail.com",
 *   "phone": "7048414949",
 *   "venmo": "testuser"
 * }
 */
export interface EditAccountParams {
    first: string;
    last: string;
    email: string;
    phone: string;
    venmo: string;
}

/**
 * Change Password Paramaters
 *
 * @example {
 *   "password": "879f7a7fj6178bdafjk732vj1s9x"
 * }
 */
export interface ChangePasswordParams {
    password: string;
}

/**
 * Update Expo Push Token
 *
 * @example {
 *   "expoPushToken": "ExponentPushToken[xv1qZtFzJY_yVFHK-dmWlN]"
 * }
 */
export interface UpdatePushTokenParams {
    expoPushToken: string;
}

/**
 * When user POSTs to verify their account, they need to send the
 * id of the verify entry
 *
 * @example {
 *   "id": "22192b90-54f8-49b5-9dcf-26049454716b"
 * }
 */
export interface VerifyAccountParams {
    id: string;
}

/**
 * Result of Verifiying your account
 *
 * @example {
 *   status: "success",
 *   message: "Successfully verified email",
 *   data: {
 *     email: "bnussman@gmail.com",
 *     isEmailVerified: true
 *   }
 * }
 */
export interface VerifyAccountResult {
    status: APIStatus;
    message: string;
    data: EmailData;
}

/**
 * Data about a user's email
 *
 * @example {
 *     email: "bnussman@gmail.com",
 *     isEmailVerified: true
 * }
 */
interface EmailData {
    isEmailVerified: boolean;
    isStudent?: boolean;
    email: string;
}

/**
 * @example {
 *     "status": "success",
 *     "data": [
 *         {
 *             "beep": {
 *                 "beepersid": "ca34cc7b-de97-40b7-a1ab-148f6c43d073",
 *                 "destination": "Hoey Hall",
 *                 "doneTime": 1608484088896,
 *                 "groupSize": 1,
 *                 "id": "58be9754-d973-42a7-ab6c-682ff41d7da9",
 *                 "isAccepted": true,
 *                 "origin": "5617 Camelot Dr Camelot Dr Charlotte, NC 28270",
 *                 "riderid": "22192b90-54f8-49b5-9dcf-26049454716b",
 *                 "state": 3,
 *                 "timeEnteredQueue": 1608484062417
 *             },
 *             "beeper": {
 *                 "first": "Test",
 *                 "id": "ca34cc7b-de97-40b7-a1ab-148f6c43d073",
 *                 "last": "User",
 *                 "photoUrl": "https://ridebeepapp.s3.amazonaws.com/images/ca34cc7b-de97-40b7-a1ab-148f6c43d073-1607039319321.jpg",
 *                 "username": "test"
 *             }
 *         }
 *     ]
 * }
 */
export interface RiderHistoryResult {
    status: APIStatus;
    data: RiderHistoryWithBeeperData[];
}

/**
 * @example {
 *   "beep": {
 *     "beepersid": "ca34cc7b-de97-40b7-a1ab-148f6c43d073",
 *     "destination": "Hoey Hall",
 *     "doneTime": 1608484088896,
 *     "groupSize": 1,
 *     "id": "58be9754-d973-42a7-ab6c-682ff41d7da9",
 *     "isAccepted": true,
 *     "origin": "5617 Camelot Dr Camelot Dr Charlotte, NC 28270",
 *     "riderid": "22192b90-54f8-49b5-9dcf-26049454716b",
 *     "state": 3,
 *     "timeEnteredQueue": 1608484062417
 *   },
 *   "beeper": {
 *     "first": "Test",
 *     "id": "ca34cc7b-de97-40b7-a1ab-148f6c43d073",
 *     "last": "User",
 *     "photoUrl": "https://ridebeepapp.s3.amazonaws.com/images/ca34cc7b-de97-40b7-a1ab-148f6c43d073-1607039319321.jpg",
 *     "username": "test"
 *     }
 *   }
 */
export interface RiderHistoryWithBeeperData {
    beep: BeepEntry;
    beeper: MinimalUser;
}

/**
 * @example {
 *      "status": "success",
 *      "data": [
 *          {
 *              "beep": {
 *                  "beepersid": "22192b90-54f8-49b5-9dcf-26049454716b",
 *                  "destination": "5617 Camelot Dr. Chatlotte, NC",
 *                  "doneTime": 1608504258230,
 *                  "groupSize": 3,
 *                  "id": "9f109d79-d494-4e81-91c8-20cc95edc6f8",
 *                  "isAccepted": true,
 *                  "origin": "1586-B U.S. Hwy 421 S U.S. Highway 421 South Boone, North Carolina 28607",
 *                  "riderid": "ca34cc7b-de97-40b7-a1ab-148f6c43d073",
 *                  "state": 3,
 *                  "timeEnteredQueue": 1608504246661
 *              },
 *              "rider": {
 *                  "first": "Test",
 *                  "id": "ca34cc7b-de97-40b7-a1ab-148f6c43d073",
 *                  "last": "User",
 *                  "photoUrl": "https://ridebeepapp.s3.amazonaws.com/images/ca34cc7b-de97-40b7-a1ab-148f6c43d073-1607039319321.jpg",
 *                  "username": "test"
 *              }
 *          }
 *      ]
 *  }
 */
export interface BeeperHistoryResult {
    status: APIStatus;
    data: BeepEntryWithRiderData[];
}

/**
 * @example {
 *   "beep": {
 *      "beepersid": "22192b90-54f8-49b5-9dcf-26049454716b",
 *      "destination": "5617 Camelot Dr. Chatlotte, NC",
 *      "doneTime": 1608504258230,
 *      "groupSize": 3,
 *      "id": "9f109d79-d494-4e81-91c8-20cc95edc6f8",
 *      "isAccepted": true,
 *      "origin": "1586-B U.S. Hwy 421 S U.S. Highway 421 South Boone, North Carolina 28607",
 *      "riderid": "ca34cc7b-de97-40b7-a1ab-148f6c43d073",
 *      "state": 3,
 *      "timeEnteredQueue": 1608504246661
 *   },
 *   "rider": {
 *      "first": "Test",
 *      "id": "ca34cc7b-de97-40b7-a1ab-148f6c43d073",
 *      "last": "User",
 *      "photoUrl": "https://ridebeepapp.s3.amazonaws.com/images/ca34cc7b-de97-40b7-a1ab-148f6c43d073-1607039319321.jpg",
 *      "username": "test"
 *   }
 * }
 */
export interface BeepEntryWithRiderData {
    beep: BeepEntry;
    rider: MinimalUser;
}
