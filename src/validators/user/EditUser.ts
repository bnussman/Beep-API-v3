import { IsDate, IsEmail, IsOptional, IsString } from 'class-validator';
import { Field, InputType } from 'type-graphql';

@InputType()
export default class EditUserValidator {

  @Field()
  @IsString()
  public first?: string;

  @Field()
  @IsString()
  public last?: string;

  @Field()
  @IsEmail()
  public email?: string;

}
