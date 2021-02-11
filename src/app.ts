import express from "express";
import { Application } from "express";
import healthcheck from "./healthcheck/routes";
import { errorHandler } from "./utils/Error";
import { handleNotFound } from "./utils/404";
import * as Sentry from "@sentry/node";
import { initializeSentry } from "./utils/sentry";
import { Server } from "http";
import cors from "cors";
import { EntityManager, EntityRepository, MikroORM } from "@mikro-orm/core";
import { TokenEntry } from "./entities/TokenEntry";
import { User } from "./entities/User";
import { VerifyEmail } from "./entities/VerifyEmail";
import { QueueEntry } from "./entities/QueueEntry";
import { Beep } from "./entities/Beep";
import { ForgotPassword } from "./entities/ForgotPassword";
import { Report } from "./entities/Report";
import { Location } from "./entities/Location";
import expressPlayground from 'graphql-playground-middleware-express';
import { GraphQLSchema } from "graphql";
import { buildSchema } from 'type-graphql';
import { graphqlHTTP } from 'express-graphql';
import { UserResolver } from './users/resolver';
import {authChecker} from "./utils/authentication";

const url = `mongodb+srv://banks:${process.env.MONGODB_PASSWORD}@beep.5zzlx.mongodb.net/test?retryWrites=true&w=majority`;

export const BeepORM = {} as {
    orm: MikroORM,
    em: EntityManager
    userRepository: EntityRepository<User>,
    queueEntryRepository: EntityRepository<QueueEntry>,
    tokenRepository: EntityRepository<TokenEntry>,
    verifyEmailRepository: EntityRepository<VerifyEmail>,
    beepRepository: EntityRepository<Beep>,
    forgotPasswordRepository: EntityRepository<ForgotPassword>,
    reportRepository: EntityRepository<Report>,
    locationRepository: EntityRepository<Location>,
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

        this.server = this.app.listen(port, () => {
            console.log(`Beep API listening at http://0.0.0.0:${port}`);
        });
    }

    public async close(): Promise<void> {
        this.server?.close();
    }

    private async setup(): Promise<void> {

        BeepORM.orm = await MikroORM.init({
            entities: ['./build/entities/*.js'],
            entitiesTs: ['./src/entities/*.ts'],
            dbName: 'beep',
            type: 'mongo',
            clientUrl: url,
            debug: true
        });

        BeepORM.em = BeepORM.orm.em;
        BeepORM.userRepository = BeepORM.orm.em.getRepository(User);
        BeepORM.tokenRepository = BeepORM.orm.em.getRepository(TokenEntry);
        BeepORM.verifyEmailRepository = BeepORM.orm.em.getRepository(VerifyEmail);
        BeepORM.queueEntryRepository = BeepORM.orm.em.getRepository(QueueEntry);
        BeepORM.beepRepository = BeepORM.orm.em.getRepository(Beep);
        BeepORM.forgotPasswordRepository = BeepORM.orm.em.getRepository(ForgotPassword);
        BeepORM.reportRepository = BeepORM.orm.em.getRepository(Report);
        BeepORM.locationRepository = BeepORM.orm.em.getRepository(Location);

        this.app.use(cors());
        this.app.use(express.json());
        this.app.use(express.urlencoded({ extended: true, limit: "50mb" }));
        this.app.disable('x-powered-by')
        this.app.use("/healthcheck", healthcheck);
        this.app.use("/.well-known/acme-challenge/:id", healthcheck);
        this.app.get('/graphql', expressPlayground({ endpoint: '/graphql' }));

        initializeSentry(this.app);

        this.app.use(Sentry.Handlers.requestHandler({
            user: ["id"]
        }));

        try {
            const schema: GraphQLSchema = await buildSchema({
                resolvers: [UserResolver],
                authChecker: authChecker
            });

            this.app.post(
                '/graphql',
                express.json(),
                graphqlHTTP((req, res) => ({
                    schema,
                    context: { req, res, em: BeepORM.em.fork() },
                    customFormatErrorFn: (error) => {
                        throw error;
                    },
                })),
            );
        }
        catch(error) {
            console.error(error);
        }


        this.app.use(Sentry.Handlers.tracingHandler());

        this.app.use(Sentry.Handlers.errorHandler());

        this.app.use(handleNotFound);

        this.app.use(errorHandler);
    }
}
