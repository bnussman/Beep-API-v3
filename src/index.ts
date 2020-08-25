import { Application } from 'express';
import express = require('express');
import * as Auth from "./auth/routes";
import * as Account from "./account/routes";
import * as Rider from "./rider/routes";
import * as Beeper from "./beeper/routes";
import logger from  "./utils/logger";

const app: Application = express();
const port = 3001;

app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.disable('x-powered-by');

//------------------------------
//  API Endpoints
//------------------------------
app.use('/auth', Auth);
app.use('/account', Account);
app.use('/rider', Rider);
app.use('/beeper', Beeper);

//------------------------------
//  Start Web Server
//------------------------------
app.listen(port, () => console.log(`Beep API Server running on  http://localhost:${port}`))
