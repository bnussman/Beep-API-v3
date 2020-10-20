import { APIStatus } from "../utils/Error";

export interface LoginParams {
    username: string;
    password: string;
    expoPushToken?: string;
}

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

export interface LogoutParams {
   isApp?: boolean; 
}

export interface RemoveTokenParams {
    tokenid: string; 
}

export interface ForgotPasswordParams {
    email: string; 
}

export interface ResetPasswordParams {
    id: string;
    password: string;
}

export interface LoginResponse {
    status: APIStatus.Success,
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
    capacity: number,
    isBeeping: boolean,
    userLevel: number,
    isEmailVerified: boolean,
    isStudent: boolean,
    masksRequired: boolean
}
