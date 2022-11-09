import express, { Express } from "express";
import * as config from "./config";
import http from "http";
import https from "https";
import { Context } from "./context";
import fs from "node:fs";
import ExpressController from "./express";
import { WorkerManager } from "./worker";
import bodyParser from 'body-parser';
main();

async function main() {
    let workers = WorkerManager.init();
    let express = prepareExpress();
    let httpServer = initializeHttpServer(express);
    let ctx = new Context(workers, httpServer, express);
    configureExpress(express, ctx);
    runHttpServer(ctx);
}

function configureExpress(exp: Express, ctx: Context) {
    exp.get("/", (req, res) => {
        res.sendFile(__dirname + "/index.html");
    });
    exp.get("/client.bundle.js", (req, res) => {
        res.sendFile(__dirname + "/bundle/client.bundle.js" );
        console.log(`send dummy client to ${req.ip}`);
    });
    exp.post("/room/:roomId/user/:userId/kick", ExpressController.kick);  

    // send information to client for joining.
    exp.post("/room/:roomId/user/:userId/join", (req, res) => ExpressController.join(ctx.controller, req, res)); // OK
    exp.post("/room/:roomId/user/:userId/leave", (req, res) => ExpressController.leave(ctx.controller, req, res)); // OK
    exp.post("/rooms", (req, res) => ExpressController.roomList(ctx.controller, req, res)); // OK
    exp.post("/room/:roomId/users", (req, res) => ExpressController.userList(ctx.controller, req, res)); // OK
    exp.post("/room/:roomId/user/:userId/transport/create/:type", (req, res) => ExpressController.createTransport(ctx.controller, req, res)) // OK
    exp.post("/room/:roomId/user/:userId/transport/:transportId/connect", (req, res) => ExpressController.connect(ctx.controller, req, res)); // OK
    exp.post("/room/:roomId/user/:userId/transport/:transportId/close", (req, res) => ExpressController.closeTransport(ctx.controller, req, res));
    exp.post("/room/:roomId/user/:userId/transport/:transportId/recv/:mediaPeerId", (req, res) => ExpressController.receive(ctx.controller, req, res)); // OK
    exp.post("/room/:roomId/user/:userId/transport/:transportId/send", (req, res) => ExpressController.send(ctx.controller, req, res)); // OK
    exp.post("/room/:roomId/user/:userId/consume/:consumerId/pause", (req, res) => ExpressController.pauseConsumer(ctx.controller, req, res)); // OK
    exp.post("/room/:roomId/user/:userId/produce/:producerId/pause", (req, res) => ExpressController.pauseProducer(ctx.controller, req, res)); // OK
    exp.post("/room/:roomId/user/:userId/consume/:consumerId/resume", (req, res) => ExpressController.resumeConsumer(ctx.controller, req, res)); // OK
    exp.post("/room/:roomId/user/:userId/produce/:producerId/resume", (req, res) => ExpressController.resumeProducer(ctx.controller, req, res)); // OK
    exp.post("/room/:roomId/user/:userId/consume/:consumerId/close", (req, res) => ExpressController.closeConsumer(ctx.controller, req, res)); // OK
    exp.post("/room/:roomId/user/:userId/produce/:producerId/close", (req, res) => ExpressController.closeProducer(ctx.controller, req, res)); // OK
    
    // heartbeat
    exp.post("/heartbeat/:userId", (req, res) => ExpressController.heartbeat(ctx, req, res));
}

function prepareExpress() {
    let exp = express();
    exp.use(bodyParser.json());
    exp.use(bodyParser.urlencoded({extended: false}));
    return exp;
}

function set_heartbeat(timeout: number, ctx: Context) {
    if (timeout <= 1000) {
        console.log("heatbeat timeout is too fast.");
        process.exit(-1);
    }

    //setTimeout(() => {
    //    let now = new Date();
    //    for (let peer of ctx.peers.values()) {
    //        if ((now.getMilliseconds() - peer.lastResponse.getMilliseconds()) > timeout) {
    //            peer.close();
    //            ctx.peers.delete(peer.userId);
    //        }
    //    }
    //}, timeout);
}

function initializeHttpServer(express: any) {
    let httpServer;
    if (config.ssl.startAsHttps) {
        let crt, key;
        try {
            crt = fs.readFileSync(config.ssl.path.crt);
            key = fs.readFileSync(config.ssl.path.key);
            httpServer = https.createServer({
                key: key,
                cert: crt
            }, express);
            return httpServer;
        } catch (err) {
            console.error("failed to create https server. see below for more informations.\n", err, "\ntrying to create http server...");
        }
    }

    try {
        httpServer = http.createServer(express);
    } catch (err) {
        console.error("failed to create http server. see below for more informations.\n", err);
        process.exit(-1);
    }

    if (!httpServer) {
        throw new Error("failed to create http server.");
    }

    return httpServer;
}

function runHttpServer(ctx: Context) {
    ctx.http?.listen(config.httpPort, config.httpHost,() => print_server_info(ctx));
    console.log(`express server is listening on port ${config.httpPort}`);
}

function print_server_info(ctx: Context) {
    console.log(`node version: ${process.versions.node}`);
    console.log(`numWorkers: ${config.numberOfWorkers}`);
    console.log(`http port: ${config.httpPort}`);
    console.log(`express protocol: ${ctx.isHttps ? "https" : "http"}`)
    console.log(`socket port: ${config.socketPort}`);
}