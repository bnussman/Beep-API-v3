import { v4 as uuidv4 } from 'uuid';
import * as r from 'rethinkdb';
import { WriteResult, Cursor } from 'rethinkdb';
import { TokenData, UserPluckResult } from '../types/beep';
import { conn } from '../utils/db';
import * as nodemailer from "nodemailer";

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
    const id: string | null = await isTokenValid(token);

    if (id) {
        const hasCorrectLevel = await hasUserLevel(id, 1);
        
        if(hasCorrectLevel) {
            return id;
        }
    }
    return null;
}

/**
 * get user data given an email
 * @param email string of user's email
 * @param pluckItems are items we want to pluck in the db query 
 * @returns Promise<UserPluckResult>
 */
export async function getUserFromEmail(email: string, ...pluckItems: string[]): Promise<UserPluckResult | null> {
    try {
        let cursor: Cursor;
        //if no pluck items were passed in, don't pluck anything
        if (pluckItems.length == 0) {
            cursor = await r.table("users").filter({ 'email': email }).limit(1).run(conn);
        }
        else {
            cursor = await r.table("users").filter({ 'email': email }).pluck(...pluckItems).limit(1).run(conn);
        }
        
        try {
            const result: UserPluckResult = await cursor.next();
            return result;
        } catch (error) {
            //error is telling us there is no row result from the db, not really an errro
            return null;
        }

    } catch (error) {
        throw new error;
    }
}

/**
 * Helper function to send password reset email to user
 * @param email who to send the email to
 * @param id is the passowrdReset entry (NOT the user's id)
 * @param first is the first name of the recipiant so email is more personal
 */
export function sendResetEmail(email: string, id: string, first: string | undefined): void {
    const transporter = nodemailer.createTransport({
        host: "smtp.gmail.com",
        port: 465,
        secure: true,
        auth: {
            user: "banks@nussman.us",
            pass: process.env.MAIL_PASSWORD
        }
    }); 

    const url: string = process.env.NODE_ENV === "development" ? "https://dev.ridebeep.app" : "https://ridebeep.app";
 
    const mailOptions: nodemailer.SendMailOptions = { 
        from : 'banks@nussman.us', 
        to : email, 
        subject : 'Change your Beep App password', 
        html: `Hey ${first}, <br><br>
            Head to ${url}/password/reset/${id} to reset your password. This link will expire in an hour. <br><br>
            Roll Neers, <br>
            -Banks Nussman
        ` 
    }; 

    transporter.sendMail(mailOptions, (error: Error | null, info: nodemailer.SentMessageInfo) => { 
        if (error) { 
            throw error;
            //TODO return false if error in prod
        } 
        //retun true 
        console.log("Successfully sent email: ", info); 
    });     
}

/**
 * Helper function that deactives all auth tokens for user by their userid
 * @param userid string of their user id
 */
export function deactivateTokens(userid: string): void {
    try {
        r.table("tokens").filter({ userid: userid }).delete().run(conn);
    }
    catch (error) {
        throw error;
    }
}
/**
 * Helper function that will run a db query on passwordReset table to delete entries
 * where the time is less than an hour ago, meaning it expired.
 */
export async function cleanPasswordResetTable(): Promise<void> {
    try { 
        //delete any password reset requests that were requested over an hour ago
        await r.table("passwordReset").filter((r.row("time").add(3600 * 1000)).lt(Date.now())).delete().run(conn);
    } 
    catch (error) {
        throw error;
    }
}

export function sendVerifyEmailEmail(email: string, id: string, first: string | undefined): void {
    const transporter = nodemailer.createTransport({
        host: "smtp.gmail.com",
        port: 465,
        secure: true,
        auth: {
            user: "banks@nussman.us",
            pass: process.env.MAIL_PASSWORD
        }
    }); 

    const url: string = process.env.NODE_ENV === "development" ? "https://dev.ridebeep.app" : "https://ridebeep.app";
 
    const mailOptions: nodemailer.SendMailOptions = { 
        from : 'banks@nussman.us', 
        to : email, 
        subject : 'Verify your Beep App Email!', 
        html: `Hey ${first}, <br><br>
            Head to ${url}/account/verify/${id} to verify your email. This link will expire in an hour. <br><br>
            Roll Neers, <br>
            -Banks Nussman
        ` 
    }; 

    transporter.sendMail(mailOptions, (error: Error | null, info: nodemailer.SentMessageInfo) => { 
        if (error) { 
            throw error;
            //TODO return false if error in prod
        } 
        //retun true 
        console.log("Successfully sent email: ", info); 
    });     
}

export async function createVerifyEmailEntry(id: string, email: string, first: string): Promise<void> {
    const document = {
        "time": Date.now(),
        "userid": id,
        "email": email
    };

    try {
        const result: WriteResult = await r.table("verifyEmail").insert(document).run(conn);
        const verifyId: string = result.generated_keys[0];

        sendVerifyEmailEmail(email, verifyId, first);
    }
    catch (error) {
        throw error;
    }
}
