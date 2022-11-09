import { Context } from "./context";
import Peer from "./peer";
import Room from "./room";
import * as config from "./config";
import { Producer, WebRtcTransport } from "mediasoup/node/lib/types";
import { Direction, MediaType } from "./type";
import { DtlsParameters } from "mediasoup-client/lib/Transport";
import { MediaKind, RtpCapabilities, RtpParameters } from "mediasoup-client/lib/RtpParameters";

export default class Controller {
    private context: Context;
    public constructor(context: Context) {
        this.context = context;
    }

    public userList(roomId: string, token?: string) {
        try {
            let room = this.getRoomOrThrow(roomId);
            return room.peerList;
        } catch (err) {
            throw err;
        }
    }

    public roomList(token?: string) {
        return this.context.rooms.keys();
    }

    public async join(roomId: string, userId: number, token?: string) {
        let room = this.context.rooms.get(roomId);
        let peer = new Peer(userId);

        if (!room) {
            room = new Room(roomId);
            room = await room.init();
            room.participate(peer);
            return room.rtpCapabilities;
        }
        else return room.rtpCapabilities;
    }

    public async createWebRTCTransport(roomId: string, userId: number, direction: keyof Direction, type?: keyof MediaType, token?: string) {
        try {
            let room = this.getRoomOrThrow(roomId);
            let user = this.getUserOrThrow(roomId, userId);

            let transport;
            if (direction == "Send") {
                transport = await room.createTransport(user.userId, "WebRtc", "Send", config.transportSetting) as WebRtcTransport;
            } else if (direction == "Recv") {
                transport = await room.createTransport(user.userId, "WebRtc", "Recv", config.transportSetting) as WebRtcTransport;
            } else {
                throw new Error(400, "direction is either \"Send\" or \"Recv\"");
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
            let user = this.getUserOrThrow(roomId, userId);
            user.closeTransport(transportId);
            return true;
        } catch (err) {
            throw err;
        }
    }

    public async connectWebRTCTransport(roomId: string, userId: number, transportId: string, dtlsParameters: DtlsParameters, token?: string) {
        try {
            let transport = this.getTransportOrThrow(roomId,userId, transportId) as WebRtcTransport;
            transport.connect({dtlsParameters});
            return true;
        } catch (err) {
            throw err;
        }
    }

    public async send(roomId: string, userId: number, transportId: string, paused: boolean, type: MediaType, kind: MediaKind, rtpParameters: RtpParameters, token?: string) {
        try {
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

    public async receive(roomId: string, userId: number, transportId: string, mediaPeerId: number, type: MediaType, rtpCapabilities: RtpCapabilities, token?: string) {
        let room = this.getRoomOrThrow(roomId);
        let mediaPeer = this.getUserOrThrow(roomId, userId);
        let producer: Producer | undefined;
        mediaPeer.producers.forEach((value, key) => {
            if (value.appData.type === type) {
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

    public async leave(roomId: string, userId: number, token?: string) {
        try {
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
            let consumer = this.getConsumerOrThrow(roomId, userId, consumerId);
            if (!consumer.paused) {
                consumer.pause();
            }
            return true;
        } catch (err)  {
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
}

class Error {
    public code: number;
    public message: string;
    public constructor(code: number, message: string) {
        this.code = code;
        this.message = message;
    }
}