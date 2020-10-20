import { APIStatus } from "../utils/Error";

export interface PublicUser {
    first: string;
    last: string;
    capacity: number;
    isStudent: boolean;
    masksRequired: boolean;
    queueSize: number;
    singlesRate: number | string;
    groupRate: number | string;
    venmo: string;
    isBeeping: boolean;
}

export interface UserResult {
    status: APIStatus;
    user: PublicUser;
}

export interface ReportUserParams {
    id: string;
    reason: string;
}
