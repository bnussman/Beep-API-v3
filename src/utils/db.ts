import * as r from 'rethinkdb';
import * as Sentry from '@sentry/node';
import { Connection, ConnectionOptions } from 'rethinkdb';

const host = "192.168.1.116";
const port = 28015;
let conn: Connection;
let connQueues: Connection;
let connHistory: Connection;

function connect () {
    r.connect(getConnectionOptions("beep")).then((connection: Connection) => {
        console.log("Connected to Beep DB");
        conn = connection;
    }).catch((error) => console.error(error));
    r.connect(getConnectionOptions("beepQueues")).then((connection: Connection) => {
        console.log("Connected to BeeQueues DB");
        connQueues = connection;
    }).catch((error) => console.error(error));
    r.connect(getConnectionOptions("beepHistory")).then((connection: Connection) => {
        console.log("Connected to BeepHistory DB");
        connHistory = connection;
    }).catch((error) => console.error(error));
}

function getConnectionOptions(databaseName: string): ConnectionOptions {
    return {
        host: host,
        port: port,
        db: databaseName
    };
}

export { connect, conn, connQueues, connHistory };
