declare type InitialState = {
    url: string | null;
    state: 'new' | 'connecting' | 'connected' | 'disconnected' | 'closed';
    activeSpeakerId: string | null;
    statsPeerId: string | null;
    faceDetection: boolean;
};
declare const room: (state: InitialState, action: any) => any;
export default room;
//# sourceMappingURL=room.d.ts.map