import type * as mediasoupTypes from 'mediasoup/types';

export type ServerConfig = {
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
		};
		/**
		 * Additional options that are not part of WebRtcTransportOptions but
		 * instead used for function calls.
		 */
		additionalWebRtcTransportOptions?: {
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
		| 'ffmpeg'
		| 'gstreamer'
		| 'unknown';
	name: string;
	version?: string;
};

export type SerializedServer = {
	createdAt: Date;
	numMediasoupWorkers: number;
	networkThrottleEnabled: boolean;
	numRooms: number;
	rooms: SerializedRoom[];
};

export type SerializedRoom = {
	roomId: RoomId;
	createdAt: Date;
	numPeers: number;
	numJoiningPeers: number;
	peers: SerializedPeer[];
	numBroadcasterPeers: number;
	numJoiningBroadcasterPeers: number;
	broadcasterPeers: SerializedPeer[];
};

export type SerializedPeer = {
	peerId: PeerId;
	displayName: string;
	device: PeerDevice;
	remoteAddress: string;
};

export type ApiMethod = 'GET' | 'POST' | 'DELETE';

export type ApiPath = (
	| string
	| {
			[key: string]: string;
	  }
)[];

export type TransportDirection = 'producer' | 'consumer';

export type PlainTransportRemoteData = {
	transportId: string;
	ip: string;
	port: number;
	rtcpPort?: number;
};

export type Source = 'audio' | 'video' | 'screensharing';

export type Channel = 'chat' | 'bot';

export type PeerProducersInfo = {
	peerId: PeerId;
	producers: {
		producerId: string;
		kind: mediasoupTypes.MediaKind;
		source: Source;
		consumableCodecs: Omit<mediasoupTypes.RtpCodecParameters, 'rtcpFeedback'>[];
	}[];
};

export type WorkerAppData = {
	idx: number;
};

export type WebRtcTransportAppData = {
	direction: TransportDirection;
};

export type PlainTransportAppData = {
	direction: TransportDirection;
};

export type ProducerAppData = {
	peerId: PeerId;
	source: Source;
};

/**
 * @remarks
 * - This is the type of `addData` sent by the Peer or BroadcasterPeer.
 */
export type PeerProducerAppData = {
	source: Source;
};

export type ConsumerAppData = {
	peerId: PeerId;
	source: Source;
};

export type DataProducerAppData = {
	peerId: PeerId;
	channel: Channel;
};

/**
 * @remarks
 * - This is the type of `addData` sent by the Peer or BroadcasterPeer.
 */
export type PeerDataProducerAppData = {
	channel: Channel;
};

export type BotDataProducerAppData = {
	channel: Extract<Channel, 'bot'>;
};

export type DataConsumerAppData = {
	// Unset in Bot.
	peerId?: PeerId;
	channel: Channel;
};
