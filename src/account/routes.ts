import * as express from 'express';
import { Router, Request, Response } from 'express';
import { WriteResult } from "rethinkdb";
import * as r from 'rethinkdb';
import { sha256 } from 'js-sha256';
import { makeJSONSuccess, makeJSONError, makeJSONWarning } from '../utils/json';
import { createVerifyEmailEntryAndSendEmail, getUserFromId, isAuthenticated } from "../auth/helpers";
import { conn, connHistory } from '../utils/db';
import { isEduEmail, getEmail, deleteUser } from './helpers';
import { Validator } from "node-input-validator";
import { BeepTableResult, UserPluckResult } from '../types/beep';
import * as Sentry from "@sentry/node";

const router: Router = express.Router();

router.post('/edit', isAuthenticated, editAccount);
router.post('/delete', isAuthenticated, deleteAccount);
router.post('/password', isAuthenticated, changePassword);
router.post('/pushtoken', isAuthenticated, updatePushToken);
router.post('/verify', verifyAccount);
router.post('/verify/resend', isAuthenticated, resendEmailVarification);
router.post('/history/rider', isAuthenticated, getRideHistory);
router.post('/history/beeper', isAuthenticated, getBeepHistory);

async function editAccount(req: Request, res: Response): Promise<Response | void> {
    //Create a new validator to ensure user matches criteria when updating profile
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
        return res.status(422).send(makeJSONError(v.errors));
    }

    r.table("users").get(req.user.id).update({first: req.body.first, last: req.body.last, email: req.body.email, phone: req.body.phone, venmo: req.body.venmo}, {returnChanges: true}).run(conn, async function (error: Error, result: WriteResult) {
        if (error) {
            Sentry.captureException(error);
            return res.status(500).send(makeJSONError("Unable to edit account"));
        }

        if (result.unchanged > 0) {
            //if RethinkDB reports no changes made, send user a warning
            return res.send(makeJSONWarning("Nothing was changed about your profile."));
        }
       
        if (result.changes[0].old_val.email !== result.changes[0].new_val.email) {
            try {
                //delete user's existing email varification entries
                await r.table("verifyEmail").filter({ userid: req.user.id }).delete().run(conn);
            }
            catch (error) {
                Sentry.captureException(error);
                return res.status(500).send(makeJSONError("Unable to edit account"));
            }

            //if user made a change to their email, we need set their status to not verified and make them re-verify
            try {
                r.table("users").get(req.user.id).update({isEmailVerified: false, isStudent: false}).run(conn);
            }
            catch (error) {
                Sentry.captureException(error);
                return res.status(500).send(makeJSONError("Unable to edit account"));
            }
            
            //calles helper function that will create a db entry for email varification and also send the email
            createVerifyEmailEntryAndSendEmail(req.user.id, req.body.email, req.body.first);
        }

        res.send(makeJSONSuccess("Successfully edited profile."));
    });
}

async function changePassword (req: Request, res: Response): Promise<Response | void> {
    //vaidator that will ensure a new password was entered
    const v = new Validator(req.body, {
        password: "required",
    });

    const matched = await v.check();

    if (!matched) {
        //user did not meet new password criteria, send them the validation errors
        return res.status(422).send(makeJSONError(v.errors));
    }

    //encrypt password
    const encryptedPassword = sha256(req.body.password);

    //update the user's password
    r.table("users").get(req.user.id).update({password: encryptedPassword}).run(conn, function (error: Error) {
        if (error) {
            Sentry.captureException(error);
            return res.status(500).send(makeJSONError("Unable to change password"));
        }

        return res.send(makeJSONSuccess("Successfully changed password."));
    });
}

async function updatePushToken (req: Request, res: Response): Promise<Response | void> {
    //update user's push token
    r.table("users").get(req.user.id).update({ pushToken: req.body.expoPushToken }).run(conn, function (error: Error) {
        if (error) {
            Sentry.captureException(error);
            return res.status(500).send(makeJSONError("Unable to update push token"));
        }

        res.send(makeJSONSuccess("Successfully updated push token."));
    });
}

