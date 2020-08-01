export namespace Beep {
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
        pushToken: string;
        inQueueOfUserID: string;
        isBeeping: boolean;
        queueSize: number;
        userLevel: number;
    }
}
