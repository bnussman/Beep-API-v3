import { APIStatus } from "../utils/Error";

export interface ProfilePhotoResponse {
    status: APIStatus;
    message: string;
    url: string;
}
