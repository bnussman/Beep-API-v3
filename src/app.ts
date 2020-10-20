import express from "express";
import { RegisterRoutes } from "../build/routes";
import { connect } from "./utils/db";
//import { errorHandler } from "./utils/Error";
import { handleNotFound } from "./utils/404";

connect();

export const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

RegisterRoutes(app);

app.use(handleNotFound);

//app.use(errorHandler);
