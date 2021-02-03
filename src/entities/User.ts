import { Collection, Entity, OneToMany, PrimaryKey, Property, SerializedPrimaryKey } from "@mikro-orm/core";
import { ObjectId } from "@mikro-orm/mongodb";
import { QueueEntry } from './QueueEntry';

@Entity()
export class User {

    @PrimaryKey()
    _id!: ObjectId;

    @SerializedPrimaryKey()
    id!: string;

    @Property()
    first!: string;

    @Property()
    last!: string;

    @Property()
    username!: string;

    @Property()
    email!: string;

    @Property()
    phone!: string;

    @Property()
    venmo!: string;

    @Property()
    password?: string;

    @Property()
    isBeeping = false;

    @Property()
    isEmailVerified = false;

    @Property()
    isStudent = false;

    @Property()
    groupRate = 4.0;

    @Property()
    singlesRate = 3.0;

    @Property()
    capacity = 4;

    @Property() 
    masksRequired = false;

    @Property()
    queueSize = 0;

    @Property()
    userLevel = 0;

    @Property({ nullable: true })
    pushToken?: string;

    @Property({ nullable: true })
    photoUrl?: string;

    //TODO: do we need this here, or just on the token side, we dont need to access these from the user
    //@OneToMany(() => TokenEntry, t => t.user, { lazy: true })
    //tokens = new Collection<TokenEntry>(this);

    //Lets keep this so we can get a users queue very easily
    @OneToMany(() => QueueEntry, q => q.beeper, { lazy: true })
    queue = new Collection<QueueEntry>(this);
}
