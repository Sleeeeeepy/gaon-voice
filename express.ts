import { Request, Response } from "express";
import * as config from "./config";
import Controller from "./controller";
import { Context } from "./context";
import { Express } from "express";

export function configureExpress(exp: Express, ctx: Context) {
    exp.get("/", (req, res) => {
        res.sendFile(__dirname + "/index.html");
    });
    exp.get("/client.bundle.js", (req, res) => {
        res.sendFile(__dirname + "/bundle/client.bundle.js" );
        console.log(`send dummy client to ${req.ip}`);
    });
    exp.post("/room/:roomId/user/:userId/kick", ExpressController.kick);  

    // send information to client for joining.
    exp.post("/room/:roomId/user/:userId/join", (req, res) => ExpressController.join(ctx.controller, req, res));
    exp.post("/room/:roomId/user/:userId/leave", (req, res) => ExpressController.leave(ctx.controller, req, res));
    exp.post("/rooms", (req, res) => ExpressController.roomList(ctx.controller, req, res));
    exp.post("/room/:roomId/users", (req, res) => ExpressController.userList(ctx.controller, req, res));
    exp.post("/room/:roomId/user/:userId/transport/create/:direction", (req, res) => ExpressController.createTransport(ctx.controller, req, res));
    exp.post("/room/:roomId/user/:userId/transport/:transportId/connect", (req, res) => ExpressController.connect(ctx.controller, req, res));
    exp.post("/room/:roomId/user/:userId/transport/:transportId/close", (req, res) => ExpressController.closeTransport(ctx.controller, req, res));
    exp.post("/room/:roomId/user/:userId/transport/:transportId/recv/:mediaPeerId", (req, res) => ExpressController.receive(ctx.controller, req, res));
    exp.post("/room/:roomId/user/:userId/transport/:transportId/send", (req, res) => ExpressController.send(ctx.controller, req, res));
    exp.post("/room/:roomId/user/:userId/consume/:consumerId/pause", (req, res) => ExpressController.pauseConsumer(ctx.controller, req, res));
    exp.post("/room/:roomId/user/:userId/produce/:producerId/pause", (req, res) => ExpressController.pauseProducer(ctx.controller, req, res));
    exp.post("/room/:roomId/user/:userId/consume/:consumerId/resume", (req, res) => ExpressController.resumeConsumer(ctx.controller, req, res)); 
    exp.post("/room/:roomId/user/:userId/produce/:producerId/resume", (req, res) => ExpressController.resumeProducer(ctx.controller, req, res)); 
    exp.post("/room/:roomId/user/:userId/consume/:consumerId/close", (req, res) => ExpressController.closeConsumer(ctx.controller, req, res));
    exp.post("/room/:roomId/user/:userId/produce/:producerId/close", (req, res) => ExpressController.closeProducer(ctx.controller, req, res));
    
    // heartbeat
    exp.post("/heartbeat/:userId", (req, res) => ExpressController.heartbeat(ctx, req, res));
}

export default class ExpressController {
    public static userList(ctrl: Controller, req: Request, res: Response) {
        const { roomId } = req.params;
        let response = ctrl.userList(roomId);

        res.status(200).json({peer: [...response]});
    }

    public static roomList(ctrl: Controller, req: Request, res: Response) {
        let response = ctrl.roomList();
        res.status(200).json({room: [...response]});
    }

    public static async join(ctrl: Controller, req: Request, res: Response) {
        const { roomId } = req.params;
        const userId = Number.parseInt(req.params.userId);
        const token = req.headers['x-access-token'] as string;
        let rtpCapabilities = await ctrl.join(roomId, userId, token);
        res.status(200).json({routerRtpCapabilities: rtpCapabilities});
    }

    public static async createTransport(ctrl: Controller, req: Request, res: Response) {
        try {
            let { userId, roomId, direction } = req.params;
            let token = req.headers['x-access-token'] as string;
            //@ts-ignore
            let response = await ctrl.createWebRTCTransport(roomId, parseInt(userId), direction, token);
            res.status(200).json(response);
            console.log(`===new transport===\nuserId=${userId}}\nroomI=d${roomId}\ntype=${direction}\ntransportId=${response.transportId}`);
        } catch (err) {
            console.log(err);
            res.status(500).json("Failed to create transport.");
        }
    }
    
    public static async closeTransport(ctrl: Controller, req: Request, res: Response) {
        let { userId, roomId, transportId } = req.params;
        let token = req.headers['x-access-token'] as string;
        try {
            let closed = await ctrl.closeTransport(roomId, parseInt(userId), transportId, token);
            res.status(200).json({closed: closed});
        } catch (err) {
            res.status(500).json({closed: false});
        }
        
        
        console.log(`===close transport===\nuserId=${userId}}\nroomId=${roomId}transportId=${transportId}`);
    }

    public static async connect(ctrl: Controller, req: Request, res: Response) {
        try {
            let { userId, roomId, transportId } = req.params;
            let { dtlsParameters } = req.body;
            let token = req.headers['x-access-token'] as string;
            let connected = await ctrl.connectWebRTCTransport(roomId, parseInt(userId), transportId, dtlsParameters, token);
            res.status(200).json({connect: connected});
            console.log(`===connect transport===\nuserId=${userId}\nroomId=${roomId}transportId=${transportId}`);
        } catch (err) {
            console.log(err);
            res.status(500).json({connect: false});
        }
    }

