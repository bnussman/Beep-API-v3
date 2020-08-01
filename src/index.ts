import { sha256 } from 'js-sha256';
import { v4 as uuidv4 } from 'uuid';
import { Application, Request, Response } from 'express';
import express = require('express');
import * as r from 'rethinkdb';
import { CursorError, ReqlError, Cursor, WriteResult } from 'rethinkdb';
import { conn, connQueues } from './database/db';
import { TokenData, User } from './types/index.d';

const app: Application = express();
const port = 3001;

app.use(express.json())
app.use(express.urlencoded({ extended: true }))

//------------------------------
//  API Endpoints
//------------------------------
app.post('/auth/login', login);
app.post('/auth/signup', signup);
app.post('/auth/logout', logout);
app.post('/auth/token', removeToken);
app.get('/beeper/status/:id', getBeeperStatus);
app.post('/beeper/status', setBeeperStatus);
app.post('/beeper/queue', getBeeperQueue);
app.post('/beeper/queue/status', setBeeperQueue);
app.post('/rider/find', findBeep);
app.post('/rider/choose', chooseBeep);
app.post('/rider/status', getRiderStatus);
app.post('/rider/leave', riderLeaveQueue);
app.get('/rider/list', getBeeperList);
app.post('/account/edit', editAccount);
app.post('/account/password', changePassword);

/**
 * API function to handle a login
 */
function login (req: Request, res: Response): void {
    //RethinkDB Query to see if there is a user with POSTed username
    r.table("users").filter({ "username": req.body.username }).run(conn, function (error: Error, cursor: Cursor) {
        //Handle RethinkDB error
        if (error) {
            throw error;
        }
        //Iterate through user's with that given username
        cursor.next(async function(error: CursorError, result: User) {
            //Handle RethinkDB cursour error
            if (error) {
                //TODO: re-add error.msg check
                res.send(makeJSONError("User not found."));
                //close the RethinkDB cursor to prevent leak
                cursor.close();
                return;
            }
            //hash the input, and compare it to user's encrypted password
            if (result.password == sha256(req.body.password)) {
                //if authenticated, get new auth tokens
                const tokenData = await getToken(result.id);
                //send out data to REST API
                res.send({
                    'status': "success",
                    'id': result.id,
                    'username': result.username,
                    'first': result.first,
                    'last': result.last,
                    'email': result.email,
                    'phone': result.phone,
                    'venmo': result.venmo,
                    'token': tokenData.token,
                    'tokenid': tokenData.tokenid,
                    'singlesRate': result.singlesRate,
                    'groupRate': result.groupRate,
                    'capacity': result.capacity,
                    'isBeeping': result.isBeeping,
                    'userLevel': result.userLevel
                });
                
                if (req.body.expoPushToken) {
                    setPushToken(result.id, req.body.expoPushToken);
                }

                //close the RethinkDB cursor to prevent leak
                cursor.close();
                return;
            }
            else {
                res.send(makeJSONError("Password is incorrect."));
                //close the RethinkDB cursor to prevent leak
                cursor.close();
                return;
            }
        });
    });
}


/**
 * API function to handle a sign up
 * TODO: ensure username is not taken before signup
 */
function signup (req: Request, res: Response): void {
    //This is the row that will be inserted into our users RethinkDB table
    const document = {
        'first': req.body.first,
        'last': req.body.last,
        'email': req.body.email,
        'phone': req.body.phone,
        'venmo': req.body.venmo,
        'username': req.body.username,
        'password': sha256(req.body.password),
        'isBeeping': false,
        'queueSize': 0,
        'inQueueOfUserID': null,
        'pushToken': req.body.expoPushToken,
        'singlesRate': 3.00,
        'groupRate': 2.00,
        'capacity': 4,
        'userLevel': 0
    };

    //insert a new user into our users table
    r.table("users").insert(document).run(conn, async function (error: Error, result: WriteResult) {
        //handle a RethinkDB error
        if (error) {
            throw error;
        }
        //if we successfully inserted our new user...
        if (result.inserted == 1) {
            //line below uses the RethinkDB result to get us the user's id the rethinkdb generated for us
            const userid = result.generated_keys[0];
            //user our getToken function to get an auth token on signup
            const tokenData = await getToken(userid);

            //because signup was successful we must make their queue table
            r.db("beepQueues").tableCreate(userid).run(connQueues);

            //produce our REST API output
            res.send({
                'status': "success",
                'id': userid,
                'username': req.body.username,
                'first': req.body.first,
                'last': req.body.last,
                'email': req.body.email,
                'phone': req.body.phone,
                'venmo': req.body.venmo,
                'token': tokenData.token,
                'tokenid': tokenData.tokenid,
                'singlesRate': 3.00,
                'groupRate': 2.00,
                'capacity': 4,
                'isBeeping': false,
                'userLevel': 0
            });
        }
        else {
            //RethinkDB says that a new entry was NOT inserted, something went wrong...
            res.send(makeJSONError("New user was not inserted into the database."));
        }
    });
}

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

