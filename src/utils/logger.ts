import * as WebSocket from "ws";
import * as os from "os";

interface defaults {
    time: number,
    server: string
}

class Logger {

    private ws: WebSocket;
    private hostname: string;

    constructor() {
        this.ws = new WebSocket("ws://192.168.1.114:8080");
        this.hostname = os.hostname();
    }

    getDefaults(): defaults {
        return({
            time: Date.now(),
            server: this.hostname,
        });
    }

    async info(event: any): Promise<void> {
        this.ws.send(JSON.stringify({
            level: "info",
            ...this.getDefaults(),
            event: event
        }));
    }

    async warning(event: any): Promise<void> {
        this.ws.send(JSON.stringify({
            level: "warning",
            ...this.getDefaults(),
            event: event
        }));
    }

    async error(event: any): Promise<void> {
        this.ws.send(JSON.stringify({
            level: "error",
            ...this.getDefaults(),
            event: event
        }));
    }
}

const logger = new Logger();

export default logger;
