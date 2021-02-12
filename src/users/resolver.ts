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

    @Query(() => User)
    public async getUser(@Arg("id") id: string): Promise<User> {
        const user = await BeepORM.userRepository.findOne(id);

        if (!user) {
            throw new Error("User not found");
        }

        return user;
    }

    @Mutation(() => Boolean)
    @Authorized(UserRole.ADMIN)
    public async removeUser(@Arg("id") id: string): Promise<boolean> {
        const user = BeepORM.em.getReference(User, new ObjectId(id));

        if (!user) {
            throw new Error("User not found");
        }

        if (await deleteUser(user)) {
            return true;
        }

        return false;
    }

    @Mutation(() => User)
    @Authorized(UserRole.ADMIN)
    public async editUser(@Arg("id") id: string, @Arg('data') data: EditUserValidator): Promise<User> {
        const user = await BeepORM.userRepository.findOne(id);

        if (!user) {
            throw new Error("User not found");
        }

        wrap(user).assign(data);

        await BeepORM.userRepository.persistAndFlush(user);

        return user;
    }

    @Query(() => [User])
    @Authorized(UserRole.ADMIN)
    public async getUsers(@Args() { offset, show }: PaginationArgs): Promise<User[]> {
        const [users, count] = await BeepORM.em.findAndCount(User, {}, { limit: show, offset: offset });

        //TODO: we need to return count along with result for pagination

        return users;
    }

    @Query(() => [Beep])
    @Authorized()
    public async getRideHistory(@Arg("id") id: string): Promise<Beep[]> {
        return await BeepORM.beepRepository.find({ rider: id }, { populate: true });
    }

    @Query(() => [Beep])
    @Authorized()
    public async getBeepHistory(@Arg("id") id: string): Promise<Beep[]>  {
        return await BeepORM.beepRepository.find({ beeper: id }, { populate: true });
    }

    @Query(() => [QueueEntry])
    @Authorized()
    public async getQueue(@Arg("id") id: string): Promise<QueueEntry[]> {
        const r = await BeepORM.queueEntryRepository.find({ beeper: id }, { populate: true });
        
        for (let i = 0; i < r.length; i++) {
           if (r[i].state == -1) {
               BeepORM.queueEntryRepository.nativeDelete(r[i]);
           }
        }

        return r.filter(entry => entry.state != -1);
    }
}
