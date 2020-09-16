import { Application } from 'express';
import express = require('express');
import * as Auth from "./auth/routes";
import * as Account from "./account/routes";
import * as Rider from "./rider/routes";
import * as Beeper from "./beeper/routes";
import logger from './utils/logger';
import * as os from "os";

export default class BeepAPIServer {

    private app: Application;
    private port: number;

    constructor() {
        this.app = express();
        this.port = 3001;
        this.setFeatures();
        this.setEndpoints();
    }

    setEndpoints(): void {
        this.app.use('/auth', Auth);
        this.app.use('/account', Account);
        this.app.use('/rider', Rider);
        this.app.use('/beeper', Beeper);

        this.app.all("*", (req: express.Request, res: express.Response, next: express.NextFunction) => {
            logger.info({hostname: os.hostname(), req, res});
            next();
        });
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
