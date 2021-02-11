import express from 'express';
import { EditUserParams, UserResult } from "../users/users";
import { deleteUser } from '../account/helpers';
import { BeepORM } from '../app';
import { ObjectId } from '@mikro-orm/mongodb';
import { wrap } from '@mikro-orm/core';
import { User, UserRole } from '../entities/User';
import { Arg, Args, Authorized, Mutation, Query, Resolver } from 'type-graphql';
import PaginationArgs from '../args/Pagination';
import { Beep } from '../entities/Beep';
import { QueueEntry } from '../entities/QueueEntry';
import EditUserValidator from '../validators/user/EditUser';

@Resolver(User)
export class UserResolver {

    @Query(returns => User)
    public async getUser(@Arg("id") id: string) {
        const user = await BeepORM.userRepository.findOne(id);

        if (!user) {
            throw new Error("User not found");
        }

        return user;
    }

    @Mutation(returns => Boolean)
    @Authorized(UserRole.ADMIN)
    public async removeUser(@Arg("id") id: string) {
        const user = BeepORM.em.getReference(User, new ObjectId(id));

        if (!user) {
            throw new Error("User not found");
        }

        if (await deleteUser(user)) {
            return true;
        }

        return false;
    }

    @Mutation(returns => User)
    @Authorized(UserRole.ADMIN)
    public async editUser(@Arg('data') data: EditUserValidator, @Arg("id") id: string) {
        const user = await BeepORM.userRepository.findOne(id);

        if (!user) {
            throw new Error("User not found");
        }

        wrap(user).assign(data);

        await BeepORM.userRepository.persistAndFlush(user);

        return user;
    }

    @Query(returns => [User])
    @Authorized(UserRole.ADMIN)
    public async getUsers(@Args() { offset, show }: PaginationArgs) {
        const [users, count] = await BeepORM.em.findAndCount(User, {}, { limit: show, offset: offset });

        //TODO: we need to return count along with result for pagination

        return users;
    }

    @Query(returns => [Beep])
    @Authorized()
    public async getRideHistory(@Arg("id") id: string) {
        return await BeepORM.beepRepository.find({ rider: id }, { populate: true });
    }

    @Query(returns => [Beep])
    @Authorized()
    public async getBeepHistory(@Arg("id") id: string) {
        return await BeepORM.beepRepository.find({ beeper: id }, { populate: true });
    }

    @Query(returns => [QueueEntry])
    @Authorized()
    public async getQueue(@Arg("id") id: string) {
        const r = await BeepORM.queueEntryRepository.find({ beeper: id }, { populate: true });
        
        for (let i = 0; i < r.length; i++) {
           if (r[i].state == -1) {
               //await BeepORM.queueEntryRepository.nativeDelete(r[i]);
               BeepORM.queueEntryRepository.nativeDelete(r[i]);
           }
        }

        return r.filter(entry => entry.state != -1);
    }
}
