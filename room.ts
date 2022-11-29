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
import { Channel, Direction, TransportType } from "./type";
import { WorkerManager } from "./worker";

export default class Room {
    private _roomId: string;
    private peers: Map<number, Peer>;
    private _router?: Router;
    private _worker?: Worker;
    private _audioLevelObserver?: AudioLevelObserver;
    private _isInitialized: boolean;
    private _channel?: Channel;

    public constructor(channel?: Channel) {
        this._roomId = channel?.id.toString() ?? "1";
        this.peers = new Map<number, Peer>();
        if (!config.audioLevelObserver.interval) {
            throw new Error("Failed to create AudioLevelObserver. check the configuration file.")
        }
        this._worker = WorkerManager.getIdleWorker();
        this._isInitialized = false;
        this._channel = channel;
    }

    public static async init(channel?: Channel) {
        let room = new Room(channel);

        let worker = room._worker?.worker;
        if (!worker) {
            throw new Error("Failed to initialize worker");
        }
        room._router = await worker.createRouter({mediaCodecs: config.mediaCodecs});
        let observer = await room._router?.createAudioLevelObserver({interval: config.audioLevelObserver.interval});
        room._audioLevelObserver = observer;
        if (room._worker) {
            WorkerManager.markRunning(room._worker);
        }
        room._isInitialized = true;
        return room;
    }

    public get channelName() {
        if (this._channel) {
            return this._channel.name;
        }
        return "undefined";
    }
    
    public get projectId() {
        return this._channel?.projectId;
    }

    public get router() {
        return this._router;
    }

    public get audioLevelObserver() {
        return this._audioLevelObserver;
    }

    public get size() {
        return this.peers.size;
    }

    public async createConsumer(peerId: number, transportId: string, options: ConsumerOptions) {
        if (!this._isInitialized) throw new Error("room is not initialized."); 
        if (!this._router) throw new Error("Failed to create consumer.");
        let peer = this.peers.get(peerId);
        if (!peer) {
            throw new Error(`The user ${peerId} does not exist in the room ${this._roomId}.`);
        }
        return peer.createConsumer(this._router, transportId, options);
    }

    public async createProducer(peerId: number, transportId: string, options: ProducerOptions) {
        if (!this._isInitialized) throw new Error("room is not initialized."); 
        if (!this._router) throw new Error("Failed to create producer.");
        let peer = this.peers.get(peerId);
        if (!peer) {
            throw new Error(`The user ${peerId} does not exist in the room ${this._roomId}.`);
        }
        return peer.createProducer(this._router, transportId, options);
    }

    public async createTransport(peerId: number, transportType: keyof TransportType, direction: keyof Direction, transportSetting: DirectTransportOptions | WebRtcTransportOptions | PipeTransportOptions | PlainTransportOptions) {
        if (!this._isInitialized) throw new Error("room is not initialized."); 
        if (!this._router) throw new Error("Failed to create transport.");
        let peer = this.peers.get(peerId);
        if (!peer) {
            throw new Error(`The user ${peerId} does not exist in the room ${this._roomId}.`);
        }
        return peer.createTransport(this._router, transportType, direction, transportSetting);
    }

    public async createMobileTransport(peerId: number, transportType: keyof TransportType, direction: keyof Direction, transportSetting: DirectTransportOptions | WebRtcTransportOptions | PipeTransportOptions | PlainTransportOptions) {
        if (!this._isInitialized) throw new Error("room is not initialized."); 
        if (!this._router) throw new Error("Failed to create transport.");
        let peer = this.peers.get(peerId);
        if (!peer) {
            throw new Error(`The user ${peerId} does not exist in the room ${this._roomId}.`);
        }
        return peer.createMobileTransport(this._router, transportType, direction, transportSetting);
    }
    
    public participate(peer: Peer) {
        if (!this._isInitialized) throw new Error("room is not initialized."); 
        if (this.peers.has(peer.userId)) return;
        this.peers.set(peer.userId, peer);
        peer.onClose = () => {
            this.deletePeer(peer.userId);
        }
    }

    public disconnect(peerId: number) {
        if (!this._isInitialized) throw new Error("room is not initialized."); 
        let peer = this.peers.get(peerId);
        if (peer) {
            this.deletePeer(peerId);
        }
       
        if (!peer?.closed) {
            peer?.close();  
        }
        console.log(this.peerList);
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
