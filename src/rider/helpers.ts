import * as r from 'rethinkdb';
import database from '../utils/db';

export async function getUsersCurrentLocation(id: string): Promise<any> {
    const result = await r.table(id).orderBy(r.desc('timestamp')).limit(1).run((await database.getConnLocations()));
    return (await result.next());
}

