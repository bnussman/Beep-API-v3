import {UserPluckResult} from "../types/beep";
import * as r from 'rethinkdb';
import {conn} from "../utils/db";

export function isEduEmail(email: string): boolean {
    return (email.substr(email.length - 3) === "edu");
}

export async function getEmail(id: string): Promise<string | undefined> {
    try {
        const result: UserPluckResult = await r.table("users").get(id).pluck("email").run(conn);
        return result.email;
    }
    catch (error) {
        throw error;
    }
}
