import { Route, Security, Post, Request, Tags } from "tsoa";
import database from '../utils/db';
import * as Sentry from "@sentry/node";
import * as r from 'rethinkdb';
import { WriteResult } from 'rethinkdb';
import AWS from 'aws-sdk';
import express from "express";
import multer from "multer";
import { APIResponse, APIStatus } from "../utils/Error";
import { ProfilePhotoResponse } from "./files";

@Tags("Files")
@Route("files")
export class FilesController {

    @Security("token")
    @Post("upload")
    public async uploadFile(@Request() request: express.Request): Promise<ProfilePhotoResponse | APIResponse> {
        const s3 = new AWS.S3({
            accessKeyId: process.env.S3_ACCESS_KEY_ID,
            secretAccessKey: process.env.S3_ACCESS_KEY_SECRET,
            endpoint: process.env.S3_ENDPOINT_URL
        });

        await this.handleFile(request);

        let fileName = request.file.originalname;

        const extention = fileName.substr(fileName.lastIndexOf("."), fileName.length);

        fileName = request.user.id + "-" + Date.now() + extention;

        const uploadParams = {
            Body: request.file.buffer,
            Key: "images/" + fileName,
            Bucket: "beep",
            ACL: "public-read"
        };

        try {
            const result = await s3.upload(uploadParams).promise();

            if (result) {
                try {
                    const dbResult: WriteResult = await r.table("users").get(request.user.id).update({ photoUrl: result.Location }, { returnChanges: true }).run((await database.getConn()));

                    //if user had an existing profile picture, use S3 to delete the old photo
                    if (dbResult.changes[0].old_val.photoUrl != null) {
                        const key: string = dbResult.changes[0].old_val.photoUrl.split("https://beep.us-east-1.linodeobjects.com/")[1];

                        const params = {
                            Bucket: "beep",
                            Key: key
                        };

                        s3.deleteObject(params,  (error: Error, data: unknown) => {
                            if (error) {
                                Sentry.captureException(error);
                            }
                        });
                    }

                    return {
                        status: APIStatus.Success,
                        message: "Successfully set profile photo",
                        url: result.Location
                    };
                }
                catch (error) {
                    Sentry.captureException(error);
                    return new APIResponse(APIStatus.Error, error);
                }
            }
            else {
                Sentry.captureException("No result from AWS");
                return new APIResponse(APIStatus.Error, "Error");
            }
        }
        catch (error) {
            console.error(error);
            Sentry.captureException(error);
            return new APIResponse(APIStatus.Error, error);
        }
    }

    private handleFile(request: express.Request): Promise<void> {
        //console.log(request);
        const multerSingle = multer({limits: { fieldSize: 25 * 1024 * 1024 }}).single("photo") as any;
        return new Promise((resolve, reject): void => {
            multerSingle(request, undefined, async (error: Error) => {
                if (error) {
                    console.error(error);
                    reject(error);
                }
                resolve();
            });
        });
    }
}
