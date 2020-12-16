import { APIStatus } from "../utils/Error";

/**
 * Public User Result
 *
 * @example {
 *   "capacity": 4,
 *   "first": "Test",
 *   "groupRate": "2",
 *   "isBeeping": false,
 *   "isStudent": false,
 *   "last": "User",
 *   "masksRequired": true,
 *   "queueSize": 0,
 *   "singlesRate": "3",
 *   "venmo": "testuser"
 * }
*/
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
    photoUrl: string | null;
}

/**
 * Public User Result
 *
 * @example {
 *   "status": "success",
 *   "user": {
 *     "capacity": 4,
 *     "first": "Test",
 *     "groupRate": "2",
 *     "isBeeping": false,
 *     "isStudent": false,
 *     "last": "User",
 *     "masksRequired": true,
 *     "queueSize": 0,
 *     "singlesRate": "3",
 *     "venmo": "testuser"
 *   }
 * }
*/
export interface UserResult {
    status: APIStatus;
    user: PublicUser;
}

//TODO: example data
export interface DetailedUser {
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
    photoUrl: string | null;
    id: string;
    email: string;
    inQueueOfUserID: string | null;
    isEmailVerified: boolean;
    phone: string;
    pushToken: string;
    username: string;
    userLevel: number;
}

//TODO: example data
export interface UsersResult {
    status: APIStatus;
    total: number,
    users: DetailedUser[];
}

/**
 * Edit User Params
 *
 * @example {
 *     "venmo": "bankstestvenmo",
 *     "first": "Banks"
 * }
*/
export interface EditUserParams {
    first?: string;
    last?: string;
    capacity?: number;
    isStudent?: boolean;
    masksRequired?: boolean;
    queueSize?: number;
    singlesRate?: number | string;
    groupRate?: number | string;
    venmo?: string;
    isBeeping?: boolean;
    photoUrl?: string | null;
    id?: string;
    email?: string;
    inQueueOfUserID?: string | null;
    isEmailVerified?: boolean;
    phone?: string;
    pushToken?: string;
    username?: string;
    userLevel?: number;
}
