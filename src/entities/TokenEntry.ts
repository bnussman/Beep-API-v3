import { Entity, ManyToOne, PrimaryKey, Property, SerializedPrimaryKey } from "@mikro-orm/core";
import { ObjectId } from "@mikro-orm/mongodb";
import { User } from "./User";

@Entity()
export class TokenEntry {

    @PrimaryKey()
    _id: ObjectId;

    @SerializedPrimaryKey()
    id!: string;

    @Property() 
    tokenid = new ObjectId();

    @ManyToOne()
    user!: User;
    
    constructor(u: User) {
        this.user = u;
    }
}
