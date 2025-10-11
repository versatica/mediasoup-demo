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

export type ApiHttpMethod = 'GET' | 'POST' | 'DELETE';

export type ApiHttpPath = (
	| string
	| {
			[key: string]: string;
	  }
)[];

export type TransportDirection = 'producer' | 'consumer';

export type Source = 'audio' | 'video' | 'screensharing';

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
