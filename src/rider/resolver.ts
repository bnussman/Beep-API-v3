import { sendNotification } from '../utils/notifications';
import { BeepORM } from '../app';
import { QueryOrder, wrap } from '@mikro-orm/core';
import { QueueEntry } from '../entities/QueueEntry';
import { User } from '../entities/User';
import { Arg, Authorized, Ctx, Mutation, PubSub, PubSubEngine, Query, Resolver, Root, Subscription } from 'type-graphql';
import GetBeepInput from '../validators/rider';
import { Context } from '../utils/context';
   
@Resolver()
export class RiderResolver {

    @Mutation(() => QueueEntry)
    @Authorized()
    public async chooseBeep(@Ctx() ctx: Context, @PubSub() pubSub: PubSubEngine,  @Arg('beeperId') beeperId: string, @Arg('input') input: GetBeepInput): Promise<QueueEntry> {
        const beeper = await BeepORM.userRepository.findOne(beeperId);

        if (!beeper) {
            throw new Error("Beeper not found");
        }

        if (!beeper.isBeeping) {
            throw new Error("The user you have chosen is no longer beeping at this time.");
        }

        const entry = {
            timeEnteredQueue: Date.now(),
            isAccepted: false,
            groupSize: input.groupSize,
            origin: input.origin,
            destination: input.destination,
            state: 0,
            rider: ctx.user
        };

        const q = new QueueEntry();

        wrap(q).assign(entry, { em: BeepORM.em });

        beeper.queue.add(q);

        await BeepORM.userRepository.persistAndFlush(beeper);

        sendNotification(beeper, `${ctx.user.name} has entered your queue`, "Please open your app to accept or deny this rider.", "enteredBeeperQueue");

        q.ridersQueuePosition = -1;

        const e = await BeepORM.queueEntryRepository.findOne({ rider: ctx.user.id }, true);

        pubSub.publish(beeper.id, e);
        pubSub.publish(ctx.user.id, e);

        return q;
    }
   
    @Query(() => User)
    @Authorized()
    public async findBeep(): Promise<User> {
        const beeper = await BeepORM.userRepository.findOne({ isBeeping: true });

        if (!beeper) {
            throw new Error("Nobody is beeping right now!");
        }

        return beeper;
    }

    @Query(() => QueueEntry)
    @Authorized()
    public async getRiderStatus(@Ctx() ctx: Context): Promise<QueueEntry> {
        const entry = await BeepORM.queueEntryRepository.findOne({ rider: ctx.user }, { populate: ['beeper'] });

        if (entry?.state == -1) await BeepORM.queueEntryRepository.nativeDelete(entry);

        if (!entry || entry.state == -1) {
            throw new Error("Currently, user is not getting a beep.");
        }

        const ridersQueuePosition = await BeepORM.queueEntryRepository.count({ beeper: entry.beeper, timeEnteredQueue: { $lt: entry.timeEnteredQueue }, state: { $ne: -1 } });

        entry.ridersQueuePosition = ridersQueuePosition;

        if (entry.state == 1) {
            const location = await BeepORM.locationRepository.findOne({ user: entry.beeper }, {}, { timestamp: QueryOrder.DESC });
            if (location) {
                entry.location = location;
            }
        }

        return entry;
    }
    
    @Mutation(() => Boolean)
    @Authorized()
    public async riderLeaveQueue(@Ctx() ctx: Context, @PubSub() pubSub: PubSubEngine): Promise<boolean> {
        const entry = await BeepORM.queueEntryRepository.findOne({ rider: ctx.user });

        if (!entry) {
            throw new Error("Unable to leave queue");
        }

        if (entry.isAccepted) entry.beeper.queueSize--;

        await BeepORM.userRepository.persistAndFlush(entry.beeper);

        entry.state = -1;

        await BeepORM.queueEntryRepository.persistAndFlush(entry);

        sendNotification(entry.beeper, `${ctx.user.name} left your queue`, "They decided they did not want a beep from you! :(");

        pubSub.publish(entry.beeper.id, null);
        pubSub.publish(ctx.user.id, null);

        return true;
    }
    
    @Query(returns => [User])
    @Authorized()
    public async getBeeperList(): Promise<User[]> {
        return await BeepORM.userRepository.find({ isBeeping: true });
    }

    @Subscription(() => QueueEntry, { nullable: true, topics: ({ args }) => args.topic })
    public getRiderUpdates(@Arg("topic") topic: string, @Root() entry: QueueEntry): QueueEntry | null {
        console.log("Rider Sub tiggered");
        return entry;
    }
}
