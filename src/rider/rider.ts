import { APIStatus } from "../utils/Error";

export interface ChooseBeepParams {
    groupSize: number;
    origin: string;
    destination: string;
    beepersID: string;
}

export interface ChooseBeepResponse {
    status: APIStatus,
    beeper: BeeperData
}

export interface BeeperData {
    id: string;
    first: string;
    last: string;
    queueSize: number;
    singlesRate: number | string;
    groupRate: number | string;
    userLevel: number;
    isStudent: boolean;
    capacity: number;
    masksRequired: boolean;
    phone?: string;
    venmo?: string;
}

export interface RiderStatusResult {
    status: APIStatus;
    groupSize: number;
    isAccepted: boolean;
    ridersQueuePosition?: number;
    state?: number;
    beeper: BeeperData
}

export interface LeaveQueueParams {
    beepersID: string;
}

export interface BeeperListResult {
    status: APIStatus,
    beeperList: BeeperListItem[];
}

export interface BeeperListItem {
    first: string;
    last: string;
    queueSize: number;
    id: string;
    singlesRate: string | number;
    groupsRate: string | number;
    capacity: number;
    userLevel: number;
    isStudent: boolean;
    masksRequired: boolean;
}

