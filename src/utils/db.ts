import * as r from 'rethinkdb';
import { Connection, ConnectionOptions } from 'rethinkdb';

let host = "192.168.1.116"; 

if (process.env.NODE_ENV === "test") {
    host = "192.168.1.123";
}

const connOptions: ConnectionOptions = ({
    host: host,
    port: 28015,
    db: 'beep'
});

const connQueuesOptions: ConnectionOptions = ({
    host: host,
    port: 28015,
    db: 'beepQueues'
});

let conn: Connection;
let connQueues: Connection;

r.connect(connOptions).then((connection: Connection) => {
    conn = connection;
}).catch((error) => { console.error(error) });

r.connect(connQueuesOptions).then((connection: Connection) => {
    connQueues = connection;
}).catch((error) => { console.error(error) });

export { conn, connQueues };
