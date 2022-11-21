import { Context } from "./context";
import Peer from "./peer";
import Room from "./room";
import * as config from "./config";
import { Producer, WebRtcTransport } from "mediasoup/node/lib/types";
import { Direction, MediaType, PeerResult } from "./type";
import { DtlsParameters } from "mediasoup-client/lib/Transport";
import { MediaKind, RtpCapabilities, RtpParameters } from "mediasoup-client/lib/RtpParameters";
import { getChannel, getPermission, getUserToken } from "./database";
import crypto from "node:crypto";

export default class Controller {
    private context: Context;

    public constructor(context: Context) {
        this.context = context;
    }

    public userList(roomId: string) {
        try {
            let room = this.getRoomOrThrow(roomId);
            let ret = new Array<PeerResult>();
            for (let peer of room.peerList) {
                let result = new PeerResult(peer);
                ret.push(result);
            }
            return ret;
        } catch (err) {
            throw err;
        }
    }

    public roomList() {
        return this.context.rooms.keys();
    }

    public async join(roomId: string, userId: number, token?: string) {
        let room = this.context.rooms.get(roomId);
        let peer = new Peer(userId);

        if (!this.auth(userId, token)) {
            throw new Error(401, "Failed to authentication.");
        }

        if (!room) {
            //let channel = await getChannel(parseInt(roomId));
            room = new Room(roomId);
            room = await room.init();
            room.participate(peer);
            return room.rtpCapabilities;
        }
        else return room.rtpCapabilities;
    }

    public async createWebRTCTransport(roomId: string, userId: number, direction: keyof Direction, token?: string) {
        try {
            if (!this.auth(userId, token)) {
                throw new Error(401, "Failed to authentication.");
            }
            let room = this.getRoomOrThrow(roomId);
            let user = this.getUserOrThrow(roomId, userId);

            let transport;
            if (direction === "Send") {
                transport = await room.createTransport(user.userId, "WebRtc", "Send", config.transportSetting) as WebRtcTransport;
            } else if (direction === "Recv") {
                transport = await room.createTransport(user.userId, "WebRtc", "Recv", config.transportSetting) as WebRtcTransport;
            } else {
                throw new Error(400, "direction can be either \"Send\" or \"Recv\"");
            }

            return {
                transportId: transport.id,
                iceParameters: transport?.iceParameters,
                iceCandidates: transport?.iceCandidates,
                dtlsParameters: transport?.dtlsParameters
            };
        } catch (err) {
            throw err;
        }
    }

    public async closeTransport(roomId: string, userId: number, transportId: string, token?: string) {
        try {
            if (!this.auth(userId, token)) {
                throw new Error(401, "Failed to authentication.");
            }
            let user = this.getUserOrThrow(roomId, userId);
            user.closeTransport(transportId);
            return true;
        } catch (err) {
            throw err;
        }
    }

    public async connectWebRTCTransport(roomId: string, userId: number, transportId: string, dtlsParameters: DtlsParameters, token?: string) {
        try {
            if (!this.auth(userId, token)) {
                throw new Error(401, "Failed to authentication.");
            }
            let transport = this.getTransportOrThrow(roomId,userId, transportId) as WebRtcTransport;
            transport.connect({dtlsParameters});
            return true;
        } catch (err) {
            throw err;
        }
    }

    public async send(roomId: string, userId: number, transportId: string, paused: boolean, type: MediaType, kind: MediaKind, rtpParameters: RtpParameters, token?: string) {
        try {
            if (!this.auth(userId, token)) {
                throw new Error(401, "Failed to authentication.");
            }
            let room = this.getRoomOrThrow(roomId);
            let producer = await room.createProducer(userId, transportId, {
                kind: kind,
                rtpParameters: rtpParameters,
                paused: paused,
                appData: {
                    type: type
                }
            });

            if (!producer) {
                throw new Error(500, "Failed to create producer.");
            }

            if (producer.kind === 'audio') {
                room.audioLevelObserver?.addProducer({producerId: producer.id});
            }

            return producer;
        } catch (err) {
            throw err;
        }
    }

