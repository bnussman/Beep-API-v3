import { APIStatus } from '../utils/Error';
import { LimitedUser } from '../users/users';

/**
 * Example of a submitted report
 *
 * @example {
 *   "id": "0c4dd21b-54bc-4e51-bed7-a7fd1ade00fe",
 *   "reason": "this user is an asshole"
 * }
 */
export interface ReportUserParams {
    id: string;
    reason: string;
    beepEventId?: string;
}

/**
 * List of all reports
 *
 * @example {
 *   "status": "success",
 *   "reports": [
 *      {
 *          "id": "0c4dd21b-54bc-4e51-bed7-a7fd1ade00fe",
 *          "reason": "Actual sexiest beeper 🤤",
 *          "reportedId": "22192b90-54f8-49b5-9dcf-26049454716b",
 *          "reporterId": "de623bd0-c000-4f74-a342-2620da1c6e9f",
 *          "timestamp": 1603395053099
 *      },
 *      {
 *          "id": "c5008c11-d7ea-4f69-9b42-6698237d15bb",
 *          "reason": "hhgfh",
 *          "reportedId": "22192b90-54f8-49b5-9dcf-26049454716b",
 *          "reporterId": "ca34cc7b-de97-40b7-a1ab-148f6c43d073",
 *          "timestamp": 1607803770171
 *      },
 *      {
 *          "id": "70c21248-b6e7-443a-b2c0-9b4ef4392b32",
 *          "reason": "test",
 *          "reportedId": "22192b90-54f8-49b5-9dcf-26049454716b",
 *          "reporterId": "22192b90-54f8-49b5-9dcf-26049454716b",
 *          "timestamp": 1602892848454
 *      }
 *    ]
 *  }
 */
export interface ReportsResponse {
    status: APIStatus, 
    total: number,
    reports: Report[]
}

/**
 * Example of a get report response
 *
 * @exmaple {
 *    "status": "success",
 *    "report": {
 *        "adminNotes": null,
 *        "beepEventId": "5553eebe-fb8d-446a-8c46-40e5b033a905",
 *        "handled": false,
 *        "handledByUser": {
 *            "first": "Banks",
 *            "id": "22192b90-54f8-49b5-9dcf-26049454716b",
 *            "last": "Nussman",
 *            "photoUrl": "https://ridebeepapp.s3.amazonaws.com/images/22192b90-54f8-49b5-9dcf-26049454716b-1610644210939.jpg",
 *            "username": "banks"
 *        },
 *        "id": "bd8158e2-5a62-482f-866e-5a29c0adac4a",
 *        "reason": "He tried to kill me AGAIN!!!!!",
 *        "reported": {
 *            "first": "Banks",
 *            "id": "22192b90-54f8-49b5-9dcf-26049454716b",
 *            "last": "Nussman",
 *            "photoUrl": "https://ridebeepapp.s3.amazonaws.com/images/22192b90-54f8-49b5-9dcf-26049454716b-1610644210939.jpg",
 *            "username": "banks"
 *        },
 *        "reporter": {
 *            "first": "William",
 *            "id": "911e0810-cfaf-4b7c-a707-74c3bd1d48c2",
 *            "last": "Nussman",
 *            "photoUrl": "https://ridebeepapp.s3.amazonaws.com/images/911e0810-cfaf-4b7c-a707-74c3bd1d48c2-1609649054314.jpg",
 *            "username": "william"
 *        },
 *        "timestamp": 1610657263989
 *    }
 * }
 */
export interface ReportResponse {
    status: APIStatus;
    report: Report;
}

/**
 * Single Report
 *
 * @example {
 *        "adminNotes": null,
 *        "beepEventId": "5553eebe-fb8d-446a-8c46-40e5b033a905",
 *        "handled": false,
 *        "handledByUser": {
 *            "first": "Banks",
 *            "id": "22192b90-54f8-49b5-9dcf-26049454716b",
 *            "last": "Nussman",
 *            "photoUrl": "https://ridebeepapp.s3.amazonaws.com/images/22192b90-54f8-49b5-9dcf-26049454716b-1610644210939.jpg",
 *            "username": "banks"
 *        },
 *        "id": "bd8158e2-5a62-482f-866e-5a29c0adac4a",
 *        "reason": "He tried to kill me AGAIN!!!!!",
 *        "reported": {
 *            "first": "Banks",
 *            "id": "22192b90-54f8-49b5-9dcf-26049454716b",
 *            "last": "Nussman",
 *            "photoUrl": "https://ridebeepapp.s3.amazonaws.com/images/22192b90-54f8-49b5-9dcf-26049454716b-1610644210939.jpg",
 *            "username": "banks"
 *        },
 *        "reporter": {
 *            "first": "William",
 *            "id": "911e0810-cfaf-4b7c-a707-74c3bd1d48c2",
 *            "last": "Nussman",
 *            "photoUrl": "https://ridebeepapp.s3.amazonaws.com/images/911e0810-cfaf-4b7c-a707-74c3bd1d48c2-1609649054314.jpg",
 *            "username": "william"
 *        },
 *        "timestamp": 1610657263989
 *    }
 */
export interface Report {
    id?: string;
    reason: string;
    reported: LimitedUser;
    reporter: LimitedUser;
    handledByUser: LimitedUser;
    handled: boolean;
    adminNotes: string | null;
    beepEventId?: string;
    timestamp: number;
}

/**
 * Update a Report
 *
 * @example {
 *   "adminNotes": "Guy was mad at other guy for eating in his Tacoma",
 *   "handled": true
 * }
 */
export interface UpdateReportParams {
    adminNotes?: string | null;
    handled?: boolean;
}
