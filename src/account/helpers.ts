import { UserPluckResult } from "../types/beep";
import * as r from 'rethinkdb';
import { conn, connQueues } from "../utils/db";
import logger from "../utils/logger";
import { deactivateTokens } from "../auth/helpers";

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
        logger.error(error);
        return undefined;
    }
}

export function deleteUser(id: string): boolean {
    //delete user document in user table
    try {
        r.table("users").get(id).delete().run(conn);
    }
    catch (error) {
        logger.error(error);
        return false;
    }

    //delete user's queue table from beepQueues 
    try {
        r.db("beepQueues").tableDrop(id).run(connQueues);
    }
    catch (error) {
        logger.error(error);
        return false;
    }

    //deative all of the user's tokens
    deactivateTokens(id);

    return true;
}
