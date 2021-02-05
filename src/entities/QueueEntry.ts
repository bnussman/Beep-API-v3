import { Entity, ManyToOne, OneToOne, PrimaryKey, Property, SerializedPrimaryKey } from "@mikro-orm/core";
import { ObjectId } from "@mikro-orm/mongodb";
import { User } from "./User";

@Entity()
export class QueueEntry {

    @PrimaryKey()
    _id!: ObjectId;

    @SerializedPrimaryKey()
    id!: string;
    
    @Property()
    origin!: string;

    @Property()
    destination!: string;

    @Property()
    state = 0;

    @Property({ default: false })
    isAccepted!: boolean;

    @Property()
    groupSize!: number;

    @Property({ default: Date.now() })
    timeEnteredQueue!: number;

    @ManyToOne(() => User)
    beeper!: User

    @ManyToOne(() => User)
    rider!: User;
}
