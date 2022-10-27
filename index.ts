import express from "express";
import mediasoup from "mediasoup";
import * as config from "./config";
import http from "http";
import https from "https";
import { Context, CurrentContext } from "./context";
import fs from "node:fs";
import ExpressController from "./express";
import { WorkerManager } from "./worker";
import bodyParser from 'body-parser';
import Peer from "./peer";
import Room from "./room";
main();

async function main() {
    let ctx = CurrentContext.getInstance();

    WorkerManager.init();
    let exp = express();
    exp.use(bodyParser.json());
    exp.use(bodyParser.urlencoded({extended: false}));
    exp.get("/", (req, res) => {
        res.sendFile(__dirname + "/index.html");
        
    });
    exp.get("/client.bundle.js", (req, res) => {
        res.sendFile(__dirname + "/bundle/client.bundle.js" );
        console.log(`send dummy client to ${req.ip}`);
    });
    exp.post("/room/:roomId/user/:userId/kick", ExpressController.kick);  

    // send information to client for joining.
    exp.post("/room/:roomId/user/:userId/join", ExpressController.join); // OK
    exp.post("/room/:roomId/user/:userId/leave", ExpressController.leave); // OK
    exp.post("/rooms", ExpressController.roomList); // OK
    exp.post("/room/:roomId/users", ExpressController.userList); // OK
    exp.post("/room/:roomId/user/:userId/transport/create/:type", ExpressController.createTransport) // OK
    exp.post("/room/:roomId/user/:userId/transport/:transportId/connect", ExpressController.connect); // OK
    exp.post("/room/:roomId/user/:userId/transport/:transportId/close", ExpressController.closeTransport);
    exp.post("/room/:roomId/user/:userId/transport/:transportId/recv/:mediaPeerId", ExpressController.receive); // OK
    exp.post("/room/:roomId/user/:userId/transport/:transportId/send", ExpressController.send); // OK
    exp.post("/room/:roomId/user/:userId/consume/:consumerId/pause", ExpressController.pauseConsumer); // OK
    exp.post("/room/:roomId/user/:userId/produce/:producerId/pause", ExpressController.pauseProducer); // OK
    exp.post("/room/:roomId/user/:userId/consume/:consumerId/resume", ExpressController.resumeConsumer); // OK
    exp.post("/room/:roomId/user/:userId/produce/:producerId/resume", ExpressController.resumeProducer); // OK
    exp.post("/room/:roomId/user/:userId/consume/:consumerId/close", ExpressController.closeConsumer); // OK
    exp.post("/room/:roomId/user/:userId/produce/:producerId/close", ExpressController.closeProducer); // OK

    // heartbeat
    exp.post("/heartbeat/:userId", ExpressController.heartbeat);
    ctx.express = exp;

    initializeContext();
    initializeHttpServer(ctx);
    runHttpServer(ctx);
    //set_heartbeat(config.heartbeatTimeout, ctx);
}

function initializeContext() {
    let ctx = CurrentContext.getInstance();
    ctx.peers = new Map<number, Peer>();
    ctx.rooms = new Map<string, Room>();
}

function set_heartbeat(timeout: number, ctx: Context) {
    if (timeout <= 1000) {
        console.log("heatbeat timeout is too fast.");
        process.exit(-1);
    }

    setTimeout(() => {
        let now = new Date();
        for (let peer of ctx.peers.values()) {
            if ((now.getMilliseconds() - peer.lastResponse.getMilliseconds()) > timeout) {
                peer.close();
                ctx.peers.delete(peer.userId);
            }
        }
    }, timeout);
}

function initializeHttpServer(ctx: Context) {
    if (config.ssl.startAsHttps) {
        let crt, key;
        try {
            crt = fs.readFileSync(config.ssl.path.crt);
            key = fs.readFileSync(config.ssl.path.key);
            ctx.http = https.createServer({
                key: key,
                cert: crt
            }, ctx.express);
            ctx.isHttps = true;
            return;
        } catch (err) {
            console.error("failed to create https server. see below for more informations.\n", err, "\ntrying to create http server...");
        }
    }

    try {
        ctx.http = http.createServer(ctx.express);
        ctx.isHttps = false;
    } catch (err) {
        console.error("failed to create http server. see below for more informations.\n", err);
        process.exit(-1);
    }
}

function runHttpServer(ctx: Context) {
    ctx.http?.listen(config.httpPort, config.httpHost,() => print_server_info());
    console.log(`express server is listening on port ${config.httpPort}`);
}

function print_server_info() {
    let ctx = CurrentContext.getInstance();
    console.log(`node version: ${process.versions.node}`);
    console.log(`numWorkers: ${config.numberOfWorkers}`);
    console.log(`http port: ${config.httpPort}`);
    console.log(`express protocol: ${ctx.isHttps ? "https" : "http"}`)
    //console.log(`socket port: ${config.socketPort}`);
}