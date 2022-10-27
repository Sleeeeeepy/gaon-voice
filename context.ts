import http from "http";
import https from "https";
import { Worker } from "mediasoup/node/lib/types";
import { Express } from "express";
import Room from "./room";
import Peer from "./peer";

export interface Context {
    workers?: Array<Worker>;
    http?: http.Server | https.Server;
    express?: Express;
    rooms: Map<string, Room>;
    peers: Map<number, Peer>;
    isHttps: boolean;
}

export class CurrentContext {
    private static _context: Context;

    public static getInstance() {
        if (this._context === null || this._context === undefined) {
            return {
                workers: new Array<Worker>(),
                http: undefined,
                express: undefined,
                rooms: new Map<string, Room>(),
                peers: new Map<number, Peer>(),
                isHttps: false
            } as Context;
            //throw new Error("Empty context");
        }
        return this._context;
    }

    //public static set context(context: Context) {
    //    CurrentContext._context = context;
    //}
}