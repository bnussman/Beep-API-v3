import * as r from 'rethinkdb';
import database from '../utils/db';
import { LocationData } from './rider';
import * as Sentry from '@sentry/node';

export async function getUsersCurrentLocation(id: string): Promise<LocationData | null> {
    try {
        const result = await r.table(id).orderBy(r.desc('timestamp')).limit(1).run((await database.getConnLocations()));

        return (await result.next());
    }
    catch (error) {
        Sentry.captureException(error);
    }
    return null;
}

