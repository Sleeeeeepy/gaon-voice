import express from "express";
import * as config from "./config";
import * as hostConfig from "./hostConfig.json";
import http from "http";
import https from "https";
import { Context } from "./context";
import fs from "node:fs";
import { configureExpress } from "./express";
import { WorkerManager } from "./worker";
import bodyParser from 'body-parser';
import io from "socket.io";
import { configureServerSideSocket } from "./socket";

export async function main() {
    let workers = WorkerManager.init();
    let express = prepareExpress();
    let httpServer = initializeHttpServer(express);
    let socketServer = createSocketIOServer();
    let socketHttpServer = createSocketIOHttpServer();
    let ctx = new Context(workers, httpServer, express, socketServer, socketHttpServer);

    // run express server
    configureExpress(express, ctx);
    runHttpServer(ctx);

    // run socket server
    runSocketIOServer(ctx);

    process.on("SIGINT", handler);
    function handler(signal: NodeJS.Signals) {
        console.log("cleaning up WebRTC server...");
        ctx.http?.close();
        ctx.socketServer?.close();
        ctx.socketHttpServer?.close();
        ctx.rooms.forEach((value) => value.close());
        ctx.socketServer?.disconnectSockets();
        ctx.workers?.forEach((worker) => worker.close());
        console.log("bye");
        process.exit(0);
    }
}

function createSocketIOServer() {
    let server = new io.Server({connectTimeout: 10000}, {cors: {origin: hostConfig.socket["cors-origin"]}});
    return server;
}

function createSocketIOHttpServer() {
    let httpServer = http.createServer();
    return httpServer;
}

function runSocketIOServer(ctx: Context) {
    let server = ctx.socketServer;
    if (!server) {
        throw new Error("Failed to run socket server.");
    }

    server.on("connection", (socket) => {
        configureServerSideSocket(ctx, server!, socket);
    });

    let httpServer = ctx.socketHttpServer;
    if (!httpServer) {
        throw new Error("Failed to run http server.");
    }
    httpServer.listen(hostConfig.socket.port, hostConfig.socket.host);
    server.listen(httpServer);
    console.log(`socket.io server listening on port ${hostConfig.socket.port}`);
}

function prepareExpress() {
    let exp = express();
    exp.use(bodyParser.json());
    exp.use(bodyParser.urlencoded({extended: false}));
    return exp;
}

function set_heartbeat(timeout: number, ctx: Context) {
    if (timeout <= 1000) {
        console.log("heartbeat timeout is too fast.");
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
            console.error("failed to create https server. see below for more information.\n", err, "\ntrying to create http server...");
        }
    }

    try {
        httpServer = http.createServer(express);
    } catch (err) {
        console.error("failed to create http server. see below for more information.\n", err);
        process.exit(-1);
    }

    if (!httpServer) {
        throw new Error("failed to create http server.");
    }

    return httpServer;
}

function runHttpServer(ctx: Context) {
    ctx.http?.listen(hostConfig.express.port, hostConfig.express.host,() => print_server_info(ctx));
    console.log(`express server is listening on port ${hostConfig.express.port}`);
}

function print_server_info(ctx: Context) {
    console.log(`node version: ${process.versions.node}`);
    console.log(`numWorkers: ${config.numberOfWorkers}`);
    console.log(`http port: ${hostConfig.express.port}`);
    console.log(`express protocol: ${ctx.isHttps ? "https" : "http"}`)
    console.log(`socket port: ${hostConfig.socket.port}`);
}