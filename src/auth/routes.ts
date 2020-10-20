import { Request, Controller, Route, Get, Path, Example, Post, Security, Body, Tags }  from 'tsoa';
import * as r from 'rethinkdb';
import express from 'express';
import { Cursor, WriteResult } from 'rethinkdb';
import { conn, connQueues } from '../utils/db';
import { User } from '../types/beep';
import { sha256 } from 'js-sha256';
import { getToken, setPushToken, getUserFromEmail, sendResetEmail, deactivateTokens, createVerifyEmailEntryAndSendEmail, doesUserExist } from './helpers';
import { UserPluckResult } from "../types/beep";
import { Validator } from "node-input-validator";
import * as Sentry from "@sentry/node";
import { ForgotPasswordParams, LoginParams, LoginResponse, LogoutParams, RemoveTokenParams, ResetPasswordParams, SignUpParams } from "./auth";
import { APIResponse, APIStatus } from 'src/utils/Error';

@Tags("Auth")
@Route("auth")
export class AuthController extends Controller {

    @Post("login")
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

        try {
            const cursor: Cursor = await r.table("users").filter({ "username": requestBody.username }).run(conn);

            try {
                const result: User = await cursor.next();

                if (result.password == sha256(requestBody.password)) {
                    //if authenticated, get new auth tokens
                    const tokenData = await getToken(result.id);

                    if (requestBody.expoPushToken) {
                        setPushToken(result.id, requestBody.expoPushToken);
                    }

                    //close the RethinkDB cursor to prevent leak
                    cursor.close();

                    //send out data to REST API
                    return ({
                        'status': APIStatus.Success,
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
                        'isStudent': result.isStudent,
                        'masksRequired': result.masksRequired
                    });
                }
                else {
                    //close the RethinkDB cursor to prevent leak
                    cursor.close();
                    //send message to client
                    this.setStatus(401);
                    return new APIResponse(APIStatus.Error, "Password is incorrect.");
                }
            }
            catch (error) {
                //close the RethinkDB cursor
                cursor.close();
                //tell the client no user exists
                this.setStatus(401);
                return new APIResponse(APIStatus.Error, "User not found");
            }
        }
        catch (error) {
            Sentry.captureException(error);
            this.setStatus(500);
            return new APIResponse(APIStatus.Error, error.message);
        }
    }

    @Post("signup")
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

        if ((await doesUserExist(requestBody.username))) {
            this.setStatus(409);
            return new APIResponse(APIStatus.Error, "That username is already in use");
        }

        //This is the row that will be inserted into our users RethinkDB table
        const document = {
            'first': requestBody.first,
            'last': requestBody.last,
            'email': requestBody.email,
            'phone': requestBody.phone,
            'venmo': requestBody.venmo,
            'username': requestBody.username,
            'password': sha256(requestBody.password),
            'isBeeping': false,
            'queueSize': 0,
            'inQueueOfUserID': null,
            'pushToken': requestBody.expoPushToken || null,
            'singlesRate': 3.00,
            'groupRate': 2.00,
            'capacity': 4,
            'userLevel': 0,
            'isEmailVerified': false,
            'isStudent': false,
            'masksRequired': false
        };
    
        try {
            const result: WriteResult = await r.table("users").insert(document).run(conn);

            //if we successfully inserted our new user...
            if (result.inserted == 1) {
                //line below uses the RethinkDB result to get us the user's id the rethinkdb generated for us
                const userid = result.generated_keys[0];
                //user our getToken function to get an auth token on signup
                const tokenData = await getToken(userid);

                //because signup was successful we must make their queue table
                r.db("beepQueues").tableCreate(userid).run(connQueues);

                //because user signed up, create a verify email entry in the db, this function will send the email
                createVerifyEmailEntryAndSendEmail(userid, requestBody.email, requestBody.first);

                //produce our REST API output
                return ({
                    'status': APIStatus.Success,
                    'id': userid,
                    'username': requestBody.username,
                    'first': requestBody.first,
                    'last': requestBody.last,
                    'email': requestBody.email,
                    'phone': requestBody.phone,
                    'venmo': requestBody.venmo,
                    'token': tokenData.token,
                    'tokenid': tokenData.tokenid,
                    'singlesRate': 3.00,
                    'groupRate': 2.00,
                    'capacity': 4,
                    'isBeeping': false,
                    'userLevel': 0,
                    'isEmailVerified': false,
                    'isStudent': false,
                    'masksRequired': false
                });
            }
            else {
                //RethinkDB says that a new entry was NOT inserted, something went wrong...
                this.setStatus(500);
                return new APIResponse(APIStatus.Error, "New user was not inserted into the database");
            }
        }
        catch (error) {
            Sentry.captureException(error);
            this.setStatus(500);
            return new APIResponse(APIStatus.Error, error.message);
        }
    }
    
    @Security("token")
    @Post("logout")
    public async logout (@Request() request: express.Request, @Body() requestBody: LogoutParams): Promise<APIResponse> {
        //RethinkDB query to delete entry in tokens table.
        try {
            const result: WriteResult = await r.table("tokens").get(request.user.token).delete().run(conn);            //handle a RethinkDB error

            //if RethinkDB tells us something was deleted, logout was successful
            if (result.deleted == 1) {
                //unset the user's push token
                if (requestBody.isApp) {
                    //if user signs out in our iOS or Android app, unset their push token.
                    //We must check this beacuse we don't want the website to un-set a push token
                    setPushToken(request.user.id, null);
                }
                //return success message
                this.setStatus(200);
                return new APIResponse(APIStatus.Success, "Token was revoked.");
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

    @Post("token")
    public async removeToken (@Body() requestBody: RemoveTokenParams): Promise<APIResponse> {
        //RethinkDB query to delete entry in tokens table.
        try {
            const result: WriteResult = await r.table("tokens").filter({'tokenid': requestBody.tokenid}).delete().run(conn);

            //if RethinkDB tells us something was deleted, logout was successful
            if (result.deleted == 1) {
                this.setStatus(200);
                return new APIResponse(APIStatus.Success, "Token was revoked.");
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
                const cursor: Cursor = await r.table("passwordReset").filter({ userid: user.id }).run(conn);

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
                const result: WriteResult = await r.table("passwordReset").insert(doccument).run(conn);

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
            const result: WriteResult = await r.table("passwordReset").get(requestBody.id).delete({ returnChanges: true }).run(conn);

            //get the db entry from the RethinkDB changes
            const entry = result.changes[0].old_val;

            //check if request time was made over an hour ago
            if ((entry.time + (3600 * 1000)) < Date.now()) {
                this.setStatus(410);
                return new APIResponse(APIStatus.Error, "Your verification token has expired. You must re-request to reset your password.");
            }

            try {
                //update user's password in their db entry
                await r.table("users").get(entry.userid).update({ password: sha256(requestBody.password) }).run(conn);

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
            //the entry with the user's specifed token does not exists in the passwordReset table
            this.setStatus(404);
            return new APIResponse(APIStatus.Error, error.message);
        }
    }
}
