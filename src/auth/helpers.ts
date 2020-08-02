import { v4 as uuidv4 } from 'uuid';
import * as r from 'rethinkdb';
import { WriteResult } from 'rethinkdb';
import { TokenData } from '../types/index.d';
import { conn } from '../utils/db';

/**
 * Generates an authentication token and a token for that token (for offline logouts), stores
 * the entry in the tokens table, and returns that same data.
 *
 * @param userid a user's ID which is used to associate a token with a userid in our tokens table
 * @return user's id, auth token, and auth token's token to be used by login and sign up
 */
export async function getToken(userid: string): Promise<TokenData> {
    //this information will be inserted into the tokens table and returned by this function
    const document = {
        'userid': userid,
        'tokenid': uuidv4()
    };

    //insert our new auth token into our tokens table
    const result: WriteResult = await r.table("tokens").insert(document).run(conn);

    //if nothing was inserted into the tokens table, we know something is wrong
    if (result.inserted == 0) {
        throw "Unable to insert new token into db.";
    }

    const token: string = result.generated_keys[0];

    //return the data we generated
    return ({
        'userid': document.userid,
        'tokenid': document.tokenid,
        'token': token
    });
}

/**
 * Updates a user's pushToken in the database
 * @param id a user's id in which we want to update their push tokens
 * @param token the expo push token for the user
 */
export async function setPushToken(id: string | null, token: string | null): Promise<void> {
    if (!id) return;
    //run query to get user and update their pushToken
    await r.table("users").get(id).update({pushToken: token}).run(conn);
}

/**
 * Retuns user's id if their token is valid, null otherwise
 *
 * @param token takes a user's auth token as input
 * @return userid if token is valid, null otherwise
 */
export async function isTokenValid(token: string): Promise<string | null> {
    //get (only) user's id from tokens db where the token is the token passed to this function
    //NOTE: filter must be used over get here because token is not a primary (or secondary) key
    const result: any = await r.table("tokens").get(token).run(conn);

    if (result) {
        return result.userid;
    }

    //we did not find this token in the tokens table, so it is not valid,
    //rather then returning a userid, return null to signify that token is not valid.
    return null;
}

/**
 * function to tell if user has a specific user level
 * @param userid is the user's id
 * @prarm level is the desired user level
 * @returns a promice that is a boolean. True if user has level, false otherwise
 */
export async function hasUserLevel(userid: string, level: number): Promise<boolean> {
    const userLevel: number = await r.table("users").get(userid).pluck('userLevel').run(conn);
    //return a boolean, true if user has desired level, false otherwise
    return level == userLevel;
}

/**
 * works exactly like isTokenValid, but only returns a userid if user has userLevel == 1 (meaning they are an admin)
 * @param token a user's auth token
 * @returns promice that resolves to null or a user's id
 */
export async function isAdmin(token: string): Promise<string | null> {
    const id = await isTokenValid(token);

    if (id) {
        const hasCorrectLevel = await hasUserLevel(id, 1);
        
        if(hasCorrectLevel) {
            return id;
        }
    }
    return null;
}
