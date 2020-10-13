import * as express from 'express';
import { Router, Request, Response } from 'express';
import * as r from 'rethinkdb';
import { ReqlError } from 'rethinkdb';
import { makeJSONError } from '../utils/json';
import { UserPluckResult } from "../types/beep";
import { db } from '../utils/db';
import * as Sentry from "@sentry/node";

const router: Router = express.Router();

router.get('/:id', getUser);

async function getUser (req: Request, res: Response): Promise<Response | void> {
    r.table("users").get(req.params.id).pluck('first', 'last', 'capacity', 'isStudent', 'masksRequired', 'queueSize', 'singlesRate', 'groupRate', 'venmo', 'isBeeping').run(db.getConn(), function (error: ReqlError, result: UserPluckResult) {
        //if there was an error, notify user with REST API.
        if (error) {
            Sentry.captureException(error);
            return res.status(500).send(makeJSONError("Unable to get beeper status"));
        }
        //We have no error, send the resulting data from query.
        return res.send({
            'status': 'success',
            'user': result
        });
    });
}

export = router; 
