import { initializeSentry } from "./utils/sentry";
import { MikroORM } from "@mikro-orm/core";
import { TokenEntry } from "./entities/TokenEntry";
import { User } from "./entities/User";
import { VerifyEmail } from "./entities/VerifyEmail";
import { QueueEntry } from "./entities/QueueEntry";
import { Beep } from "./entities/Beep";
import { ForgotPassword } from "./entities/ForgotPassword";
import { Report } from "./entities/Report";
import { Location } from "./entities/Location";
import { GraphQLSchema } from "graphql";
import { buildSchema } from 'type-graphql';
import { authChecker } from "./utils/authentication";
import { ApolloServer } from "apollo-server";
import { Rating } from "./entities/Rating";
import { ORM } from "./utils/ORM";

const url = `mongodb+srv://banks:${process.env.MONGODB_PASSWORD}@beep.5zzlx.mongodb.net/test?retryWrites=true&w=majority`;

export const BeepORM = {} as ORM;

export default class BeepAPIServer {

    constructor() {
        this.setup();
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
        BeepORM.ratingRepository = BeepORM.orm.em.getRepository(Rating);

        initializeSentry();

        const schema: GraphQLSchema = await buildSchema({
            resolvers: [__dirname + '/**/resolver.{ts,js}'],
            authChecker: authChecker
        });

        const server = new ApolloServer({
            schema,
            subscriptions: {
                path: "/subscriptions",
                //@ts-ignore
                onConnect: async (params: { token: string }) => {
                    if (!params || !params.token) throw new Error("No auth token");

                    const tokenEntryResult = await BeepORM.em.findOne(TokenEntry, params.token, { populate: ['user'] });
                    
                    if (tokenEntryResult) return { user: tokenEntryResult.user, token: tokenEntryResult };
                }
            },
            context: async ({ req, connection }) => {
                if (!req) {
                    return connection?.context;
                }

                const token: string | undefined = req.get("Authorization")?.split(" ")[1];

                if (!token) return;

                const tokenEntryResult = await BeepORM.em.findOne(TokenEntry, token, { populate: ['user'] });

                if (tokenEntryResult) return { user: tokenEntryResult.user, token: tokenEntryResult };
            }
        });

        await server.listen(3001);

        console.log("🚕 Server ready and has started!");
    }
}
