import express = require('express');
import { Router, Request, Response } from 'express';
import { WriteResult } from "rethinkdb";
import * as r from 'rethinkdb';
import { sha256 } from 'js-sha256';
import { makeJSONSuccess, makeJSONError, makeJSONWarning } from '../utils/json';
import { isTokenValid } from "../auth/helpers";
import { conn } from '../utils/db';

const router: Router = express.Router();

router.post('/edit', editAccount);
router.post('/password', changePassword);
router.post('/pushtoken', updatePushToken);

async function editAccount (req: Request, res: Response): Promise<void> {
    //check if auth token is valid before processing the request to update push token
    const id = await isTokenValid(req.body.token);

    if (!id) {
        //if there is no id returned, the token is not valid.
        res.send(makeJSONError("Your auth token is not valid."));
        return;
    }

    r.table("users").get(id).update({first: req.body.first, last: req.body.last, email: req.body.email, phone: req.body.phone, venmo: req.body.venmo}).run(conn, function (error: Error, result: WriteResult) {
        if (error) {
            throw error;
        }
        if (result.unchanged > 0) {
            res.send(makeJSONWarning("Nothing was changed about your profile."));
            return;
        }
        res.send(makeJSONSuccess("Successfully edited profile."));
    });
}

async function changePassword (req: Request, res: Response): Promise<void> {
    //check if auth token is valid before processing the request to update push token
    const id = await isTokenValid(req.body.token);

    if (!id) {
        //if there is no id returned, the token is not valid.
        res.send(makeJSONError("Your auth token is not valid."));
        return;
    }

    const encryptedPassword = sha256(req.body.password);

    r.table("users").get(id).update({password: encryptedPassword}).run(conn, function (error: Error) {
        if (error) {
            throw error;
        }
        res.send(makeJSONSuccess("Successfully changed password."));
    });
}

async function updatePushToken (req: Request, res: Response): Promise<void> {
    //check if auth token is valid before processing the request to update push token
    const id = await isTokenValid(req.body.token);

    if (!id) {
        //if there is no id returned, the token is not valid.
        res.send(makeJSONError("Your auth token is not valid."));
        return;
    }

    r.table("users").get(id).update({pushToken: req.body.expoPushToken}).run(conn, function (error: Error) {
        if (error) {
            throw error;
        }
        res.send(makeJSONSuccess("Successfully updated push token."));
    });
}

export = router;
