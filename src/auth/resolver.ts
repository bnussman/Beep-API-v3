import { sha256 } from 'js-sha256';
import { getToken, setPushToken, getUserFromEmail, sendResetEmail, deactivateTokens, createVerifyEmailEntryAndSendEmail, doesUserExist } from './helpers';
import { wrap } from '@mikro-orm/core';
import { BeepORM } from '../app';
import { User } from '../entities/User';
import { ForgotPassword } from '../entities/ForgotPassword';
import { Arg, Authorized, Ctx, Field, Mutation, ObjectType, Resolver } from 'type-graphql';
import { LoginInput, SignUpInput } from '../validators/auth';
import { TokenEntry } from '../entities/TokenEntry';
import { Context } from '../utils/context';

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

        if (!user) {
            throw new Error("User not found");
        }

        if (user.password != sha256(input.password)) {
            throw new Error("Password is incorrect");
        }

        const tokenData = await getToken(user);

        if (input.pushToken) {
            setPushToken(user, input.pushToken);
        }

        return {
            user: user,
            tokens: tokenData
        };
    }

    @Mutation(() => Auth)
    public async signup (@Arg('input') input: SignUpInput): Promise<Auth> {
        if (input.venmo.charAt(0) == '@') {
            input.venmo = input.venmo.substr(1, input.venmo.length);
        }

        if ((await doesUserExist(input.username))) {
            throw new Error("That username is already in use");
        }

        const user = new User();
    
        input.password = sha256(input.password);

        wrap(user).assign(input);

        await BeepORM.userRepository.persistAndFlush(user);
    
        const tokenData = await getToken(user);

        createVerifyEmailEntryAndSendEmail(user, input.email, input.first);

        return {
            user: user,
            tokens: tokenData
        };
    }
    
    @Mutation(() => Boolean)
    @Authorized()
    public async logout(@Ctx() ctx: Context, @Arg('isApp') isApp: boolean): Promise<boolean> {
        await BeepORM.tokenRepository.removeAndFlush(ctx.token);

        if (isApp) {
            setPushToken(ctx.user, null);
        }

        return true;
    }

    @Mutation(() => Boolean)
    public async removeToken(@Arg('token') tokenid: string): Promise<boolean> {
        await BeepORM.tokenRepository.removeAndFlush({ tokenid: tokenid });

        return true;
    }

    @Mutation(() => Boolean)
    public async forgotPassword(@Arg('email') email: string): Promise<boolean> {

        const user: User | null = await getUserFromEmail(email);

        if (!user) {
            throw new Error("User does not exist");
        }

        const existing = await BeepORM.forgotPasswordRepository.findOne({ user: user });

        if (existing) {
            sendResetEmail(email, existing.id, user.first);

            throw new Error("You have already requested to reset your password. We have re-sent your email. Check your email and follow the instructions.");
        }

        const entry = new ForgotPassword(user);

        await BeepORM.forgotPasswordRepository.persistAndFlush(entry);

        sendResetEmail(email, entry.id, user.first);

        return true;
    }

    @Mutation(() => Boolean)
    public async resetPassword(@Arg('id') id: string, @Arg('password') password: string): Promise<boolean> {
        const entry = await BeepORM.forgotPasswordRepository.findOne(id, { populate: true });

        if (!entry) {
            throw new Error("This reset password request does not exist");
        }

        if ((entry.time + (3600 * 1000)) < Date.now()) {
            throw new Error("Your verification token has expired. You must re-request to reset your password.");
        }

        entry.user.password = sha256(password);

        deactivateTokens(entry.user);

        await BeepORM.userRepository.persistAndFlush(entry.user);

        return true;
    }
}