/**
 * API function to handle a logout
 */
async function logout (req: Request, res: Response): Promise<void> {
    //check if auth token is valid before processing the request to update push token
    const id = await isTokenValid(req.body.token);

    if (!id) {
        //if there is no id returned, the token is not valid.
        res.send(makeJSONError("Your auth token is not valid."));
        return;
    }

    //RethinkDB query to delete entry in tokens table.
    r.table("tokens").get(req.body.token).delete().run(conn, function (error: Error, result: WriteResult) {
        //handle a RethinkDB error
        if (error) {
            throw error;
        }
        //if RethinkDB tells us something was deleted, logout was successful
        if (result.deleted == 1) {
            //unset the user's push token
            setPushToken(id, null);
            //return success message
            res.send(makeJSONSuccess("Token was revoked."));
        }
        else {
            //Nothing was deleted in the db, so there was some kind of error
            res.send(makeJSONError("Token was not deleted in our database."));
        }
    });
}

/**
 * API function that handles revoking an auth token given a tokenid (an offline logout)
 * TODO: rather than having this function, just use logout and post data accordingly
 */
function removeToken (req: Request, res: Response): void {
    //RethinkDB query to delete entry in tokens table.
    r.table("tokens").filter({'tokenid': req.body.tokenid}).delete().run(conn, function (error: Error, result: WriteResult) {
        //handle a RethinkDB error
        if (error) {
            throw error;
        }
        //if RethinkDB tells us something was deleted, logout was successful
        if (result.deleted == 1) {
            res.send(makeJSONSuccess("Token was revoked."));
        }
        else {
            //Nothing was deleted in the db, so there was some kind of error
            res.send(makeJSONError("Token was not deleted in our database."));
        }
    });
}

/**
 * Retuns user's id if their token is valid, null otherwise
 *
 * @param token takes a user's auth token as input
 * @return userid if token is valid, null otherwise
 */
async function isTokenValid(token: string): Promise<string | null> {
    //get (only) user's id from tokens db where the token is the token passed to this function
    //NOTE: filter must be used over get here because token is not a primary (or secondary) key
    const result: any = await r.table("tokens").get(token).run(conn);

    if (result) {
        return result.userid;
    }

    //we did not find this token in the tokens table, so it is not valid,
    //rather then returning a userid, return null to signify that token is not valid.
    return null;
}

/**
 * function to tell if user has a specific user level
 * @param userid is the user's id
 * @prarm level is the desired user level
 * @returns a promice that is a boolean. True if user has level, false otherwise
 */
async function hasUserLevel(userid: string, level: number): Promise<boolean> {
    const userLevel: number = await r.table("users").get(userid).pluck('userLevel').run(conn);
    //return a boolean, true if user has desired level, false otherwise
    return level == userLevel;
}

/**
 * works exactly like isTokenValid, but only returns a userid if user has userLevel == 1 (meaning they are an admin)
 * @param token a user's auth token
 * @returns promice that resolves to null or a user's id
 */
async function isAdmin(token: string): Promise<string | null> {
    const id = await isTokenValid(token);

    if (id) {
        const hasCorrectLevel = await hasUserLevel(id, 1);
        
        if(hasCorrectLevel) {
            return id;
        }
    }
    return null;
}

/**
 * Updates a user's pushToken in the database
 * @param id a user's id in which we want to update their push tokens
 * @param token the expo push token for the user
 */
async function setPushToken(id: string | null, token: string | null): Promise<void> {
    if (!id) return;
    //run query to get user and update their pushToken
    await r.table("users").get(id).update({pushToken: token}).run(conn);
}

