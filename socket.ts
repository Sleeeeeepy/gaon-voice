import { Context } from "./context";
import { Server, Socket } from 'socket.io';
import { DtlsParameters } from "mediasoup-client/lib/Transport";
import { RtpCapabilities, RtpParameters } from "mediasoup-client/lib/RtpParameters";

export function makeSocket(ctx: Context, svr: Server)  {
    // on connection
    svr.on("connection", (socket) => {
        configureClientSideSocket(ctx, svr, socket);
    });

    return svr;
}

function configureClientSideSocket(ctx: Context, svr: Server, sock: Socket) {
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
        sock.broadcast.emit("new_user", {userId: userId});
        sock.emit("join", ret);
        sock.data.userId = userId;
        sock.data.token = token;
        sock.data.roomId = roomId;
    });

    sock.on("userList", async (roomId: string, token: string) => {
        let ret = ctrl.userList(roomId, token);
        sock.emit("userList", [...ret]);
    });

    sock.on("roomList", () => {
        let ret = ctrl.roomList();
        sock.emit("roomList", [...ret]);
    });

    sock.on("createSendTransport", async (roomId: string, userId: number, type: any, token: string) => {
        let ret = await ctrl.createWebRTCTransport(roomId, userId, "Send", type, token);
        sock.emit("createSendTransport", ret);
    });

    sock.on("closeTransport", async (roomId: string, userId: number, transportId: string, token: string) => {
        let ret = await ctrl.closeTransport(roomId, userId, transportId, token);
        sock.emit("closeTransport", ret);
    });

    sock.on("connectTransport", async (roomId: string, userId: number, transportId: string, dtlsParameters: DtlsParameters, token: string) => {
        let ret = await ctrl.connectWebRTCTransport(roomId, userId, transportId, dtlsParameters, token);
        sock.emit("connectTransport", ret);
    });

    sock.on("sendTransport", async (roomId: string, userId: number, transportId: string, paused: boolean, type: any, kind: any, rtpParameters: RtpParameters, token: string) => {
        let ret = await ctrl.send(roomId, userId, transportId, paused, type, kind, rtpParameters, token);
        sock.emit("sendTransport", ret);
    });

    sock.on("receiveTransport", async (roomId: string, userId: number, transportId: string, mediaPeerId: number, type, rtpCapabilities: RtpCapabilities, token: string) => {
        let ret = await ctrl.receive(roomId, userId, transportId, mediaPeerId, type, rtpCapabilities, token);
        sock.emit("receiveTransport", ret);
    });

    sock.on("leave", async (roomId: string, userId: number, token: string) => {
        let ret = await ctrl.leave(roomId, userId, token);
        sock.emit("leave", ret);
        sock.broadcast.emit("user_leave", {userId: userId});
    });
}