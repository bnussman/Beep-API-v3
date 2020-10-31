import { UserPluckResult } from "../types/beep";
import * as r from 'rethinkdb';
import database from "../utils/db";
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
        const result: UserPluckResult = await r.table("users").get(id).pluck("email").run(database.getConn());
        return result.email;
    }
    catch (error) {
        //error getting user with id from users table and plucking email
        Sentry.captureException(error);
        return undefined;
    }
}

/**
 * delete a user based on their id
 * @param id string the user's id
 * @returns boolean true if delete was successful
 */
export async function deleteUser(id: string): Promise<boolean> {
    //delete user document in user table
    try {
        r.table("users").get(id).delete().run(database.getConn());
    }
    catch (error) {
        Sentry.captureException(error);
        return false;
    }

    //delete user's queue table from beepQueues 
    try {
        r.db("beepQueues").tableDrop(id).run(database.getConnQueues());
    }
    catch (error) {
        Sentry.captureException(error);
        return false;
    }

    //deative all of the user's tokens
    deactivateTokens(id);

    return true;
}
