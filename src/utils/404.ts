import { Request, Response, NextFunction } from "express";
import { makeJSONError } from "./json";

export function handleNotFound(req: Request, res: Response, next: NextFunction): void {
    res.status(404).send(makeJSONError("Not found"));
}
