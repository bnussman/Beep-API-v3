import { APIStatus } from "../utils/Error";

export interface DirectionsResponse {
    status: APIStatus;
    eta: string;
}
