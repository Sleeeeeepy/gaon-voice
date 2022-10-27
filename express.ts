import { Request, Response } from "express";
import { CurrentContext } from "./context";
import Peer from "./peer";
import * as config from "./config";
import { DtlsParameters, WebRtcTransport } from "mediasoup/node/lib/WebRtcTransport";
import Room from "./room";
import { Direction } from "./type";
import { Producer } from "mediasoup/node/lib/Producer";
import { ContextExclusionPlugin } from "webpack";

export default class ExpressController {
    private static ctx = CurrentContext.getInstance();

    public static userList(req: Request, res: Response) {
        const { roomId } = req.params;
        let room = ExpressController.ctx.rooms.get(roomId);
        if (!room) {
            res.status(404).json("404");
            return;
        }

        res.status(200).json({peer: [...room.peerList]});
    }

    public static roomList(req: Request, res: Response) {
        res.status(200).json({room: [...ExpressController.ctx.rooms.keys()]});
    }

    public static async join(req: Request, res: Response) {
        const { roomId } = req.params;
        const userId = Number.parseInt(req.params.userId);
        let room = ExpressController.ctx.rooms.get(roomId);
        let peer = new Peer(userId, req.ip, "");
        ExpressController.ctx.peers.set(userId, peer);
        if (!room) {
            room = new Room(roomId);
            ExpressController.ctx.rooms.set(roomId, room);
            room.init().then(() => {
                if (room) {
                    room.participate(peer);
                    res.status(200).json({routerRtpCapabilities: room.rtpCapabilities});
                    return;
                }
            });
        } else {
            res.status(200).json({routerRtpCapabilities: room.rtpCapabilities});
        }
    }

    public static async createTransport(req: Request, res: Response) {
        try {
            let { userId, roomId, type } = req.params;
            let room = ExpressController.ctx.rooms.get(roomId);
            if (!room) {
                res.status(404).json("no room");
                return;
            }
            
            let user = room.getUser(Number.parseInt(userId));
            if (!user) {
                res.status(404).json("no user");
                return;
            }
            let transport;
            type = type.toLowerCase();
            if (type == "send") {
                transport = await room.createTransport(user.userId, "WebRtc", "Send", config.transportSetting) as WebRtcTransport;
            } else if (type == "recv") {
                transport = await room.createTransport(user.userId, "WebRtc", "Recv", config.transportSetting) as WebRtcTransport;
            } else {
                throw new Error("Failed to create transport. invaild type.");
            }

            res.status(200).json({
                transportId: transport?.id,
                iceParameters: transport?.iceParameters,
                iceCandidates: transport?.iceCandidates,
                dtlsParameters: transport?.dtlsParameters
            });
            console.log(`===new transport===\nuserId=${userId}}\nroomI=d${roomId}\ntype=${type}\ntransportId=${transport?.id}`);
        } catch (err) {
            console.log(err);
            res.status(500).json("Failed to create transport.");
        }
    }
    
    public static async closeTransport(req: Request, res: Response) {
        let { userId, roomId, transportId } = req.params;
        let room = ExpressController.ctx.rooms.get(roomId);
        if (!room) {
            res.status(404).json("no room");
            return;
        }
        
        let user = room.getUser(Number.parseInt(userId));
        if (!user) {
            res.status(404).json("no user");
            return;
        }
        user.closeTransport(transportId);
        res.json(200).json("200");
        console.log(`===close transport===\nuserId=${userId}}\nroomId=${roomId}transportId=${transportId}`);
    }

    public static async connect(req: Request, res: Response) {
        try {
            let { userId, roomId, transportId } = req.params;
            let { dtlsParameters } = req.body;
            
            let room = ExpressController.ctx.rooms.get(roomId);
            if (!room) {
                res.status(404).json("no room");
                return;
            }
            
            let user = room.getUser(Number.parseInt(userId));
            if (!user) {
                res.status(404).json("no user");
                return;
            }
    
            let transport = user.getTransport(transportId);
            if (!transport) {
                res.status(404).json("no transport");
                return;
            }
            //console.log(dtlsParameters, JSON.stringify(dtlsParameters));
            // @ts-ignore
            transport.connect({dtlsParameters});
            res.status(200).json("connected.");
            console.log(`===connect transport===\nuserId=${userId}\nroomId=${roomId}transportId=${transportId}`);
        } catch (err) {
            console.log(err);
            res.status(500).json("Failed to connect transport");
        }
    }

    public static async send(req: Request, res: Response) {
        try {
            let { userId, transportId, roomId } = req.params;
            let paused = (req.body.paused === "true");
            let type = req.body.type;
            let kind = req.body.kind;
            let rtpParameters = req.body.rtpParameters;
            let room = ExpressController.ctx.rooms.get(roomId);

            if (!room) {
                res.status(404).json("no room");
                return;
            }
            
            let user = room.getUser(Number.parseInt(userId));
            if (!user) {
                res.status(404).json("no user");
                return;
            }
    
            let transport = user.getTransport(transportId);
            if (!transport) {
                res.status(404).json("no transport");
                return;
            }

            let producer = await room.createProducer(user.userId, transportId, {
                // @ts-ignore
                kind: kind,
                rtpParameters,
                paused,
                appData: {
                    type: type
                }
            });

            if (!producer) {
                throw new Error("Failed to create producer.");
            }

            if (producer.kind === 'audio') {
                room.audioLevelObserver?.addProducer({producerId: producer.id});
            }
            res.json({id: producer.id});
            console.log(`===send===\nuserId=${userId}\nroomId=${roomId}\ntransportId=${transportId}\ntype=${type}\nkind=${kind}`);
        } catch (err) {
            res.status(500).json("Failed to create producer.");
            console.log(err);
        }
    }