async function verifyAccount (req: Request, res: Response): Promise<Response | void> {
    try {
        //this seems weird, but verifying the account by deleteing the entry in the db, but tell RethinkDB to retun changes
        const result: WriteResult = await r.table("verifyEmail").get(req.body.id).delete({returnChanges: true}).run(conn);

        //get the changes reported by RethinkDB
        const entry = result.changes[0].old_val;

        //check to see if 1 hour has passed since the initial request, if so, report an error.
        //3600 seconds in an hour, multiplied by 1000 because javascripts handles Unix time in ms
        if ((entry.time + (3600 * 1000)) < Date.now()) {
            return res.status(410).send(makeJSONError("Your verification token has expired."));
        }

        //use the helper function getEmail to get user's email address from their id
        const usersEmail: string | undefined = await getEmail(entry.userid);

        //this case should not happen because of validation, but just in case
        if(!usersEmail) {
            return res.status(400).send(makeJSONError("Please ensure you have a valid email set in your profile. Visit your app or our website to re-send a varification email."));
        }

        //if the user's current email is not the same as the email they are trying to verify dont prcede with the request
        if (entry.email !== usersEmail) {
            return res.status(400).send(makeJSONError("You tried to verify an email address that is not the same as your current email."));
        }

        let update;

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

            return res.send({
                "status": "success",
                "message": "Successfully verified email",
                "data": {...update, "email": usersEmail}
            });
        }
        catch(error) {
            Sentry.captureException(error);
            res.status(500).send(makeJSONError("Unable to verify account"));
        }
    }
    catch (error) {
        res.status(404).send(makeJSONError("Invalid verify email token"));
    }
}

async function resendEmailVarification(req: Request, res: Response) {
    try {
        //delete user's existing email varification entries
        await r.table("verifyEmail").filter({ userid: req.user.id }).delete().run(conn);
    }
    catch (error) {
        Sentry.captureException(error);
        return res.status(500).send(makeJSONError("Unable to resend varification email"));
    }

    //get user's current email and first name
    const user: UserPluckResult | null = await getUserFromId(req.user.id, "first", "email");

    if (!user) {
        Sentry.captureException("User tried to resend their verification email but helper function was unable to getUserFromId");
        return res.status(500).send(makeJSONError("You don't exist as a user"));
    }

    //create a new entry with their current email address and send in email
    await createVerifyEmailEntryAndSendEmail(req.user.id, user.email, user.first);

    return res.send(makeJSONSuccess("Successfully re-sent varification email to " + user.email));
}

async function deleteAccount(req: Request, res: Response) {
    if (await deleteUser(req.user.id)) {
        res.send(makeJSONSuccess("Successfully deleted user"));
    }
    else {
        res.status(500).send(makeJSONError("Unable to delete user"));
    }
}

async function getRideHistory(req: Request, res: Response) {
    try {
        const cursor: r.Cursor = await r.table("beeps").filter({ riderid: req.user.id }).orderBy(r.desc("timeEnteredQueue")).run(connHistory);
        const result: BeepTableResult[] = await cursor.toArray();

        for (let i = 0; i < result.length; i++) {
            let user = {
                first: "Deleted",
                last: "User"
            };

            const userData = await getUserFromId(result[i].beepersid, "first", "last");

            if (userData && userData.first != undefined && userData.last != undefined) {
                user = {
                    first: userData.first,
                    last: userData.last
                };
            }

            result[i].beepersName = user.first + " " + user.last;
        }

        res.send(result);
    }
    catch (error) {
        Sentry.captureException(error);
        return res.status(500).send(makeJSONError("Unable to get ride history"));
    }
}

async function getBeepHistory(req: Request, res: Response) {
    try {
        const cursor: r.Cursor = await r.table("beeps").filter({ beepersid: req.user.id }).orderBy(r.desc("timeEnteredQueue")).run(connHistory);
        const result = await cursor.toArray();

        for (let i = 0; i < result.length; i++) {
            let user = {
                first: "Deleted",
                last: "User"
            };

            const userData = await getUserFromId(result[i].riderid, "first", "last");

            if (userData && userData.first != undefined && userData.last != undefined) {
                user = {
                    first: userData.first,
                    last: userData.last
                };
            }

            result[i].riderName = user.first + " " + user.last;
        }

        res.send(result);
    }
    catch (error) {
        Sentry.captureException(error);
        return res.status(500).send(makeJSONError("Unable to get ride history"));
    }
}

export = router;
