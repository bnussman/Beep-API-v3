import * as r from 'rethinkdb';
import database from "../utils/db";
import * as Sentry from "@sentry/node";

export async function getNumReports(): Promise<number> {
    try {
        return r.table("userReports").count().run((await database.getConn()));
    }
    catch (error) {
        Sentry.captureException(error);
    }
    return 0;
}
