import * as express from "express";
import { Request, Response, Application } from "express";
import { makeJSONSuccess } from "./json";

export default class Healthcheck {

    private port: number;
    private app: Application;

    constructor() {
        this.port = 3005;    
        this.app = express();
        this.app.use('/healthcheck', this.healthcheck);
        this.start();
    }

    private healthcheck(req: Request, res: Response): void {
        res.send(makeJSONSuccess("OK"));
    }

    private start() {
        this.app.listen(this.port, () => {
            console.log(`Started Liveness on http://0.0.0.0:${this.port}`);
        });
    }  
}
