import { AudioLevelObserver, AudioLevelObserverOptions } from "mediasoup/node/lib/AudioLevelObserver";
import { Consumer, ConsumerOptions } from "mediasoup/node/lib/Consumer";
import { DirectTransport, DirectTransportOptions } from "mediasoup/node/lib/DirectTransport";
import { PipeTransport, PipeTransportOptions } from "mediasoup/node/lib/PipeTransport";
import { PlainTransport, PlainTransportOptions } from "mediasoup/node/lib/PlainTransport";
import { Producer, ProducerOptions } from "mediasoup/node/lib/Producer";
import { Router } from "mediasoup/node/lib/Router";
import { WebRtcTransport, WebRtcTransportOptions } from "mediasoup/node/lib/WebRtcTransport";
import Room from "./room";
import { Direction, TransportType } from "./type";

export default class Peer {
    private _userId: number;
    private _ip?: string;
    private _date: Date;
    private _lastResponse: Date;
    private _rtpCapabilities?: number;
    private _sendTransports: Map<string, DirectTransport | WebRtcTransport | PipeTransport | PlainTransport>;
    private _recvTransports: Map<string, DirectTransport | WebRtcTransport | PipeTransport | PlainTransport>;
    private _producers: Map<string, Producer>;
    private _consumers: Map<string, Consumer>;
    private _audioLevelObservers?: AudioLevelObserver;
    private _closed: boolean;
    private _token?: string;
    private _callback?: () => void;
    
    public constructor(userId: number, ip?: string, token?: string, audioLevelObserver?: AudioLevelObserver) {
        this._userId = userId;
        this._ip = ip;
        this._date = new Date(); 
        this._lastResponse = new Date();
        this._sendTransports = new Map<string, DirectTransport | WebRtcTransport | PipeTransport | PlainTransport>();
        this._recvTransports = new Map<string, DirectTransport | WebRtcTransport | PipeTransport | PlainTransport>();
        this._producers = new Map<string, Producer>;
        this._consumers = new Map<string, Consumer>;
        this._closed = false;
        this._token = token;
        this._audioLevelObservers = audioLevelObserver;
    }

    public get userId() {
        return this._userId;
    }

    public get ip() {
        return this._ip;
    }

    public get rtpCapabilities() {
        return this._rtpCapabilities;
    }

    public get closed() {
        return this._closed;
    }

    public get date() {
        return this._date;
    }

    public get lastResponse() {
        return this._lastResponse;
    }

    public set lastResponse(date: Date) {
        this._lastResponse = date;
    }

    public get token() {
        if (this._token) {
            return this.token;
        }
        else return "";
    }

    public set token(token: string) {
        this._token = token;
    }

    public async createTransport(router: Router, kind: keyof TransportType, direction: keyof Direction, transportSetting: DirectTransportOptions | WebRtcTransportOptions | PipeTransportOptions | PlainTransportOptions, appData?: Record<string, unknown>) {
        if (!transportSetting.appData && appData) {
            transportSetting.appData = appData;
        }
        let transport;
        switch (kind) {
            case "Direct":
                transport = await router.createDirectTransport(transportSetting as DirectTransportOptions);
                break;
            case "Pipe":
                transport = await router.createPipeTransport(transportSetting as PipeTransportOptions);
                break;
            case "Plain":
                transport = await router.createPlainTransport(transportSetting as PlainTransportOptions);
                break;
            case "WebRtc":
                transport = await router.createWebRtcTransport(transportSetting as WebRtcTransportOptions);
                break;
        }

        if (direction == "Recv") {
            this._recvTransports.set(transport.id, transport);
        } else if (direction == "Send") {
            this._sendTransports.set(transport.id, transport);
        } else {
            throw new Error("undefined direction.");
        }
        return transport;
    }

