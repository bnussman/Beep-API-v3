import { Entity, ManyToOne, OneToOne, PrimaryKey, Property } from "@mikro-orm/core";
import { ObjectId } from "@mikro-orm/mongodb";
import { User } from "./User";

@Entity()
export class Beep {

    @PrimaryKey()
    id!: ObjectId;

    @OneToOne()
    beeper!: User;

    @OneToOne()
    rider!: User;
    
    @Property()
    origin!: string;

    @Property()
    destination!: string;

    @Property({ default: 0 })
    state!: number;

    @Property({ default: false })
    isAccepted!: boolean;

    @Property()
    groupSize!: number;

    @Property({ default: Date.now() })
    timeEnteredQueue!: number;

    @Property()
    doneTime!: number;
}
