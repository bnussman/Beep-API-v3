import { Collection, Entity, OneToMany, PrimaryKey, Property, SerializedPrimaryKey } from "@mikro-orm/core";
import { ObjectId } from "@mikro-orm/mongodb";
import { QueueEntry } from './QueueEntry';
import { TokenEntry } from './TokenEntry';

@Entity()
export class User {

    @PrimaryKey()
    _id: ObjectId;

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

    @OneToMany(() => TokenEntry, t => t.user, { lazy: true })
    tokens = new Collection<TokenEntry>(this);

    @OneToMany(() => QueueEntry, q => q.beeper, { lazy: true })
    queue = new Collection<QueueEntry>(this);
}
