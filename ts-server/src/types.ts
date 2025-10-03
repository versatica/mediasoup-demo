import type * as mediasoupTypes from 'mediasoup/types';

export type Config = {
	domain: string;
	http: {
		listenIp: string;
		listenPort: number;
		tls?: {
			cert: string | NonSharedBuffer;
			key: string | NonSharedBuffer;
		};
	};
	mediasoup: {
		numWorkers: number;
		workerSettings: {
			dtlsCertificateFile?: string;
			dtlsPrivateKeyFile?: string;
			logLevel: mediasoupTypes.WorkerLogLevel;
			logTags: mediasoupTypes.WorkerLogTag[];
			disableLiburing?: boolean;
		};
		routerOptions: {
			mediaCodecs: mediasoupTypes.RouterRtpCodecCapability[];
		};
		webRtcServerOptions: {
			listenInfos: mediasoupTypes.TransportListenInfo[];
		};
		webRtcTransportOptions?: {
			initialAvailableOutgoingBitrate?: number;
			minimumAvailableOutgoingBitrate?: number;
			maxSctpMessageSize?: number;
			// Additional options that are not part of WebRtcTransportOptions.
			maxIncomingBitrate?: number;
		};
		plainTransportOptions: {
			listenInfo: mediasoupTypes.TransportListenInfo;
			maxSctpMessageSize?: number;
		};
	};
};

export type RoomId = string;

export type PeerId = string;

export type PeerDevice = {
	flag:
		| 'chrome'
		| 'firefox'
		| 'safari'
		| 'opera'
		| 'edge'
		| 'aiortc'
		| 'unknown';
	name?: string;
	version?: string;
};

export type SerializedPeer = {
	peerId: PeerId;
	displayName: string;
	device: PeerDevice;
};

export type TransportDirection = 'producer' | 'consumer';

export type Source = 'audio' | 'video' | 'screensharing';

export type Channel = 'chat' | 'bot';

export type MediasoupWorkerAppData = {
	idx: number;
};

export type MediasoupWebRtcTransportAppData = {
	direction: TransportDirection;
};

export type MediasoupProducerAppData = {
	// Optional since it's not sent by client.
	peerId?: PeerId;
	source: Source;
};

export type MediasoupConsumerAppData = {
	peerId: PeerId;
	source: Source;
};

export type MediasoupDataProducerAppData = {
	// Optional since it's not sent by client.
	peerId?: PeerId;
	channel: Channel;
};

export type MediasoupDataConsumerAppData = {
	// Unset in Bot.
	peerId?: PeerId;
	channel: Channel;
};
