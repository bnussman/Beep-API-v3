import * as r from 'rethinkdb';
import { request } from "https";
import { conn } from "../utils/db";

/**
 * Use Expo's API to send a push notification
 * @param userid the resipiant's id
 * @param title for the notification
 * @param message is the body of the push notification
 */
export async function sendNotification(userid: string, title: string, message: string): Promise<void> {
    let pushToken = await getPushToken(userid);

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
 * @return string of users Expo push token
 */
async function getPushToken(userid: string): Promise<string> {
    const output = await r.table("users").get(userid).pluck('pushToken').run(conn);
    return output.pushToken;
}
