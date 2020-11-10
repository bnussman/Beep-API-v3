import { Route, Security, Post, Request } from "tsoa";
import database from '../utils/db';
import * as Sentry from "@sentry/node";
import * as r from 'rethinkdb';
import { WriteResult } from 'rethinkdb';
import AWS from 'aws-sdk';
import express from "express";
import multer from "multer";
import { APIResponse, APIStatus } from "../utils/Error";
import {ProfilePhotoResponse} from "./files";

@Route("files")
export class FilesController {

    @Security("token")
    @Post("upload")
    public async uploadFile(@Request() request: express.Request): Promise<ProfilePhotoResponse | APIResponse> {
        const s3 = new AWS.S3({
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_ACCESS_KEY_SECRET
        });

        //console.log(request);

        await this.handleFile(request);


        let fileName = request.file.originalname;
        console.log(fileName);

        const extention = fileName.substr(fileName.lastIndexOf("."), fileName.length);

        fileName = request.user.id + "-" + Date.now() + extention;

        console.log(fileName);

        const uploadParams = {
            Body: request.file.buffer,
            Key: "images/" + fileName,
            Bucket: "ridebeepapp",
            ACL: "public-read"
        };

        try {
            const result = await s3.upload(uploadParams).promise();
            
            console.log("Upload Success", result.Location);

            if (result) {
                try {
                    const dbResult: WriteResult = await r.table("users").get(request.user.id).update({ photoUrl: result.Location }).run(database.getConn());
                    console.log(dbResult);

                    return {
                        status: APIStatus.Success,
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

    private handleFile(request: express.Request): Promise<any> {
        console.log(request);
        const multerSingle = multer({limits: { fieldSize: 25 * 1024 * 1024 }}).single("photo") as any;
        return new Promise((resolve, reject) => {
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