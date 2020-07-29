import { Connection, ConnectionOptions } from 'rethinkdb';
import * as r from 'rethinkdb';

const connOptions: ConnectionOptions = ({
    host: '192.168.1.132',
    port: 28015,
    db: 'beep'
});

const connQueuesOptions: ConnectionOptions = ({
    host: '192.168.1.132',
    port: 28015,
    db: 'beepQueues'
});

let conn: Connection;
let connQueues: Connection;

r.connect(connOptions).then(connection => {
    conn = connection;
});

r.connect(connQueuesOptions).then(connection => {
    connQueues = connection;
});

export {conn, connQueues};
