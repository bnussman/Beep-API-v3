import express = require('express');
import { Router, Request, Response } from 'express';
import { WriteResult } from "rethinkdb";
import * as r from 'rethinkdb';
import { sha256 } from 'js-sha256';
import { makeJSONSuccess, makeJSONError, makeJSONWarning } from '../utils/json';
import { isTokenValid, createVerifyEmailEntry } from "../auth/helpers";
import { conn } from '../utils/db';
import {isEduEmail, getEmail} from './helpers';
import { Validator } from "node-input-validator";

const router: Router = express.Router();

router.post('/edit', editAccount);
router.post('/password', changePassword);
router.post('/pushtoken', updatePushToken);
router.post('/verify', verifyAccount);

async function editAccount (req: Request, res: Response): Promise<void> {
    //check if auth token is valid before processing the request to update push token
    const id = await isTokenValid(req.body.token);

    if (!id) {
        //if there is no id returned, the token is not valid.
        res.send(makeJSONError("Your auth token is not valid."));
        return;
    }

    const v = new Validator(req.body, {
        first: "required|alpha",
        last: "required|alpha",
        email: "required|email",
        phone: "required|phoneNumber",
        venmo: "required",
    });

    const matched = await v.check();

    if (!matched) {
        res.send(makeJSONError(v.errors));
        return;
    }

    r.table("users").get(id).update({first: req.body.first, last: req.body.last, email: req.body.email, phone: req.body.phone, venmo: req.body.venmo}, {returnChanges: true}).run(conn, function (error: Error, result: WriteResult) {
        if (error) {
            throw error;
        }
        if (result.unchanged > 0) {
            res.send(makeJSONWarning("Nothing was changed about your profile."));
            return;
        }
        
        if (result.changes[0].old_val.email !== result.changes[0].new_val.email) {
            //user changed their email, make email not valid
            try {
                r.table("users").get(id).update({isEmailVerified: false, isStudent: false}).run(conn);
            }
            catch (error) {
                throw error;
            }

            createVerifyEmailEntry(id, req.body.email, req.body.first);
        }
        //TODO we need to pass returnChanges param to the update function and check if email was changed
        //if email was changed, set isEmailVarified to false

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

    const v = new Validator(req.body, {
        password: "required",
    });

    const matched = await v.check();

    if (!matched) {
        res.send(makeJSONError(v.errors));
        return;
    }

    const encryptedPassword = sha256(req.body.password);

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

    r.table("users").get(id).update({pushToken: req.body.expoPushToken}).run(conn, function (error: Error) {
        if (error) {
            throw error;
        }
        res.send(makeJSONSuccess("Successfully updated push token."));
    });
}

async function verifyAccount (req: Request, res: Response): Promise<void> {
    try {
        const result: WriteResult = await r.table("verifyEmail").get(req.body.id).delete({returnChanges: true}).run(conn);

        const userid = result.changes[0].old_val.userid;
        const email = result.changes[0].old_val.email;
        const time = result.changes[0].old_val.time;

        if ((time * (3600 * 1000)) < Date.now()) {
            res.send(makeJSONError("Your verification token has expired."));
            return;
        }

        const usersEmail: string | undefined = await getEmail(userid);

        if(!usersEmail) {
            res.send(makeJSONError("Please ensure you have a valid email set in your profile. Visit your app or our website to re-send a varification email."));
            return;
        }

        if (email !== usersEmail) {
            res.send(makeJSONError("You tried to verify an email address that is not the same as your current email."));
            return;
        }

        let update: Object;

        if (isEduEmail(email)) {
            update = {isEmailVerified: true, isStudent: true};
        }
        else {
            update = {isEmailVerified: true};
        }

        try {
            await r.table("users").get(userid).update(update).run(conn);
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

export = router;