    public async receive(roomId: string, userId: number, transportId: string, mediaPeerId: number, type: MediaType, kind: MediaKind, rtpCapabilities: RtpCapabilities, token?: string) {
        if (!this.auth(userId, token)) {
            throw new Error(401, "Failed to authentication.");
        }
        let room = this.getRoomOrThrow(roomId);
        let mediaPeer = this.getUserOrThrow(roomId, mediaPeerId);
        let producer: Producer | undefined;
        mediaPeer.producers.forEach((value, key) => {
            if (value.appData.type === type && value.kind === kind) {
                producer = value;
            }
        });

        if (!producer) {
            throw new Error(404, `no producer`);
        }

        if (!room.router?.canConsume({
            producerId: producer.id,
            rtpCapabilities: rtpCapabilities
        })) {
            throw new Error(500, `can't consume`);
        }

        let consumer = await room.createConsumer(userId, transportId, {
            rtpCapabilities: rtpCapabilities,
            producerId: producer.id,
            appData: { type },
            paused: true
        });

        if (!consumer) {
            throw new Error(500, "Failed to create consumer.");
        }

        return {
            producerId: producer.id,
            consumerId: consumer.id,
            rtpParameters: consumer.rtpParameters,
            type: consumer.type,
            producerPaused: consumer.producerPaused,
            kind: consumer.kind,
            mediaType: type
        };
    }

    public async invitePhone(roomId: string, userId: number, token?: string) {
        try {
            let found = false;
            while (!found) {
                let random = crypto.randomInt(100_000, 999_999);
                if (this.context.mobileInvite.has(random))  {
                    continue;
                }
                this.context.mobileInvite.set(random, {roomId: parseInt(roomId), userId: userId});
                found = true;
            }
        } catch (err) {
            throw err;
        }
    }

    public async acceptInvite(inviteId: number) {
        let invite = this.context.mobileInvite.get(inviteId);
        try {
            if (!invite) {
                throw new Error(404, "failed to accept invite.");
            }
            
            let room = this.getRoomOrThrow(invite.roomId.toString());
            return room.rtpCapabilities;
        } catch (err) {
            throw err;
        }
    }

    public async leave(roomId: string, userId: number, token?: string) {
        try {
            if (!this.auth(userId, token)) {
                throw new Error(401, "Failed to authentication.");
            }
            let room = this.getRoomOrThrow(roomId);
            let user = this.getUserOrThrow(roomId, userId);
            user.close();
            if (room.size === 0) {
                room.close();
            }
            return true;
        } catch (err) {
            throw err;
        }
    }

    public async closeProducer(roomId: string, userId: number, producerId: string, token?: string) {
        try {
            if (!this.auth(userId, token)) {
                throw new Error(401, "Failed to authentication.");
            }
            let producer = this.getProducerOrThrow(roomId, userId, producerId);
            if (!producer.closed) {
                producer.close();
            }
            return true;
        } catch (err) {
            throw err;
        }
    }

    public async resumeProducer(roomId: string, userId: number, producerId: string, token?: string) {
        try {
            if (!this.auth(userId, token)) {
                throw new Error(401, "Failed to authentication.");
            }
            let producer = this.getProducerOrThrow(roomId, userId, producerId);
            if (producer.paused) {
                producer.resume();
            }
            return true;
        } catch (err) {
            throw err;
        }
    }

    public async pauseProducer(roomId: string, userId: number, producerId: string, token?: string) {
        try {
            if (!this.auth(userId, token)) {
                throw new Error(401, "Failed to authentication.");
            }
            let producer = this.getProducerOrThrow(roomId, userId, producerId);
            if (!producer.paused) {
                producer.pause();
            }
            return true;
        } catch (err) {
            throw err;
        }
    }

