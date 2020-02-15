declare type InitialState = {
    id: string | null;
    displayName: string | null;
    displayNameSet: boolean;
    device: any | null;
    canSendMic: boolean;
    canSendWebcam: boolean;
    canChangeWebcam: boolean;
    webcamInProgress: boolean;
    shareInProgress: boolean;
    audioOnly: boolean;
    audioOnlyInProgress: boolean;
    audioMuted: boolean;
    restartIceInProgress: boolean;
};
declare const me: (state: InitialState, action: any) => any;
export default me;
//# sourceMappingURL=me.d.ts.map