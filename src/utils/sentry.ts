import * as Sentry from "@sentry/node";
import * as Tracing from "@sentry/tracing";
import { Application } from "express";

export function initializeSentry(app: Application): void {
    console.log(process.env);
    Sentry.init({
        dsn: process.env.SENTRY_URL || "http://ddeca23af15c47a7819d89a0d92e3d68@192.168.1.124:9000/2",
        environment: process.env.CI_ENVIRONMENT_NAME || "development",
        integrations: [
            // enable HTTP calls tracing
            new Sentry.Integrations.Http({ tracing: true }),
            // enable Express.js middleware tracing
            new Tracing.Integrations.Express({ app })
        ],
        tracesSampleRate: 1.0
    });
}
