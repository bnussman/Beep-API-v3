"use strict";
exports.__esModule = true;
exports.connHistory = exports.connQueues = exports.conn = exports.connect = void 0;
var r = require("rethinkdb");
var host = "192.168.1.116";
var port = 28015;
var conn;
exports.conn = conn;
var connQueues;
exports.connQueues = connQueues;
var connHistory;
exports.connHistory = connHistory;
function connect() {
    r.connect(getConnectionOptions("beep")).then(function (connection) {
        console.log("Connected to Beep DB");
        exports.conn = conn = connection;
    })["catch"](function (error) { return console.error(error); });
    r.connect(getConnectionOptions("beepQueues")).then(function (connection) {
        console.log("Connected to BeeQueues DB");
        exports.connQueues = connQueues = connection;
    })["catch"](function (error) { return console.error(error); });
    r.connect(getConnectionOptions("beepHistory")).then(function (connection) {
        console.log("Connected to BeepHistory DB");
        exports.connHistory = connHistory = connection;
    })["catch"](function (error) { return console.error(error); });
}
exports.connect = connect;
function getConnectionOptions(databaseName) {
    return {
        host: host,
        port: port,
        db: databaseName
    };
}
