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

export interface RiderHistoryResult {
    status: APIStatus;
    data: BeepTableResult[];
}

export interface BeeperHistoryResult {
    status: APIStatus;
    data: BeepTableResult[];
}
