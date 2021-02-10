import { Request, Controller, Route, Post, Security, Body, Tags }  from 'tsoa';
import express from 'express';
import { sha256 } from 'js-sha256';
import { getToken, setPushToken, getUserFromEmail, sendResetEmail, deactivateTokens, createVerifyEmailEntryAndSendEmail, doesUserExist } from './helpers';
import { Validator } from "node-input-validator";
import * as Sentry from "@sentry/node";
import { ForgotPasswordParams, LoginParams, LoginResponse, LogoutParams, RemoveTokenParams, ResetPasswordParams, SignUpParams } from "./auth";
import { APIResponse, APIStatus } from '../utils/Error';
import { wrap } from '@mikro-orm/core';
import { BeepORM } from '../app';
import { User } from '../entities/User';
import { ForgotPassword } from '../entities/ForgotPassword';

@Tags("Auth")
@Route("auth")
export class AuthController extends Controller {

    /**
     * Checks provided credentials and provides a responce with user data and authentication tokens.
     * Provide a username and password to login successfully
     * @param {LoginParams} requestBody - Conatins a username and password and optional Expo push token
     */
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

        const user = await BeepORM.userRepository.findOne({ username: requestBody.username }, ['password']);

        if (!user) {
            this.setStatus(401);
            return new APIResponse(APIStatus.Error, "User not found");
        }

        if (user.password == sha256(requestBody.password)) {
            const tokenData = await getToken(user);

            if (requestBody.expoPushToken) {
                setPushToken(user, requestBody.expoPushToken);
            }

            return {
                status: APIStatus.Success,
                user: user,
                tokens: { ...tokenData }
            };
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
            this.setStatus(422);
            return new APIResponse(APIStatus.Error, v.errors);
        }

        if (requestBody.venmo.charAt(0) == '@') {
            requestBody.venmo = requestBody.venmo.substr(1, requestBody.venmo.length);
        }

        if ((await doesUserExist(requestBody.username))) {
            this.setStatus(409);
            return new APIResponse(APIStatus.Error, "That username is already in use");
        }

        const user = new User();
    
        requestBody.password = sha256(requestBody.password);

        wrap(user).assign(requestBody);

        await BeepORM.userRepository.persistAndFlush(user);
    
        const tokenData = await getToken(user);

        createVerifyEmailEntryAndSendEmail(user, requestBody.email, requestBody.first);

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
    @Security("token")
    @Post("logout")
    public async logout (@Request() request: express.Request, @Body() requestBody: LogoutParams): Promise<APIResponse> {
        await BeepORM.tokenRepository.removeAndFlush(request.user.token);

        if (requestBody.isApp) {
            setPushToken(request.user.user, null);
        }

        return new APIResponse(APIStatus.Success, "Token was revoked");
    }

    /**
     * Removes any tokenid  
     * If user's device was offline upon logout, a tokenid was kept in storage. This endpoint handles the removal of the tokenData upon the device's next login
     * @param {RemoveTokenParams} requestBody - Includes the tokenid for the token we need to remove
     */
    @Post("token")
    public async removeToken (@Body() requestBody: RemoveTokenParams): Promise<APIResponse> {
        await BeepORM.tokenRepository.removeAndFlush({ tokenid: requestBody.tokenid });

        return new APIResponse(APIStatus.Success, "Token was revoked");
    }

    /**
     * Allows user to initiate a Forgot Password event.
     * This will send them an email that will allow them to reset their password.
     * @param {ForgotPasswordParams} requestBody - The user only enters their email, we use that to send email and identify them
     */
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

        const user: User | null = await getUserFromEmail(requestBody.email);

        if (!user) {
            return new APIResponse(APIStatus.Error, "That user account does not exist");
        }

        const existing = await BeepORM.forgotPasswordRepository.findOne({ user: user });

        if (existing) {
            sendResetEmail(requestBody.email, existing.id, user.first);

            this.setStatus(409);
            return new APIResponse(APIStatus.Error, "You have already requested to reset your password. We have re-sent your email. Check your email and follow the instructions.");
        }

        const entry = new ForgotPassword(user);

        await BeepORM.forgotPasswordRepository.persistAndFlush(entry);

        sendResetEmail(requestBody.email, entry.id, user.first);

        return new APIResponse(APIStatus.Success, "Successfully sent email");
    }

    /**
     * Allows unauthenticated user to reset their password based on a id value sent to them via email and the /password/forgot route
     * If a reset password token is no longer valid, this endpoint is responcible for removing it
     * @param {ResetPasswordParams} requestBody - Request should include the passwordReset token and the new password
     */
    @Post("password/reset")
    public async resetPassword (@Body() requestBody: ResetPasswordParams): Promise<APIResponse> {
        const v = new Validator(requestBody, {
            password: "required",
        });

        const matched = await v.check();

        if (!matched) {
            this.setStatus(422);
            return new APIResponse(APIStatus.Error, v.errors);
        }
        
        const entry = await BeepORM.forgotPasswordRepository.findOne(requestBody.id, { populate: true });

        if (!entry) {
            this.setStatus(404);
            return new APIResponse(APIStatus.Error, "This reset password request does not exist");
        }

        if ((entry.time + (3600 * 1000)) < Date.now()) {
            this.setStatus(410);
            return new APIResponse(APIStatus.Error, "Your verification token has expired. You must re-request to reset your password.");
        }

        entry.user.password = sha256(requestBody.password);

        deactivateTokens(entry.user);

        await BeepORM.userRepository.persistAndFlush(entry.user);

        return new APIResponse(APIStatus.Success, "Successfully reset your password!");
    }
}