    public async closeConsumer(roomId: string, userId: number, consumerId: string, token?: string) {
        try {
            if (!this.auth(userId, token)) {
                throw new Error(401, "Failed to authentication.");
            }
            let consumer = this.getConsumerOrThrow(roomId, userId, consumerId);
            if (!consumer.closed) {
                consumer.close();
            }
            return true;
        } catch (err)  {
            throw err;
        }
    }

    public async resumeConsumer(roomId: string, userId: number, consumerId: string, token?: string) {
        try {
            if (!this.auth(userId, token)) {
                throw new Error(401, "Failed to authentication.");
            }
            let consumer = this.getConsumerOrThrow(roomId, userId, consumerId);
            if (consumer.paused) {
                consumer.resume();
            }
            return true;
        } catch (err)  {
            throw err;
        }
    }

    public async pauseConsumer(roomId: string, userId: number, consumerId: string, token?: string) {
        try {
            if (!this.auth(userId, token)) {
                throw new Error(401, "Failed to authentication.");
            }
            let consumer = this.getConsumerOrThrow(roomId, userId, consumerId);
            if (!consumer.paused) {
                consumer.pause();
            }
            return true;
        } catch (err)  {
            throw err;
        }
    }

    public async kick(roomId: string, adminId: number, victimId: number, adminToken: string) {
        try {
            if (!await this.auth(adminId, adminToken)) {
                throw new Error(401, "Failed to authentication.");
            }

            if (!await this.permission(adminId, parseInt(roomId))) {
                throw new Error(401, "Failed to authentication.");
            }

            let user = this.getUserOrThrow(roomId, victimId);
            user.close();
        } catch (err) {
            throw err;
        }
    }

    public async mute(roomId: string, adminId: number, victimId: number, adminToken: string) {
        try {

        } catch (err) {
            throw err;
        }
    }

    public async unmute(roomId: string, adminId: number, victimId: number, adminToken: string) {
        try {

        } catch (err) {
            throw err;
        }
    }

    private getRoomOrThrow(roomId: string) {
        let room = this.context.rooms.get(roomId);
        if (!room) {
            throw new Error(404, `The room ${roomId} does not exist.`);
        }
        return room;
    }

    private getUserOrThrow(roomId: string, userId: number) {
        try {
            let room = this.getRoomOrThrow(roomId);
            let user = room.getUser(userId)
            if (!user) {
                throw new Error(404, `The user ${userId} does not exist in the room ${roomId}`);
            }
            return user;
        } catch (err) {
            throw err;
        }
    }

    private getTransportOrThrow(roomId: string, userId: number, transportId: string) {
        try {
            let user = this.getUserOrThrow(roomId, userId);
            let transport = user.getTransport(transportId);
            if (!transport) {
                throw new Error(404, `The transport ${transportId} of the user ${userId} does not exist in the room ${roomId}`);
            }
            return transport;
        } catch (err) {
            throw err;
        }
    }

    private getProducerOrThrow(roomId: string, userId: number, producerId: string) {
        try {
            let user = this.getUserOrThrow(roomId, userId);
            let producer = user.getProducer(producerId);
            if (!producer) {
                throw new Error(404, `The producer ${producerId} of the user ${userId} does not exist in the room ${roomId}`);
            }
            return producer;
        } catch (err)  {
            throw err;
        }
    }

    private getConsumerOrThrow(roomId: string, userId: number, consumerId: string) {
        try {
            let user = this.getUserOrThrow(roomId, userId);
            let consumer = user.getConsumer(consumerId);
            if (!consumer) {
                throw new Error(404, `The consumer ${consumerId} of the user ${userId} does not exist in the room ${roomId}`);
            }
            return consumer;
        } catch (err)  {
            throw err;
        }
    }

    private async auth(userId: number, token?: string) {
        try {
            return await getUserToken(userId) === token;
        } catch (err) {
            return false;
        }
    }

    private async permission(userId: number, roomId: number) {
        try {
            return await getPermission(userId, roomId);
        } catch (err) {
            return false;
        }
    }
}

class Error {
    public code: number;
    public message: string;
    public constructor(code: number, message: string) {
        this.code = code;
        this.message = message;
    }
}