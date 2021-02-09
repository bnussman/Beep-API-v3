import { Entity, ManyToOne, PrimaryKey, Property, SerializedPrimaryKey } from "@mikro-orm/core";
import { ObjectId } from "@mikro-orm/mongodb";
import { Beep } from "./Beep";
import { User } from "./User";

@Entity()
export class Report {

    @PrimaryKey()
    _id!: ObjectId;

    @SerializedPrimaryKey()
    id!: string;

    @ManyToOne()
    reporter!: User;

    @ManyToOne()
    reported!: User;

    @ManyToOne({ nullable: true })
    handledBy?: User;

    @Property()
    reason!: string;

    @Property({ nullable: true })
    notes?: string;

    @Property({ default: Date.now() })
    timestamp!: number;

    @Property({ default: false })
    handled!: boolean

    @ManyToOne()
    beep?: Beep;

    constructor(reporter: User, reported: User, reason: string, beep?: Beep) {
        this.reporter = reporter;
        this.reported = reported;
        this.reason = reason;
        if (beep) {
            this.beep = beep;
        }
    }
}
