import { APIStatus } from "../utils/Error";

/**
 * Login Parameters
 *
 * @example {
 *     "username": "banks",
 *     "password": "d9a63ka9cf982bf8921bs9",
 *     "expoPushToken": "ExponentPushToken[xv1qZtFzJY_yVFHK-dmWlN]"
 * }
 */
export interface LoginParams {
    username: string;
    password: string;
    expoPushToken?: string;
}


/**
 * Sign Up Parameters
 *
 * @example {
 *     "first": "Banks",
 *     "last": "Nussman",
 *     "email": "banks@nussman.us",
 *     "phone": "7048414949",
 *     "venmo": "banksnussman",
 *     "username": "banks",
 *     "password": "d9a63ka9cf982bf8921bs9",
 *     "expoPushToken": "ExponentPushToken[xv1qZtFzJY_yVFHK-dmWlN]"
 * }
 */
export interface SignUpParams {
    first: string;
    last: string;
    email: string;
    phone: string;
    venmo: string;
    username: string;
    password: string;
    expoPushToken?: string;
}

/**
 * Logout Parameters
 *
 * @example {
 *     "isApp": true
 * }
 */
export interface LogoutParams {
   isApp?: boolean; 
}

/**
 * Push Token Parameters
 *
 * @example {
 *     "tokenid": "22192b90-54f8-49b5-9dcf-26049454716b"
 * }
 */
export interface RemoveTokenParams {
    tokenid: string; 
}

/**
 * Forgot Password Parameters
 *
 * @example {
 *     "email": "banks@nussman.us"
 * }
 */
export interface ForgotPasswordParams {
    email: string; 
}

/**
 * Reset Password Parameters
 *
 * @example {
 *     "id": "22192b90-54f8-49b5-9dcf-26049454716b",
 *     "password": "7632bf6w9wfdb6qqfigyr6"
 * }
 */
export interface ResetPasswordParams {
    id: string;
    password: string;
}

/**
 * Login Response
 *
 * @example {
 *     "status": "success",
 *     "id": "22192b90-54f8-49b5-9dcf-26049454716b",
 *     "username": "banks",
 *     "first": "Banks",
 *     "last": "Nussman",
 *     "email": "nussmanwb@appstate.edu",
 *     "phone": "7049968597",
 *     "venmo": "banksnussman",
 *     "token": "46377129-d3dc-4cff-afab-db1db35b642b",
 *     "tokenid": "74ff2e4e-0703-41dc-aa8f-13f3c3862a35",
 *     "singlesRate": "3",
 *     "groupRate": "2",
 *     "capacity": "4",
 *     "isBeeping": false,
 *     "userLevel": 0,
 *     "isEmailVerified": true,
 *     "isStudent": true,
 *     "masksRequired": true
 * }
 */
export interface LoginResponse {
    status: APIStatus,
    id: string,
    username: string,
    first: string,
    last: string,
    email: string,
    phone: string,
    venmo: string,
    token: string,
    tokenid: string,
    singlesRate: string | number,
    groupRate: string | number,
    capacity: string | number,
    isBeeping: boolean,
    userLevel: number,
    isEmailVerified: boolean,
    isStudent: boolean,
    masksRequired: boolean
}
