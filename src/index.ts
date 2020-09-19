import { Application } from 'express';
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
        this.initializeSentry(this.app);
        this.setFeatures();
    }

    initializeSentry(app: Application): void {
        Sentry.init({
            dsn: "https://1588498392e8472697b3c496de6a3a53@sentry.nussman.us/2",
            integrations: [
                // enable HTTP calls tracing
                new Sentry.Integrations.Http({ tracing: true }),
                // enable Express.js middleware tracing
                new Tracing.Integrations.Express({ app }),
            ],
            tracesSampleRate: 1.0,
        });
    }

    setFeatures(): void {
        this.app.use(Sentry.Handlers.requestHandler());
        this.app.use(Sentry.Handlers.tracingHandler());
        this.app.use(express.json())
        this.app.use(express.urlencoded({ extended: true }))
        this.app.disable('x-powered-by');
        this.app.use('/auth', Auth);
        this.app.use('/account', Account);
        this.app.use('/rider', Rider);
        this.app.use('/beeper', Beeper);
        this.app.use(Sentry.Handlers.errorHandler());
    }

    start(): void {
        this.app.listen(this.port, () => {
            console.log(`Started Beep-API-v3 on http://0.0.0.0:${this.port}`);
        });
    }
}

const s = new BeepAPIServer();

s.start();