/**
 * Generates an authentication token and a token for that token (for offline logouts), stores
 * the entry in the tokens table, and returns that same data.
 *
 * @param userid a user's ID which is used to associate a token with a userid in our tokens table
 * @return user's id, auth token, and auth token's token to be used by login and sign up
 */
async function getToken(userid: string): Promise<TokenData> {
    //this information will be inserted into the tokens table and returned by this function
    const document = {
        'userid': userid,
        'tokenid': uuidv4()
    };

    //insert our new auth token into our tokens table
    const result: WriteResult = await r.table("tokens").insert(document).run(conn);

    //if nothing was inserted into the tokens table, we know something is wrong
    if (result.inserted == 0) {
        throw "Unable to insert new token into db.";
    }

    const token: string = result.generated_keys[0];

    //return the data we generated
    return ({
        'userid': document.userid,
        'tokenid': document.tokenid,
        'token': token
    });
}

/**
 * API function that returns a beeper's isBeeing status
 */
function getBeeperStatus (req: Request, res: Response): void {
    //get isBeeping from user with id GET param in users db
    r.table("users").get(req.params.id).pluck('isBeeping').run(conn, function (error: ReqlError, result: any) {
        //if there was an error, notify user with REST API.
        if (error) {
            res.send(makeJSONError("Unable to get beeping status."));
            console.log(error);
            return;
        }
        //We have no error, send the resulting data from query.
        res.send({
            'status': 'success',
            'isBeeping': result.isBeeping
        });
    });
}

/**
 * API function that allows beeper to update isBeeping
 */
async function setBeeperStatus (req: Request, res: Response): Promise<void> {
    //get user's id
    let id = await isTokenValid(req.body.token);

    //if id is null, user's token is not valid
    if (!id) {
        res.send(makeJSONError("Your token is not valid."));
        return;
    }

    //if beeper is setting isBeeping to false
    if (req.body.isBeeping == false) {
        //get beepers queue size
        const queueSize = await getQueueSize(id);
        //we must make sure their queue is empty before they stop beeping
        if (queueSize > 0) {
            res.send(makeJSONError("You can't stop beeping when you still have beeps to complete or riders in your queue"));
            return;
        }
    }

    //query updates beepers isBeeping, singlesRate, and groupRate values
    r.table('users').get(id).update({isBeeping: req.body.isBeeping, singlesRate: req.body.singlesRate, groupRate: req.body.groupRate, capacity: req.body.capacity}).run(conn, function(error: Error) {
        //handle any RethinkDB error
        if (error) {
            res.send(makeJSONError("Unable to update beeping status."));
            console.log(error);
            return;
        }
        //If there was no DB error, our update query was successful. return success with REST API
        res.send(makeJSONSuccess("Successfully updated beeping status."));
    });
}

async function chooseBeep (req: Request, res: Response): Promise<void> {
    //get user's id
    let id = await isTokenValid(req.body.token);

    //if id is null, user's token is not valid
    if (!id) {
        res.send(makeJSONError("Your token is not valid."));
        return;
    }

    const result = await r.table('users').get(req.body.beepersID).pluck('first', 'last', 'queueSize', 'singlesRate', 'groupRate', 'isBeeping').run(conn);

    if (!result.isBeeping) {
        res.send(makeJSONError("The user you have chosen is no longer beeping at this time."));
        return;
    }

    //if there was no error, construct our new entry for beeper's queue table
    const newEntry = {
        'riderid': id,
        'timeEnteredQueue': Date.now(),
        'isAccepted': false,
        'groupSize': req.body.groupSize,
        'origin': req.body.origin,
        'destination': req.body.destination,
        'state': 0
    };

    //insert newEntry into beeper's queue table
    r.table(req.body.beepersID).insert(newEntry).run(connQueues, function (error, result) {
        //handle any RethinkDB error
        if (error) {
            res.send(makeJSONError("Server error while creating new entry in beeper's queue table."));
            console.log(error);
            return;
        }
        //ensure we actually inserted something
        if (result.inserted != 1) {
            res.send(makeJSONError("Nothing was inserted into beeper's queue table. This should not have happended..."));
            return;
        }
    });

    //update beeper's queue size in the users table
    r.table('users').get(req.body.beepersID).update({'queueSize': r.row('queueSize').add(1)}).run(conn, function (error, result) {
        //handle any RethinkDB error
        if (error) {
            res.send(makeJSONError("Server error while incrementing beeper's queue size"));
            console.log(error);
            return;
        }
        //ensure we actually updated something
        if (result.replaced != 1) {
            res.send(makeJSONError("Nothing was changed in beeper's queue table. This should not have happended..."));
            return;
        }
    });

    //update rider's inQueueOfUserID
    r.table('users').get(id).update({'inQueueOfUserID': req.body.beepersID}).run(conn, function (error, result) {
        //handle any RethinkDB error
        if (error) {
            res.send(makeJSONError("Server error while updating 'inQueueOfUserID' for rider"));
            console.log(error);
            return;
        }
        //ensure we actually updated something
        if (result.replaced != 1) {
            res.send(makeJSONError("Nothing was changed in beeper's queue table. This should not have happended..."));
            return;
        }
    });

    //Tell Beeper someone entered their queue
    sendNotification(req.body.beepersID, "A rider has entered your queue", "Please open your app to accept or deny them.");

    //if we made it to this point, user has found a beep and it has been
    //registered in our db. Send output with nessesary data to rider.
    res.send({
        'status': 'success',
        'beeper': {
            'id': req.body.beepersID,
            'first': result.first,
            'last': result.last,
            'queueSize': result.queueSize + 1,
            'singlesRate': result.singlesRate,
            'groupRate': result.groupRate
        }
    });
}

