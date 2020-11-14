import * as r from 'rethinkdb';
import { WriteResult, Cursor } from 'rethinkdb';
import { TokenData, UserPluckResult } from '../types/beep';
import database from'../utils/db';
import * as nodemailer from "nodemailer";
import { transporter } from "../utils/mailer";
import * as Sentry from "@sentry/node";
import { v4 as uuidv4 } from "uuid";

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
    try {
        const result: WriteResult = await r.table("tokens").insert(document).run((await database.getConn()));

        //if nothing was inserted into the tokens table, we know something is wrong
        if (result.inserted == 0) {
            Sentry.captureException("Somehow, tokenData was not inserted, this is very bad");
            return ({
                'userid': userid,
                'tokenid': "yikes",
                'token': "yikes"
            });
        }

        const token: string = result.generated_keys[0];

        //return the data we generated
        return ({
            'userid': document.userid,
            'tokenid': document.tokenid,
            'token': token
        });
    } 
    catch (error) {
        Sentry.captureException(error);
        return ({
            'userid': userid,
            'tokenid': "yikes",
            'token': "yikes"
        });
    }
}

/**
 * Updates a user's pushToken in the database
 * @param id a user's id in which we want to update their push tokens
 * @param token the expo push token for the user
 */
export async function setPushToken(id: string | null, token: string | null): Promise<void> {
    if (!id) return;
    //run query to get user and update their pushToken
    try {
        await r.table("users").get(id).update({pushToken: token}).run((await database.getConn()));
    }
    catch(error) {
        Sentry.captureException(error);
    }
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
    try {
        const result: any = await r.table("tokens").get(token).run((await database.getConn()));

        if (result) {
            return result.userid;
        }

        //we did not find this token in the tokens table, so it is not valid,
        //rather then returning a userid, return null to signify that token is not valid.
    }
    catch (error) {
        Sentry.captureException(error);
    }

    return null;
}

/**
 * function to tell if user has a specific user level
 *
 * @param userid is the user's id
 * @prarm level is the desired user level
 * @returns a promice that is a boolean. True if user has level, false otherwise
 */
export async function hasUserLevel(userid: string, level: number): Promise<boolean> {
    try {
        const userLevel: number = await r.table("users").get(userid).pluck('userLevel').run((await database.getConn()));

        //return a boolean, true if user has desired level, false otherwise
        return level == userLevel;
    }
    catch (error) {
        //in prod, log error with our logger i guess
        Sentry.captureException(error);
    }
    return false;
}

/**
 * works exactly like isTokenValid, but only returns a userid if user has userLevel == 1 (meaning they are an admin)
 *
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
 *
 * @param email string of user's email
 * @param pluckItems are items we want to pluck in the db query 
 * @returns Promise<UserPluckResult>
 */
export async function getUserFromEmail(email: string, ...pluckItems: string[]): Promise<UserPluckResult | null> {
    try {
        let cursor: Cursor;

        //if no pluck items were passed in, don't pluck anything
        if (pluckItems.length == 0) {
            cursor = await r.table("users").filter({ 'email': email }).limit(1).run((await database.getConn()));
        }
        else {
            //expand all the pluck paramaters and rethinkdb query to get them
            cursor = await r.table("users").filter({ 'email': email }).pluck(...pluckItems).limit(1).run((await database.getConn()));
        }
        
        try {
            //call the next item in the table
            const result: UserPluckResult = await cursor.next();
            //return the user's pluck data
            return result;
        } catch (error) {
            //error is telling us there is no row result from the db, not really an error
            //return null because there is no user.
            return null;
        }
    }
    catch (error) {
        Sentry.captureException(error);
    }
    return null;
}

/**
 * get user data given an email
 *
 * @param email string of user's email
 * @param pluckItems are items we want to pluck in the db query 
 * @returns Promise<UserPluckResult>
 */
export async function getUserFromId(id: string, ...pluckItems: string[]): Promise<UserPluckResult | null> {
    let result = null;

    try {
        //if no pluck items were passed in, don't pluck anything
        if (pluckItems.length == 0) {
            result = await r.table("users").get(id).run((await database.getConn()));
        }
        else {
            //expand all the pluck paramaters and rethinkdb query to get them
            result = await r.table("users").get(id).pluck(...pluckItems).run((await database.getConn()));
        }
        
    }
    catch (error) {
        //this probabaly means that the user identified by id no longer exists
    }

    return result;
}

/**
 * Helper function to send password reset email to user
 *
 * @param email who to send the email to
 * @param id is the passowrdReset entry (NOT the user's id)
 * @param first is the first name of the recipiant so email is more personal
 */
export function sendResetEmail(email: string, id: string, first: string | undefined): void {

    const url: string = process.env.NODE_ENV === "development" ? "https://dev.ridebeep.app" : "https://ridebeep.app";
 
    const mailOptions: nodemailer.SendMailOptions = { 
        from : 'Beep App <banks@ridebeep.app>', 
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
            Sentry.captureException(error);
        } 
    });     
}

/**
 * Helper function that deactives all auth tokens for user by their userid
 *
 * @param userid string of their user id
 * @returns void
 */
export async function deactivateTokens(userid: string): Promise<void> {
    try {
        //delete all entries in the tokens db where userid matches
        r.table("tokens").filter({ userid: userid }).delete().run((await database.getConn()));
    }
    catch (error) {
        //RethinkDB error when deleteing push tokens for userid
        Sentry.captureException(error);
    }
}

/**
 * Send Very Email Email to user
 *
 * @param email string user's email
 * @param id string is the eventid in the verifyEmail database
 * @param first string is the user's first name to make the email more personalized
 * @returns void
 */
export function sendVerifyEmailEmail(email: string, id: string, first: string | undefined): void {

    const url: string = process.env.NODE_ENV === "development" ? "https://dev.ridebeep.app" : "https://ridebeep.app";
 
    const mailOptions: nodemailer.SendMailOptions = { 
        from : 'Beep App <banks@ridebeep.app>', 
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
            Sentry.captureException(error);
        } 
    });     
}

/**
 * Helper function for email verfication. This function will create and insert a new email verification entry and 
 * it will call the other helper function to actually send the email.
 *
 * @param id is the user's is
 * @param email is the user's email
 * @param first is the user's first name so we can make the email more personal
 * @returns void
 */
export async function createVerifyEmailEntryAndSendEmail(id: string, email: string | undefined, first: string | undefined): Promise<void> {
    if (!email || !first) {
        Sentry.captureException(new Error("Did not create verify email entry or send email due to no email or first name"));
        return;
    }

    //this is what will be inserted into the verifyEmail table
    const document = {
        "time": Date.now(),
        "userid": id,
        "email": email
    };

    try {
        const result: WriteResult = await r.table("verifyEmail").insert(document).run((await database.getConn()));

        //get the generated id from RethinkDB write result because that id is the token the user uses for varification
        const verifyId: string = result.generated_keys[0];

        //send the email
        sendVerifyEmailEmail(email, verifyId, first);
    }
    catch (error) {
        //RethinkDB unable to insert into verifyEmail table
        Sentry.captureException(error);
    }
}

/**
 * function to tell you if a user exists by a username
 *
 * @param username string 
 * @returns Promise<boolean> true if user exists by username
 */
export async function doesUserExist(username: string): Promise<boolean> {
    try {
        const count: number = await r.table("users").filter({ username: username }).count().run((await database.getConn()));
        
        if (count >= 1) {
            return true;        
        }
    }
    catch (error) {
        Sentry.captureException(error);
    }
    return false;
}
