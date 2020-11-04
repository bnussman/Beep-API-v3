import * as r from 'rethinkdb';
import database from '../utils/db';
import { BeepTableResult, UserPluckResult } from "../types/beep";
import * as Sentry from "@sentry/node";

/**
 * Retuns user's id if their token is valid, null otherwise
 *
 * @param token takes a user's auth token as input
 * @return userid if token is valid, null otherwise
 */
export async function getQueueSize(userid: string): Promise<number> {
    try {
        const result = await r.table("users").get(userid).pluck('queueSize').run(database.getConn());
        return result.queueSize;
    }
    catch(error) {
        Sentry.captureException(error);
    }
    return 0;
}

/**
 * Helper function that, given a user's id, will return that user's personal info
 * @param userid
 * @return object with personal info
 */
export async function getPersonalInfo (userid: string): Promise<UserPluckResult> {
    try {
        //RethinkDB query gets data from users db at userid
        const result: UserPluckResult = await r.table('users').get(userid).pluck('first', 'last', 'phone', 'venmo', 'isStudent', 'photoUrl').run(database.getConn());

        return result;
    }
    catch (error) {
        Sentry.captureException(error);
    }
    return { first: "error" };
}

/**
 * Record the beep in the historal beep table
 *
 * @param event
 * @return void
 */
export async function storeBeepEvent (event: BeepTableResult): Promise<void> {
    try {
        r.table("beeps").insert(event).run(database.getConnHistory());
    }
    catch (error) {
        Sentry.captureException(error);
    }
}
