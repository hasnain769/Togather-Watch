export interface VideoState {
    playing: boolean;
    timestamp: number;
    url?: string;
}

export interface User {
    id: string;
}

export interface Room {
    users: Set<string>;
    videoState?: VideoState;
}

// Socket Event Payloads
export interface VideoUpdatePayload {
    roomId: string;
    playing: boolean;
    timestamp: number;
    url?: string;
}

export interface SignalPayload {
    target: string;
    signal: any;
    callerID: string;
}
