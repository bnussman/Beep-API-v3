import * as r from 'rethinkdb';
import { conn } from '../utils/db';

/**
 * Retuns user's id if their token is valid, null otherwise
 *
 * @param token takes a user's auth token as input
 * @return userid if token is valid, null otherwise
 */
export async function getQueueSize(userid: string): Promise<number> {
    const size = await r.table("users").get(userid).pluck('queueSize').run(conn);
    return size.queueSize;
}
