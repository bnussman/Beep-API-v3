import { APIStatus } from "../utils/Error";

/**
 * Example Directions Response
 *
 * @example {
 *   status: APIStatus.Success,
 *   eta: "7 minutes"
 * }
 */
export interface DirectionsResponse {
    status: APIStatus;
    eta: string;
}
