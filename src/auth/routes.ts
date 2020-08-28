import express = require('express');
import { Router, Request, Response } from 'express';
import * as r from 'rethinkdb';
import { Cursor, CursorError, WriteResult } from 'rethinkdb';
import { conn, connQueues } from '../utils/db';
import { User } from '../types/beep';
import { makeJSONSuccess, makeJSONError } from '../utils/json';
import { sha256 } from 'js-sha256';
import { getToken, setPushToken, isTokenValid, getUserFromEmail, sendResetEmail, deactivateTokens, createVerifyEmailEntryAndSendEmail, doesUserExist } from './helpers';
import { UserPluckResult } from "../types/beep";
import { Validator } from "node-input-validator";
import logger from "../utils/logger";

const router: Router = express.Router();

router.post('/login', login);
router.post('/signup', signup);
router.post('/logout', logout);
router.post('/token', removeToken);
router.post('/password/forgot', forgotPassword);
router.post('/password/reset', resetPassword);

/**
 * API function to handle a login
 */
async function login (req: Request, res: Response): Promise<Response | void> {
    //make a validator to check login inputs
    const v = new Validator(req.body, {
        username: "required",
        password: "required"
    });

    const matched = await v.check();

    if (!matched) {
        //users input did not match our criteria, send the validator's error
        return res.send(makeJSONError(v.errors));
    }

    //RethinkDB Query to see if there is a user with POSTed username
    r.table("users").filter({ "username": req.body.username }).run(conn, function (error: Error, cursor: Cursor) {
        //Handle RethinkDB error
        if (error) {
            res.send(makeJSONError("Unable to login"));
            return logger.error(error);
        }

        //Iterate through user's with that given username
        cursor.next(async function(error: CursorError, result: User) {
            //Handle RethinkDB cursour error
            if (error) {
                //close the RethinkDB cursor
                cursor.close();
                //tell the client no user exists
                return res.send(makeJSONError("User not found"));
            }
            //hash the input, and compare it to user's encrypted password
            if (result.password == sha256(req.body.password)) {
                //if authenticated, get new auth tokens
                const tokenData = await getToken(result.id);

                if (req.body.expoPushToken) {
                    setPushToken(result.id, req.body.expoPushToken);
                }

                //close the RethinkDB cursor to prevent leak
                //TODO closing the cursour here could break everything , check and make sure it did not
                cursor.close();

                //send out data to REST API
                return res.send({
                    'status': "success",
                    'id': result.id,
                    'username': result.username,
                    'first': result.first,
                    'last': result.last,
                    'email': result.email,
                    'phone': result.phone,
                    'venmo': result.venmo,
                    'token': tokenData.token,
                    'tokenid': tokenData.tokenid,
                    'singlesRate': result.singlesRate,
                    'groupRate': result.groupRate,
                    'capacity': result.capacity,
                    'isBeeping': result.isBeeping,
                    'userLevel': result.userLevel,
                    'isEmailVerified': result.isEmailVerified,
                    'isStudent': result.isStudent
                });
            }
            else {
                //close the RethinkDB cursor to prevent leak
                cursor.close();
                //send message to client
                return res.send(makeJSONError("Password is incorrect."));
            }
        });
    });
}

/**
 * API function to handle a sign up
 * TODO: ensure username is not taken before signup
 */
