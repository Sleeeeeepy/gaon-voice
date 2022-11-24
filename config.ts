import { AudioLevelObserverOptions } from "mediasoup/node/lib/AudioLevelObserver";
import { RtpCodecCapability } from "mediasoup/node/lib/RtpParameters";
import { TransportListenIp } from "mediasoup/node/lib/Transport";
import { WebRtcTransportOptions } from "mediasoup/node/lib/WebRtcTransport";
import { WorkerSettings } from "mediasoup/node/lib/Worker";
import os from "node:os";

export const worker_config: WorkerSettings = {
    logLevel: "debug",
    logTags: ["ice", "rtp", "srtp", "rtcp"],
    rtcMinPort: 32767,
    rtcMaxPort: 65535,
};

export const mediaCodecs: RtpCodecCapability[] = [
    {
        kind: 'audio',
        mimeType: 'audio/opus',
        clockRate: 48000,
        channels: 2
    },
    {
        kind: 'video',
        mimeType: 'video/VP8',
        clockRate: 90000,
        parameters: {
            'x-google-start-bitrate': 1000
        }
    }
];

export const transportSetting: WebRtcTransportOptions = {
    listenIps: [
      { ip: "127.0.0.1", announcedIp: undefined }
    ],
    initialAvailableOutgoingBitrate: 1000000,
    enableUdp: true,
    enableTcp: true,
    preferUdp: true
};

export const numberOfWorkers = os.cpus().length;
export const heartbeatTimeout = 3000;
export const pingInterval = 1000;

export const ssl = {
    path: {
        key: "./ssl/private.key",
        crt: "./ssl/crt.pem"
    },
    startAsHttps: true
};

export const audioLevelObserver: AudioLevelObserverOptions = { 
    //maxEntries: 20, 
    //threshold: 200, 
    interval: 800,
    //appData: undefined
};