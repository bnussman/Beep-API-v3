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
        //TODO even when i replace the throw with the logger, I should still return something to prevent a promise that never resolves
        throw error;
    }
}

/**
 * Helper function that, given a user's id, will return that user's personal info
 * @param userid
 * @return object with personal info
 */
export async function getPersonalInfo (userid: string): Promise<UserPluckResult> {
    try {
        //RethinkDB query gets data from users db at userid
        const result: UserPluckResult = await r.table('users').get(userid).pluck('first', 'last', 'phone', 'venmo', 'isStudent').run(conn);

        return result;
    }
    catch (error) {
        //TODO even when i replace the throw with the logger, I should still return something to prevent a promise that never resolves
        throw error;
    }
}
