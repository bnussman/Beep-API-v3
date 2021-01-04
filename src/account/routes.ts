import express from 'express';
import { WriteResult } from "rethinkdb";
import * as r from 'rethinkdb';
import { sha256 } from 'js-sha256';
import { createVerifyEmailEntryAndSendEmail, getUserFromId } from "../auth/helpers";
import database from '../utils/db';
import { isEduEmail, getEmail, deleteUser } from './helpers';
import { Validator } from "node-input-validator";
import { UserPluckResult } from '../types/beep';
import * as Sentry from "@sentry/node";
import { APIStatus, APIResponse } from "../utils/Error";
import { Response, Body, Controller, Post, Route, Security, Tags, Request, Delete, Example, Put, Patch } from 'tsoa';
import { ChangePasswordParams, EditAccountParams, UpdatePushTokenParams, VerifyAccountParams, VerifyAccountResult } from "./account";

@Tags("Account")
@Route("account")
export class AccountController extends Controller {

    /**
     * Edit your user account
     * @param {EditAccountParams} requestBody - user should send full account data
     * @returns {APIResponse}
     */
    @Example<APIResponse>({
        status: APIStatus.Success,
        message: "Successfully edited profile."
    })
    @Response<APIResponse>(422, "Validation Error", {
        status: APIStatus.Error,
        message: {
            first: {
                message: "The first field is mandatory.",
                rule: "numeric"
            }
        }
    })
    @Response<APIResponse>(500, "Server Error", {
        status: APIStatus.Error,
        message: "Unable to edit account"
    })
    @Security("token")
    @Patch()
    public async editAccount(@Request() request: express.Request, @Body() requestBody: EditAccountParams): Promise<APIResponse> {
        const v = new Validator(requestBody, {
            first: "required|alpha",
            last: "required|alpha",
            email: "required|email",
            phone: "required|phoneNumber",
            venmo: "required",
        });

        const matched = await v.check();

        if (!matched) {
            this.setStatus(422);
            return new APIResponse(APIStatus.Error, v.errors);
        }

        //if user puts an @ at the beginning of their venmo username, rewrite it without the @ symbol
        if (requestBody.venmo.charAt(0) == '@') {
            requestBody.venmo = requestBody.venmo.substr(1, requestBody.venmo.length);
        }

        try {
            const result: WriteResult = await r.table("users").get(request.user.id).update({first: requestBody.first, last: requestBody.last, email: requestBody.email, phone: requestBody.phone, venmo: requestBody.venmo}, {returnChanges: true}).run((await database.getConn()));
            if (result.unchanged > 0) {
                //if RethinkDB reports no changes made, send user a warning
                return new APIResponse(APIStatus.Warning, "Nothing was changed about your profile.");
            }
           
            if (result.changes[0].old_val.email !== result.changes[0].new_val.email) {
                try {
                    //delete user's existing email varification entries
                    await r.table("verifyEmail").filter({ userid: request.user.id }).delete().run((await database.getConn()));
                }
                catch (error) {
                    Sentry.captureException(error);
                    this.setStatus(500);
                    return new APIResponse(APIStatus.Error, "Unable to edit account");
                }

                //if user made a change to their email, we need set their status to not verified and make them re-verify
                try {
                    r.table("users").get(request.user.id).update({isEmailVerified: false, isStudent: false}).run((await database.getConn()));
                }
                catch (error) {
                    Sentry.captureException(error);
                    this.setStatus(500);
                    return new APIResponse(APIStatus.Error, "Unable to edit account");
                }
                
                //calles helper function that will create a db entry for email varification and also send the email
                createVerifyEmailEntryAndSendEmail(request.user.id, requestBody.email, requestBody.first);
            }

            return new APIResponse(APIStatus.Success, "Successfully edited profile.");
        }
        catch (error) {
            Sentry.captureException(error);
            this.setStatus(500);
            return new APIResponse(APIStatus.Error, "Unable to edit account");
        }
    }

