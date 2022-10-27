export interface TransportType {
    Pipe: string;
    WebRtc: string;
    Direct: string;
    Plain: string;
}

export interface Direction {
    Send: string;
    Recv: string;
}

export interface MediaType {
    Screen: string,
    ScreenSound: string,
    Camera: string,
    Voice: string
}