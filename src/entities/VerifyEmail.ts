import { Entity, IdentifiedReference, ManyToOne, PrimaryKey, Property, Reference, SerializedPrimaryKey } from "@mikro-orm/core";
import { ObjectId } from "@mikro-orm/mongodb";
import { User } from "./User";

@Entity()
export class VerifyEmail {

    @PrimaryKey()
    _id: ObjectId;

    @SerializedPrimaryKey()
    id!: string;

    @ManyToOne(() => User, { wrappedReference: true })
    user!: IdentifiedReference<User>;

    @Property() 
    time = Date.now();

    @Property()
    email!: string;
    
    constructor(u: User, e: string) {
        this.user = Reference.create(u);
        this.email = e;
    }
}
