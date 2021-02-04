import { APIStatus } from '../utils/Error';
import { Report } from '../entities/Report';

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
    beep?: string;
}

export interface ReportsResponse {
    status: APIStatus, 
    total: number,
    reports: Report[]
}

export interface ReportResponse {
    status: APIStatus;
    report: Report;
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
    notes?: string;
    handled?: boolean;
}
