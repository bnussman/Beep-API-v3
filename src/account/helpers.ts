import { UserPluckResult } from "../types/beep";
import * as r from 'rethinkdb';
import { conn } from "../utils/db";

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
        throw error;
    }
}
