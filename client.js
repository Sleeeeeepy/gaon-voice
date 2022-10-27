//import * as client from 'mediasoup-client';
const client = require("mediasoup-client");
const host = "";
let device;
let _interval = 200;
let _screen;
let _producer;
let _consumer;
let _sendTransport;
let _sendTransportId;
let _recvTransport;
let _recvTransportId;
let _roomId = "hi";
let _userId = Math.floor(Math.random() * 0xff);
let mediaPeer;
let _prevPeer = new Array();
main();
async function main() {
    try {
        init();
    } catch (err) {
        console.log(err);
    }
}

async function init() {
    //initalize device and events.
    device = new client.Device();
    document.getElementById("btn_join").onclick = () => join(_roomId, _userId);
    document.getElementById("btn_localMedia").onclick = () => startLocalMedia();
    document.getElementById("btn_startMedia").onclick = () => startMedia(_roomId, _userId);
    document.getElementById("btn_recv").onclick = () => subscribe(_roomId, _userId);
    document.getElementById("txt_peer").onkeyup = () => onInputChanged();
}

function onInputChanged() {
    mediaPeer = document.getElementById("txt_peer").value;
}

async function join(roomId, userId) {
    let {routerRtpCapabilities} = await HttpRequest(`/room/${roomId}/user/${userId}/join`);
    console.log(routerRtpCapabilities);
    if (!device.loaded) {
        await device.load({routerRtpCapabilities});
    }
    heartbeat(userId);
    //setTimeout(heartbeat, _interval, [userId]);
}

async function heartbeat(userId) {
    let { status, interval } = await HttpRequest(`/heartbeat/${userId}`);
    if (interval) {
        _interval = interval;
    }
}

async function startLocalMedia() {
    _screen = await navigator.mediaDevices.getDisplayMedia({video: true});
    document.getElementById("video_local").srcObject = _screen;
}

async function startMedia(roomId, userId) {
    // sendTransport가 없으면 만든다.
    if (!_sendTransport) {
        await createSendTransport(roomId, userId);
    }

    console.log("ready to produce...");
    // sendTransport로부터 producer를 만든다.
    _producer = await _sendTransport.produce({
        track: _screen.getVideoTracks()[0],
        encodings: null
    });
    console.log("producerId is", _producer.id);
    // 이벤트 설정
    _producer.track.onended = async () => {
        HttpRequest(`/room/${roomId}/user/${userId}/produce/${_producer.id}/close`);
        _producer.close();
    }
}

async function leave(roomId, userId) {
    clearInterval(_interval);
    await HttpRequest(`/room/${roomId}/user/${userId}/leave`);
}

async function createSendTransport(roomId, userId) {
    let { transportId, iceParameters, iceCandidates, dtlsParameters } = await HttpRequest(`/room/${roomId}/user/${userId}/transport/create/send`);
    _sendTransport = await device.createSendTransport({
        id: transportId,
        iceCandidates: iceCandidates,
        dtlsParameters: dtlsParameters,
        iceParameters: iceParameters,
        iceServers : [{
            url: 'turn:numb.viagenie.ca',
            credential: 'muazkh',
            username: 'webrtc@live.com'
        }]
    });
    _sendTransportId = transportId;
    console.log(transportId, iceParameters, iceCandidates, dtlsParameters);

    _sendTransport.on("connect", async ({dtlsParameters}, callback, errback) => {
        try {
            await HttpRequest(`room/${roomId}/user/${userId}/transport/${_sendTransportId}/connect`, {dtlsParameters});
            callback();
            console.log(dtlsParameters);
        } catch (err) {
            errback(err);
        }
    });

    _sendTransport.on("produce", async ({kind, rtpParameters}, callback, errback) => {
        try {
            let {id} = await HttpRequest(`room/${roomId}/user/${userId}/transport/${_sendTransportId}/send`, {kind, rtpParameters, paused: true});
            callback({id});
        } catch (err) {
            errback(err);
        }
    });

    _sendTransport.on("connectionstatechange", (state) => {
        switch (state) {
            case "connected":
                document.getElementById("video_local").srcObject = stream;
                break;
        }
    });
}

