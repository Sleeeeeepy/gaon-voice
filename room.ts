import { AudioLevelObserver } from "mediasoup/node/lib/AudioLevelObserver";
import { ConsumerOptions } from "mediasoup/node/lib/Consumer";
import { DirectTransportOptions } from "mediasoup/node/lib/DirectTransport";
import { PipeTransportOptions } from "mediasoup/node/lib/PipeTransport";
import { PlainTransportOptions } from "mediasoup/node/lib/PlainTransport";
import { ProducerOptions } from "mediasoup/node/lib/Producer";
import { Router } from "mediasoup/node/lib/Router";
import { WebRtcTransportOptions } from "mediasoup/node/lib/WebRtcTransport";
import { Worker } from "./worker";
import * as config from "./config";
import Peer from "./peer";
import { Direction, TransportType } from "./type";
import { WorkerManager } from "./worker";
import { CurrentContext } from "./context";

export default class Room {
    private _roomId: string;
    private peers: Map<number, Peer>;
    private _router?: Router;
    private _worker?: Worker;
    private _audioLevelObserver?: AudioLevelObserver;
    private _isInitalized: boolean;

    public constructor(roomId: string) {
        this._roomId = roomId;
        this.peers = new Map<number, Peer>();
        if (!config.audioLevelObserver.interval) {
            throw new Error("Failed to create AudioLevelObserver. check the configuration file.")
        }
        this._worker = WorkerManager.getIdleWorker();
        this._isInitalized = false;
    }

    public async init() {
        let worker = this._worker?.worker;
        if (!worker) {
            throw new Error("Failed to initalize worker");
        }
        this._router = await worker.createRouter({mediaCodecs: config.mediaCodecs});
        let observer = await this._router?.createAudioLevelObserver({interval: config.audioLevelObserver.interval});
        this._audioLevelObserver = observer;
        if (this._worker) {
            WorkerManager.markRunning(this._worker);
        }
        this._isInitalized = true;
        return this;
    }

    public get router() {
        return this._router;
    }

    public get audioLevelObserver() {
        return this._audioLevelObserver;
    }

    public getNumUser() {
        return this.peers.size;
    }

    public async createConsumer(peerId: number, transportId: string, options: ConsumerOptions) {
        if (!this._isInitalized) throw new Error("room is not initalized."); 
        if (!this._router) throw new Error("Failed to create consumer.");
        let peer = this.peers.get(peerId);
        if (!peer) {
            throw new Error(`The user ${peerId} does not exist in the room ${this._roomId}.`);
        }
        return peer.createConsumer(this._router, transportId, options);
    }

    public async createProducer(peerId: number, transportId: string, options: ProducerOptions) {
        if (!this._isInitalized) throw new Error("room is not initalized."); 
        if (!this._router) throw new Error("Failed to create producer.");
        let peer = this.peers.get(peerId);
        if (!peer) {
            throw new Error(`The user ${peerId} does not exist in the room ${this._roomId}.`);
        }
        return peer.createProducer(this._router, transportId, options);
    }

    public async createTransport(peerId: number, kind: keyof TransportType, direction: keyof Direction, transportSetting: DirectTransportOptions | WebRtcTransportOptions | PipeTransportOptions | PlainTransportOptions, appData?: Record<string, unknown>) {
        if (!this._isInitalized) throw new Error("room is not initalized."); 
        if (!this._router) throw new Error("Failed to create transport.");
        let peer = this.peers.get(peerId);
        if (!peer) {
            throw new Error(`The user ${peerId} does not exist in the room ${this._roomId}.`);
        }
        return peer.createTransport(this._router, kind, direction, transportSetting, appData);
    }

    public participate(peer: Peer) {
        if (!this._isInitalized) throw new Error("room is not initalized."); 
        this.peers.set(peer.userId, peer);
        peer.onClose = () => {
            this.deletePeer(peer.userId);
            let ctx = CurrentContext.getInstance();
            ctx.peers.delete(peer.userId);
        }
    }

    public disconnect(peerId: number) {
        if (!this._isInitalized) throw new Error("room is not initalized."); 
       let peer = this.peers.get(peerId);
       if (peer) {
            this.deletePeer(peerId);
       }
       
       if (!peer?.closed) {
            peer?.close();  
       }
    }

    private deletePeer(peerId: number) {
        this.peers.delete(peerId);
    }

    public get roomId(): string {
        return this._roomId;
    }

    public get rtpCapabilities() {
        if (!this._router) return undefined;
        return this._router.rtpCapabilities;
    }

    public close() {
        this.peers.forEach((p) => {
            p.close();
            this.deletePeer(p.userId);
        });

        if (this._router) {
            this._router.close();    
        }

        if (this._worker) {
            WorkerManager.markIdle(this._worker);
        }
    }
    
    public get peerList() {
        return this.peers.values();
    }

    public getUser(userId: number) {
        return this.peers.get(userId);
    }
}
