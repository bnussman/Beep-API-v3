import { APIStatus } from "../utils/Error";

export interface EditAccountParams {
    first: string;
    last: string;
    email: string;
    phone: string;
    venmo: string;
}

export interface ChangePasswordParams {
    password: string;
}

export interface UpdatePushTokenParams {
    expoPushToken: string;
}

export interface VerifyAccountParams {
    id: string;
}

export interface VerifyAccountResult {
    status: APIStatus;
    message: string;
    data: EmailData;
}

interface EmailData {
    isEmailVerified: boolean;
    isStudent?: boolean;
    email: string;
}
