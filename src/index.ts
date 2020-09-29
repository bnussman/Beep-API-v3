import { Application } from 'express';
import { db } from './utils/db';
import { healthcheck } from './utils/healthcheck';
import { handleNotFound } from './utils/404';
import { initializeSentry } from './utils/sentry';
import { Server } from "http";
import * as express from 'express';
import * as Auth from "./auth/routes";
import * as Account from "./account/routes";
import * as Rider from "./rider/routes";
import * as Beeper from "./beeper/routes";
import * as Sentry from "@sentry/node";
import * as cors from "cors";

export default class BeepAPIServer {

    private app: Application;
    private port: number;
    private server: Server | null;

    constructor() {
        this.port = 3001;
        this.server = null;
        this.app = express();
        this.initializeServer();
    }

    /**
     * Set the Beep API's routes
     * @returns void
     */
    private setRoutes(): void {
        this.app.use('/auth', Auth);
        this.app.use('/account', Account);
        this.app.use('/rider', Rider);
        this.app.use('/beeper', Beeper);
    }

    /**
     * Sets the ExpressJS options we need
     * @returns void
     */
    private setFeatures(): void {
        this.app.use(cors());
        this.app.use(express.json());
        this.app.use(express.urlencoded({ extended: true }));
        this.app.disable('x-powered-by');
    }

    /**
     * Use helper functions to initialize this REST API server
     * @returns void
     */
    private initializeServer(): void {
        this.setFeatures();

        //define the healthcheck api endpoint before we initializeSentry
        //so Kubernetes's liveness check does not flood Sentry's logs
        this.app.use('/healthcheck', healthcheck);

        //initialize the Sentry connection
        initializeSentry(this.app);

        //Tell ExpressJS to use Sentry handlers
        this.app.use(Sentry.Handlers.requestHandler({
            user: ["id"]
        }));

        this.app.use(Sentry.Handlers.tracingHandler());

        //set out API endpoint routes
        this.setRoutes();

        //Sentry told us to put this after the routes are consumed
        this.app.use(Sentry.Handlers.errorHandler());
       
        //404 route that will return json
        this.app.use(handleNotFound);
    }

    /**
     * Get the ExpressJS Application
     * @returns app ExpressJS Application
     */
    public getApp(): Application {
        return this.app;
    }

    /**
     * Connects to RethinkDB and starts the ExpressJS server
     * @returns Promise<void>
     */
    public async start(): Promise<void> {
        //wait for the database connnection to be active before listening for requests
        await db.connect();

        this.server = this.app.listen(this.port, () => {
            console.log("Started Beep-API-v3 on http://0.0.0.0:" + this.port);
        });
    }

    /**
     * Disconnects RethinkDB and stops ExpressJS server
     * @returns Promise<void>
     */
    public async close(): Promise<void> {
        //close the db connections
        await db.close();

        //close the ExpressJS server
        this.server?.close();
    }
}

const server = new BeepAPIServer();

server.start();