/**
 * API function that allows user to find a ride with a beeper
 */
async function findBeep (req: Request, res: Response): Promise<void> {
    //get user's id
    let id = await isTokenValid(req.body.token);

    //if id is null, user's token is not valid
    if (!id) {
        res.send(makeJSONError("Your token is not valid."));
        return;
    }

    //rethinkdb query to search users table (in acending order by queueSize) for users where isBeeping is true
    //and id is not equal to requester's, and limit by 1 to decide a riders beeper
    r.table('users').orderBy({'index': 'queueSize'}).filter(r.row('isBeeping').eq(true).and(r.row('id').ne(id))).limit(1).run(conn, function (error, cursor) {
        //Handle any RethinkDB error
        if (error) {
            res.send(makeJSONError("Unable to find a beep due to a backend error."));
            console.log(error);
            return;
        }

        //this paticular RethinkDB query will return an iterable object, so use next to get the beeper
        cursor.next(function(error: CursorError, result: any) {
            //Handle RethinkDB cursour error
            if (error) {
                //If rethinkdb says there are not more rows, no one is beeping!
                if (error.msg == "No more rows in the cursor.") {
                    //Return error to REST API
                    res.send(makeJSONError("Nobody is beeping at the moment! Try to find a ride later."));
                    //close the RethinkDB cursor to prevent leak
                    cursor.close();
                    return;
                }
            }

            //if we made it to this point, user has found a beep and it has been
            //registered in our db. Send output with nessesary data to rider.
            res.send({
                'status': 'success',
                'beeper': {
                    'id': result.id,
                    'first': result.first,
                    'last': result.last,
                    'queueSize': result.queueSize,
                    'singlesRate': result.singlesRate,
                    'groupRate': result.groupRate,
                    'capacity': result.capacity
                }
            });
        });
    });
}

/**
 * API function that gets a beeper's queue as an array
 */
async function getBeeperQueue (req: Request, res: Response): Promise<void> {
    //get user's id
    let id = await isTokenValid(req.body.token);

    //if id is null, user's token is not valid
    if (!id) {
        res.send(makeJSONError("Your token is not valid."));
        return;
    }

    //get beeper's queue ordered by the time each rider entered the queue so the order makes sence for the beeper
    r.table(id).orderBy('timeEnteredQueue').run(connQueues, async function (error: any, result: any) {
        //Handle any RethinkDB error
        if (error) {
            res.send(makeJSONError("Unable to get beeper's queue due to a server error."));
            console.log(error);
            return;
        }

        //for every entry in a beeper's queue, add personal info
        for (let doc of result) {
            //for every queue entry, add personal info of the rider
            doc['personalInfo'] = await getPersonalInfo(doc.riderid);
        }

        //after processing, send data.
        res.send({
            'status': 'success',
            'queue': result
        });
    });
}

/**
 * Helper function that, given a user's id, will return that user's personal info
 * @param userid
 * @return json-like object (or array?) thing with personal info
 */
