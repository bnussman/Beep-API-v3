import * as WebSocket from "ws";
import * as os from "os";

class Logger {

    private ws: WebSocket;
    private hostname: string;

    constructor() {
        this.ws = new WebSocket("ws://192.168.1.114:8080");
        this.hostname = os.hostname();
    }

    async info(message: any) {
        this.ws.send(JSON.stringify({
            level: "info",
            time: Date.now(),
            server: this.hostname,
            message: message
        }));
    }

    async warning(message: any) {
        this.ws.send(JSON.stringify({
            level: "warning",
            time: Date.now(),
            server: this.hostname,
            message: message
        }));
    }

    async error(message: any) {
        this.ws.send(JSON.stringify({
            level: "warning",
            time: Date.now(),
            server: this.hostname,
            message: message
        }));
    }
}

const logger = new Logger();

export default logger;
