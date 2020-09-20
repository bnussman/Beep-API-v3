import { Application } from 'express';
import { healthcheck } from './utils/status';
import * as express from 'express';
import * as Auth from "./auth/routes";
import * as Account from "./account/routes";
import * as Rider from "./rider/routes";
import * as Beeper from "./beeper/routes";
import * as Sentry from "@sentry/node";
import * as Tracing from "@sentry/tracing";

export default class BeepAPIServer {

    private app: Application;
    private port: number;

    constructor() {
        this.port = 3001;
        this.app = express();
        this.setFeatures(this.app);
    }

    setFeatures(app: Application): void {
        Sentry.init({
            dsn: "http://ddeca23af15c47a7819d89a0d92e3d68@192.168.1.124:9000/2",
            integrations: [
                // enable HTTP calls tracing
                new Sentry.Integrations.Http({ tracing: true }),
                // enable Express.js middleware tracing
                new Tracing.Integrations.Express({ app }),
            ],
            tracesSampleRate: 1.0,
            debug: true
        });

        this.app.use(Sentry.Handlers.requestHandler());
        this.app.use(Sentry.Handlers.tracingHandler());
        this.app.use(express.json())
        this.app.use(express.urlencoded({ extended: true }))
        this.app.disable('x-powered-by');

        this.app.use('/healthcheck', healthcheck);
        this.app.use('/auth', Auth);
        this.app.use('/account', Account);
        this.app.use('/rider', Rider);
        this.app.use('/beeper', Beeper);

        this.app.use(Sentry.Handlers.errorHandler());

        this.app.listen(this.port, () => {
            console.log(`Started Beep-API-v3 on http://0.0.0.0:${this.port}`);
        });
    }
}

new BeepAPIServer();
