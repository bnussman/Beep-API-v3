import * as Sentry from "@sentry/node";
import * as Tracing from "@sentry/tracing";
import { Application } from "express";

export function initializeSentry(app: Application): void {
    Sentry.init({
        dsn: process.env.SENTRY_URL || "https://07d16e85f80f40ee941887cbd45d16eb@sentry.nussman.us/2",
        environment: process.env.GITLAB_ENVIRONMENT_NAME || "development",
        integrations: [
            // enable HTTP calls tracing
            new Sentry.Integrations.Http({ tracing: true }),
            // enable Express.js middleware tracing
            new Tracing.Integrations.Express({ app })
        ],
        tracesSampleRate: 1.0,
        debug: true
    });
}