async function getPersonalInfo (userid: string): Promise<object> {
    //RethinkDB query gets data from users db at userid
    let result = await r.table('users').get(userid).pluck('first', 'last', 'phone', 'venmo').run(conn);
    return ({
        'first': result.first,
        'last': result.last,
        'phone': result.phone,
        'venmo': result.venmo
    });
}

async function getRiderStatus (req: Request, res: Response): Promise<void> {
    //get user's id
    let id = await isTokenValid(req.body.token);

    //if id is null, user's token is not valid
    if (!id) {
        res.send(makeJSONError("Your token is not valid."));
        return;
    }

    //get rider's entry in our user's db
    let result = await r.table('users').get(id).pluck('inQueueOfUserID').run(conn);

    //we will be using the rider's beeper's id a lot, so make it a const
    const beepersID = result.inQueueOfUserID;

    //if user is in a queue...
    if (beepersID) {
        //since we are in a queue, we need to find the db entry where the rider has you id
        let result = await r.table(beepersID).filter({riderid: id}).run(connQueues);

        //resolve the next element so we have a const of the db entry
        const queueEntry = await result.next();

        //get rider's position in the queue by using a count query where we count entries where they entered the queue earlier
        //(they have an earlier timestamp)
        let ridersQueuePosition = await r.table(beepersID).filter(r.row('timeEnteredQueue').lt(queueEntry.timeEnteredQueue).and(r.row('isAccepted').eq(true))).count().run(connQueues);

        //get beeper's information
        let beepersInfo = await r.table('users').get(beepersID).pluck('first', 'last', 'phone', 'venmo', 'singlesRate', 'groupRate', 'queueSize').run(conn);

        let output;

        if (queueEntry.isAccepted) {
            //if rider is accepted by beeper, give them data along with more personal info like full name and phone number
            output = {
                "status": "success",
                "groupSize": queueEntry.groupSize,
                "isAccepted": queueEntry.isAccepted,
                "ridersQueuePosition": ridersQueuePosition,
                "state": queueEntry.state,
                "beeper": {
                    "id": beepersID,
                    "first": beepersInfo.first,
                    "last": beepersInfo.last,
                    "phone": beepersInfo.phone,
                    "venmo": beepersInfo.venmo,
                    "queueSize": beepersInfo.queueSize,
                    "singlesRate": beepersInfo.singlesRate,
                    "groupRate": beepersInfo.groupRate
                }
            };
        }
        else {
            //rider is not yet accepted, give them info, but exclude less personal info
            output = {
                "status": "success",
                "groupSize": queueEntry.groupSize,
                "isAccepted": queueEntry.isAccepted,
                "beeper": {
                    "id": beepersID,
                    "first": beepersInfo.first,
                    "last": beepersInfo.last,
                    "queueSize": beepersInfo.queueSize,
                    "singlesRate": beepersInfo.singlesRate,
                    "groupRate": beepersInfo.groupRate
                }
            };
        }
        //respond with appropriate output
        res.send(output);
    }
    else {
        //if beeper's id is not defined, they are not getting a beep
        res.send(makeJSONError("Currently, user is not getting a beep."));
    }
}

/**
 * API function that is invoked when a rider wants to leave the queue they are in
 */
async function riderLeaveQueue (req: Request, res: Response): Promise<void> {
    //get user's id
    let id = await isTokenValid(req.body.token);

    //if id is null, user's token is not valid
    if (!id) {
        res.send(makeJSONError("Your token is not valid."));
        return;
    }

    //delete entry in beeper's queue table
    r.table(req.body.beepersID).filter({'riderid': id}).delete().run(connQueues, function (error, result) {
        //handle any RethinkDB error
        if (error) {
            res.send(makeJSONError("Server error while deleting queue entry in beeper's queue table"));
            console.log(error);
            return;
        }
        //ensure we actually deleted something
        if (result.deleted != 1) {
            res.send(makeJSONError("Nothing was deleted into beeper's queue table. This should not have happended..."));
            return;
        }
    });

    //decreace beeper's queue size
    r.table('users').get(req.body.beepersID).update({'queueSize': r.row('queueSize').sub(1)}).run(conn, function (error, result) {
        //handle any RethinkDB error
        if (error) {
            res.send(makeJSONError("Server error while decrementing beeper's queue size"));
            console.log(error);
            return;
        }
        //ensure we actually updated something
        if (result.replaced != 1) {
            res.send(makeJSONError("Nothing was changed in beeper's queue table. This should not have happended..."));
            return;
        }
    });

    //set rider's inQueueOfUserID value to null because they are no longer in a queue
    r.table('users').get(id).update({'inQueueOfUserID': null}).run(conn, function (error, result) {
        //handle any RethinkDB error
        if (error) {
            res.send(makeJSONError("Server error while updating 'inQueueOfUserID' for rider"));
            console.log(error);
            return;
        }
        //ensure we actually updated something
        if (result.replaced != 1) {
            res.send(makeJSONError("Nothing was changed in beeper's queue table. This should not have happended..."));
            return;
        }
    });

    //if we made it to this point, we successfully removed a user from the queue.
    res.send(makeJSONSuccess("Successfully removed user from queue."));
}

