import type * as mediasoupTypes from 'mediasoup/types';
import type * as protooTypes from 'protoo-server';

import type {
	PeerId,
	PeerDevice,
	TransportDirection,
	MediasoupProducerAppData,
	MediasoupDataProducerAppData,
} from '../types';

type NotificationNameDataMap<U extends { name: string }> = {
	[K in U as K['name']]: K extends { data: infer D } ? D : undefined;
};

type RequestNameDataMap<U extends { name: string }> = {
	[K in U as K['name']]: K extends { data: infer D } ? D : undefined;
};

type RequestNameResponseDataMap<U extends { name: string }> = {
	[K in U as K['name']]: K extends { responseData: infer R } ? R : undefined;
};

/**
 * Notifications sent from client to server using Protoo protocol.
 */
type NotificationFromClient =
	| {
			name: 'closeProducer';
			data: {
				producerId: string;
			};
	  }
	| {
			name: 'pauseProducer';
			data: {
				producerId: string;
			};
	  }
	| {
			name: 'resumeProducer';
			data: {
				producerId: string;
			};
	  }
	| {
			name: 'pauseConsumer';
			data: {
				consumerId: string;
			};
	  }
	| {
			name: 'resumeConsumer';
			data: {
				consumerId: string;
			};
	  }
	| {
			name: 'setConsumerPreferredLayers';
			data: {
				consumerId: string;
				spatialLayer: number;
				temporalLayer?: number;
			};
	  }
	| {
			name: 'setConsumerPriority';
			data: {
				consumerId: string;
				priority: number;
			};
	  }
	| {
			name: 'requestConsumerKeyFrame';
			data: {
				consumerId: string;
			};
	  }
	| {
			name: 'changeDisplayName';
			data: { displayName: string };
	  };

export type NotificationNameFromClient =
	keyof NotificationNameDataMap<NotificationFromClient>;

export type NotificationDataFromClient<
	Name extends NotificationNameFromClient,
> = NotificationNameDataMap<NotificationFromClient>[Name];

/**
 * This is needed to cast the Protoo notification from client into something
 * that we can use with our signaling types.
 */
export type TypedProtooNotificationFromClient = {
	[N in NotificationNameFromClient]: {
		method: N;
		data: NotificationDataFromClient<N>;
	};
}[NotificationNameFromClient];

/**
 * Requests sent from client to server using Protoo protocol.
 */
type RequestFromClient =
	| {
			name: 'getRouterRtpCapabilities';
			responseData: {
				routerRtpCapabilities: mediasoupTypes.RouterRtpCapabilities;
			};
	  }
	| {
			name: 'join';
			data: {
				displayName: string;
				device: PeerDevice;
				rtpCapabilities: mediasoupTypes.RtpCapabilities;
				sctpCapabilities: mediasoupTypes.SctpCapabilities;
			};
			responseData: {
				peers: {
					peerId: PeerId;
					displayName: string;
					device: PeerDevice;
				}[];
			};
	  }
	| {
			name: 'createWebRtcTransport';
			data: {
				direction: TransportDirection;
				sctpCapabilities?: mediasoupTypes.SctpCapabilities;
				forceTcp: boolean;
			};
			responseData: {
				transportId: string;
				iceParameters: mediasoupTypes.IceParameters;
				iceCandidates: mediasoupTypes.IceCandidate[];
				dtlsParameters: mediasoupTypes.DtlsParameters;
				sctpParameters?: mediasoupTypes.SctpParameters;
			};
	  }
	| {
			name: 'connectWebRtcTransport';
			data: {
				direction: TransportDirection;
				dtlsParameters: mediasoupTypes.DtlsParameters;
			};
	  }
	| {
			name: 'restartIce';
			data: { direction: TransportDirection };
			responseData: { iceParameters: mediasoupTypes.IceParameters };
	  }
	| {
			name: 'produce';
			data: {
				kind: mediasoupTypes.MediaKind;
				rtpParameters: mediasoupTypes.RtpParameters;
				appData: MediasoupProducerAppData;
			};
			responseData: { producerId: string };
	  }
	| {
			name: 'produceData';
			data: {
				sctpStreamParameters: mediasoupTypes.SctpStreamParameters;
				label: string;
				protocol: string;
				appData: MediasoupDataProducerAppData;
			};
			responseData: { dataProducerId: string };
	  }
	| {
			name: 'getTransportStats';
			data: { direction: TransportDirection };
			responseData: { stats: mediasoupTypes.WebRtcTransportStat[] };
	  }
	| {
			name: 'getProducerStats';
			data: { producerId: string };
			responseData: { stats: mediasoupTypes.ProducerStat[] };
	  }
	| {
			name: 'getConsumerStats';
			data: { consumerId: string };
			responseData: { stats: mediasoupTypes.ConsumerStat[] };
	  }
	| {
			name: 'getDataProducerStats';
			data: { dataProducerId: string };
			responseData: { stats: mediasoupTypes.DataProducerStat[] };
	  }
	| {
			name: 'getDataConsumerStats';
			data: { dataConsumerId: string };
			responseData: { stats: mediasoupTypes.DataConsumerStat[] };
	  };