    public async createConsumer(router: Router, transportId: string, options: ConsumerOptions) {
        let producerId = options.producerId;
        if (!router.canConsume(options)) {
            throw new Error("fail to create consumer.");
        }

        let transport = this._recvTransports.get(transportId);
        if (!transport) {
            throw new Error(`no such transport ${transportId}`);
        }

        let consumer = await transport.consume({
            producerId: producerId,
            rtpCapabilities: options.rtpCapabilities,
            paused: true
        });

        consumer.on("transportclose", () => {
            this.closeConsumer(consumer.id);
        });

        consumer.on("producerclose", () => {
            this.closeConsumer(consumer.id);
        });

        this._consumers.set(consumer.id, consumer);
        console.log(`new consumer ${consumer.id}`);
        return consumer;
    }

    public async createProducer(router: Router, transportId: string, options: ProducerOptions) {
        let transport = this._sendTransports.get(transportId);
        if (!transport) {
            throw new Error(`no such transport ${transportId}`);
        }

        let producer = await transport.produce(options);
        producer.on("transportclose", () => {
            this.closeProducer(producer.id);
        });

        if (this._audioLevelObservers) {
            this._audioLevelObservers.addProducer({producerId: producer.id});
        }

        this._producers.set(producer.id, producer);
        console.log(`new producer ${producer.id}`);
        return producer;
    }

    public pauseConsumer(consumerId: string) {
        let consumer = this._consumers.get(consumerId);
        if (consumer && !consumer.paused) {
            consumer.pause();
            console.log(`[pause] consumer ${consumerId}`);
        }
    }

    public pauseProducer(producerId: string) {
        let producer = this._producers.get(producerId);
        if (producer && !producer.paused) {
            producer.pause();
            console.log(`[pause] producer ${producerId}`);
        }
    }

    public resumeConsumer(consumerId: string) {
        let consumer = this._consumers.get(consumerId);
        if (consumer && consumer.paused) {
            consumer.resume();
            console.log(`[resume] consumer ${consumerId}`);
        }
    }

    public resumeProducer(producerId: string) {
        let producer = this._producers.get(producerId);
        if (producer && producer.paused) {
            producer.resume();
            console.log(`[resume] producer ${producerId}`);
        }
    }

    public closeTransport(transportId: string) {
        let transport = this._sendTransports.get(transportId);
        if (transport) {
            transport.close();
            this._sendTransports.delete(transportId);
        }
    }

    public closeConsumer(consumerId: string) {
        let consumer = this._consumers.get(consumerId);
        if (consumer) {
            consumer.close();
            this._consumers.delete(consumerId);
        }
    }

    public closeProducer(producerId: string) {
        let producer = this._producers.get(producerId);
        if (producer) {
            producer.close();
            this._producers.delete(producerId);
        }
    }

    public close() {
        if (this._closed) return;

        //this._producers.forEach((p) => {
        //    p.close();
        //});
//
        //this._consumers.forEach((c) => {
        //    c.close();
        //});

        this._sendTransports.forEach((t) => {
            t.close();
        });
        
        this._recvTransports.forEach((t) => {
            t.close();
        });

        this._closed = true;
        if (this._callback) {
            this._callback();
        }
    }

    public getSendTransport(transportId: string) {
        return this._sendTransports.get(transportId);
    }

    public getRecvTransport(transportId: string) {
        return this._recvTransports.get(transportId);
    }

    public getTransport(transportId: string) {
        let sendTransport = this._sendTransports.get(transportId);
        if (sendTransport) {
            return sendTransport;
        }

        let recvTransport = this._recvTransports.get(transportId);
        if (recvTransport) {
            return recvTransport;
        }

        return undefined;
    }

    public getProducer(producerId: string) {
        return this._producers.get(producerId);
    }

    public getConsumer(consumerId: string) {
        return this._consumers.get(consumerId);
    }

    public get sendTransports() {
        return this._sendTransports;
    }

    public get recvTransports() {
        return this._recvTransports;
    }

    public get producers() {
        return this._producers;
    }

    public get consumers() {
        return this._consumers;
    }

    public set onClose(callback: () => void | undefined) {
        this._callback = callback;
    }
}