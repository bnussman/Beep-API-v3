import { APIStatus } from '../utils/Error';

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
 *        "adminNotes": "I called the guy and took care of it. ",
 *        "handled": true,
 *        "handledBy": "22192b90-54f8-49b5-9dcf-26049454716b",
 *        "id": "c5008c11-d7ea-4f69-9b42-6698237d15bb",
 *        "reason": "hhgfh",
 *        "reportedId": "22192b90-54f8-49b5-9dcf-26049454716b",
 *        "reporterId": "ca34cc7b-de97-40b7-a1ab-148f6c43d073",
 *        "timestamp": 1607803770171
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
 *   "id": "c5008c11-d7ea-4f69-9b42-6698237d15bb",
 *   "reason": "hhgfh",
 *   "reportedId": "22192b90-54f8-49b5-9dcf-26049454716b",
 *   "reporterId": "ca34cc7b-de97-40b7-a1ab-148f6c43d073",
 *   "timestamp": 1607803770171,
 *   "adminNotes": "Guy was mad at other guy for smoking weed in his Prius",
 *   "handled": false,
 *   "handledBy": null
 * }
 */
export interface Report {
    id?: string;
    reason: string;
    reportedId: string;
    reporterId: string;
    timestamp: number;
    adminNotes: string | null;
    handled: boolean;
    handledBy: string | null;
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
    adminNotes?: string;
    handled?: boolean;
}
