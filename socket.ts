import { Context } from "./context";
import { Server, Socket } from 'socket.io';
import { DtlsParameters } from "mediasoup-client/lib/Transport";
import { RtpCapabilities, RtpParameters } from "mediasoup-client/lib/RtpParameters";

export function configureServerSideSocket(ctx: Context, svr: Server, sock: Socket) {
    let ctrl = ctx.controller;
    sock.on("disconnect", async () => {
        let token = sock.data.token;
        let userId = sock.data.userId;
        let roomId = sock.data.roomId;
        await ctrl.leave(roomId, userId, token);
    });

    sock.on("join", async (roomId: string, userId: number, token: string, callback) => {
        let ret = await ctrl.join(roomId, userId, token);
        await sock.join(roomId);
        sock.broadcast.emit("newUser", {userId: userId});
        sock.data.userId = userId;
        sock.data.roomId = roomId;
        callback(ret);
    });

    sock.on("userList", async (roomId: string, token: string, callback) => {
        try {
            let ret = [...ctrl.userList(roomId)];
            callback(ret);
        } catch (err) {
            callback({error: err});
            console.log(err);
        }
    });

    sock.on("roomList", (callback) => {
        let ret =[...ctrl.roomList()];
        callback(ret);
    });

    // TODO: 검증 로직 추가 (이미 해당 유저가 Transport를 가지고 있는 것은 아닌지?)
    sock.on("createSendTransport", async (roomId: string, userId: number, token: string, callback) => {
        try {
            let ret = await ctrl.createWebRTCTransport(roomId, userId, "Send", token);
            callback(ret);

            sock.broadcast.emit("establishNewSendTransport", userId, roomId);
        } catch (err) {
            callback({error: err});
            console.log(err);
        }
    });

    sock.on("createRecvTransport", async (roomId: string, userId: number, token: string, callback) => {
        try {
            let ret = await ctrl.createWebRTCTransport(roomId, userId, "Recv", token);
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