async function signup (req: Request, res: Response): Promise<Response | void> {
    //validator to check if all signup feilds are valid
    const v = new Validator(req.body, {
        first: "required|alpha",
        last: "required|alpha",
        email: "required|email",
        phone: "required|phoneNumber",
        venmo: "required",
        username: "required|alphaNumeric",
        password: "required",
    });

    const matched = await v.check();

    if (!matched) {
        //users input did not match our criteria, send the validator's error
        return res.send(makeJSONError(v.errors));
    }

    if (doesUserExist(req.body.username)) {
        return res.send(makeJSONError("That username is already in use"));
    }

    //This is the row that will be inserted into our users RethinkDB table
    const document = {
        'first': req.body.first,
        'last': req.body.last,
        'email': req.body.email,
        'phone': req.body.phone,
        'venmo': req.body.venmo,
        'username': req.body.username,
        'password': sha256(req.body.password),
        'isBeeping': false,
        'queueSize': 0,
        'inQueueOfUserID': null,
        'pushToken': req.body.expoPushToken || null,
        'singlesRate': 3.00,
        'groupRate': 2.00,
        'capacity': 4,
        'userLevel': 0,
        'isEmailVerified': false,
        'isStudent': false
    };

    //insert a new user into our users table
    r.table("users").insert(document).run(conn, async function (error: Error, result: WriteResult) {
        //handle a RethinkDB error
        if (error) {
            res.send(makeJSONError("Unable to signup"));
            return logger.error(error);
        }

        //if we successfully inserted our new user...
        if (result.inserted == 1) {
            //line below uses the RethinkDB result to get us the user's id the rethinkdb generated for us
            const userid = result.generated_keys[0];
            //user our getToken function to get an auth token on signup
            const tokenData = await getToken(userid);

            //because signup was successful we must make their queue table
            r.db("beepQueues").tableCreate(userid).run(connQueues);

            //because user signed up, create a verify email entry in the db, this function will send the email
            createVerifyEmailEntryAndSendEmail(userid, req.body.email, req.body.first);

            //produce our REST API output
            return res.send({
                'status': "success",
                'id': userid,
                'username': req.body.username,
                'first': req.body.first,
                'last': req.body.last,
                'email': req.body.email,
                'phone': req.body.phone,
                'venmo': req.body.venmo,
                'token': tokenData.token,
                'tokenid': tokenData.tokenid,
                'singlesRate': 3.00,
                'groupRate': 2.00,
                'capacity': 4,
                'isBeeping': false,
                'userLevel': 0,
                'isEmailVerified': false,
                'isStudent': false
            });
        }
        else {
            //RethinkDB says that a new entry was NOT inserted, something went wrong...
            return res.send(makeJSONError("New user was not inserted into the database."));
        }
    });
}

/**
 * API function to handle a logout
 */
async function logout (req: Request, res: Response): Promise<Response | void> {
    //check if auth token is valid before processing the request to update push token
    const id = await isTokenValid(req.body.token);

    if (!id) {
        //if there is no id returned, the token is not valid.
        return res.send(makeJSONError("Your auth token is not valid."));
    }

    //RethinkDB query to delete entry in tokens table.
    r.table("tokens").get(req.body.token).delete().run(conn, function (error: Error, result: WriteResult) {
        //handle a RethinkDB error
        if (error) {
            res.send(makeJSONError("Unable to logout"));
            return logger.error(error);
        }

        //if RethinkDB tells us something was deleted, logout was successful
        if (result.deleted == 1) {
            //unset the user's push token
            if (req.body.isApp) {
                //if user signs out in our iOS or Android app, unset their push token.
                //We must check this beacuse we don't want the website to un-set a push token
                setPushToken(id, null);
            }
            //return success message
            return res.send(makeJSONSuccess("Token was revoked."));
        }
        else {
            //Nothing was deleted in the db, so there was some kind of error
            return res.send(makeJSONError("Token was not deleted in our database."));
        }
    });
}

/**
 * API function that handles revoking an auth token given a tokenid (an offline logout)
 * TODO: rather than having this function, just use logout and post data accordingly
 * @param req
 * @param res
 */
function removeToken (req: Request, res: Response): void {
    //RethinkDB query to delete entry in tokens table.
    r.table("tokens").filter({'tokenid': req.body.tokenid}).delete().run(conn, function (error: Error, result: WriteResult) {
        //handle a RethinkDB error
        if (error) {
            res.send(makeJSONError("Unable to remove token"));
            return logger.error(error);
        }

        //if RethinkDB tells us something was deleted, logout was successful
        if (result.deleted == 1) {
            return res.send(makeJSONSuccess("Token was revoked."));
        }
        else {
            //Nothing was deleted in the db, so there was some kind of error
            return res.send(makeJSONError("Token was not deleted in our database."));
        }
    });
}

/**
 * API function to handle user forgetting a password
 * @param req
 * @param res
 */
