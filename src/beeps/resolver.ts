import { BeepORM } from '../app';
import { Beep } from '../entities/Beep';
import { QueryOrder } from '@mikro-orm/core';
import { Args, Query, Resolver } from 'type-graphql';
import PaginationArgs from '../args/Pagination';

@Resolver(Beep)
export class BeepResolver {
   
    @Query(() => [Beep])
    public async getBeeps(@Args() { offset, show }: PaginationArgs): Promise<Beep[]> {
        const [beeps, count] = await BeepORM.beepRepository.findAndCount({}, { orderBy: { doneTime: QueryOrder.DESC }, limit: show, offset: offset, populate: ['beeper', 'rider'] });

        //TODO figure out pagination

        return beeps;
    }

    @Query(() => [Beep])
    public async getBeep(id: string): Promise<Beep> {
        const beep = await BeepORM.beepRepository.findOne(id);

        if (!beep) {
            throw new Error("This beep entry does not exist");
        }

        return beep;
    }
}
