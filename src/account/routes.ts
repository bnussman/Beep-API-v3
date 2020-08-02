import express = require('express');
import { Router, Request, Response } from 'express';
import * as r from 'rethinkdb';
import { sha256 } from 'js-sha256';
import { makeJSONSuccess, makeJSONError } from '../utils/json';
import { isTokenValid } from "../auth/helpers";
import { conn } from '../utils/db';

const router: Router = express.Router();

router.post('/edit', editAccount);
router.post('/password', changePassword);

async function editAccount (req: Request, res: Response): Promise<void> {
    //check if auth token is valid before processing the request to update push token
    const id = await isTokenValid(req.body.token);

    if (!id) {
        //if there is no id returned, the token is not valid.
        res.send(makeJSONError("Your auth token is not valid."));
        return;
    }

    r.table("users").get(id).update({first: req.body.first, last: req.body.last, email: req.body.email, phone: req.body.phone, venmo: req.body.venmo}).run(conn, function (error: Error) {
        if (error) {
            throw error;
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

export = router;
