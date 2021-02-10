import express from 'express';
import { sha256 } from 'js-sha256';
import { createVerifyEmailEntryAndSendEmail } from "../auth/helpers";
import { isEduEmail, deleteUser } from './helpers';
import { Validator } from "node-input-validator";
import * as Sentry from "@sentry/node";
import { APIStatus, APIResponse } from "../utils/Error";
import { Body, Controller, Post, Route, Security, Tags, Request, Delete, Put, Patch } from 'tsoa';
import { BeepORM } from '../app';
import { wrap } from '@mikro-orm/core';
import { ChangePasswordParams, EditAccountParams, UpdatePushTokenParams, VerifyAccountParams, VerifyAccountResult } from './account';

@Tags("Account")
@Route("account")
export class AccountController extends Controller {

    /**
     * Edit your user account
     * @param {EditAccountParams} requestBody - user should send full account data
     * @returns {APIResponse}
     */
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

        if (requestBody.venmo.charAt(0) == '@') {
            requestBody.venmo = requestBody.venmo.substr(1, requestBody.venmo.length);
        }

        const oldEmail = request.user.user.email;

        wrap(request.user.user).assign(requestBody);

        await BeepORM.userRepository.persistAndFlush(request.user.user); 

        if (oldEmail !== requestBody.email) {
            await BeepORM.verifyEmailRepository.nativeDelete({ user: request.user.user });

            wrap(request.user.user).assign({ isEmailVerified: false, isStudent: false });

            await BeepORM.userRepository.persistAndFlush(request.user.user); 

            createVerifyEmailEntryAndSendEmail(request.user.user, requestBody.email, requestBody.first);
        }

        return new APIResponse(APIStatus.Success, "Successfully edited profile.");
    }

    /**
     * Change your password when authenticated with this endpoint
     * @param {ChangePasswordParams} requestBody - user should send a new password
     * @returns {APIResponse}
     */
    @Security("token")
    @Post("password")
    public async changePassword (@Request() request: express.Request, @Body() requestBody: ChangePasswordParams): Promise<APIResponse> {
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

        await BeepORM.userRepository.persistAndFlush(request.user.user);

        return new APIResponse(APIStatus.Success, "Successfully changed password.");
    }

    /**
     * Update your Push Token to a new push token to ensure mobile device gets notified by Expo
     * @param {UpdatePushTokenParams} requestBody - user should send an Expo Push Token
     * @returns {APIResponse}
     */
    @Security("token")
    @Put("pushtoken")
    public async updatePushToken (@Request() request: express.Request, @Body() requestBody: UpdatePushTokenParams): Promise<APIResponse> {
        wrap(request.user.user).assign({ pushToken: requestBody.expoPushToken });

        await BeepORM.userRepository.persistAndFlush(request.user.user);

        return new APIResponse(APIStatus.Success, "Successfully updated push token.");
    }

    /**
     * Verify your account by using the token sent to your email.
     * @param {VerifyAccountParams} requestBody - user should send the token of the verify account entry
     * @returns {VerifyAccountResult | APIResponse}
     */
    @Post("verify")
    public async verifyAccount(@Body() requestBody: VerifyAccountParams): Promise<VerifyAccountResult | APIResponse> {
        const entry = await BeepORM.verifyEmailRepository.findOne(requestBody.id, { populate: true });

        if (!entry) {
            this.setStatus(404);
            return new APIResponse(APIStatus.Error, "Invalid verify email token");
        }

        if ((entry.time + (3600 * 1000)) < Date.now()) {
            this.setStatus(410);
            await BeepORM.verifyEmailRepository.removeAndFlush(entry);
            return new APIResponse(APIStatus.Error, "Your verification token has expired");
        }

        const usersEmail: string | undefined = entry.user.email;

        if (!usersEmail) {
            this.setStatus(400);
            await BeepORM.verifyEmailRepository.removeAndFlush(entry);
            return new APIResponse(APIStatus.Error, "Please ensure you have a valid email set in your profile. Visit your app or our website to re-send a varification email.");
        }

        //if the user's current email is not the same as the email they are trying to verify dont prcede with the request
        if (entry.email !== usersEmail) {
            this.setStatus(400);
            await BeepORM.verifyEmailRepository.removeAndFlush(entry);
            return new APIResponse(APIStatus.Error, "You tried to verify an email address that is not the same as your current email.");
        }

        let update;

        if (isEduEmail(entry.email)) {
            update = { isEmailVerified: true, isStudent: true };
        }
        else {
            update = { isEmailVerified: true };
        }

        const user = await BeepORM.userRepository.findOne(entry.user);

        if (!user) return new APIResponse(APIStatus.Error, "You tried to verify an account that does not exist");

        wrap(user).assign(update);

        await BeepORM.userRepository.persistAndFlush(user);

        await BeepORM.verifyEmailRepository.removeAndFlush(entry);

        return {
            status: APIStatus.Success,
            message: "Successfully verified email",
            data: {...update, email: entry.email}
        };
    }

    /**
     * Resend a verification email to a user
     * @returns {APIResponse}
     */
    @Security("token")
    @Post("verify/resend")
    public async resendEmailVarification(@Request() request: express.Request): Promise<APIResponse> {
        await BeepORM.verifyEmailRepository.nativeDelete({ user: request.user.user });

        createVerifyEmailEntryAndSendEmail(request.user.user, request.user.user.email, request.user.user.first);

        return new APIResponse(APIStatus.Success, "Successfully re-sent varification email to " + request.user.user.email);
    }
    
    /**
     * Delete your own user account
     * @returns {APIResponse}
     */
    @Security("token")
    @Delete()
    public async deleteAccount(@Request() request: express.Request): Promise<APIResponse> {
        if (await deleteUser(request.user.user)) {
            return new APIResponse(APIStatus.Success, "Successfully deleted user");
        }

        this.setStatus(500);
        return new APIResponse(APIStatus.Error, "Unable to delete user");
    }
}