/**
 * API function that allows beeper to modify the status of a rider in their queue
 */
async function setBeeperQueue (req: Request, res: Response): Promise<void> {
    //get user's id
    let id = await isTokenValid(req.body.token);

    //if id is null, user's token is not valid
    if (!id) {
        res.send(makeJSONError("Your token is not valid."));
        return;
    }

    //if the beeper is accepting or denying a rider, run this code to ensure that beeper is
    //acceping or denying the rider that was first to request a ride (amung the isAccepted == false) beeps
    if (req.body.value == 'accept' || req.body.value == 'deny') {
        //in beeper's queue table, get the time the rider entered the queue
        //we need this to count the number of people before this rider in the queue
        let result = await r.table(id).filter({'riderid': req.body.riderID}).pluck('timeEnteredQueue').run(connQueues);

        //resolve the query and get the time this rider entered the queue as a const
        const timeEnteredQueue = (await result.next()).timeEnteredQueue;

        //query to get rider's actual position in the queue
        let ridersQueuePosition = await r.table(id).filter(r.row('timeEnteredQueue').lt(timeEnteredQueue).and(r.row('isAccepted').eq(false))).count().run(connQueues);

        //if there are riders before this rider that have not been accepted,
        //tell the beeper they must respond to them first.
        if (ridersQueuePosition != 0) {
            res.send(makeJSONError("You must respond to the rider who first joined your queue."));
            return;
        }
    }
    else {
        //in beeper's queue table, get the time the rider entered the queue
        //we need this to count the number of people before this rider in the queue
        let result = await r.table(id).filter({'riderid': req.body.riderID}).pluck('timeEnteredQueue').run(connQueues);

        //resolve the query and get the time this rider entered the queue as a const
        const timeEnteredQueue = (await result.next()).timeEnteredQueue;

        //query to get rider's actual position in the queue
        let ridersQueuePosition = await r.table(id).filter(r.row('timeEnteredQueue').lt(timeEnteredQueue).and(r.row('isAccepted').eq(true))).count().run(connQueues);

        //if there are riders before this rider that have been accepted,
        //tell the beeper they must respond to them first.
        if (ridersQueuePosition != 0) {
            res.send(makeJSONError("You must respond to the rider who first joined your queue."));
            return;
        }
    }

    if (req.body.value == 'accept') {
        //RethinkDB query that modifies record in beeper's queue, setting isAccepted to true for specific rider
        r.table(id).get(req.body.queueID).update({'isAccepted': true}).run(connQueues, function (error) {
            //handle RethinkDB errors
            if (error) {
                res.send(makeJSONError("Unable to accept rider due to a server error."));
                console.log(error);
                return;
            }

            //if we made it here, accept occoured successfully
            res.send(makeJSONSuccess("Successfully accepted rider in queue."));
        });

        //Notify the rider that they were accepted into a queue
        sendNotification(req.body.riderID, "A beeper has accepted your beep request", "You will recieve another notification when they are on their way to pick you up.");
    }
    else if (req.body.value == 'deny' || req.body.value == 'complete') {
        //delete entry in beeper's queues table
        r.table(id).get(req.body.queueID).delete().run(connQueues, function (error, result) {
            //handle any RethinkDB error
            if (error) {
                res.send(makeJSONError("Server error while deleting queue entry in beeper's queue table"));
                console.log(error);
                return;
            }
            //ensure we actually deleted something
            if (result.deleted != 1) {
                res.send(makeJSONError("Nothing was deleted into beeper's queue table. This should not have happended..."));
                return;
            }
        });

        //decrease beeper's queue size
        r.table('users').get(id).update({'queueSize': r.row('queueSize').sub(1)}).run(conn, function (error, result) {
            //handle any RethinkDB error
            if (error) {
                res.send(makeJSONError("Server error while decrementing beeper's queue size"));
                console.log(error);
                return;
            }
            //ensure we actually updated something
            if (result.replaced != 1) {
                res.send(makeJSONError("Nothing was changed in beeper's queue table. This should not have happended..."));
                return;
            }
        });

        //set rider's inQueueOfUserID value to null because they are no longer in a queue
        r.table('users').get(req.body.riderID).update({'inQueueOfUserID': null}).run(conn, function (error, result) {
            //handle any RethinkDB error
            if (error) {
                res.send(makeJSONError("Server error while updating 'inQueueOfUserID' for rider"));
                console.log(error);
                return;
            }
            //ensure we actually updated something
            if (result.replaced != 1) {
                res.send(makeJSONError("Nothing was changed in beeper's queue table. This should not have happended..."));
                return;
            }
        });

        if (req.body.value == "deny") {
            //if the command sent to the api was deny, let the rider know they were denied
            sendNotification(req.body.riderID, "A beeper has denied your beep request", "Open your app to find a diffrent beeper.");
        }

        //if we reached this point, operation was successful
        res.send(makeJSONSuccess("Successfully removed user from queue."));
    }
    else {
        //we can just increment the state number in the queue doccument
        r.table(id).get(req.body.queueID).update({'state': r.row('state').add(1)}, {returnChanges: true}).run(connQueues, function (error, result) {
            //handle any RethinkDB error
            if (error) {
                res.send(makeJSONError("Server error while updating incrementing state in rider's queue doccument"));
                console.log(error);
                return;
            }
           
            let newState = result.changes[0].new_val.state;

            switch(newState) {
                case 1:
                    sendNotification(req.body.riderID, "Your beeper is on their way!", "Your beepr is on their way to pick you up.");
                    break;
                case 2:
                    sendNotification(req.body.riderID, "Your beeper is here!", "Your beepr is here to pick you up.");
                    break;
                /*
                case 3:
                    sendNotification(req.body.riderID, "Your beeper is on their way!", "Your beepr is on their way to pick you up.");
                    break;
                */
            }
            
            res.send(makeJSONSuccess("Successfully changed ride state."));
        });
    }
}

