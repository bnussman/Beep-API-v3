import BeepAPIServer from "./app";
import database from "./utils/db";

const server = new BeepAPIServer();
const app = server.getApp();
const port = process.env.PORT || 3001;

database.connect(function() {
    app.listen(port, () => {
        console.log(`Beep API listening at http://0.0.0.0:${port}`);
    });
});