async function forgotPassword (req: Request, res: Response): Promise<Response | void> {
    //validate the email that user inputs
    const v = new Validator(req.body, {
        email: "required|email",
    });

    const matched = await v.check();

    if (!matched) {
        //if input did not match criteria, give user error
        return res.send(makeJSONError(v.errors));
    }

    //we want to try to get a user's doc, if null, there is no user
    //call our helper function. getUserFromEmail takes an email and will pluck evey other param from their user table
    let user: UserPluckResult | null = await getUserFromEmail(req.body.email, "id", "first");

    if (user) {
        //we were able to find a user and get their details
        //everything in this try-catch is to handle if a request has already been made for forgot password
        try {
            //query the db for any password reset entries with the same userid
            const cursor: Cursor = await r.table("passwordReset").filter({ userid: user.id }).run(conn);

            try { 
                //we try to take the cursor and get the next item
                const entry = await cursor.next();

                //there is a entry where userid is the same as the incoming request, this means the user already has an active db entry,
                //so we will just resend an email with the same db id
                if (entry) {
                    sendResetEmail(req.body.email, entry.id, user.first);

                    return res.send(makeJSONError("You have already requested to reset your password. We have re-sent your email. Check your email and follow the instructions."));
                }
            }
            catch (error) {
                //the next function is throwing an error, it is basiclly saying there is no next, so we can say 
                //there is no entry for the user currenly in the table, which means we can procede to give them a forgot password token
            }
        }
        catch (error) {
            //there was an error establishing the cursor used for looking in passwordReset
            res.send(makeJSONError("Unable to process a forgot password request"));
            return logger.error(error);
        }

        //this is what will be inserted when making a new forgot password entry
        const doccument = {
            "userid": user.id,
            "time": Date.now()
        }; 

        try {
            //insert the new entry
            const result: WriteResult = await r.table("passwordReset").insert(doccument).run(conn);

            //use the RethinkDB write result as the forgot password token
            const id: string = result.generated_keys[0];

            //now send an email with some link inside like https://ridebeep.app/password/reset/ba386adf-743a-434e-acfe-98bdce47d484	
            sendResetEmail(req.body.email, id, user.first);

            return res.send(makeJSONSuccess("Successfully sent email"));
        }
        catch (error) {
            //There was an error inserting a forgot password entry
            res.send(makeJSONError("Unable to process a forgot password request"));
            return logger.error(error);
        }
    }
    else {
        return res.send(makeJSONError("User not found"));
    }
}

/**
 * API function to handle user resetting their password after getting reset email
 * @param req
 * @param res
 */
async function resetPassword (req: Request, res: Response): Promise<Response | void> {
    //validate the user's new password
    const v = new Validator(req.body, {
        password: "required",
    });

    const matched = await v.check();

    if (!matched) {
        //user did not match the password criteria, send them the validation errors
        return res.send(makeJSONError(v.errors));
    }

    try {
        //this seems odd, but we delete the forgot password entry but use RethinkDB returnChanges to invalidate the entry and complete this 
        //new password request
        const result: WriteResult = await r.table("passwordReset").get(req.body.id).delete({ returnChanges: true }).run(conn);

        //get the db entry from the RethinkDB changes
        const entry = result.changes[0].old_val;

        //check if request time was made over an hour ago
        if ((entry.time + (3600 * 1000)) < Date.now()) {
            return res.send(makeJSONError("Your verification token has expired. You must re-request to reset your password."));
        }

        try {
            //update user's password in their db entry
            await r.table("users").get(entry.userid).update({ password: sha256(req.body.password) }).run(conn);

            //incase user's password was in the hands of bad person, invalidate user's tokens after they successfully reset their password
            deactivateTokens(entry.userid);

            return res.send(makeJSONSuccess("Successfully reset your password!"));
        }
        catch (error) {
            //RethinkDB unable to update user's password
            res.send(makeJSONError("Unable to reset your password"));
            return logger.error(error);
        }
    }
    catch (error) {
        //the entry with the user's specifed token does not exists in the passwordReset table
        return res.send(makeJSONError("Invalid password reset token"));
    }
}

export = router;