/**
 * API endpoint to return a JSON responce with a status and list of all users beeping
 */
function getBeeperList (req: Request, res: Response): void {
    r.table("users").filter({isBeeping: true}).pluck('first', 'last', 'queueSize', 'id', 'singlesRate', 'groupRate', 'capacity').run(conn, async function (error: Error, result) {
        if (error) {
            console.log(error);
            return;
        }

        const list = await result.toArray();

        res.send({
            "status": "success",
            "beeperList": list
        });
    });
}

/**
 * Retuns user's id if their token is valid, null otherwise
 *
 * @param token takes a user's auth token as input
 * @return userid if token is valid, null otherwise
 */
async function getQueueSize(userid: string): Promise<number> {
    const size = await r.table("users").get(userid).pluck('queueSize').run(conn);
    return size.queueSize;
}

/**
 * @param message the error message you wish to include in the API's responce
 * @return JSON error message
 */
function makeJSONError(message: string): object {
    return ({ status: "error", message: message });
}

/**
 * @param message the success message you wish to include in the API's responce
 * @return JSON success message
 */
function makeJSONSuccess(message: string): object {
    return ({ status: "success", message: message });
}

/**
 * Use Expo's API to send a push notification
 * @param userid the resipiant's id
 * @param title for the notification
 * @param message is the body of the push notification
 */
async function sendNotification(userid: string, title: string, message: string): Promise<void> {
    let pushToken = await getPushToken(userid);
    
    /*
    fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            "to": pushToken,
            "title": title,
            "body": message
        })
    });
    */
}

/**
 * Given a user's id, query the db and return their Expo push token
 * @param userid a user's id
 * @return string of users Expo push token
 */
async function getPushToken(userid: string): Promise<string> {
    const output = await r.table("users").get(userid).pluck('pushToken').run(conn);
    return output.pushToken;
}

//------------------------------
//  Start Web Server
//------------------------------
app.listen(port, () => console.log(`Beep API Server running on  http://localhost:${port}`))
