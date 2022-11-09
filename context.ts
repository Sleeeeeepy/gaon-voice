import http from "http";
import https from "https";
import { Worker } from "./worker";
import { Express } from "express";
import Room from "./room";
import Peer from "./peer";
import Controller from "./controller";

export class Context {
    private readonly _workers?: Array<Worker> | undefined;
    private readonly _http?: http.Server | https.Server | undefined;
    private readonly _express?: Express | undefined;
    private readonly _rooms: Map<string, Room>;
    private readonly _isHttps: boolean;
    private readonly _controller: Controller;

    public constructor(workers: Array<Worker>, httpServer: http.Server | https.Server, express: Express) {
        this._workers = workers;
        this._http = httpServer;
        this._express = express;
        this._rooms = new Map<string, Room>();
        this._isHttps = httpServer instanceof https.Server;
        this._controller = new Controller(this);
    }

    public get workers(): Array<Worker> | undefined {
        return this._workers;
    }

    public get http(): http.Server | https.Server | undefined {
        return this._http;
    }

    public get express(): Express | undefined {
        return this._express;
    }

    public get rooms(): Map<string, Room> {
        return this._rooms;
    }

    public get isHttps() {
        return this._isHttps;
    }

    public get controller() {
        return this._controller;
    }
}