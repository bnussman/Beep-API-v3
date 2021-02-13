import { IsOptional, IsString } from 'class-validator';
import { Field, InputType } from 'type-graphql';
import { User } from '../entities/User';

@InputType()
export class LoginInput implements Partial<User> {

  @Field()
  @IsString()
  public username!: string;

  @Field()
  @IsString()
  public password!: string;

  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  public pushToken?: string;
}
