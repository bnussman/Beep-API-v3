import { deleteUser } from '../account/helpers';
import { BeepORM } from '../app';
import { wrap } from '@mikro-orm/core';
import { PartialUser, User, UserRole } from '../entities/User';
import { Arg, Args, Authorized, ClassType, Ctx, Field, Info, Int, Mutation, ObjectType, PubSub, PubSubEngine, Query, Resolver, Root, Subscription } from 'type-graphql';
import PaginationArgs from '../args/Pagination';
import { Beep } from '../entities/Beep';
import { QueueEntry } from '../entities/QueueEntry';
import EditUserValidator from '../validators/user/EditUser';
import { Context } from '../utils/context';
import { GraphQLResolveInfo } from 'graphql';
import fieldsToRelations from 'graphql-fields-to-relations';
import { Paginated } from '../utils/paginated';

@ObjectType()
class UsersResponse extends Paginated(User) {}

@Resolver(User)
export class UserResolver {

    @Query(() => User)
    public async getUser(@Arg("id") id: string, @Info() info: GraphQLResolveInfo): Promise<User> {
        const relationPaths = fieldsToRelations(info);
        const user = await BeepORM.userRepository.findOne(id, relationPaths);

        if (!user) {
            throw new Error("User not found");
        }

        return user;
    }

    @Mutation(() => Boolean)
    @Authorized(UserRole.ADMIN)
    public async removeUser(@Arg("id") id: string): Promise<boolean> {
        const user = BeepORM.em.getReference(User, id);

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
    public async editUser(@Arg("id") id: string, @Arg('data') data: EditUserValidator, @PubSub() pubSub: PubSubEngine): Promise<User> {
        const user = await BeepORM.userRepository.findOne(id);

        if (!user) {
            throw new Error("User not found");
        }

        wrap(user).assign(data);

        pubSub.publish("User" + id, data);

        await BeepORM.userRepository.persistAndFlush(user);

        return user;
    }

    @Query(() => UsersResponse)
    @Authorized(UserRole.ADMIN)
    public async getUsers(@Args() { offset, show }: PaginationArgs): Promise<UsersResponse> {
        const [users, count] = await BeepORM.em.findAndCount(User, {}, { limit: show, offset: offset });

        return {
            items: users,
            count: count
        };
    }

    @Query(() => [Beep])
    @Authorized()
    public async getRideHistory(@Ctx() ctx: Context, @Arg("id", { nullable: true }) id?: string): Promise<Beep[]> {
        return await BeepORM.beepRepository.find({ rider: id || ctx.user}, { populate: true });
    }

    @Query(() => [Beep])
    @Authorized()
    public async getBeepHistory(@Ctx() ctx: Context, @Arg("id", { nullable: true }) id?: string): Promise<Beep[]>  {
        return await BeepORM.beepRepository.find({ beeper: id || ctx.user }, { populate: true });
    }

    @Query(() => [QueueEntry])
    @Authorized()
    public async getQueue(@Ctx() ctx: Context, @Info() info: GraphQLResolveInfo, @Arg("id", { nullable: true }) id?: string): Promise<QueueEntry[]> {
        const relationPaths = fieldsToRelations(info);
        const r = await BeepORM.queueEntryRepository.find({ beeper: id || ctx.user.id }, relationPaths);

        return r;
    }

    @Subscription(() => PartialUser, {
        topics: ({ args }) => "User" + args.topic,
    })
    public getUserUpdates(@Arg("topic") topic: string, @Root() user: User): Partial<User> {
        return user;
    }
}
