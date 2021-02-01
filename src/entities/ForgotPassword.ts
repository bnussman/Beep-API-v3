import { Entity, IdentifiedReference, ManyToOne, PrimaryKey, Property, Reference } from "@mikro-orm/core";
import { ObjectId } from "@mikro-orm/mongodb";
import { User } from "./User";

@Entity()
export class ForgotPassword {

    @PrimaryKey()
    id!: ObjectId;

    @ManyToOne(() => User, { wrappedReference: true })
    user!: IdentifiedReference<User>;

    @Property() 
    time = Date.now();

    constructor(u: User) {
        this.user = Reference.create(u);
    }
}
