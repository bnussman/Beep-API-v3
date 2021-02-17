import { Report } from '../entities/Report';
import { BeepORM } from '../app';
import { QueryOrder, wrap } from '@mikro-orm/core';
import { User, UserRole } from '../entities/User';
import { Arg, Args, Authorized, Ctx, Mutation, Query, Resolver } from 'type-graphql';
import { Context } from '../utils/context';
import { ReportInput, UpdateReportInput } from '../validators/report';
import PaginationArgs from '../args/Pagination';
import { Rating } from '../entities/Rating';
import { RatingInput } from '../validators/rating';
import { Beep } from '../entities/Beep';

@Resolver(Rating)
export class RatingResolver {

    @Mutation(() => Boolean)
    @Authorized()
    public async rateUser(@Ctx() ctx: Context, @Arg('input') input: RatingInput): Promise<boolean> {
        const user = BeepORM.em.getReference(User, input.userId);

        const beep = input.beepId ? BeepORM.em.getReference(Beep, input.beepId) : undefined;
            
        const rating = new Rating(ctx.user, user, input.stars, input.message, beep);

        await BeepORM.reportRepository.persistAndFlush(rating);

        return true;
    }

    @Query(() => [Rating])
    @Authorized()
    public async getUserRating(@Arg('id') id: string): Promise<Rating[]> {
        return await BeepORM.ratingRepository.find({ rated: id }); 
    }

}
