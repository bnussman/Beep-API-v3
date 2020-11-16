import * as r from 'rethinkdb';
import * as Sentry from '@sentry/node';
import { Connection, ConnectionOptions } from 'rethinkdb';

class Database {

    private host: string;
    private port: number;
    public conn: Connection | null;
    public connQueues: Connection | null;
    public connHisory: Connection | null;

    constructor() {
        this.host = "192.168.1.116";
        this.port = 28015;
        this.conn = null;
        this.connQueues = null;
        this.connHisory = null;
    }

    public async connect(run?: () => void): Promise<void> {
        try {
            console.log("Connecting to database...");
            this.conn = await r.connect(this.getConnectionOptions("beep"));
            this.connQueues = await r.connect(this.getConnectionOptions("beepQueues"));
            this.connHisory = await r.connect(this.getConnectionOptions("beepHistory"));
            if (run) run();
        } 
        catch (error) {
            Sentry.captureException(error);
            console.error(error);
        }
    
    }

    public async close(): Promise<void> {
        await this.conn?.close();
        await this.connQueues?.close();
        await this.connHisory?.close();
    }

    private getConnectionOptions(databaseName: string): ConnectionOptions {
        return {
            host: this.host,
            port: this.port,
            db: databaseName
        };
    }

    public async getConn(): Promise<Connection> {
        if (this.conn == null) {
            Sentry.captureMessage("No connection to RethinkDB");

            this.conn = await r.connect(this.getConnectionOptions("beep"));
            
            if (this.conn.open) {
                Sentry.captureMessage("Succesfully reconnected to RethinkDB");
            }
            else {
                Sentry.captureException(new Error("Reconnection to RethinkDB failed"));
            }
        }

        if (!this.conn.open) {
            Sentry.captureMessage("Connection to RethinkDB is not open");

            this.conn = await r.connect(this.getConnectionOptions("beep"));

            if (this.conn.open) {
                Sentry.captureMessage("Succesfully reconnected to RethinkDB");
            }
            else {
                Sentry.captureException(new Error("Reconnection to RethinkDB failed"));
            }
        }

        if (this.conn == null || !this.conn.open) {
            Sentry.captureException("Unable to establish connection to RethinkDB");
            throw new Error("Unable to establish connection to RethinkDB");
        }

        return this.conn;
    }

    public async getConnQueues(): Promise<Connection> {
        if (this.connQueues == null) {
            Sentry.captureMessage("No connection to RethinkDB");

            this.connQueues = await r.connect(this.getConnectionOptions("beepQueues"));

            if (this.connQueues.open) {
                Sentry.captureMessage("Succesfully reconnected to RethinkDB");
            }
            else {
                Sentry.captureException(new Error("Reconnection to RethinkDB failed"));
            }
        }

        if (!this.connQueues.open) {
            Sentry.captureMessage("Connection to RethinkDB is not open");

            this.connQueues = await r.connect(this.getConnectionOptions("beepQueues"));

            if (this.connQueues.open) {
                Sentry.captureMessage("Succesfully reconnected to RethinkDB");
            }
            else {
                Sentry.captureException(new Error("Reconnection to RethinkDB failed"));
            }
        }

        if (this.connQueues == null || !this.connQueues.open) {
            Sentry.captureException("Unable to establish connection to RethinkDB");
            throw new Error("Unable to establish connection to RethinkDB");
        }

        return this.connQueues;
    }

    public async getConnHistory(): Promise<Connection> {
        if (this.connHisory == null) {
            Sentry.captureMessage("No connection to RethinkDB");

            this.connHisory = await r.connect(this.getConnectionOptions("beepHistory"));

            if (this.connHisory.open) {
                Sentry.captureMessage("Succesfully reconnected to RethinkDB");
            }
            else {
                Sentry.captureException(new Error("Reconnection to RethinkDB failed"));
            }
        }

        if (!this.connHisory.open) {
            Sentry.captureMessage("Connection to RethinkDB is not open");

            this.connHisory = await r.connect(this.getConnectionOptions("beepHistory"));

            if (this.connHisory.open) {
                Sentry.captureMessage("Succesfully reconnected to RethinkDB");
            }
            else {
                Sentry.captureException(new Error("Reconnection to RethinkDB failed"));
            }
        }

        if (this.connHisory == null || !this.connHisory.open) {
            Sentry.captureException("Unable to establish connection to RethinkDB");
            throw new Error("Unable to establish connection to RethinkDB");
        }

        return this.connHisory;
    }
}

const database = new Database();

export default database;
