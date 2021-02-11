import {User} from '@sentry/node';
import { IsDate, IsEmail, IsOptional, IsString } from 'class-validator';
import { Field, InputType } from 'type-graphql';

@InputType()
export default class EditUserValidator implements Partial<User> {

  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  public first?: string;

  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  public last?: string;

  @Field({ nullable: true })
  @IsEmail()
  @IsOptional()
  public email?: string;

}
