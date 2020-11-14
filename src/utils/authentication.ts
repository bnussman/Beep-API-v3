import * as express from "express";
import { TokenEntry } from "../types/beep";
import database from"./db";
import * as r from "rethinkdb";
import * as Sentry from "@sentry/node";
import { APIStatus, APIAuthResponse } from "./Error";

export async function expressAuthentication(request: express.Request, securityName: string, scopes?: string[]): Promise<any> {
    if (securityName === "token") {
        //get the Authorization header and split after the first space because it will say Bearer first
        const token: string | undefined = request.get("Authorization")?.split(" ")[1];

        if (!token) {
            return Promise.reject(new APIAuthResponse(APIStatus.Error, "You must provide an authentication token"));
        }

        try {
            const result: TokenEntry | null = await r.table("tokens").get(token).run((await database.getConn())) as TokenEntry;

            if (result) {
                return Promise.resolve({ token: token, id: result.userid });
            }
            else {
                return Promise.reject(new APIAuthResponse(APIStatus.Error, "Your token is not valid"));
            }
        }
        catch (error) {
            Sentry.captureException(error);
            return Promise.reject(error);
        }
    }
}
