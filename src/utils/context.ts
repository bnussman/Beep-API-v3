import { EntityManager } from "@mikro-orm/core";
import { User } from "../entities/User";

export interface Context {
    em: EntityManager;
    user: User;
}
