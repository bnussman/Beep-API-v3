import express from "express";
import healthcheck from "./healthcheck/routes";
import { RegisterRoutes } from "../build/routes";
import { connect } from "./utils/db";
import { errorHandler } from "./utils/Error";
import { handleNotFound } from "./utils/404";
import * as Sentry from "@sentry/node";
import { initializeSentry } from "./utils/sentry";
import cors from "cors";

connect();

export const app = express();

app.use(cors());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use("/healthcheck", healthcheck);

initializeSentry(app);

app.use(Sentry.Handlers.requestHandler({
    user: ["id"]
}));

app.use(Sentry.Handlers.tracingHandler());

RegisterRoutes(app);

app.use(Sentry.Handlers.errorHandler());

app.use(handleNotFound);

app.use(errorHandler);
