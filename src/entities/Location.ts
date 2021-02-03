import { Entity, ManyToOne, PrimaryKey, Property, SerializedPrimaryKey } from "@mikro-orm/core";
import { ObjectId } from "@mikro-orm/mongodb";
import { User } from "./User";

@Entity()
export class Location {
    @PrimaryKey()
    _id!: ObjectId;

    @SerializedPrimaryKey()
    id!: string;

    @ManyToOne()
    user!: User;

    @Property()
    latitude!: number;

    @Property()
    longitude!: number;

    @Property()
    altitude!: number;

    @Property()
    accuracy!: number;

    @Property()
    altitudeAccuracy!: number;

    @Property()
    heading!: number;

    @Property()
    speed!: number;

    @Property({ default: Date.now() })
    timestamp!: number;
}
