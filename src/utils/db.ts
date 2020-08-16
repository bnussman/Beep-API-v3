import * as r from 'rethinkdb';
import { Connection, ConnectionOptions } from 'rethinkdb';

const connOptions: ConnectionOptions = ({
    host: '192.168.1.116',
    port: 28015,
    db: 'beep'
});

const connQueuesOptions: ConnectionOptions = ({
    host: '192.168.1.116',
    port: 28015,
    db: 'beepQueues'
});

let conn: Connection;
let connQueues: Connection;

r.connect(connOptions).then((connection: Connection) => {
    console.log("connected to beep db");
    conn = connection;
}).catch((error) => {console.log(error)});

r.connect(connQueuesOptions).then((connection: Connection) => {
    console.log("connected to queue db");
    connQueues = connection;
}).catch((error) => {console.log(error)});

export { conn, connQueues };
