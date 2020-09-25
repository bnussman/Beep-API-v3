import * as r from 'rethinkdb';
import * as Sentry from '@sentry/node';
import { Connection, ConnectionOptions } from 'rethinkdb';

export default class Database {

    private host: string;
    private port: number;
    public conn: Connection | null;
    public connQueues: Connection | null;

    constructor() {
        this.host = "192.168.1.116";
        this.port = 28015;
        this.conn = null;
        this.connQueues = null;
    }

    public async connect(): Promise<void> {
        try {
            this.conn = await r.connect(this.getConnectionOptions("beep"));
            this.connQueues = await r.connect(this.getConnectionOptions("beepQueues"));
        } 
        catch (error) {
            Sentry.captureException(error);
            console.error(error);
        }
    }

    public async close(): Promise<void> {
        await this.conn?.close();
        await this.connQueues?.close();
    }

    private getConnectionOptions(databaseName: string): ConnectionOptions {
        return {
            host: this.host,
            port: this.port,
            db: databaseName
        };
    }

    public getConn(): Connection {
        if (this.conn == null) throw new Error("Connection should not be null");
        return this.conn;
    }

    public getConnQueues(): Connection {
        if (this.connQueues == null) throw new Error("ConnectionQueues should not be null");
        return this.connQueues;
    }
}

const db = new Database();

export { db };
