import express, { Express } from "express";
import * as config from "./config";
import http from "http";
import https from "https";
import { Context } from "./context";
import fs from "node:fs";
import { configureExpress } from "./express";
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