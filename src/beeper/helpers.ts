import * as r from 'rethinkdb';
import { conn } from '../utils/db';
import { UserPluckResult } from "../types/beep";

/**
 * Retuns user's id if their token is valid, null otherwise
 *
 * @param token takes a user's auth token as input
 * @return userid if token is valid, null otherwise
 */
export async function getQueueSize(userid: string): Promise<number> {
    try {
        const result = await r.table("users").get(userid).pluck('queueSize').run(conn);
        return result.queueSize;
    }
    catch(error) {
        throw error;
    }
}

/**
 * Helper function that, given a user's id, will return that user's personal info
 * @param userid
 * @return json-like object (or array?) thing with personal info
 */
export async function getPersonalInfo (userid: string): Promise<object> {
    try {
        //RethinkDB query gets data from users db at userid
        const result: UserPluckResult = await r.table('users').get(userid).pluck('first', 'last', 'phone', 'venmo').run(conn);

        return ({
            'first': result.first,
            'last': result.last,
            'phone': result.phone,
            'venmo': result.venmo
        });
    }
    catch (error) {
        throw error;
    }
}
