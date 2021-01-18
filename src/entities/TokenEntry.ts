import { Entity, ManyToOne, OneToOne, PrimaryKey, Property } from "@mikro-orm/core";
import { ObjectId } from "@mikro-orm/mongodb";
import { User } from "./User";

@Entity()
export class TokenEntry {

    @PrimaryKey()
    id!: ObjectId;

    @Property() 
    tokenid = new ObjectId();

    @ManyToOne()
    user!: User;
    
    constructor(u: User) {
        this.user = u;
    }
}