export type RequestNameFromClient = keyof RequestNameDataMap<RequestFromClient>;

export type RequestDataFromClient<Name extends RequestNameFromClient> =
	RequestNameDataMap<RequestFromClient>[Name];

export type RequestResponseDataFromClient<Name extends RequestNameFromClient> =
	RequestNameResponseDataMap<RequestFromClient>[Name];

/**
 * This is needed to cast the Protoo request from client into something that
 * we can use with our signaling types.
 */
export type TypedProtooRequestFromClient = {
	[N in RequestNameFromClient]: {
		method: N;
		data: RequestDataFromClient<N>;
		accept: RequestResponseDataFromClient<N> extends undefined
			? (responseData?: RequestResponseDataFromClient<N>) => void
			: (responseData: RequestResponseDataFromClient<N>) => void;
		reject: protooTypes.RejectFn;
	};
}[RequestNameFromClient];

/**
 * Notifications sent from server to client using Protoo protocol.
 */
type NotificationFromServer =
	| {
			name: 'mediasoupVersion';
			data: {
				version: string;
			};
	  }
	| {
			name: 'newPeer';
			data: {
				peerId: PeerId;
				displayName: string;
				device: PeerDevice;
			};
	  }
	| {
			name: 'peerDisplayNameChanged';
			data: {
				peerId: PeerId;
				displayName: string;
				oldDisplayName: string;
			};
	  }
	| {
			name: 'peerClosed';
			data: {
				peerId: PeerId;
			};
	  }
	| {
			name: 'activeSpeaker';
			data: {
				peerId?: PeerId;
				volume?: number;
			};
	  }
	| {
			name: 'producerScore';
			data: {
				producerId: string;
				score: mediasoupTypes.ProducerScore[];
			};
	  }
	| {
			name: 'activeSpeaker';
			data: {
				peerId?: PeerId;
				volume?: number;
			};
	  }
	| {
			name: 'consumerPaused';
			data: {
				consumerId: string;
			};
	  }
	| {
			name: 'consumerResumed';
			data: {
				consumerId: string;
			};
	  }
	| {
			name: 'consumerScore';
			data: {
				consumerId: string;
				score: mediasoupTypes.ConsumerScore;
			};
	  }
	| {
			name: 'consumerLayersChanged';
			data: {
				consumerId: string;
				score?: mediasoupTypes.ConsumerLayers;
			};
	  }
	| {
			name: 'consumerClosed';
			data: {
				consumerId: string;
			};
	  }
	| {
			name: 'dataConsumerClosed';
			data: {
				dataConsumerId: string;
			};
	  };

export type NotificationNameFromServer =
	keyof NotificationNameDataMap<NotificationFromServer>;

export type NotificationDataFromServer<
	Name extends keyof NotificationNameDataMap<NotificationFromServer>,
> = NotificationNameDataMap<NotificationFromServer>[Name];

/**
 * Requests sent from server to client using Protoo protocol.
 */
type RequestFromServer =
	| {
			name: 'newConsumer';
			data: {
				peerId: PeerId;
				consumerId: string;
				producerId: string;
				kind: mediasoupTypes.MediaKind;
				rtpParameters: mediasoupTypes.RtpParameters;
				type: mediasoupTypes.ConsumerType;
				producerPaused: boolean;
				appData: MediasoupProducerAppData;
			};
	  }
	| {
			name: 'newDataConsumer';
			data: {
				peerId: PeerId;
				dataConsumerId: string;
				dataProducerId: string;
				sctpStreamParameters: mediasoupTypes.SctpStreamParameters;
				label: string;
				protocol: string;
				appData: MediasoupDataProducerAppData;
			};
	  };

export type RequestNameFromServer = keyof RequestNameDataMap<RequestFromServer>;

export type RequestDataFromServer<Name extends RequestNameFromServer> =
	RequestNameDataMap<RequestFromServer>[Name];

export type RequestResponseDataFromServer<Name extends RequestNameFromServer> =
	RequestNameResponseDataMap<RequestFromServer>[Name];
