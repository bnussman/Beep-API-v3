import { ArgsType, Field, Int } from 'type-graphql';

@ArgsType()
export default class PaginationArgs {
  @Field(type => Int, { nullable: true })
  offset?: number;

  @Field(type => Int, { nullable: true })
  show?: number;
}
