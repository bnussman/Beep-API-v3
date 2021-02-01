import { Entity, IdentifiedReference, ManyToOne, PrimaryKey, Property, Reference, SerializedPrimaryKey } from "@mikro-orm/core";
import { ObjectId } from "@mikro-orm/mongodb";
import { User } from "./User";

@Entity()
export class ForgotPassword {

    @PrimaryKey()
    _id: ObjectId;

    @SerializedPrimaryKey()
    id!: string;

    @ManyToOne(() => User, { wrappedReference: true })
    user!: IdentifiedReference<User>;

    @Property() 
    time = Date.now();

    constructor(u: User) {
        this.user = Reference.create(u);
    }
}