    /**
     * Change your password when authenticated with this endpoint
     * @param {ChangePasswordParams} requestBody - user should send a new password
     * @returns {APIResponse}
     */
    @Example<APIResponse>({
        status: APIStatus.Success,
        message: "Successfully changed password."
    })
    @Response<APIResponse>(422, "Validation Error", {
        status: APIStatus.Error,
        message: {
            password: {
                message: "The password field is mandatory.",
                rule: "numeric"
            }
        }
    })
    @Response<APIResponse>(500, "Server Error", {
        status: APIStatus.Error,
        message: "Unable to change password"
    })
    @Security("token")
    @Post("password")
    public async changePassword (@Request() request: express.Request, @Body() requestBody: ChangePasswordParams): Promise<APIResponse> {
        //vaidator that will ensure a new password was entered
        const v = new Validator(requestBody, {
            password: "required",
        });

        const matched = await v.check();

        if (!matched) {
            this.setStatus(422);
            return new APIResponse(APIStatus.Error, v.errors);
        }

        const encryptedPassword = sha256(requestBody.password);

        try {
            const result: WriteResult = await r.table("users").get(request.user.id).update({password: encryptedPassword}).run((await database.getConn()));
            //TODO check if something was written by checking result
            this.setStatus(200);
            return new APIResponse(APIStatus.Success, "Successfully changed password.");
        }
        catch (error) {
            Sentry.captureException(error);
            this.setStatus(500);
            return new APIResponse(APIStatus.Error, "Unable to change password");
        }
    }

    /**
     * Update your Push Token to a new push token to ensure mobile device gets notified by Expo
     * @param {UpdatePushTokenParams} requestBody - user should send an Expo Push Token
     * @returns {APIResponse}
     */
    @Example<APIResponse>({
        status: APIStatus.Success,
        message: "Successfully updated push token."
    })
    @Response<APIResponse>(500, "Server Error", {
        status: APIStatus.Error,
        message: "Unable to update push token"
    })
    @Security("token")
    @Put("pushtoken")
    public async updatePushToken (@Request() request: express.Request, @Body() requestBody: UpdatePushTokenParams): Promise<APIResponse> {
        try {
            const result: WriteResult = await r.table("users").get(request.user.id).update({ pushToken: requestBody.expoPushToken }).run((await database.getConn()));
            //TODO check if something was written by checking result
            this.setStatus(200);
            return new APIResponse(APIStatus.Success, "Successfully updated push token.");
        }
        catch(error) {
            Sentry.captureException(error);
            this.setStatus(500);
            return new APIResponse(APIStatus.Error, "Unable to update push token");
        }
    }

