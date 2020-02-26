/// <reference types="node" />
import { Worker } from 'mediasoup-client-aiortc';
import { types as mediasoupClientTypes } from 'mediasoup-client';
export declare class RoomClient {
    _closed: boolean;
    _displayName: string;
    _device: any;
    _forceTcp: boolean;
    _produce: boolean;
    _consume: boolean;
    _useDataChannel: boolean;
    _externalAudio: string;
    _externalVideo: string;
    _nextDataChannelTestNumber: number;
    _useSharingSimulcast: boolean;
    _protooUrl: string;
    _protoo: any;
    _mediasoupDevice: mediasoupClientTypes.Device;
    _sendTransport: mediasoupClientTypes.Transport;
    _recvTransport: mediasoupClientTypes.Transport;
    _micProducer: mediasoupClientTypes.Producer;
    _webcamProducer: mediasoupClientTypes.Producer;
    _shareProducer: mediasoupClientTypes.Producer;
    _chatDataProducer: mediasoupClientTypes.DataProducer;
    _botDataProducer: mediasoupClientTypes.DataProducer;
    _consumers: Map<string, mediasoupClientTypes.Consumer>;
    _dataConsumers: Map<string, mediasoupClientTypes.DataConsumer>;
    _worker: Worker;
    _localStatsPeriodicTimer: NodeJS.Timer;
    /**
     * @param  {Object} data
     * @param  {Object} data.store - The Redux store.
     */
    static init(data: any): void;
    constructor({ roomId, peerId, displayName, useSharingSimulcast, forceTcp, produce, consume, forceH264, forceVP8, datachannel, externalAudio, externalVideo }: {
        roomId: string;
        peerId: string;
        displayName: string;
        useSimulcast: boolean;
        useSharingSimulcast: boolean;
        forceTcp: boolean;
        produce: boolean;
        consume: boolean;
        forceH264: boolean;
        forceVP8: boolean;
        datachannel: boolean;
        externalAudio: string;
        externalVideo: string;
    });
    close(): void;
    join(): Promise<void>;
    enableMic(): Promise<void>;
    disableMic(): Promise<void>;
    muteMic(): Promise<void>;
    unmuteMic(): Promise<void>;
    enableWebcam(): Promise<void>;
    disableWebcam(): Promise<void>;
    muteWebcam(): Promise<void>;
    unmuteWebcam(): Promise<void>;
    changeWebcam(): Promise<void>;
    enableAudioOnly(): Promise<void>;
    disableAudioOnly(): Promise<void>;
    muteAudio(): Promise<void>;
    unmuteAudio(): Promise<void>;
    restartIce(): Promise<void>;
    setConsumerPriority(consumerId: string, priority: number): Promise<void>;
    requestConsumerKeyFrame(consumerId: string): Promise<void>;
    enableChatDataProducer(): Promise<void>;
    enableBotDataProducer(): Promise<void>;
    sendChatMessage(text: string): Promise<void>;
    sendBotMessage(text: string): Promise<void>;
    changeDisplayName(displayName: string): Promise<void>;
    getSendTransportRemoteStats(): Promise<void>;
    getRecvTransportRemoteStats(): Promise<void>;
    getAudioRemoteStats(): Promise<void>;
    getVideoRemoteStats(): Promise<void>;
    getConsumerRemoteStats(consumerId: string): Promise<void>;
    getChatDataProducerRemoteStats(): Promise<void>;
    getBotDataProducerRemoteStats(): Promise<any>;
    getDataConsumerRemoteStats(dataConsumerId: string): Promise<any>;
    getSendTransportLocalStats(): Promise<any>;
    getRecvTransportLocalStats(): Promise<any>;
    getAudioLocalStats(): Promise<any>;
    getVideoLocalStats(): Promise<any>;
    getConsumerLocalStats(consumerId: string): Promise<any>;
    showLocalStats(): Promise<void>;
    hideLocalStats(): Promise<void>;
    _joinRoom(): Promise<void>;
    _getWebcamType(device: any): string;
    _pauseConsumer(consumer: mediasoupClientTypes.Consumer): Promise<void>;
    _resumeConsumer(consumer: mediasoupClientTypes.Consumer): Promise<void>;
}
//# sourceMappingURL=RoomClient.d.ts.map