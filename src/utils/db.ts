import * as r from 'rethinkdb';
import * as Sentry from '@sentry/node';
import { Connection, ConnectionOptions } from 'rethinkdb';

class Database {

    private host: string;
    private port: number;
    public conn: Connection | null;
    public connQueues: Connection | null;
    public connLocations: Connection | null;

    constructor() {
        this.host = "192.168.1.116";
        this.port = 28015;
        this.conn = null;
        this.connQueues = null;
        this.connLocations = null;
    }

    public async connect(run?: () => void): Promise<void> {
        try {
            console.log("Connecting to database...");
            this.conn = await r.connect(this.getConnectionOptions("beep"));
            this.connQueues = await r.connect(this.getConnectionOptions("beepQueues"));
            this.connLocations = await r.connect(this.getConnectionOptions("beepLocations"));
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
        await this.connLocations?.close();
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

    public async getConnLocations(): Promise<Connection> {
        if (this.connLocations == null) {
            Sentry.captureMessage("No connection to RethinkDB");

            this.connLocations = await r.connect(this.getConnectionOptions("beepLocations"));

            if (this.connLocations.open) {
                Sentry.captureMessage("Succesfully reconnected to RethinkDB");
            }
            else {
                Sentry.captureException(new Error("Reconnection to RethinkDB failed"));
            }
        }

        if (!this.connLocations.open) {
            Sentry.captureMessage("Connection to RethinkDB is not open");

            this.connLocations = await r.connect(this.getConnectionOptions("beepLocations"));

            if (this.connLocations.open) {
                Sentry.captureMessage("Succesfully reconnected to RethinkDB");
            }
            else {
                Sentry.captureException(new Error("Reconnection to RethinkDB failed"));
            }
        }

        if (this.connLocations == null || !this.connLocations.open) {
            Sentry.captureException("Unable to establish connection to RethinkDB");
            throw new Error("Unable to establish connection to RethinkDB");
        }

        return this.connLocations;
    }
}

const database = new Database();

export default database;
