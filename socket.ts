import { Context } from "./context";
import { Server, Socket } from 'socket.io';
import { DtlsParameters } from "mediasoup-client/lib/Transport";
import { MediaKind, RtpCapabilities, RtpParameters } from "mediasoup-client/lib/RtpParameters";
import { MediaType } from "./type";

export function configureServerSideSocket(ctx: Context, svr: Server, sock: Socket) {
    let ctrl = ctx.controller;
    sock.on("disconnect", async () => {
        try {
            let token = sock.data.token;
            let userId = sock.data.userId;
            let roomId = sock.data.roomId;
            if (!roomId) {
                throw new Error("Invalid parameter roomId");
            } else {
                roomId = roomId.toString();
            }
            let isMobile = sock.data.type === "Mobile";
            if (isMobile) {
                await ctrl.closeMobile(roomId, userId);
                return;
            }
            await ctrl.leave(roomId, userId, token);
            sock.broadcast.emit("userLeave", {userId: userId});
        } catch (err) {
            console.log(err);
        }
    });

    sock.on("join", async (roomId: string, userId: number, token: string, callback) => {
        try {
            if (!roomId) {
                throw new Error("Invalid parameter roomId");
            } else {
                roomId = roomId.toString();
            }
            let ret = await ctrl.join(roomId, userId, token);
            await sock.join(roomId);
            sock.broadcast.emit("newUser", {userId: userId});
            sock.data.userId = userId;
            sock.data.roomId = roomId;
            sock.data.type = "PC";
            callback(ret);
        } catch (err) {
            callback({error: err});
            console.log(err);
        }
    });

    sock.on("silentJoin", async (roomId: string, userId: number, token: string, callback) => {
        try {
            if (!roomId) {
                throw new Error("Invalid parameter roomId");
            } else {
                roomId = roomId.toString();
            }
            let ret = ctrl.silentJoin(roomId, userId, token);
            await sock.join(roomId);
            sock.data.userId = userId;
            sock.data.roomId = roomId;
            sock.data.type = "PC";
            sock.data.silence = true;
            callback(ret);
        } catch (err) {
            callback({error: err});
            console.log(err);
        }
    });
    
    sock.on("userList", async (roomId: string, token: string, callback) => {
        try {
            if (!roomId) {
                throw new Error("Invalid parameter roomId");
            } else {
                roomId = roomId.toString();
            }
            let ret = ctrl.userList(roomId);
            callback(ret);
        } catch (err) {
            callback({error: err});
            console.log(err);
        }
    });

    // sock.on("roomList", (callback) => {
    //     try {
    //         let ret =[...ctrl.roomList()];
    //         callback(ret);
    //     } catch (err) {
    //         callback({error: err});
    //         console.log(err);
    //     }
    // });

    // TODO: 검증 로직 추가 (이미 해당 유저가 Transport를 가지고 있는 것은 아닌지?)
    sock.on("createSendTransport", async (roomId: string, userId: number, token: string, callback) => {
        try {
            if (!roomId) {
                throw new Error("Invalid parameter roomId");
            } else {
                roomId = roomId.toString();
            }
            let ret = await ctrl.createWebRTCTransport(roomId, userId, "Send", "Browser", token);
            callback(ret);

            sock.broadcast.emit("establishNewSendTransport", userId, roomId);
        } catch (err) {
            callback({error: err});
            console.log(err);
        }
    });

    sock.on("createRecvTransport", async (roomId: string, userId: number, token: string, callback) => {
        try {
            if (!roomId) {
                throw new Error("Invalid parameter roomId");
            } else {
                roomId = roomId.toString();
            }
            let ret = await ctrl.createWebRTCTransport(roomId, userId, "Recv", "Browser", token);
            callback(ret);
        } catch (err) {
            callback({error: err});
            console.log(err);
        }
    });

    sock.on("createMobileSendTransport", async (roomId: string, userId: number, callback) => {
        try {
            if (!roomId) {
                throw new Error("Invalid parameter roomId");
            } else {
                roomId = roomId.toString();
            }
            let ret = await ctrl.createWebRTCTransport(roomId, userId, "Send", "Mobile");
            callback(ret);

            sock.broadcast.emit("establishNewSendTransport", userId, roomId);
        } catch (err) {
            callback({error: err});
            console.log(err);
        }
    });

    sock.on("closeTransport", async (roomId: string, userId: number, transportId: string, token: string, callback) => {
        try {
            if (!roomId) {
                throw new Error("Invalid parameter roomId");
            } else {
                roomId = roomId.toString();
            }
            let ret = await ctrl.closeTransport(roomId, userId, transportId, token);
            callback(ret);
        } catch (err) {
            callback({error: err});
            console.log(err);
        }
    });

    sock.on("connectTransport", async (roomId: string, userId: number, transportId: string, dtlsParameters: DtlsParameters, token: string, callback) => {
        try {
            if (!roomId) {
                throw new Error("Invalid parameter roomId");
            } else {
                roomId = roomId.toString();
            }
            let ret = await ctrl.connectWebRTCTransport(roomId, userId, transportId, dtlsParameters, token);
            callback(ret);
        } catch (err) {
            callback({error: err});
            console.log(err);
        }
    });

    sock.on("sendTransport", async (roomId: string, userId: number, transportId: string, paused: boolean, type: any, kind: any, rtpParameters: RtpParameters, token: string, callback) => {
        try {
            if (!roomId) {
                throw new Error("Invalid parameter roomId");
            } else {
                roomId = roomId.toString();
            }
            let ret = await ctrl.send(roomId, userId, transportId, paused, type, kind, rtpParameters, token);
            sock.broadcast.emit("startProduce", userId, type, kind);
            callback(ret.id);
        } catch (err) {
            callback({error: err});
            console.log(err);
        }
    });

    sock.on("sendSignal", async (userId: number, type: MediaType, kind: MediaKind, callback) => {
        sock.broadcast.emit("startProduce", userId, type, kind);
        callback();
    });

    sock.on("receiveTransport", async (roomId: string, userId: number, transportId: string, mediaPeerId: number, type, kind, rtpCapabilities: RtpCapabilities, token: string, callback) => {
        try {
            if (!roomId) {
                throw new Error("Invalid parameter roomId");
            } else {
                roomId = roomId.toString();
            }
            let ret = await ctrl.receive(roomId, userId, transportId, mediaPeerId, type, kind, rtpCapabilities, token);
            callback(ret);
        } catch (err) {
            callback({error: err});
            console.log(err);
        }
    });

    sock.on("kick", async (roomId: string, adminId: number, victimId: number, adminToken: string, callback) => {
        try {
            if (!roomId) {
                throw new Error("Invalid parameter roomId");
            } else {
                roomId = roomId.toString();
            }
            let ret = await ctrl.kick(roomId, adminId, victimId, adminToken);
            sock.broadcast.emit("userLeave", {userId: victimId});
            callback(ret);
        } catch (err) {
            callback({error: err});
        }
        
    });

    sock.on("resumeConsumer", async (roomId: string, userId: number, consumerId: string, token: string, callback) => {
        try {
            if (!roomId) {
                throw new Error("Invalid parameter roomId");
            } else {
                roomId = roomId.toString();
            }
            let ret = await ctrl.resumeConsumer(roomId, userId, consumerId);
            callback({result: ret});
        } catch (err) {
            callback({result: false});
            console.log(err);
        }
    });

    sock.on("pauseConsumer", async (roomId: string, userId: number, consumerId: string, token: string, callback) => {
        try {
            if (!roomId) {
                throw new Error("Invalid parameter roomId");
            } else {
                roomId = roomId.toString();
            }
            let ret = await ctrl.pauseConsumer(roomId, userId, consumerId, token);
            callback({result: ret});
        } catch (err) {
            callback({result: false});
            console.log(err);
        }
    });

    sock.on("closeConsumer", async (roomId: string, userId: number, consumerId: string, token: string, callback) => {
        try {
            if (!roomId) {
                throw new Error("Invalid parameter roomId");
            } else {
                roomId = roomId.toString();
            }
            let ret = await ctrl.closeConsumer(roomId, userId, consumerId, token);
            callback({result: ret});
        } catch (err) {
            callback({result: false});
            console.log(err);
        }
    });

    sock.on("resumeProducer", async (roomId: string, userId: number, producerId: string, token: string, callback) => {
        try {
            if (!roomId) {
                throw new Error("Invalid parameter roomId");
            } else {
                roomId = roomId.toString();
            }
            let ret = await ctrl.resumeProducer(roomId, userId, producerId, token);
            callback({result: ret});
        } catch (err) {
            callback({result: false});
            console.log(err);
        }
    });

    sock.on("pauseProducer", async (roomId: string, userId: number, producerId: string, token: string, callback) => {
        try {
            if (!roomId) {
                throw new Error("Invalid parameter roomId");
            } else {
                roomId = roomId.toString();
            }
            let ret = await ctrl.pauseProducer(roomId, userId, producerId, token);
            callback({result: ret});
        } catch (err) {
            callback({result: false});
            console.log(err);
        }
    });

    sock.on("closeProducer", async (roomId: string, userId: number, producerId: string, token: string, callback) => {
        try {
            if (!roomId) {
                throw new Error("Invalid parameter roomId");
            } else {
                roomId = roomId.toString();
            }
            let ret = await ctrl.closeProducer(roomId, userId, producerId, token);
            callback({result: ret});
        } catch (err) {
            callback({result: false});
            console.log(err);
        }
    });

    sock.on("mute", async (roomId: string, adminId: number, victimId: number, type: keyof MediaType, kind: MediaKind, adminToken: string, callback) => {
        try {
            if (!roomId) {
                throw new Error("Invalid parameter roomId");
            } else {
                roomId = roomId.toString();
            }
            let ret = await ctrl.mute(roomId, adminId, victimId, type, kind, adminToken);
            callback({result: true});
        } catch (err) {
            callback({result: false});
        }
    });

    sock.on("unmute", async (roomId: string, adminId: number, victimId: number, type: keyof MediaType, kind: MediaKind, adminToken: string, callback) => {
        try {
            if (!roomId) {
                throw new Error("Invalid parameter roomId");
            } else {
                roomId = roomId.toString();
            }
            let ret = await ctrl.unmute(roomId, adminId, victimId, type, kind, adminToken);
            callback({result: true});
        } catch (err) {
            callback({result: false});
        }
    });
    
    sock.on("leave", async (roomId: string, userId: number, token: string, callback) => {
        try {
            if (!roomId) {
                throw new Error("Invalid parameter roomId");
            } else {
                roomId = roomId.toString();
            }
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
    
    sock.on("leaveSignal", async (roomId: string, userId: number) => {
        try {
            if (!roomId) {
                throw new Error("Invalid parameter roomId");
            } else {
                roomId = roomId.toString();
            }
            console.log(`*** user leave ***\nroomId=${roomId}\nuserId=${userId}`);
            //await ctrl.leave(roomId, userId, "");
            sock.broadcast.emit("userLeave", {userId: userId});
        } catch (err) {
            console.log(err);
        }
    });

    sock.on("invitePhone", async (roomId: string, userId: number, token: string, callback) => {
        try {
            if (!roomId) {
                throw new Error("Invalid parameter roomId");
            } else {
                roomId = roomId.toString();
            }
            let ret = await ctrl.invitePhone(roomId, userId, token);
            if(ret){
                callback(ret);
            }
        } catch (err) {
            callback(-1);
            console.log(err);
        }
    });

    sock.on("acceptInvite", async (inviteId: number, callback) => {
        try {
            let ret = await ctrl.acceptInvite(inviteId);
            sock.data.userId = ret.userId;
            sock.data.roomId = ret.roomId;
            sock.data.type = "Mobile";
            callback(ret);
        } catch (err) {
            callback({error: err});
            console.log(err);
        }
    });
}