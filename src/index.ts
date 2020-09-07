import { Application } from 'express';
import express = require('express');
import * as Auth from "./auth/routes";
import * as Account from "./account/routes";
import * as Rider from "./rider/routes";
import * as Beeper from "./beeper/routes";

export default class BeepAPIServer {

    private app: Application;
    private port: number;

    constructor() {
        this.app = express();
        this.port = 3001;
        this.setEndpoints();
        this.setFeatures();
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
        this.app.listen(this.port);
    }
}

const server: BeepAPIServer = new BeepAPIServer();

server.start();
