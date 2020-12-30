import { Response, Request, Controller, Route, Example, Post, Security, Body, Tags }  from 'tsoa';
import * as r from 'rethinkdb';
import express from 'express';
import { Cursor, WriteResult } from 'rethinkdb';
import database from '../utils/db';
import { sha256 } from 'js-sha256';
import { getToken, setPushToken, getUserFromEmail, sendResetEmail, deactivateTokens, createVerifyEmailEntryAndSendEmail, doesUserExist } from './helpers';
import { UserPluckResult } from "../types/beep";
import { Validator } from "node-input-validator";
import * as Sentry from "@sentry/node";
import { ForgotPasswordParams, LoginParams, LoginResponse, LogoutParams, RemoveTokenParams, ResetPasswordParams, SignUpParams } from "./auth";
import { APIResponse, APIStatus } from '../utils/Error';
import { wrap } from '@mikro-orm/core';
import { BeepORM } from '../app';
import { User } from '../entities/User';
import { ObjectId } from '@mikro-orm/mongodb';
import { TokenEntry } from '../entities/TokenEntry';

@Tags("Auth")
@Route("auth")
export class AuthController extends Controller {

    /**
     * Checks provided credentials and provides a responce with user data and authentication tokens.
     * Provide a username and password to login successfully
     * @param {LoginParams} requestBody - Conatins a username and password and optional Expo push token
     */
    @Post("login")
    @Example<LoginResponse>({
        status: APIStatus.Success,
        user: {
            capacity: 4,
            email: "nussmanwb@appstate.edu",
            first: "Banks",
            groupRate: 2,
            id: new ObjectId(),
            isBeeping: false,
            isEmailVerified: true,
            isStudent: true,
            last: "Nussman",
            masksRequired: true,
            phone: "7049968597",
            singlesRate: 3,
            userLevel: 0,
            username: "banks",
            venmo: "banksnussman",
            queueSize: 0
        },
        tokens: {
            token: new ObjectId(),
            tokenid: new ObjectId(),
        }
    })
    @Response<APIResponse>(422, "Invalid Input", {
        status: APIStatus.Error, 
        message: {
            password: {
                message: "The password field is mandatory.",
                rule: "required"
            }
        }
    })
    @Response<APIResponse>(401, "Unauthorized", {
        status: APIStatus.Error, 
        message: "Password is incorrect"
    })
    @Response<APIResponse>(500, "Server Error", {
        status: APIStatus.Error, 
        message: "Unable to login due to a server error"
    })
    public async login (@Body() requestBody: LoginParams): Promise<LoginResponse | APIResponse> {
        const v = new Validator(requestBody, {
            username: "required",
            password: "required"
        });

        const matched = await v.check();

        if (!matched) {
            this.setStatus(422);
            return new APIResponse(APIStatus.Error, v.errors);
        }

        const user = await BeepORM.userRepository.findOne({ username: requestBody.username });

        if (user?.password == sha256(requestBody.password)) {
            //if authenticated, get new auth tokens
            const tokenData = await getToken(user);

            if (requestBody.expoPushToken) {
                setPushToken(user, requestBody.expoPushToken);
            }

            return ({
                status: APIStatus.Success,
                user: user,
                tokens: { ...tokenData }
            });
        }
        else {
            this.setStatus(401);
            return new APIResponse(APIStatus.Error, "Password is incorrect");
        }
    }

