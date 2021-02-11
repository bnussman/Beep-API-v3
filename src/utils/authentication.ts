import * as express from "express";
import * as Sentry from "@sentry/node";
import { APIStatus, APIAuthResponse } from "./Error";
import { BeepORM } from "../app";
import { UserRole } from "../entities/User";
import { AuthChecker } from "type-graphql";
import { Context } from "../utils/context";

export async function oldAuthChecker(req: express.Request, res: express.Response, next: express.NextFunction): Promise<any> {
        const token: string | undefined = req.get("Authorization")?.split(" ")[1];

        if (!token) {
            next();
            return;
        };

        const tokenEntryResult = await BeepORM.tokenRepository.findOne(token, { populate: true });

        if (tokenEntryResult) {
            req.user = { user: tokenEntryResult.user, token: tokenEntryResult };
        }

        next();
}

// create auth checker function
export const authChecker: AuthChecker<Context> = ({ context }, roles) => {
    //@ts-ignore
    const user = context.req.user.user;
    console.log("Checking auth");
    if (roles.length === 0) {
      // if `@Authorized()`, check only if user exists
      return user != null;
    }
    // there are some roles defined now
  
    if (!user) {
      // and if no user, restrict access
      return false;
    }

    if (roles[0] == user.role) {
      // grant access if the role matches specified
      return true;
    }

    return false;
  };