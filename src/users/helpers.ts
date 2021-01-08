import * as r from 'rethinkdb';
import database from "../utils/db";
import * as Sentry from "@sentry/node";

export async function getNumUsers(): Promise<number> {
    try {
        return r.table("users").count().run((await database.getConn()));
    }
    catch (error) {
        Sentry.captureException(error);
    }
    return 0;
}

export async function getNumLocations(id: string): Promise<number> {
    try {
        return r.table(id).count().run((await database.getConnLocations()));
    }
    catch (error) {
        Sentry.captureException(error);
    }
    return 0;
}
