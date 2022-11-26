import { Consumer, MediaKind, Producer } from "mediasoup/node/lib/types";
import Peer from "./peer";

export interface TransportType {
    Pipe: string;
    WebRtc: string;
    Direct: string;
    Plain: string;
}

export interface Direction {
    Send: string;
    Recv: string;
}

export interface MediaType {
    Screen: string,
    ScreenSound: string,
    Camera: string,
    Voice: string,
    Mobile: string, // unused
    MobileSound: string
}

export class PeerResult {
    public userId: number;
    public sendTransportId?: string;
    public mobileSendTransportId?: string;
    public transportIds: Array<string>;
    public producerIds: Array<ProducerResult>;
    public consumerIds: Array<ConsumerResult>;

    public constructor(peer: Peer) {
        this.userId = peer.userId;
        this.mobileSendTransportId = peer.mobileSendTransport?.id;
        this.sendTransportId = peer.sendTransport?.id;
        this.transportIds = new Array<string>();
        this.producerIds = new Array<ProducerResult>();
        this.consumerIds = new Array<ConsumerResult>();
        
        for (let transport of peer.recvTransports.values()) {
            this.transportIds.push(transport.id);
        }

        for (let producer of peer.producers.values()) {
            this.producerIds.push(new ProducerResult(producer));
        }

        for (let consumer of peer.consumers.values()) {
            this.consumerIds.push(new ConsumerResult(consumer));
        }
    }
}

export class ProducerResult {
    public producerId: string;
    public type: any;
    public kind: MediaKind;
    public constructor(producer: Producer) {
        this.producerId = producer.id;
        this.type = producer.appData.type
        this.kind = producer.kind;
    }
}

export class ConsumerResult {
    public consumerId: string;
    public type: any;
    public kind: MediaKind;
    public constructor(consumer: Consumer) {
        this.consumerId = consumer.id;
        this.type = consumer.appData.type
        this.kind = consumer.kind;
    }
}

export class Channel {
    public id: number;
    public projectId: number;
    public groupId: number;
    public name: string;
    public type: string;
    public createdBy: number;
    public bitRate: number;
    public maxConnect: number;

    public constructor(id: number, projectId: number, groupId: number, name: string, type: string, createdBy: number, bitRate: number, maxConnect: number) {
        this.id = id;
        this.projectId = projectId;
        this.groupId = groupId;
        this.name = name;
        this.type = type;
        this.createdBy = createdBy;
        this.bitRate = bitRate;
        this.maxConnect = maxConnect;
    }
}

export class ProjectPermission {
    public id: number;
    public projectId: number;
    public userId: number;
    public permission: number;

    public constructor(id: number, projectId: number, userId: number, permission: number) {
        this.id = id;
        this.projectId = projectId;
        this.userId = userId;
        this.permission = permission;
    }
}