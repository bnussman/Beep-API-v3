import { Request, Response } from "express";
import { makeJSONSuccess } from "./json";

export function healthcheck(req: Request, res: Response): void {
    res.send(makeJSONSuccess("OK"));
}