    /**
     * Verify your account by using the token sent to your email.
     * @param {VerifyAccountParams} requestBody - user should send the token of the verify account entry
     * @returns {VerifyAccountResult | APIResponse}
     */
    @Example<VerifyAccountResult>({
        status: APIStatus.Success,
        message: "Successfully verified email",
        data: {
            email: "bnussman@gmail.com",
            isEmailVerified: true
        }
    })
    @Response<APIResponse>(400, "Bad Request", {
        status: APIStatus.Error,
        message: "You tried to verify an email address that is not the same as your current email."
    })
    @Response<APIResponse>(404, "Verify account request not found", {
        status: APIStatus.Error,
        message: "Invalid verify email token"
    })
    @Response<APIResponse>(410, "Token expired", {
        status: APIStatus.Error,
        message: "Your verification token has expired"
    })
    @Response<APIResponse>(500, "Server Error", {
        status: APIStatus.Error,
        message: "Unable to verify account"
    })
    @Post("verify")
    public async verifyAccount (@Body() requestBody: VerifyAccountParams): Promise<VerifyAccountResult | APIResponse> {
        try {
            //this seems weird, but verifying the account by deleteing the entry in the db, but tell RethinkDB to retun changes
            const result: WriteResult = await r.table("verifyEmail").get(requestBody.id).delete({returnChanges: true}).run((await database.getConn()));

            if (result.skipped == 1) {
                this.setStatus(404);
                return new APIResponse(APIStatus.Error, "Invalid verify email token");
            }

            //get the changes reported by RethinkDB
            const entry = result.changes[0].old_val;

            //check to see if 1 hour has passed since the initial request, if so, report an error.
            //3600 seconds in an hour, multiplied by 1000 because javascripts handles Unix time in ms
            if ((entry.time + (3600 * 1000)) < Date.now()) {
                this.setStatus(410);
                return new APIResponse(APIStatus.Error, "Your verification token has expired");
            }

            //use the helper function getEmail to get user's email address from their id
            const usersEmail: string | undefined = await getEmail(entry.userid);

            //this case should not happen because of validation, but just in case
            if(!usersEmail) {
                this.setStatus(400);
                return new APIResponse(APIStatus.Error, "Please ensure you have a valid email set in your profile. Visit your app or our website to re-send a varification email.");
            }

            //if the user's current email is not the same as the email they are trying to verify dont prcede with the request
            if (entry.email !== usersEmail) {
                this.setStatus(400);
                return new APIResponse(APIStatus.Error, "You tried to verify an email address that is not the same as your current email.");
            }

            let update;

            //use the helper function isEduEmail to check if user is a student
            if (isEduEmail(entry.email)) {
                //if user is a student ensure we update isStudent
                update = { isEmailVerified: true, isStudent: true };
            }
            else {
                update = { isEmailVerified: true };
            }

            try {
                //update the user's tabe with the new values
                await r.table("users").get(entry.userid).update(update).run((await database.getConn()));

                return ({
                    status: APIStatus.Success,
                    message: "Successfully verified email",
                    data: {...update, email: usersEmail}
                });
            }
            catch(error) {
                Sentry.captureException(error);
                this.setStatus(500);
                return new APIResponse(APIStatus.Error, "Unable to verify account");
            }
        }
        catch (error) {
            if (error.name == "ReqlNonExistenceError") {
                this.setStatus(404);
                return new APIResponse(APIStatus.Error, "Invalid verify email token");
            }
            Sentry.captureException(error);
            this.setStatus(500);
            return new APIResponse(APIStatus.Error, "Unable to verify account");
        }
    }

    /**
     * Resend a verification email to a user
     * @returns {APIResponse}
     */
    @Example<APIResponse>({
        status: APIStatus.Success,
        message: "Successfully re-sent varification email to banks@nussman.us"
    })
    @Response<APIResponse>(500, "Server Error", {
        status: APIStatus.Error,
        message: "Unable to resend varification email"
    })
    @Security("token")
    @Post("verify/resend")
    public async resendEmailVarification(@Request() request: express.Request): Promise<APIResponse> {
        try {
            //delete user's existing email varification entries
            await r.table("verifyEmail").filter({ userid: request.user.id }).delete().run((await database.getConn()));
        }
        catch (error) {
            Sentry.captureException(error);
            this.setStatus(500);
            return new APIResponse(APIStatus.Error, "Unable to resend varification email");
        }

        //get user's current email and first name
        const user: UserPluckResult | null = await getUserFromId(request.user.id, "first", "email");

        if (!user) {
            Sentry.captureException("User tried to resend their verification email but helper function was unable to getUserFromId");
            this.setStatus(500);
            return new APIResponse(APIStatus.Error, "You don't exist as a user");
        }

        //create a new entry with their current email address and send in email
        await createVerifyEmailEntryAndSendEmail(request.user.id, user.email, user.first);

        return new APIResponse(APIStatus.Success, "Successfully re-sent varification email to " + user.email);
    }
    
    /**
     * Delete your own user account
     * @returns {APIResponse}
     */
    @Example<APIResponse>({
        status: APIStatus.Success,
        message: "Successfully deleted user"
    })
    @Response<APIResponse>(500, "Server Error", {
        status: APIStatus.Error,
        message: "Unable to delete user"
    })
    @Security("token")
    @Delete()
    public async deleteAccount(@Request() request: express.Request): Promise<APIResponse> {
        if (await deleteUser(request.user.id)) {
            this.setStatus(200);
            return new APIResponse(APIStatus.Success, "Successfully deleted user");
        }
        this.setStatus(500);
        return new APIResponse(APIStatus.Error, "Unable to delete user");
    }
}
