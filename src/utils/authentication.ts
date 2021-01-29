import * as express from "express";
import { TokenEntry } from "../types/beep";
import database from"./db";
import * as r from "rethinkdb";
import * as Sentry from "@sentry/node";
import { APIStatus, APIAuthResponse } from "./Error";
import { hasUserLevel } from '../auth/helpers';
import {BeepORM} from "../app";
import {ObjectId} from "@mikro-orm/mongodb";
import { User } from "../entities/User";

export async function expressAuthentication(request: express.Request, securityName: string, scopes?: string[]): Promise<any> {
    if (securityName === "token") {
        //get the Authorization header and split after the first space because it will say Bearer first
        const token: string | undefined = request.get("Authorization")?.split(" ")[1];

        if (!token) {
            return Promise.reject(new APIAuthResponse(APIStatus.Error, "You must provide an authentication token"));
        }


        const tokenEntryResult = await BeepORM.tokenRepository.findOne(new ObjectId(token));


        if (!tokenEntryResult) {
            return Promise.reject(new APIAuthResponse(APIStatus.Error, "Your token is not valid"));
        }

        const user: User = tokenEntryResult.user;

        if (scopes && (scopes[0] == "admin")) {
            const hasPermission: boolean = await hasUserLevel(user, 1);
            if (!hasPermission) {
                return Promise.reject(new APIAuthResponse(APIStatus.Error, "You must be an admin to use this endpoint"));
            }
        }

        return Promise.resolve({ token: tokenEntryResult, user: user });
    }
    else if (securityName == "optionalAdmin") {
        const token: ObjectId | undefined = request.get("Authorization")?.split(" ")[1] as ObjectId | undefined;

        if (!token) {
            return Promise.resolve();
        }

        const tokenEntryResult = await BeepORM.tokenRepository.findOne(token);

        if (tokenEntryResult) {
            const isAdmin: boolean = await hasUserLevel(tokenEntryResult.user, 1);

            if (isAdmin) {
                return Promise.resolve({ token: token, user: tokenEntryResult.user });
            }
            return Promise.resolve();
        }
        else {
            return Promise.resolve();
        }
    }
}
