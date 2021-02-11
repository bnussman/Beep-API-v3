import * as express from "express";
import * as Sentry from "@sentry/node";
import { APIStatus, APIAuthResponse } from "./Error";
import { BeepORM } from "../app";
import { UserRole } from "../entities/User";
import { AuthChecker } from "type-graphql";
import { Context } from "../utils/context";

export async function oldAuthChecker(request: express.Request, securityName: string, scopes?: string[]): Promise<any> {
    if (securityName === "token") {
        const token: string | undefined = request.get("Authorization")?.split(" ")[1];

        if (!token) {
            return Promise.reject(new APIAuthResponse(APIStatus.Error, "You must provide an authentication token"));
        }

        const tokenEntryResult = await BeepORM.tokenRepository.findOne(token, { populate: true });

        if (!tokenEntryResult) {
            return Promise.reject(new APIAuthResponse(APIStatus.Error, "Your token is not valid"));
        }

        if (scopes && (scopes[0] == "admin")) {
            if (tokenEntryResult.user.role != UserRole.ADMIN) {
                return Promise.reject(new APIAuthResponse(APIStatus.Error, "You must be an admin to use this endpoint"));
            }
        }

        return Promise.resolve({ token: tokenEntryResult, user: tokenEntryResult.user });
    }
    else if (securityName == "optionalAdmin") {
        const token: string | undefined = request.get("Authorization")?.split(" ")[1];

        if (!token) {
            return Promise.resolve();
        }

        const tokenEntryResult = await BeepORM.tokenRepository.findOne(token, { populate: true });

        if (tokenEntryResult) {
            if (tokenEntryResult.user.role == UserRole.ADMIN) {
                return Promise.resolve({ token: token, user: tokenEntryResult.user });
            }
            return Promise.resolve();
        }
        else {
            return Promise.resolve();
        }
    }
}

// create auth checker function
export const authChecker: AuthChecker<Context> = ({ context: { user } }, roles) => {
    console.log("Context", user);
    console.log("Roles", roles);
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