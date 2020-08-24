import express = require('express');
import { Router, Request, Response } from 'express';
import { WriteResult } from "rethinkdb";
import * as r from 'rethinkdb';
import { sha256 } from 'js-sha256';
import { makeJSONSuccess, makeJSONError, makeJSONWarning } from '../utils/json';
import { isTokenValid, createVerifyEmailEntryAndSendEmail } from "../auth/helpers";
import { conn } from '../utils/db';
import { isEduEmail, getEmail } from './helpers';
import { Validator } from "node-input-validator";
import { UserPluckResult } from '../types/beep';

const router: Router = express.Router();

router.post('/edit', editAccount);
router.post('/password', changePassword);
router.post('/pushtoken', updatePushToken);
router.post('/verify', verifyAccount);
router.post('/status', getAccountStatus);

async function editAccount (req: Request, res: Response): Promise<void> {
    //check if auth token is valid before processing the request to update push token
    const id: string | null = await isTokenValid(req.body.token);

    if (!id) {
        //if there is no id returned, the token is not valid.
        res.send(makeJSONError("Your auth token is not valid."));
        return;
    }

    //Create a new validator to ensure user matches
    //criteria when updating profile
    const v = new Validator(req.body, {
        first: "required|alpha",
        last: "required|alpha",
        email: "required|email",
        phone: "required|phoneNumber",
        venmo: "required",
    });

    const matched = await v.check();

    if (!matched) {
        //if user did not meet cirteria, send them an error with the validator results
        res.send(makeJSONError(v.errors));
        return;
    }

    r.table("users").get(id).update({first: req.body.first, last: req.body.last, email: req.body.email, phone: req.body.phone, venmo: req.body.venmo}, {returnChanges: true}).run(conn, function (error: Error, result: WriteResult) {
        if (error) {
            throw error;
        }

        if (result.unchanged > 0) {
            //if RethinkDB reports no changes made, send user a warning
            res.send(makeJSONWarning("Nothing was changed about your profile."));
            return;
        }
       
        if (result.changes[0].old_val.email !== result.changes[0].new_val.email) {
            //if user made a change to their email, we need set their status to not verified and make them re-verify
            try {
                r.table("users").get(id).update({isEmailVerified: false, isStudent: false}).run(conn);
            }
            catch (error) {
                throw error;
            }
            
            //calles helper function that will create a db entry for email varification and also send the email
            createVerifyEmailEntryAndSendEmail(id, req.body.email, req.body.first);
        }

        res.send(makeJSONSuccess("Successfully edited profile."));
    });
}

async function changePassword (req: Request, res: Response): Promise<void> {
    //check if auth token is valid before processing the request to update push token
    const id = await isTokenValid(req.body.token);

    if (!id) {
        //if there is no id returned, the token is not valid.
        res.send(makeJSONError("Your auth token is not valid."));
        return;
    }

    //vaidator that will ensure a new password was entered
    const v = new Validator(req.body, {
        password: "required",
    });

    const matched = await v.check();

    if (!matched) {
        //user did not meet new password criteria, send them the validation errors
        res.send(makeJSONError(v.errors));
        return;
    }

    //encrypt password
    const encryptedPassword = sha256(req.body.password);

    //update the user's password
    r.table("users").get(id).update({password: encryptedPassword}).run(conn, function (error: Error) {
        if (error) {
            throw error;
        }

        res.send(makeJSONSuccess("Successfully changed password."));
    });
}

async function updatePushToken (req: Request, res: Response): Promise<void> {
    //check if auth token is valid before processing the request to update push token
    const id = await isTokenValid(req.body.token);

    if (!id) {
        //if there is no id returned, the token is not valid.
        res.send(makeJSONError("Your auth token is not valid."));
        return;
    }

    //update user's push token
    r.table("users").get(id).update({pushToken: req.body.expoPushToken}).run(conn, function (error: Error) {
        if (error) {
            throw error;
        }

        res.send(makeJSONSuccess("Successfully updated push token."));
    });
}

async function verifyAccount (req: Request, res: Response): Promise<void> {
    try {
        //this seems weird, but verifying the account by deleteing the entry in the db, but tell RethinkDB to retun changes
        const result: WriteResult = await r.table("verifyEmail").get(req.body.id).delete({returnChanges: true}).run(conn);

        //get the changes reported by RethinkDB
        const entry = result.changes[0].old_val;

        //check to see if 1 hour has passed since the initial request, if so, report an error.
        //3600 seconds in an hour, multiplied by 1000 because javascripts handles Unix time in ms
        if ((entry.time + (3600 * 1000)) < Date.now()) {
            res.send(makeJSONError("Your verification token has expired."));
            return;
        }

        //use the helper function getEmail to get user's email address from their id
        const usersEmail: string | undefined = await getEmail(entry.userid);

        //this case should not happen because of validation, but just in case
        if(!usersEmail) {
            res.send(makeJSONError("Please ensure you have a valid email set in your profile. Visit your app or our website to re-send a varification email."));
            return;
        }

        //if the user's current email is not the same as the email they are trying to verify dont prcede with the request
        if (entry.email !== usersEmail) {
            res.send(makeJSONError("You tried to verify an email address that is not the same as your current email."));
            return;
        }

        let update: Object;

        //use the helper function isEduEmail to check if user is a student
        if (isEduEmail(entry.email)) {
            //if user is a student ensure we update isStudent
            update = {isEmailVerified: true, isStudent: true};
        }
        else {
            update = {isEmailVerified: true};
        }

        try {
            //update the user's tabe with the new values
            await r.table("users").get(entry.userid).update(update).run(conn);

            res.send(makeJSONSuccess("Successfully verified email"));
        }
        catch(error) {
            throw error;
        }
    }
    catch (error) {
        res.send(makeJSONError("Invalid verify email token"));
    }
}

/**
 * API endpoint used for clients to check email varification status only (isEmailVerified and isStudent)
 * Hopefully one day we can have a socket open for user changes
 * @param req
 * @param res
 */
async function getAccountStatus(req: Request, res: Response) {
    //check if auth token is valid before processing the request to update push token
    const id = await isTokenValid(req.body.token);

    if (!id) {
        //if there is no id returned, the token is not valid.
        res.send(makeJSONError("Your auth token is not valid."));
        return;
    }

    r.table("users").get(id).pluck("isEmailVerified", "isStudent").run(conn, function(error: Error, result: UserPluckResult) {
        if (error) {
            throw error;
        }

        res.send(makeJSONSuccess(result));
    });
}

export = router;
