import express from "express";
import { Express, Application } from "express";
import healthcheck from "./healthcheck/routes";
import { RegisterRoutes } from "../build/routes";
import { errorHandler } from "./utils/Error";
import { handleNotFound } from "./utils/404";
import * as Sentry from "@sentry/node";
import { initializeSentry } from "./utils/sentry";
import database from "./utils/db";
import { Server } from "http";
import cors from "cors";
import {EntityManager, EntityRepository, MikroORM} from "@mikro-orm/core";
import {TokenEntry} from "./entities/TokenEntry";
import {User} from "./entities/User";
import {VerifyEmail} from "./entities/VerifyEmail";

const url = `mongodb+srv://banks:${process.env.MONGODB_PASSWORD}@beep.5zzlx.mongodb.net/test?retryWrites=true&w=majority`;

export const BeepORM = {} as {
    orm: MikroORM,
    em: EntityManager
    userRepository: EntityRepository<User>,
    tokenRepository: EntityRepository<TokenEntry>,
    verifyEmailRepository: EntityRepository<VerifyEmail>,
};

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

    private async setup(): Promise<void> {

        BeepORM.orm = await MikroORM.init({
            entities: ['./build/src/entities/*.js'],
            entitiesTs: ['./src/entities/*.ts'],
            dbName: 'beep',
            type: 'mongo',
            clientUrl: url
        });

        BeepORM.em = BeepORM.orm.em;
        BeepORM.userRepository = BeepORM.orm.em.getRepository(User);
        BeepORM.tokenRepository = BeepORM.orm.em.getRepository(TokenEntry);
        BeepORM.verifyEmailRepository = BeepORM.orm.em.getRepository(VerifyEmail);

        this.app.use(cors());
        this.app.use(express.json());
        this.app.use(express.urlencoded({ extended: true, limit: "50mb" }));
        this.app.disable('x-powered-by')
        this.app.use("/healthcheck", healthcheck);
        this.app.use("/.well-known/acme-challenge/:id", healthcheck);

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
