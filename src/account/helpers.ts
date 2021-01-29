import { deactivateTokens } from "../auth/helpers";
import { BeepORM } from "../app";
import { User } from '../entities/User';

/**
 * checks last 4 characters of an email address
 * @param email
 * @returns boolean true if ends in ".edu" and false if otherwise
 */
export function isEduEmail(email: string): boolean {
    return (email.substr(email.length - 3) === "edu");
}

/**
 * delete a user based on their id
 * @param id string the user's id
 * @returns boolean true if delete was successful
 */
export async function deleteUser(user: User): Promise<boolean> {
    //delete user document in user table
    await BeepORM.userRepository.removeAndFlush(user);

    //delete user's queue table from beepQueues 
    await BeepORM.queueEntryRepository.removeAndFlush({ beeper: user });

    //deative all of the user's tokens
    deactivateTokens(user);

    return true;
}