    public static async send(ctrl: Controller, req: Request, res: Response) {
        try {
            let { userId, transportId, roomId } = req.params;
            let paused = (req.body.paused === "true");
            let type = req.body.type;
            let kind = req.body.kind;
            let rtpParameters = req.body.rtpParameters;
            let token = req.headers['x-access-token'] as string;
            let response = await ctrl.send(roomId, parseInt(userId), transportId, paused, type, kind, rtpParameters, token);
            res.json({id: response.id});
            console.log(`===send===\nuserId=${userId}\nroomId=${roomId}\ntransportId=${transportId}\ntype=${type}\nkind=${kind}`);
        } catch (err) {
            res.status(500).json("Failed to create producer.");
            console.log(err);
        }
    }

    public static async receive(ctrl: Controller, req: Request, res: Response) {
        try {
            const { userId, roomId, transportId, mediaPeerId } = req.params;
            const { type, kind, rtpCapabilities } = req.body;
            const token = req.headers['x-access-token'] as string;
            let response = await ctrl.receive(roomId, parseInt(userId), transportId, parseInt(mediaPeerId), type, kind, rtpCapabilities, token);
            res.status(200).json(response);
            console.log(`===recv===\nuserId=${userId}\nroomId=${roomId}\ntransportId=${transportId}\ntype=${type}\nkind=${response.kind}\nmediaPeer=${mediaPeerId}`);
        } catch (err) {
            res.status(500).json(err);
            console.log(err);
        }
    }

    public static async kick(ctrl: Controller, req: Request, res: Response) {
        const victimId = Number.parseInt(req.params.userId);
        const roomId = req.params.roomId;
        const adminId = Number.parseInt(req.body.adminId);
        const token = req.headers['x-access-token'] as string;
        try {
            await ctrl.kick(roomId, adminId, victimId, token);
            res.status(200).json({kicked:true});
        } catch (err) {
            res.status(500).json(err);
        }
        
    }

    public static async leave(ctrl: Controller, req: Request, res: Response) {
        const userId = Number.parseInt(req.params.userId);
        const roomId = req.params.roomId;
        const token = req.headers['x-access-token'] as string;

        try {
            let result = await ctrl.leave(roomId, userId, token);
            res.status(200).json({leave: result});
        } catch (err) {
            console.log(err);
            res.status(200).json({leave: false});
        }
        
    }

    /// TODO: 작동하도록 수정
    public static heartbeat(ctx: Context, req: Request, res: Response) {
        const userId = Number.parseInt(req.params.userId);
        let now = new Date();
        let peer = undefined;

        if (peer) {
            //peer.lastResponse = now;
            res.status(200).json({status: 200, interval: config.pingInterval});
            return;
        }
        res.status(504).json({status: 504});
    }

    public static async closeProducer(ctrl: Controller, req: Request, res: Response) {
        let {producerId, userId, roomId} = req.params;
        const token = req.headers['x-access-token'] as string;

        try {
            let closed = ctrl.closeProducer(roomId, parseInt(userId), producerId, token);
            res.status(200).json({closed: closed});
        } catch (err) {
            console.log(err);
            res.status(500).json({closed: false});
        }
    }

    public static async resumeProducer(ctrl: Controller, req: Request, res: Response) {
        let {producerId, userId, roomId} = req.params;
        const token = req.headers['x-access-token'] as string;

        try {
            let resumed = ctrl.resumeProducer(roomId, parseInt(userId), producerId, token);
            res.status(200).json({resumed: resumed});
        } catch (err) {
            console.log(err);
            res.status(500).json({resumed: false});
        }
    }

    public static async pauseProducer(ctrl: Controller, req: Request, res: Response) {
        let {producerId, userId, roomId} = req.params;
        const token = req.headers['x-access-token'] as string;

        try {
            let paused = ctrl.pauseProducer(roomId, parseInt(userId), producerId, token);
            res.status(200).json({paused: paused});
        } catch (err) {
            console.log(err);
            res.status(500).json({paused: false});
        }
    }

    public static async closeConsumer(ctrl: Controller, req: Request, res: Response) {
        let {consumerId, userId, roomId} = req.params;
        const token = req.headers['x-access-token'] as string;

        try {
            let closed = ctrl.closeConsumer(roomId, parseInt(userId), consumerId, token);
            res.status(200).json({closed: closed});
        } catch (err) {
            console.log(err);
            res.status(500).json({closed: false});
        }
    }

    public static async resumeConsumer(ctrl: Controller, req: Request, res: Response) {
        let {consumerId, userId, roomId} = req.params;
        const token = req.headers['x-access-token'] as string;

        try {
            let resumed = ctrl.resumeConsumer(roomId, parseInt(userId), consumerId, token);
            res.status(200).json({resumed: resumed});
        } catch (err) {
            console.log(err);
            res.status(500).json({resumed: false});
        }
    }

    public static async pauseConsumer(ctrl: Controller, req: Request, res: Response) {
        let {consumerId, userId, roomId} = req.params;
        const token = req.headers['x-access-token'] as string;

        try {
            let paused = ctrl.pauseConsumer(roomId, parseInt(userId), consumerId, token);
            res.status(200).json({paused: paused});
        } catch (err) {
            console.log(err);
            res.status(500).json({paused: false});
        }
    }

    private static checkToken(userId: number, token: string) {
        return true;
    }
}