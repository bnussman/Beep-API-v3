import { Paginated } from '../users/resolver';
import { Arg, Args, Authorized, ObjectType, Query, Resolver } from 'type-graphql';
import { UserRole } from '../entities/User';
import PaginationArgs from '../args/Pagination';
import {BeepORM} from '../app';
import { Location } from '../entities/Location';

@ObjectType()
class LocationsResponse extends Paginated(Location) {
  // you can add more fields here if you need
}

@Resolver(Location)
export class LocationResolver {

    @Query(() => LocationsResponse)
    @Authorized(UserRole.ADMIN)
    public async getLocations(@Arg('id') id: string, @Args() { offset, show }: PaginationArgs): Promise<LocationsResponse> {
        const [locations, count] = await BeepORM.locationRepository.findAndCount({ user: id }, { limit: show, offset: offset });

        return {
            items: locations,
            count: count
        };
    }

}
