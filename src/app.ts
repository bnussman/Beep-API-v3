import express, {
    Response as ExResponse,
    Request as ExRequest,
    NextFunction,
} from "express";
import { RegisterRoutes } from "../build/routes";
import { connect } from "./utils/db";
import { ValidateError } from "tsoa";
import { APIError } from "./utils/Error";

connect();

export const app = express();

// Use body parser to read sent json payloads
app.use(
  express.urlencoded({
    extended: true,
  })
);
app.use(express.json());

RegisterRoutes(app);

function errorHandler(error: unknown, request: ExRequest, response: ExResponse, next: NextFunction): ExResponse | void {
    if (error instanceof ValidateError) {
        return response.status(422).json({
            status: "error",
            message: "Validation Failed",
            details: error?.fields,
        });
    }
    if (error instanceof APIError) {
        return response.status(error.statusCode).json({
            status: error.status,
            message: error.message,
        });
    }
    if (error instanceof Error) {
        return response.status(500).json({
            status: "error",
            message: error.message
        });
    }
    next();
}

app.use(errorHandler);
