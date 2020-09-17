import { Application } from 'express';
import express = require('express');
import * as Auth from "./auth/routes";
import * as Account from "./account/routes";
import * as Rider from "./rider/routes";
import * as Beeper from "./beeper/routes";
import * as Sentry from "@sentry/node";

export default class BeepAPIServer {

    private app: Application;
    private port: number;

    constructor() {
        this.initializeSentry();
        this.app = express();
        this.port = 3001;
        this.setFeatures();
        this.setEndpoints();
    }

    initializeSentry(): void {
        Sentry.init({
            dsn: "https://1588498392e8472697b3c496de6a3a53@sentry.nussman.us/2",
            tracesSampleRate: 1.0,
        });
    }

    setEndpoints(): void {
        this.app.use('/auth', Auth);
        this.app.use('/account', Account);
        this.app.use('/rider', Rider);
        this.app.use('/beeper', Beeper);
    }

    setFeatures(): void {
        this.app.use(express.json())
        this.app.use(express.urlencoded({ extended: true }))
        this.app.disable('x-powered-by');
    }

    start(): void {
        this.app.listen(this.port, () => {
            console.log(`Started Beep-API-v3 on http://0.0.0.0:${this.port}`);
        });
    }
}

const s = new BeepAPIServer();

s.start();
