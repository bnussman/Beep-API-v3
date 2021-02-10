import express from 'express';
import * as Sentry from "@sentry/node";
import { Controller, Request, Route, Get, Security, Tags, Query, Path, Delete, Patch, Body } from 'tsoa';
import { APIStatus, APIResponse } from "../utils/Error";
import { EditUserParams, UserResult, UsersResult } from "../users/users";
import { deleteUser } from '../account/helpers';
import { BeeperHistoryResult, RiderHistoryResult } from '../account/account';
import { BeepORM } from '../app';
import { ObjectId } from '@mikro-orm/mongodb';
import { wrap } from '@mikro-orm/core';
import { User, UserRole } from '../entities/User';

@Tags("Users")
@Route("users")
export class UsersController extends Controller {

    /**
     * Get public information about any user by providing their user id,
     * if user has admin permission (auth is OPTIONAL), they will get more personal information about the user
     * @returns {UserResult | APIResponse}
     */
    @Security("optionalAdmin")
    @Get("{id}")
    public async getUser(@Request() request: express.Request, @Path() id: string): Promise<UserResult | APIResponse> {
        const user = await BeepORM.userRepository.findOne(id);

        if (!user) {
            this.setStatus(404);
            return new APIResponse(APIStatus.Error, "User not found");
        }

        return {
            status: APIStatus.Success,
            user: user
        };
    }

    /**
     * Delete an account by user id
     * @returns {APIResponse}
     */
    @Security("token", ["admin"])
    @Delete("{id}")
    public async removeUser(@Path() id: string): Promise<APIResponse> {
        const user = BeepORM.em.getReference(User, new ObjectId(id));

        if (!user) {
            this.setStatus(404);
            return new APIResponse(APIStatus.Error, "User not found");
        }

        if (await deleteUser(user)) {
            return new APIResponse(APIStatus.Success, "Successfully deleted user");
        }

        this.setStatus(500);
        return new APIResponse(APIStatus.Error, "Unable to delete user");
    }

    /**
     * Edit a user account
     * @param {EditUserParams} requestBody - user can send any or all account params
     * @returns {APIResponse}
     */
    @Security("token", ["admin"])
    @Patch("{id}")
    public async editUser(@Path() id: string, @Body() requestBody: EditUserParams): Promise<APIResponse> {

        const user = await BeepORM.userRepository.findOne(id);

        if (!user) {
            this.setStatus(404);
            return new APIResponse(APIStatus.Error, "User not found");
        }

        wrap(user).assign(requestBody);

        await BeepORM.userRepository.persistAndFlush(user);

        return new APIResponse(APIStatus.Success, "Successfully edited user");
    }

    /**
     * Get a list of every Beep App User for admins.
     *
     * You can specify and offset and show to get pagination. Ex: https://ridebeep.app/v1/users?offset=10&show=10
     *
     * If you do not specify an offset or a show ammount, the API will return EVERY user
     *
     * @param {number} [offset] where to start in the DB
     * @param {number} [show] how many to show from start
     * @returns {UsersResponse | APIResponse} [result]
     */
    @Security("token", ["admin"])
    @Get()
    public async getUsers(@Query() offset?: number, @Query() show?: number): Promise<UsersResult | APIResponse> {
        const [users, count] = await BeepORM.em.findAndCount(User, {}, { limit: show, offset: offset });

        return {
            status: APIStatus.Success,
            total: count,
            users: users
        };
    }

    /**
     * Get all of the rides of this user in the history table
     * @returns {RiderHistoryResult | APIResponse}
     */
    @Security("token")
    @Get("{id}/history/rider")
    public async getRideHistory(@Request() request: express.Request, @Path() id: string): Promise<APIResponse | RiderHistoryResult> {
        /*
        if (request.user.user._id != id) {
            const isAdmin = await hasUserLevel(request.user.user, 1);
            console.log(isAdmin);

            if (!isAdmin) return new APIResponse(APIStatus.Error, "You must be an admin to view other peoples history");
        }
        */
        
        const r = await BeepORM.beepRepository.find({ rider: new ObjectId(id) }, { populate: true });

        return {
            status: APIStatus.Success,
            data: r
        };
    }

    /**
     * Get all of the beeps of this user in the history table
     * @returns {BeeperHistoryResult | APIResponse}
     */
    @Security("token")
    @Get("{id}/history/beeper")
    public async getBeepHistory(@Request() request: express.Request, @Path() id: string): Promise<APIResponse | BeeperHistoryResult> {
        /*
        if (request.user.user._id != new ObjectId(id)) {
            const isAdmin = await hasUserLevel(request.user.user, 1);

            if (!isAdmin) return new APIResponse(APIStatus.Error, "You must be an admin to view other peoples history");
        }
        */

        const r = await BeepORM.beepRepository.find({ beeper: new ObjectId(id) }, { populate: true });

        return {
            status: APIStatus.Success,
            data: r
        };
    }


    /**
     * User calls this to get there queue when beeping.
     * Our Socket server is responcible for telling a client a change occoured, it will prompt
     * a call to this endpoint to get the queue and data
     * @returns {GetBeeperQueueResult} 
     */
    @Security("token")
    @Get("{id}/queue")
    public async getQueue(@Request() request: express.Request, @Path() id: string): Promise<APIResponse | any> {
        //TODO: figure this out
        /*
        if (request.user.user._id != id) {
            const isAdmin = await hasUserLevel(request.user.user._id, 1);

            if (!isAdmin) return new APIResponse(APIStatus.Error, "You must be an admin to view other peoples queue");
        }
        */

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
