import express from 'express';
import { sha256 } from 'js-sha256';
import { createVerifyEmailEntryAndSendEmail } from "../auth/helpers";
import { isEduEmail, deleteUser } from './helpers';
import { Validator } from "node-input-validator";
import * as Sentry from "@sentry/node";
import { APIStatus, APIResponse } from "../utils/Error";
import { Response, Body, Controller, Post, Route, Security, Tags, Request, Delete, Example, Put, Patch } from 'tsoa';
import {BeepORM} from '../app';
import {wrap} from '@mikro-orm/core';
import {ObjectId} from '@mikro-orm/mongodb';
import {ChangePasswordParams, EditAccountParams, UpdatePushTokenParams, VerifyAccountParams, VerifyAccountResult} from './account';

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

        const oldEmail = request.user.user.email;

        wrap(request.user.user).assign(requestBody);

        await BeepORM.userRepository.persistAndFlush(request.user.user); 

        if (oldEmail !== request.user.user.email) {
            await BeepORM.verifyEmailRepository.removeAndFlush({ user: request.user.user });

            //if user made a change to their email, we need set their status to not verified and make them re-verify
            wrap(request.user.user).assign({ isEmailVerified: false, isStudent: false });

            await BeepORM.userRepository.persistAndFlush(request.user.user); 
            //calles helper function that will create a db entry for email varification and also send the email
            createVerifyEmailEntryAndSendEmail(request.user.user, requestBody.email, requestBody.first);
        }

        return new APIResponse(APIStatus.Success, "Successfully edited profile.");
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
        
        wrap(request.user.user).assign({password: encryptedPassword});

        BeepORM.userRepository.persistAndFlush(request.user.user);

        this.setStatus(200);
        return new APIResponse(APIStatus.Success, "Successfully changed password.");
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
        wrap(request.user.user).assign({ pushToken: requestBody.expoPushToken });

        BeepORM.userRepository.persistAndFlush(request.user.user);

        this.setStatus(200);

        return new APIResponse(APIStatus.Success, "Successfully updated push token.");
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
        const entry = await BeepORM.verifyEmailRepository.findOne(new ObjectId(requestBody.id));

        if (!entry) {
            this.setStatus(404);
            return new APIResponse(APIStatus.Error, "Invalid verify email token");
        }

        //check to see if 1 hour has passed since the initial request, if so, report an error.
        //3600 seconds in an hour, multiplied by 1000 because javascripts handles Unix time in ms
        if ((entry.time + (3600 * 1000)) < Date.now()) {
            this.setStatus(410);
            return new APIResponse(APIStatus.Error, "Your verification token has expired");
        }

        //use the helper function getEmail to get user's email address from their id
        /*
        console.log(entry);
        console.log(entry.user);
        const usersEmail: string | undefined = entry.user.email;

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
        */

        let update;

        //use the helper function isEduEmail to check if user is a student
        if (isEduEmail(entry.email)) {
            //if user is a student ensure we update isStudent
            update = {isEmailVerified: true, isStudent: true};
        }
        else {
            update = {isEmailVerified: true};
        }

        const user = await BeepORM.userRepository.findOne(entry.user);

        if (!user) return new APIResponse(APIStatus.Error, "error");

        wrap(user).assign(update);

        await BeepORM.userRepository.persistAndFlush(user);

        await BeepORM.verifyEmailRepository.removeAndFlush(entry);

        return ({
            "status": APIStatus.Success,
            "message": "Successfully verified email",
            "data": {...update, "email": entry.email}
        });
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
        await BeepORM.verifyEmailRepository.nativeDelete({ user: request.user.user });

        //create a new entry with their current email address and send in email
        await createVerifyEmailEntryAndSendEmail(request.user.user, request.user.user.email, request.user.user.first);

        console.log(request.user);

        return new APIResponse(APIStatus.Success, "Successfully re-sent varification email to " + request.user.user.email);
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
        if (await deleteUser(request.user.user)) {
            this.setStatus(200);
            return new APIResponse(APIStatus.Success, "Successfully deleted user");
        }
        this.setStatus(500);
        return new APIResponse(APIStatus.Error, "Unable to delete user");
    }
}
