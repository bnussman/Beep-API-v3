import express from "express";
import { RegisterRoutes } from "../build/routes";
import { connect } from "./utils/db";
//import { errorHandler } from "./utils/Error";
import { handleNotFound } from "./utils/404";
import cors from "cors";

connect();

export const app = express();

app.use(cors());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

RegisterRoutes(app);

app.use(handleNotFound);

//app.use(errorHandler);
