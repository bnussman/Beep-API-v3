import * as express from 'express';
import { Router, Request, Response } from 'express';
import * as r from 'rethinkdb';
import { ReqlError } from 'rethinkdb';
import { makeJSONError, makeJSONSuccess } from '../utils/json';
import { UserPluckResult } from "../types/beep";
import { db } from '../utils/db';
import { Validator } from "node-input-validator";
import * as Sentry from "@sentry/node";
import { isAuthenticated } from '../auth/helpers';

const router: Router = express.Router();

router.get('/:id', getUser);
router.post('/report', isAuthenticated, reportUser);

async function getUser (req: Request, res: Response): Promise<Response | void> {
    const userItems = ['first', 'last', 'capacity', 'isStudent', 'masksRequired', 'queueSize', 'singlesRate', 'groupRate', 'venmo', 'isBeeping'];

    r.table("users").get(req.params.id).pluck(...userItems).run(db.getConn(), function (error: ReqlError, result: UserPluckResult) {
        if (error) {
            Sentry.captureException(error);
            return res.status(500).send(makeJSONError("Unable to get user profile"));
        }

        return res.send({
            'status': 'success',
            'user': result
        });
    });
}

async function reportUser (req: Request, res: Response): Promise<Response | void> {
    const v = new Validator(req.body, {
        id: "required",
        reason: "required"
    });

    const matched = await v.check();

    if (!matched) {
        //users input did not match our criteria, send the validator's error
        return res.status(422).send(makeJSONError(v.errors));
    }

    const document = {
        reporterId: req.user.id,
        reportedId: req.body.id,
        reason: req.body.reason,
        timestamp: Date.now()
    };
    
    try {
        const result = await r.table("userReports").insert(document).run(db.getConn());

        if (result.inserted == 1) {
            res.send(makeJSONSuccess("Successfully reported user"));
        }
        else {
            res.send(makeJSONError("Unable to report user"));
            Sentry.captureException("Nothing was inserted into the databse when reporting a user");
        }
    }
    catch (error) {
        Sentry.captureException(error);
        return res.status(500).send(makeJSONError("Unable to insert into reports table"));
    }
}

export = router; 
