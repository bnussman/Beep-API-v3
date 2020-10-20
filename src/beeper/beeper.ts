import { UserPluckResult } from "../types/beep";
import { APIStatus } from "../utils/Error";

export interface SetBeeperStatusParams {
    singlesRate: string | number;
    groupRate: string | number;
    capacity: number;
    isBeeping: boolean;
    masksRequired: boolean;
}

export interface GetBeeperQueueResult {
    status: APIStatus,
    queue: BeepQueueTableEntry[]; 
}

export interface BeepQueueTableEntry {
    id: string;
    destination: string;
    origin: string;
    groupSize: number;
    isAccepted: boolean;
    riderid: string;
    state: number;
    timeEnteredQueue: number;
    personalInfo?: UserPluckResult;
}

export interface SetBeeperQueueParams {
    value: string;
    riderID: string;
    queueID: string;
}