    /**
     * Signs Up a user with the provided data. 
     * Provide all required signup paramaters to get a new account.
     * This endpoint will return the same thing login would asuming signup was successful.
     * @param {SignUpParams} requestBody - Conatins a signup params and optional Expo push token
     */
    @Post("signup")
    @Example<LoginResponse>({
        status: APIStatus.Success,
        user: {
            capacity: 4,
            email: "nussmanwb@appstate.edu",
            first: "Banks",
            groupRate: 2,
            id: new ObjectId(),
            isBeeping: false,
            isEmailVerified: true,
            isStudent: true,
            last: "Nussman",
            masksRequired: true,
            phone: "7049968597",
            singlesRate: 3,
            userLevel: 0,
            username: "banks",
            venmo: "banksnussman",
            queueSize: 0
        },
        tokens: {
            token: new ObjectId(),
            tokenid: new ObjectId(),
        }
    })
    @Response<APIResponse>(422, "Invalid Input", {
        status: APIStatus.Error, 
        message: {
            password: {
                message: "The password field is mandatory.",
                rule: "required"
            }
        }
    })
    @Response<APIResponse>(409, "Duplicate User", {
        status: APIStatus.Error, 
        message: "That username is already in use"
    })
    @Response<APIResponse>(500, "Server Error", {
        status: APIStatus.Error, 
        message: "Unable to sign up due to a server error"
    })
    public async signup (@Body() requestBody: SignUpParams): Promise<LoginResponse | APIResponse> {
        const v = new Validator(requestBody, {
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
            this.setStatus(422);
            return new APIResponse(APIStatus.Error, v.errors);
        }

        //if user puts an @ at the beginning of their venmo username, rewrite it without the @ symbol
        if (requestBody.venmo.charAt(0) == '@') {
            requestBody.venmo = requestBody.venmo.substr(1, requestBody.venmo.length);
        }

        if ((await doesUserExist(requestBody.username))) {
            this.setStatus(409);
            return new APIResponse(APIStatus.Error, "That username is already in use");
        }

        const user = new User();
        wrap(user).assign(requestBody);
        await BeepORM.userRepository.persistAndFlush(user);
    
        const tokenData = await getToken(user);

        //because user signed up, create a verify email entry in the db, this function will send the email
        createVerifyEmailEntryAndSendEmail(user, requestBody.email, requestBody.first);

        //produce our REST API output
        return {
            status: APIStatus.Success,
            user: user,
            tokens: { ...tokenData }
        };
    }
    
    /**
     * Logs out a user.  
     * This allows us to invalidate a user's authentication token upon logout
     * @param {LogoutParams} requestBody - Param of isApp allows us to remove current pushToken if user is in the app, otheriwse don't remove it because it was a logout on the website
     */
    @Example<APIResponse>({
        status: APIStatus.Success,
        message: "Token was revoked"
    })
    @Response<APIResponse>(500, "Server Error", {
        status: APIStatus.Error,
        message: "Token was not deleted in our database."
    })
    @Security("token")
    @Post("logout")
    public async logout (@Request() request: express.Request, @Body() requestBody: LogoutParams): Promise<APIResponse> {
        await BeepORM.tokenRepository.removeAndFlush(request.user.token);

        if (requestBody.isApp) {
            //if user signs out in our iOS or Android app, unset their push token.
            //We must check this beacuse we don't want the website to un-set a push token
            setPushToken(request.user.user, null);
        }

        //return success message
        this.setStatus(200);
        return new APIResponse(APIStatus.Success, "Token was revoked");
    }

    /**
     * Removes any tokenid  
     * If user's device was offline upon logout, a tokenid was kept in storage. This endpoint handles the removal of the tokenData upon the device's next login
     * @param {RemoveTokenParams} requestBody - Includes the tokenid for the token we need to remove
     */
    @Example<APIResponse>({
        status: APIStatus.Success,
        message: "Token was revoked"
    })
    @Response<APIResponse>(500, "Server Error", {
        status: APIStatus.Error,
        message: "Token was not deleted in our database."
    })
    @Post("token")
    public async removeToken (@Body() requestBody: RemoveTokenParams): Promise<APIResponse> {
        //RethinkDB query to delete entry in tokens table.
        try {
            const result: WriteResult = await r.table("tokens").filter({'tokenid': requestBody.tokenid}).delete().run((await database.getConn()));

            //if RethinkDB tells us something was deleted, logout was successful
            if (result.deleted == 1) {
                this.setStatus(200);
                return new APIResponse(APIStatus.Success, "Token was revoked");
            }
            else {
                //Nothing was deleted in the db, so there was some kind of error
                this.setStatus(500);
                return new APIResponse(APIStatus.Error, "Token was not deleted in our database.");
            }
        }
        catch (error) {
            Sentry.captureException(error);
            this.setStatus(500);
            return new APIResponse(APIStatus.Error, error.message);
        }
    }

    /**
     * Allows user to initiate a Forgot Password event.
     * This will send them an email that will allow them to reset their password.
     * @param {ForgotPasswordParams} requestBody - The user only enters their email, we use that to send email and identify them
     */
    @Example<APIResponse>({
        status: APIStatus.Success,
        message: "Successfully sent email"
    })
    @Response<APIResponse>(404, "User not found", {
        status: APIStatus.Error, 
        message: "User not found"
    })
    @Response<APIResponse>(409, "Forgot Password Request Conflict", {
        status: APIStatus.Error, 
        message: "You have already requested to reset your password. We have re-sent your email. Check your email and follow the instructions."
    })
    @Response<APIResponse>(422, "Invalid Input", {
        status: APIStatus.Error, 
        message: {
            email: {
                message: "The email field is mandatory.",
                rule: "required"
            }
        }
    })
    @Response<APIResponse>(500, "Server Error", {
        status: APIStatus.Error,
        message: "Unable to process a forgot password request"
    })
    @Post("password/forgot")
    public async forgotPassword (@Body() requestBody: ForgotPasswordParams): Promise<APIResponse> {
        const v = new Validator(requestBody, {
            email: "required|email",
        });

        const matched = await v.check();

        if (!matched) {
            this.setStatus(422);
            return new APIResponse(APIStatus.Error, v.errors);
        }

        //we want to try to get a user's doc, if null, there is no user
        //call our helper function. getUserFromEmail takes an email and will pluck evey other param from their user table
        const user: UserPluckResult | null = await getUserFromEmail(requestBody.email, "id", "first");

        if (user) {
            //we were able to find a user and get their details
            //everything in this try-catch is to handle if a request has already been made for forgot password
            try {
                //query the db for any password reset entries with the same userid
                const cursor: Cursor = await r.table("passwordReset").filter({ userid: user.id }).run((await database.getConn()));

                try { 
                    //we try to take the cursor and get the next item
                    const entry = await cursor.next();

                    //there is a entry where userid is the same as the incoming request, this means the user already has an active db entry,
                    //so we will just resend an email with the same db id
                    if (entry) {
                        sendResetEmail(requestBody.email, entry.id, user.first);
                        
                        this.setStatus(409);
                        return new APIResponse(APIStatus.Error, "You have already requested to reset your password. We have re-sent your email. Check your email and follow the instructions.");
                    }
                }
                catch (error) {
                    //the next function is throwing an error, it is basiclly saying there is no next, so we can say 
                    //there is no entry for the user currenly in the table, which means we can procede to give them a forgot password token
                }
            }
            catch (error) {
                //there was an error establishing the cursor used for looking in passwordReset
                Sentry.captureException(error);
                this.setStatus(500);
                return new APIResponse(APIStatus.Error, "Unable to process a forgot password request");
            }

            //this is what will be inserted when making a new forgot password entry
            const doccument = {
                "userid": user.id,
                "time": Date.now()
            }; 

            try {
                //insert the new entry
                const result: WriteResult = await r.table("passwordReset").insert(doccument).run((await database.getConn()));

                //use the RethinkDB write result as the forgot password token
                const id: string = result.generated_keys[0];

                //now send an email with some link inside like https://ridebeep.app/password/reset/ba386adf-743a-434e-acfe-98bdce47d484	
                sendResetEmail(requestBody.email, id, user.first);
                
                this.setStatus(200);
                return new APIResponse(APIStatus.Success, "Successfully sent email");
            }
            catch (error) {
                //There was an error inserting a forgot password entry
                Sentry.captureException(error);
                this.setStatus(500);
                return new APIResponse(APIStatus.Error, "Unable to process a forgot password request");
            }
        }
        else {
            this.setStatus(404);
            return new APIResponse(APIStatus.Error, "User not found");
        }
    }

    /**
     * Allows unauthenticated user to reset their password based on a id value sent to them via email and the /password/forgot route
     * If a reset password token is no longer valid, this endpoint is responcible for removing it
     * @param {ResetPasswordParams} requestBody - Request should include the passwordReset token and the new password
     */
    @Example<APIResponse>({
        status: APIStatus.Success,
        message: "Successfully reset your password!"
    })
    @Response<APIResponse>(404, "Request entity not found", {
        status: APIStatus.Error, 
        message: "This reset password request does not exist"
    })
    @Response<APIResponse>(410, "Token Expired", {
        status: APIStatus.Error,
        message: "Your verification token has expired. You must re-request to reset your password."
    })
    @Response<APIResponse>(422, "Invalid Input", {
        status: APIStatus.Error, 
        message: {
            password: {
                message: "The password field is mandatory.",
                rule: "required"
            }
        }
    })
    @Response<APIResponse>(500, "Server Error", {
        status: APIStatus.Error,
        message: "Unable to process a forgot password request"
    })
    @Post("password/reset")
    public async resetPassword (@Body() requestBody: ResetPasswordParams): Promise<APIResponse> {
        const v = new Validator(requestBody, {
            password: "required",
        });

        const matched = await v.check();

        if (!matched) {
            //user did not match the password criteria, send them the validation errors
            this.setStatus(422);
            return new APIResponse(APIStatus.Error, v.errors);
        }

        try {
            //this seems odd, but we delete the forgot password entry but use RethinkDB returnChanges to invalidate the entry and complete this 
            //new password request
            const result: WriteResult = await r.table("passwordReset").get(requestBody.id).delete({ returnChanges: true }).run((await database.getConn()));

            //get the db entry from the RethinkDB changes
            const entry = result.changes[0].old_val;

            //check if request time was made over an hour ago
            if ((entry.time + (3600 * 1000)) < Date.now()) {
                this.setStatus(410);
                return new APIResponse(APIStatus.Error, "Your verification token has expired. You must re-request to reset your password.");
            }

            try {
                //update user's password in their db entry
                await r.table("users").get(entry.userid).update({ password: sha256(requestBody.password) }).run((await database.getConn()));

                //incase user's password was in the hands of bad person, invalidate user's tokens after they successfully reset their password
                deactivateTokens(entry.userid);
    
                this.setStatus(200);
                return new APIResponse(APIStatus.Success, "Successfully reset your password!");
            }
            catch (error) {
                //RethinkDB unable to update user's password
                Sentry.captureException(error);
                this.setStatus(500);
                return new APIResponse(APIStatus.Error, "Unable to reset your password");
            }
        }
        catch (error) {
            if (error.name == "ReqlNonExistenceError") {
                //the entry with the user's specifed token does not exists in the passwordReset table
                this.setStatus(404);
                return new APIResponse(APIStatus.Error, "This reset password request does not exist");
            }
            Sentry.captureException(error);
            this.setStatus(500);
            return new APIResponse(APIStatus.Error, "Unable to reset your password");
        }
    }
}
