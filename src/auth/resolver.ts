import express from 'express';
import { sha256 } from 'js-sha256';
import { getToken, setPushToken, getUserFromEmail, sendResetEmail, deactivateTokens, createVerifyEmailEntryAndSendEmail, doesUserExist } from './helpers';
import { Validator } from "node-input-validator";
import { ForgotPasswordParams, LoginResponse, LogoutParams, RemoveTokenParams, ResetPasswordParams, SignUpParams } from "./auth";
import { APIResponse, APIStatus } from '../utils/Error';
import { wrap } from '@mikro-orm/core';
import { BeepORM } from '../app';
import { User } from '../entities/User';
import { ForgotPassword } from '../entities/ForgotPassword';
import { Arg, Field, Mutation, ObjectType, Resolver } from 'type-graphql';
import { LoginInput } from '../validators/auth';
import { TokenEntry } from '../entities/TokenEntry';

@ObjectType()
class Auth {
    @Field()
    public user!: User;
    @Field(() => TokenEntry)
    public tokens!: TokenEntry;
}

@Resolver()
export class AuthResolver {

    @Mutation(() => Auth)
    public async login(@Arg('input') input: LoginInput): Promise<Auth> {
        const user = await BeepORM.userRepository.findOne({ username: input.username }, ['password']);
        console.log(user);
        console.log(input);

        if (!user) {
            throw new Error("User not found");
        }

        if (user.password != sha256(input.password)) {
            throw new Error("Password is incorrect");
        }

        console.log(input);

        const tokenData = await getToken(user);

        if (input.pushToken) {
            setPushToken(user, input.pushToken);
        }

        console.log(tokenData);

        return {
            user: user,
            tokens: { ...tokenData }
        };
    }

    public async signup (requestBody: SignUpParams): Promise<Auth> {
        if (requestBody.venmo.charAt(0) == '@') {
            requestBody.venmo = requestBody.venmo.substr(1, requestBody.venmo.length);
        }

        if ((await doesUserExist(requestBody.username))) {
            throw new Error("That username is already in use");
        }

        const user = new User();
    
        requestBody.password = sha256(requestBody.password);

        wrap(user).assign(requestBody);

        await BeepORM.userRepository.persistAndFlush(user);
    
        const tokenData = await getToken(user);

        createVerifyEmailEntryAndSendEmail(user, requestBody.email, requestBody.first);

        return {
            user: user,
            tokens: { ...tokenData }
        };
    }
    
    public async logout (request: express.Request, requestBody: LogoutParams): Promise<APIResponse> {
        await BeepORM.tokenRepository.removeAndFlush(request.user.token);

        if (requestBody.isApp) {
            setPushToken(request.user.user, null);
        }

        return new APIResponse(APIStatus.Success, "Token was revoked");
    }

    public async removeToken (requestBody: RemoveTokenParams): Promise<APIResponse> {
        await BeepORM.tokenRepository.removeAndFlush({ tokenid: requestBody.tokenid });

        return new APIResponse(APIStatus.Success, "Token was revoked");
    }

    public async forgotPassword (requestBody: ForgotPasswordParams): Promise<APIResponse> {
        const v = new Validator(requestBody, {
            email: "required|email",
        });

        const matched = await v.check();

        if (!matched) {
            return new APIResponse(APIStatus.Error, v.errors);
        }

        const user: User | null = await getUserFromEmail(requestBody.email);

        if (!user) {
            return new APIResponse(APIStatus.Error, "That user account does not exist");
        }

        const existing = await BeepORM.forgotPasswordRepository.findOne({ user: user });

        if (existing) {
            sendResetEmail(requestBody.email, existing.id, user.first);

            return new APIResponse(APIStatus.Error, "You have already requested to reset your password. We have re-sent your email. Check your email and follow the instructions.");
        }

        const entry = new ForgotPassword(user);

        await BeepORM.forgotPasswordRepository.persistAndFlush(entry);

        sendResetEmail(requestBody.email, entry.id, user.first);

        return new APIResponse(APIStatus.Success, "Successfully sent email");
    }

    public async resetPassword (requestBody: ResetPasswordParams): Promise<APIResponse> {
        const v = new Validator(requestBody, {
            password: "required",
        });

        const matched = await v.check();

        if (!matched) {
            return new APIResponse(APIStatus.Error, v.errors);
        }
        
        const entry = await BeepORM.forgotPasswordRepository.findOne(requestBody.id, { populate: true });

        if (!entry) {
            return new APIResponse(APIStatus.Error, "This reset password request does not exist");
        }

        if ((entry.time + (3600 * 1000)) < Date.now()) {
            return new APIResponse(APIStatus.Error, "Your verification token has expired. You must re-request to reset your password.");
        }

        entry.user.password = sha256(requestBody.password);

        deactivateTokens(entry.user);

        await BeepORM.userRepository.persistAndFlush(entry.user);

        return new APIResponse(APIStatus.Success, "Successfully reset your password!");
    }
}
