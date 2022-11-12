import { Context } from "./context";
import { Server, Socket } from 'socket.io';
import { DtlsParameters } from "mediasoup-client/lib/Transport";
import { RtpCapabilities, RtpParameters } from "mediasoup-client/lib/RtpParameters";

export function makeSocket(ctx: Context, svr: Server)  {
    // on connection
    svr.on("connection", (socket) => {
        configureServerSideSocket(ctx, svr, socket);
    });

    return svr;
}

function configureServerSideSocket(ctx: Context, svr: Server, sock: Socket) {
    let ctrl = ctx.controller;
    sock.on("disconnect", async () => {
        let token = sock.data.token;
        let userId = sock.data.userId;
        let roomId = sock.data.roomId;
        await ctrl.leave(roomId, userId, token);
    });

    sock.on("join", async (roomId: string, userId: number, token: string) => {
        let ret = await ctrl.join(roomId, userId, token);
        // svr.emit("new_user", {userId: userId});
        await sock.join(roomId);
        sock.broadcast.emit("newUser", {userId: userId});
        sock.emit("joinRoom", ret);
        sock.data.userId = userId;
        sock.data.roomId = roomId;
    });

    sock.on("userList", async (roomId: string, token: string, callback) => {
        try {
            let ret = [...ctrl.userList(roomId)];
            callback(ret);
        } catch (err) {
            callback({error: err});
        }
    });

    sock.on("roomList", (callback) => {
        let ret =[...ctrl.roomList()];
        callback(ret);
    });

    sock.on("createSendTransport", async (roomId: string, userId: number, type: any, token: string, callback) => {
        try {
            let ret = await ctrl.createWebRTCTransport(roomId, userId, "Send", type, token);
            callback(ret);
        } catch (err) {
            callback({error: err});
            console.log(err);
        }
    });

    sock.on("createRecvTransport", async (roomId: string, userId: number, type: any, token: string, callback) => {
        try {
            let ret = await ctrl.createWebRTCTransport(roomId, userId, "Recv", type, token);
            callback(ret);
        } catch (err) {
            callback({error: err});
            console.log(err);
        }
    });

    sock.on("closeTransport", async (roomId: string, userId: number, transportId: string, token: string, callback) => {
        try {
            let ret = await ctrl.closeTransport(roomId, userId, transportId, token);
            callback(ret);
        } catch (err) {
            callback({error: err});
            console.log(err);
        }
    });

    sock.on("connectTransport", async (roomId: string, userId: number, transportId: string, dtlsParameters: DtlsParameters, token: string, callback) => {
        try {
            let ret = await ctrl.connectWebRTCTransport(roomId, userId, transportId, dtlsParameters, token);
            callback(ret);
        } catch (err) {
            callback({error: err});
            console.log(err);
        }
    });

    sock.on("sendTransport", async (roomId: string, userId: number, transportId: string, paused: boolean, type: any, kind: any, rtpParameters: RtpParameters, token: string, callback) => {
        try {
            let ret = await ctrl.send(roomId, userId, transportId, paused, type, kind, rtpParameters, token);
            callback(ret);
        } catch (err) {
            callback({error: err});
            console.log(err);
        }
    });

    sock.on("receiveTransport", async (roomId: string, userId: number, transportId: string, mediaPeerId: number, type, kind, rtpCapabilities: RtpCapabilities, token: string, callback) => {
        try {
            let ret = await ctrl.receive(roomId, userId, transportId, mediaPeerId, type, kind, rtpCapabilities, token);
            callback(ret);
        } catch (err) {
            callback({error: err});
            console.log(err);
        }
    });

    sock.on("leave", async (roomId: string, userId: number, token: string, callback) => {
        try {
            let ret = await ctrl.leave(roomId, userId, token);
            if (ret) {
                callback(ret);
                sock.broadcast.emit("userLeave", {userId: userId});
            }
        } catch (err) {
            callback(false);
            console.log(err);
        }
    });
}