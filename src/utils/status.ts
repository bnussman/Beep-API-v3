import { Response } from "express";
import { makeJSONSuccess } from "./json";

export function healthcheck(res: Response): void {
    res.send(makeJSONSuccess("OK"));
}
