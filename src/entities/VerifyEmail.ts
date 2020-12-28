import { Entity, ManyToOne, PrimaryKey, Property } from "@mikro-orm/core";
import { ObjectId } from "@mikro-orm/mongodb";
import { User } from "./User";

@Entity()
export class VerifyEmail {

    @PrimaryKey()
    id!: ObjectId;

    @ManyToOne()
    user: User;

    @Property() 
    time = Date.now();

    @Property()
    email!: string;
    
    constructor(u: User, e: string) {
        this.user = u;
        this.email = e;
    }
}
