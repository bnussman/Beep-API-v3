import * as r from 'rethinkdb';
import database from "../utils/db";
import * as Sentry from "@sentry/node";

export async function getNumBeeps(): Promise<number> {
    try {
        return r.table("beeps").count().run((await database.getConnHistory()));
    }
    catch (error) {
        Sentry.captureException(error);
    }
    return 0;
}
