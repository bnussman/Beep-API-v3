import express = require('express');
import { Router, Request, Response } from 'express';
import * as r from 'rethinkdb';
import { Cursor, CursorError, WriteResult } from 'rethinkdb';
import { conn, connQueues } from '../utils/db';
import { User } from '../types/beep';
import { makeJSONSuccess, makeJSONError } from '../utils/json';
import { sha256 } from 'js-sha256';
import { getToken, setPushToken, isTokenValid, getUser, sendResetEmail, deactivateTokens } from './helpers';
import { UserPluckResult } from "../types/beep";

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
function login (req: Request, res: Response): void {
    //RethinkDB Query to see if there is a user with POSTed username
    r.table("users").filter({ "username": req.body.username }).run(conn, function (error: Error, cursor: Cursor) {
        //Handle RethinkDB error
        if (error) {
            throw error;
        }
        //Iterate through user's with that given username
        cursor.next(async function(error: CursorError, result: User) {
            //Handle RethinkDB cursour error
            if (error) {
                //TODO: re-add error.msg check
                res.send(makeJSONError("User not found."));
                //close the RethinkDB cursor to prevent leak
                cursor.close();
                return;
            }
            //hash the input, and compare it to user's encrypted password
            if (result.password == sha256(req.body.password)) {
                //if authenticated, get new auth tokens
                const tokenData = await getToken(result.id);
                //send out data to REST API
                res.send({
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
                    'userLevel': result.userLevel
                });
                
                if (req.body.expoPushToken) {
                    setPushToken(result.id, req.body.expoPushToken);
                }

                //close the RethinkDB cursor to prevent leak
                cursor.close();
                return;
            }
            else {
                res.send(makeJSONError("Password is incorrect."));
                //close the RethinkDB cursor to prevent leak
                cursor.close();
                return;
            }
        });
    });
}


/**
 * API function to handle a sign up
 * TODO: ensure username is not taken before signup
 */
function signup (req: Request, res: Response): void {
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
        'pushToken': req.body.expoPushToken,
        'singlesRate': 3.00,
        'groupRate': 2.00,
        'capacity': 4,
        'userLevel': 0
    };

    //insert a new user into our users table
    r.table("users").insert(document).run(conn, async function (error: Error, result: WriteResult) {
        //handle a RethinkDB error
        if (error) {
            throw error;
        }
        //if we successfully inserted our new user...
        if (result.inserted == 1) {
            //line below uses the RethinkDB result to get us the user's id the rethinkdb generated for us
            const userid = result.generated_keys[0];
            //user our getToken function to get an auth token on signup
            const tokenData = await getToken(userid);

            //because signup was successful we must make their queue table
            r.db("beepQueues").tableCreate(userid).run(connQueues);

            //produce our REST API output
            res.send({
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
                'userLevel': 0
            });
        }
        else {
            //RethinkDB says that a new entry was NOT inserted, something went wrong...
            res.send(makeJSONError("New user was not inserted into the database."));
        }
    });
}

/**
 * API function to handle a logout
 */
async function logout (req: Request, res: Response): Promise<void> {
    //check if auth token is valid before processing the request to update push token
    const id = await isTokenValid(req.body.token);

    if (!id) {
        //if there is no id returned, the token is not valid.
        res.send(makeJSONError("Your auth token is not valid."));
        return;
    }

    //RethinkDB query to delete entry in tokens table.
    r.table("tokens").get(req.body.token).delete().run(conn, function (error: Error, result: WriteResult) {
        //handle a RethinkDB error
        if (error) {
            throw error;
        }
        //if RethinkDB tells us something was deleted, logout was successful
        if (result.deleted == 1) {
            //unset the user's push token
            setPushToken(id, null);
            //return success message
            res.send(makeJSONSuccess("Token was revoked."));
        }
        else {
            //Nothing was deleted in the db, so there was some kind of error
            res.send(makeJSONError("Token was not deleted in our database."));
        }
    });
}

/**
 * API function that handles revoking an auth token given a tokenid (an offline logout)
 * TODO: rather than having this function, just use logout and post data accordingly
 */
function removeToken (req: Request, res: Response): void {
    //RethinkDB query to delete entry in tokens table.
    r.table("tokens").filter({'tokenid': req.body.tokenid}).delete().run(conn, function (error: Error, result: WriteResult) {
        //handle a RethinkDB error
        if (error) {
            throw error;
        }
        //if RethinkDB tells us something was deleted, logout was successful
        if (result.deleted == 1) {
            res.send(makeJSONSuccess("Token was revoked."));
        }
        else {
            //Nothing was deleted in the db, so there was some kind of error
            res.send(makeJSONError("Token was not deleted in our database."));
        }
    });
}

async function forgotPassword (req: Request, res: Response) {
    //TODO make sure the user has not already put in a request to reset their password

    const user: UserPluckResult | null = await getUser(req.body.email, "id", "first");

    if (user) {
        const doccument = {
            "userid": user.id,
            "time": Date.now()
        }; 

        const result: WriteResult = await r.table("passwordReset").insert(doccument).run(conn);

        const id: string = result.generated_keys[0];

        //now send an email with some link inside like https://ridebeep.app/password/reset/ba386adf-743a-434e-acfe-98bdce47d484	
        sendResetEmail(req.body.email, id, user.first);

        res.send(makeJSONSuccess("Successfully sent email."));
    }
    else {
        res.send(makeJSONError("User not found."));
    }
}

async function resetPassword (req: Request, res: Response) {
    try {
        const user: WriteResult = await r.table("passwordReset").get(req.body.id).delete({returnChanges: true}).run(conn);
        const userid = user.changes[0].old_val.userid;

        try {
            await r.table("users").get(userid).update({ password: sha256(req.body.password) }).run(conn);
            res.send(makeJSONSuccess("Successfully reset your password!"));

            //TODO: would it be smart to de-activate any tokens the user has active?
            deactivateTokens(userid);
        }
        catch (error) {
            throw error;
        }
    }
    catch (error) {
        res.send(makeJSONError("Invalid password reset request."));
    }
}

export = router;
