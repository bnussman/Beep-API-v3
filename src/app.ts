import express from "express";
import { Express, Application } from "express";
import healthcheck from "./healthcheck/routes";
import { RegisterRoutes } from "../build/routes";
import { errorHandler } from "./utils/Error";
import { handleNotFound } from "./utils/404";
import * as Sentry from "@sentry/node";
import { initializeSentry } from "./utils/sentry";
import cors from "cors";
import database from "./utils/db";
import { Server } from "http";

export default class BeepAPIServer {
    private app: Application;
    private server: Server | null;

    constructor() {
        this.app = express();
        this.server = null;
        this.setup();
    }

    public getApp(): Application {
        return this.app;
    }

    public async start(): Promise<void> {
        const port = process.env.PORT || 3001;

        await database.connect();

        this.server = this.app.listen(port, () => {
            console.log(`Beep API listening at http://0.0.0.0:${port}`);
        });
    }

    public async close(): Promise<void> {
        await database.close();
        this.server?.close();
    }

    private setup(): void {
        this.app.use(cors());
        this.app.use(express.json());
        this.app.use(express.urlencoded({ extended: true, limit: "50mb" }));
        this.app.use("/healthcheck", healthcheck);

        initializeSentry(this.app);

        this.app.use(Sentry.Handlers.requestHandler({
            user: ["id"]
        }));

        this.app.use(Sentry.Handlers.tracingHandler());

        RegisterRoutes(this.app as Express);

        this.app.use(Sentry.Handlers.errorHandler());

        this.app.use(handleNotFound);

        this.app.use(errorHandler);
    }
}
