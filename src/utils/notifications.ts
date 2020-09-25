import * as r from 'rethinkdb';
import { request } from "https";
import { db } from "../utils/db";
import * as Sentry from "@sentry/node";

/**
 * Use Expo's API to send a push notification
 * @param userid the resipiant's id
 * @param title for the notification
 * @param message is the body of the push notification
 */
export async function sendNotification(userid: string, title: string, message: string): Promise<void> {
    const pushToken = await getPushToken(userid);

    const req = request({
        host: "exp.host",
        path: "/--/api/v2/push/send",
        method: "POST",
        headers: {
            'Content-Type': 'application/json'
        }
    });

    req.write(JSON.stringify({
        "to": pushToken,
        "title": title,
        "body": message 
    }));

    req.end();
}

/**
 * Given a user's id, query the db and return their Expo push token
 * @param userid a user's id
 * @return string of users Expo push token or null if error
 */
async function getPushToken(userid: string): Promise<string | null> {
    try {
        const output = await r.table("users").get(userid).pluck('pushToken').run(db.getConn());

        return output.pushToken;
    }
    catch(error) {
       Sentry.captureException(error); 
    }
    return null;
}