    public static async receive(req: Request, res: Response) {
        try {
            let { userId, roomId, transportId, mediaPeerId } = req.params;
            let { type, rtpCapabilities } = req.body;
            let room = ExpressController.ctx.rooms.get(roomId);
            if (!room) {
                res.status(404).json("no room");
                return;
            }
            
            let mediaPeer = room.getUser(Number.parseInt(mediaPeerId));
            if (!mediaPeer) {
                res.status(404).json("no user");
                return;
            }

            let producer: Producer | undefined;
            mediaPeer.producers.forEach((value, key) => {
                if (value.appData.type === type) {
                    producer = value;
                }
            });

            if (!producer) {
                throw new Error("no producer");
            }
            
            if (!room.router?.canConsume({
                producerId: producer.id,
                rtpCapabilities: rtpCapabilities
            })) {
                throw new Error("can't consume");
            }

            let consumer = await room.createConsumer(Number.parseInt(userId), transportId, {
                rtpCapabilities: rtpCapabilities,
                producerId: producer.id,
                appData: type,
                paused: true
            });

            if (!consumer) {
                throw new Error("Failed to create consumer.");
            }
            res.status(200).json({
                producerId: producer.id,
                consumerId: consumer.id,
                rtpParameters: consumer.rtpParameters,
                type: consumer.type,
                producerPaused: consumer.producerPaused,
                kind: consumer.kind,
                mediaType: type
            });
            console.log(`===recv===\nuserId=${userId}\nroomId=${roomId}\ntransportId=${transportId}\ntype=${type}\nkind=${consumer.kind}\nmediaPeer=${mediaPeerId}`);
        } catch (err) {
            res.status(500).json(err);
            console.log(err);
        }
    }

    public static kick(req: Request, res: Response) {
        const userId = Number.parseInt(req.params.userId);
        const roomId = req.params.roomId;

        let room = ExpressController.ctx.rooms.get(roomId);
        let user;
        if (!room?.peerList) {
            res.status(404).json("no room");
            return;
        }

        for (let peer of room?.peerList) {
            if (peer.userId === userId) {
                user = peer;
            }
        }

        if (!user) {
            res.status(404).json("no user");
            return;
        }
        // TODO: Vaildation admin
        ExpressController.ctx.rooms.get(roomId)?.disconnect(userId);
    }

    public static leave(req: Request, res: Response) {
        const userId = Number.parseInt(req.params.userId);
        const roomId = req.params.roomId;

        let room = ExpressController.ctx.rooms.get(roomId);
        if (!room) {
            res.status(404).json("404");
            return;
        }

        room.getUser(userId)?.close();
        res.status(200).json("leave");
    }

    public static heartbeat(req: Request, res: Response) {
        const userId = Number.parseInt(req.params.userId);
        let now = new Date();
        let peer = ExpressController.ctx.peers.get(userId);

        if (peer) {
            peer.lastResponse = now;
            res.status(200).json({status: 200, interval: config.pingInterval});
            return;
        }
        res.status(504).json({status: 504});
    }

    public static async closeProducer(req: Request, res: Response) {
        let {producerId, userId, roomId} = req.params;
        let room = ExpressController.ctx.rooms.get(roomId);
        let user = room?.getUser(Number.parseInt(userId));
        let producer = user?.getProducer(producerId);

        if (!producer) {
            res.status(404).json("Failed to close.");
        } else {
            user?.closeProducer(producerId);
            res.status(200).json("closed");
        }
    }

    public static async closeConsumer(req: Request, res: Response) {
        let {consumerId, userId, roomId} = req.params;
        let room = ExpressController.ctx.rooms.get(roomId);
        let user = room?.getUser(Number.parseInt(userId));
        let consumer = user?.getConsumer(consumerId);

        if (!consumer) {
            res.status(404).json("Failed to close.");
        } else {
            user?.closeConsumer(consumerId);
            res.status(200).json("closed");
        }
    }

    public static async resumeConsumer(req: Request, res: Response) {
        let {consumerId, userId, roomId} = req.params;
        let room = ExpressController.ctx.rooms.get(roomId);
        let user = room?.getUser(Number.parseInt(userId));
        let consumer = user?.getConsumer(consumerId);

        if (!consumer) {
            res.status(404).json("Failed to resume.");
        } else {
            user?.resumeConsumer(consumerId);
            res.status(200).json("resumed");
        }
    }

    public static async pauseConsumer(req: Request, res: Response) {
        let {consumerId, userId, roomId} = req.params;
        let room = ExpressController.ctx.rooms.get(roomId);
        let user = room?.getUser(Number.parseInt(userId));
        let consumer = user?.getConsumer(consumerId);

        if (!consumer) {
            res.status(404).json("Failed to pause.");
        } else {
            user?.pauseConsumer(consumerId);
            res.status(200).json("paused");
        }
    }

    public static async resumeProducer(req: Request, res: Response) {
        let {producerId, userId, roomId} = req.params;
        let room = ExpressController.ctx.rooms.get(roomId);
        let user = room?.getUser(Number.parseInt(userId));
        let producer = user?.getProducer(producerId);

        if (!producer) {
            res.status(404).json("Failed to resume.");
        } else {
            user?.resumeProducer(producerId);
            res.status(200).json("resumed");
        }
    }

    public static async pauseProducer(req: Request, res: Response) {
        let {producerId, userId, roomId} = req.params;
        let room = ExpressController.ctx.rooms.get(roomId);
        let user = room?.getUser(Number.parseInt(userId));
        let producer = user?.getProducer(producerId);

        if (!producer) {
            res.status(404).json("Failed to pause.");
        } else {
            user?.pauseProducer(producerId);
            res.status(200).json("paused");
        }
    }

    private static checkToken(userId: number, token: string) {
        return true;
    }
}