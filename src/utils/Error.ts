import { Response, Request, NextFunction} from "express";
import { ValidateError } from "tsoa";
import * as Sentry from "@sentry/node";

export enum APIStatus {
    Success = "success",
    Warning = "warning",
    Error = "error"
}

export class APIResponse {
    public status: APIStatus;
    public message: unknown;

    constructor(status: APIStatus, message: unknown) {
        this.status = status;
        this.message = message;
    }
}

export class APIAuthResponse extends APIResponse {
    constructor(status: APIStatus, message: unknown) {
        super(status, message);
    }
} 

export function errorHandler(error: unknown, request: Request, response: Response, next: NextFunction): Response | void {
    if (error instanceof ValidateError) {
        /*
        return response.status(422).json({
            status: "error",
            message: "You did not provide the correct paramaters to use this api endpoint",
        });
        */
        return response.status(422).json({
            status: "error",
            message: "You did not provide the correct paramaters to use this api endpoint",
            details: error?.fields,
        });
    }
    if (error instanceof APIAuthResponse) {
        return response.status(401).json(error);
    }
    if (error instanceof Error) {
        console.error(error);
        return response.status(500).json(new APIResponse(APIStatus.Error, error.message));
    }

    Sentry.captureException(error);

    next();
}
