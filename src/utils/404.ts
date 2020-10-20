import { Request, Response, NextFunction } from "express";
import { APIStatus, APIResponse } from "./Error";

export function handleNotFound(req: Request, res: Response, next: NextFunction): void {
    res.status(404).send(new APIResponse(APIStatus.Error, "Not found"));
}
