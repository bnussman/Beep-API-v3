import * as r from 'rethinkdb';
import database from '../utils/db';

export async function getUser(id: string, values?: string[]): Promise<unknown> {
    if (values) {
        return await r.table('users').get(id).pluck(...values).run((await database.getConn()));
    }
    return await r.table('users').get(id).run((await database.getConn()));
}
