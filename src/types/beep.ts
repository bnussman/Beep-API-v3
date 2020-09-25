export interface TokenData {
    userid: string,
    token: string,
    tokenid: string
}

export interface User {
    id: string;
    first: string;
    last: string;
    email: string;
    phone: string;
    venmo: string;
    username: string;
    password: string;
    capacity: number;
    singlesRate: number;
    groupRate: number;
    pushToken: string | null;
    inQueueOfUserID: string | null;
    isBeeping: boolean;
    queueSize: number;
    userLevel: number;
    isEmailVerified: boolean;
    isStudent: boolean;
    token: string;
    tokenid: string;
}

export interface UserPluckResult {
    id?: string;
    first?: string;
    last?: string;
    email?: string;
    phone?: string;
    venmo?: string;
    username?: string;
    password?: string;
    capacity?: number;
    singlesRate?: number;
    groupRate?: number;
    pushToken?: string | null;
    inQueueOfUserID?: string | null;
    isBeeping?: boolean;
    queueSize?: number;
    userLevel?: number;
    isEmailVerified?: boolean;
    isStudent?: boolean;
}

export interface TokenEntry {
    id: string,
    tokenid: string,
    userid: string
}

export interface TokenPluckResult {
    id?: string,
    tokenid?: string,
    userid?: string
}

export interface AuthUser {
    id: string,
    token: string
}

declare global {
    namespace Express {
        export interface Request {
            user: AuthUser;
        }
    }
}