async function createRecvTransport(roomId, userId) {
    let { transportId, iceParameters, iceCandidates, dtlsParameters } = await HttpRequest(`/room/${roomId}/user/${userId}/transport/create/recv`);
    _recvTransport = await device.createRecvTransport({
        id: transportId,
        iceCandidates: iceCandidates,
        dtlsParameters: dtlsParameters,
        iceParameters: iceParameters,
        iceServers : [{
            url: 'turn:numb.viagenie.ca',
            credential: 'muazkh',
            username: 'webrtc@live.com'
        }]
    });
    _recvTransportId = transportId;

    _recvTransport.on("connect", async ({dtlsParameters}, callback, errback) => {
        try {
            await HttpRequest(`room/${roomId}/user/${userId}/transport/${transportId}/connect`, {
                dtlsParameters
            });
            console.log(dtlsParameters);
            callback();
        } catch (err) {
            errback(err);
        }
    });
}
async function subscribe(roomId, userId, mediaUserId) {
    if (!mediaUserId) {
        mediaUserId = mediaPeer;
    }
    if (!_recvTransport) {
        await createRecvTransport(roomId, userId);
    }
    let transportId = _recvTransportId;
    console.log(JSON.stringify(device.rtpCapabilities));
    let param = await HttpRequest(`/room/${roomId}/user/${userId}/transport/${transportId}/recv/${mediaUserId}`, {rtpCapabilities: device.rtpCapabilities});
    _consumer = await _recvTransport.consume({
        id: param.consumerId,
        producerId: param.producerId,
        kind: param.kind,
        rtpParameters: param.rtpParameters,
        appData: {
            type: param.type
        }
    });

    while (_recvTransport.connectionState !== 'connected') {
        console.log("send:",_sendTransport.connectionState);
        console.log("recv:",_recvTransport.connectionState);
        await sleep(100);
    }

    async function sleep(ms) {
        return new Promise((r) => setTimeout(() => r(), ms));
    }

    await resumeConsumer(_consumer, roomId, userId);
    let remote_video = document.getElementById("video_remote"); 
    remote_video.srcObject = new MediaStream([_consumer.track.clone()]);
    remote_video.play();
}

/////////////////////////////////////////////////
// consumer & producer
/////////////////////////////////////////////////

async function pauseConsumer(consumer, roomId, userId) {
    await HttpRequest(`room/${roomId}/user/${userId}/consume/pause`);
    await consumer.pause();
}

async function pauseProducer(producer, roomId, userId) {
    await HttpRequest(`room/${roomId}/user/${userId}/produce/pause`);
    await producer.pause();
}

async function resumeConsumer(consumer, roomId, userId) {
    await HttpRequest(`/room/${roomId}/user/${userId}/consume/${consumer.id}/resume`);
    await consumer.resume();
}

async function resumeProducer(producer, roomId, userId) {
    await HttpRequest(`/room/${roomId}/user/${userId}/produce/${producer.id}/resume`);
    await producer.resume();
}

async function closeProducer(producer, roomId, userId) {
    await HttpRequest(`/room/${roomId}/user/${userId}/produce/close`);
    await producer.close();
}

async function closeConsumer(consumer, roomId, userId) {
    await HttpRequest(`room/${roomId}/user/${userId}/consume/close`);
    await consumer.close();
}

/// state update
async function updateState(roomId) {
    let { peers } = await HttpRequest(`/room/${roomId}/users`);
    let needUpdate = comparePeer();

    if (needUpdate) {
        // update something...
        updateView(); // update view
        _prevPeer = peers; // update peer

    }
    function comparePeer() {
        if (_prevPeer.length != peers.length) {
            return true;
        }

        let found = false;
        for (let i = 0; i < _prevPeer.length; i++) {
            let f = peers.findIndex((elem, index) => {
                return elem === _prevPeer[i];
            });
            found = (f != -1);
        }
        return !found;
    }
}
async function HttpRequest(path, body) {
    try {
        let header = { 'Content-Type': 'application/json'};
        let bodyData = JSON.stringify({...body});
    
        let res = await fetch(host + path, { method: 'POST', body: bodyData, headers: header});
        console.log("HTTPRequest[%s]", path, res);
        return await res.json();
    } catch (err) {
        console.log(err);
        return { err: err};
    }
}
function updateView() {

}
