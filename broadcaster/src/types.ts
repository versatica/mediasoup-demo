import type * as mediasoupTypes from 'mediasoup-client/types';

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

export type PeerProducersInfo = {
	peerId: PeerId;
	producers: {
		producerId: string;
		kind: mediasoupTypes.MediaKind;
		source: Source;
		consumableCodecs: Omit<mediasoupTypes.RtpCodecParameters, 'rtcpFeedback'>[];
	}[];
};

export type MediaClientType = 'ffmpeg' | 'gstreamer';

export type PlainTransportAppData = {
	direction: TransportDirection;
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
