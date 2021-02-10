import { Collection, Entity, Enum, OneToMany, PrimaryKey, Property, SerializedPrimaryKey, Unique } from "@mikro-orm/core";
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
    @Unique()
    username!: string;

    @Property()
    @Unique()
    email!: string;

    @Property()
    phone!: string;

    @Property()
    venmo!: string;

    @Property({ lazy: true })
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

    @Enum()
    role: UserRole = UserRole.USER;

    @Property({ nullable: true, lazy: true })
    pushToken?: string;

    @Property({ nullable: true })
    photoUrl?: string;

    @Property({ persist: false })
    get name(): string {
        return `${this.first} ${this.last}`;
    }

    @OneToMany(() => QueueEntry, q => q.beeper, { lazy: true, eager: false })
    queue = new Collection<QueueEntry>(this);
}

export enum UserRole {
    ADMIN = 'admin',
    USER = 'user'
}
