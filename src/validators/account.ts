import { User } from '../entities/User';
import { IsEmail, IsOptional, IsPhoneNumber, IsString } from 'class-validator';
import { Field, InputType } from 'type-graphql';

@InputType()
export class EditAccountInput implements Partial<User> {

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

  @Field({ nullable: true })
  @IsPhoneNumber()
  @IsOptional()
  public phone?: string;

  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  public venmo?: string;
}
