import { UserPluckResult } from "../types/beep";
import * as r from 'rethinkdb';
import { conn, connQueues } from "../utils/db";
import { deactivateTokens } from "../auth/helpers";
import * as Sentry from "@sentry/node";

/**
 * checks last 4 characters of an email address
 * @param email
 * @returns boolean true if ends in ".edu" and false if otherwise
 */
export function isEduEmail(email: string): boolean {
    return (email.substr(email.length - 3) === "edu");
}

/**
 * takes userid and gives you their email
 * @param userid is a user's id
 * @returns promise of user's email
 */
export async function getEmail(id: string): Promise<string | undefined> {
    try {
        const result: UserPluckResult = await r.table("users").get(id).pluck("email").run(conn);
        return result.email;
    }
    catch (error) {
        //error getting user with id from users table and plucking email
        Sentry.captureException(error);
        return undefined;
    }
}

export function deleteUser(id: string): boolean {
    //delete user document in user table
    try {
        r.table("users").get(id).delete().run(conn);
    }
    catch (error) {
        Sentry.captureException(error);
        return false;
    }

    //delete user's queue table from beepQueues 
    try {
        r.db("beepQueues").tableDrop(id).run(connQueues);
    }
    catch (error) {
        Sentry.captureException(error);
        return false;
    }

    //deative all of the user's tokens
    deactivateTokens(id);

    return true;
}
