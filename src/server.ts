import "reflect-metadata";
import BeepAPIServer from "./app";

const server = new BeepAPIServer();
const app = server.getApp();
const port = process.env.PORT || 3001;

app.listen(port, () => {
    console.log(`Beep API listening at http://0.0.0.0:${port}`);
});
