import express from 'express';
import * as Sentry from "@sentry/node";
import { APIStatus, APIResponse } from "../utils/Error";
import { EditUserParams, UserResult, UsersResult } from "../users/users";
import { deleteUser } from '../account/helpers';
import { BeeperHistoryResult, RiderHistoryResult } from '../account/account';
import { BeepORM } from '../app';
import { ObjectId } from '@mikro-orm/mongodb';
import { wrap } from '@mikro-orm/core';
import { User, UserRole } from '../entities/User';

export class UsersController {

    public async getUser(request: express.Request, id: string): Promise<UserResult | APIResponse> {
        const user = await BeepORM.userRepository.findOne(id);

        if (!user) {
            return new APIResponse(APIStatus.Error, "User not found");
        }

        return {
            status: APIStatus.Success,
            user: user
        };
    }

    public async removeUser(id: string): Promise<APIResponse> {
        const user = BeepORM.em.getReference(User, new ObjectId(id));

        if (!user) {
            return new APIResponse(APIStatus.Error, "User not found");
        }

        if (await deleteUser(user)) {
            return new APIResponse(APIStatus.Success, "Successfully deleted user");
        }

        return new APIResponse(APIStatus.Error, "Unable to delete user");
    }

    public async editUser(id: string, requestBody: EditUserParams): Promise<APIResponse> {

        const user = await BeepORM.userRepository.findOne(id);

        if (!user) {
            return new APIResponse(APIStatus.Error, "User not found");
        }

        wrap(user).assign(requestBody);

        await BeepORM.userRepository.persistAndFlush(user);

        return new APIResponse(APIStatus.Success, "Successfully edited user");
    }

    public async getUsers(offset?: number, show?: number): Promise<UsersResult | APIResponse> {
        const [users, count] = await BeepORM.em.findAndCount(User, {}, { limit: show, offset: offset });

        return {
            status: APIStatus.Success,
            total: count,
            users: users
        };
    }


    public async getRideHistory(request: express.Request, id: string): Promise<APIResponse | RiderHistoryResult> {
        const r = await BeepORM.beepRepository.find({ rider: new ObjectId(id) }, { populate: true });

        return {
            status: APIStatus.Success,
            data: r
        };
    }

    public async getBeepHistory(request: express.Request, id: string): Promise<APIResponse | BeeperHistoryResult> {
        const r = await BeepORM.beepRepository.find({ beeper: new ObjectId(id) }, { populate: true });

        return {
            status: APIStatus.Success,
            data: r
        };
    }

    public async getQueue(request: express.Request, id: string): Promise<APIResponse | any> {
        const r = await BeepORM.queueEntryRepository.find({ beeper: id }, { populate: true });
        
        for (let i = 0; i < r.length; i++) {
           if (r[i].state == -1) {
               //await BeepORM.queueEntryRepository.nativeDelete(r[i]);
               BeepORM.queueEntryRepository.nativeDelete(r[i]);
           }
        }

        return {
            status: APIStatus.Success,
            queue: r.filter(entry => entry.state != -1)
        };
    }
}
