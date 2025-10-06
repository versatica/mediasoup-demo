import type * as mediasoupTypes from 'mediasoup/types';
import type * as protooTypes from 'protoo-server';
import type * as throttleTypes from '@sitespeed.io/throttle';

import {
	NotificationNameDataMap,
	RequestNameDataMap,
	RequestNameResponseDataMap,
} from './common';
import type {
	PeerId,
	PeerDevice,
	SerializedPeer,
	WebRtcTransportAppData,
	PeerProducerAppData,
	ConsumerAppData,
	PeerDataProducerAppData,
	DataConsumerAppData,
} from '../types';

/**
 * Notifications sent from peer to server using Protoo protocol.
 */
type NotificationFromPeer =
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

export type NotificationNameFromPeer =
	keyof NotificationNameDataMap<NotificationFromPeer>;

export type NotificationDataFromPeer<Name extends NotificationNameFromPeer> =
	NotificationNameDataMap<NotificationFromPeer>[Name];

/**
 * This is needed to cast the Protoo notification from peer into something
 * that we can use with our signaling types.
 */
export type TypedProtooNotificationFromPeer = {
	[N in NotificationNameFromPeer]: {
		method: N;
		data: NotificationDataFromPeer<N>;
	};
}[NotificationNameFromPeer];

/**
 * Requests sent from peer to server using Protoo protocol.
 */
type RequestFromPeer =
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
				rtpCapabilities?: mediasoupTypes.RtpCapabilities;
				sctpCapabilities?: mediasoupTypes.SctpCapabilities;
			};
			responseData: {
				peers: SerializedPeer[];
			};
	  }
	| {
			name: 'createWebRtcTransport';
			data: {
				sctpCapabilities?: mediasoupTypes.SctpCapabilities;
				forceTcp: boolean;
				appData: WebRtcTransportAppData;
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
				transportId: string;
				dtlsParameters: mediasoupTypes.DtlsParameters;
			};
	  }
	| {
			name: 'restartIce';
			data: { transportId: string };
			responseData: { iceParameters: mediasoupTypes.IceParameters };
	  }
	| {
			name: 'produce';
			data: {
				transportId: string;
				kind: mediasoupTypes.MediaKind;
				rtpParameters: mediasoupTypes.RtpParameters;
				appData: PeerProducerAppData;
			};
			responseData: { producerId: string };
	  }
	| {
			name: 'produceData';
			data: {
				transportId: string;
				sctpStreamParameters: mediasoupTypes.SctpStreamParameters;
				label: string;
				protocol: string;
				appData: PeerDataProducerAppData;
			};
			responseData: { dataProducerId: string };
	  }
	| {
			name: 'getTransportStats';
			data: { transportId: string };
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
	  }
	| {
			name: 'applyNetworkThrottle';
			data: {
				secret: string;
				options: throttleTypes.ThrottleStartOptions;
			};
	  }
	| {
			name: 'stopNetworkThrottle';
			data: {
				secret: string;
			};
	  };

export type RequestNameFromPeer = keyof RequestNameDataMap<RequestFromPeer>;

export type RequestDataFromPeer<Name extends RequestNameFromPeer> =
	RequestNameDataMap<RequestFromPeer>[Name];

export type RequestResponseDataFromPeer<Name extends RequestNameFromPeer> =
	RequestNameResponseDataMap<RequestFromPeer>[Name];

/**
 * This is needed to cast the Protoo request from peer into something that
 * we can use with our signaling types.
 */
export type TypedProtooRequestFromPeer = {
	[N in RequestNameFromPeer]: {
		method: N;
		data: RequestDataFromPeer<N>;
		accept: RequestResponseDataFromPeer<N> extends undefined
			? (responseData?: RequestResponseDataFromPeer<N>) => void
			: (responseData: RequestResponseDataFromPeer<N>) => void;
		reject: protooTypes.RejectFn;
	};
}[RequestNameFromPeer];

/**
 * Notifications sent from server to peer using Protoo protocol.
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
				peer: SerializedPeer;
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
			name: 'producerScore';
			data: {
				producerId: string;
				score: mediasoupTypes.ProducerScore[];
			};
	  }
	| {
			name: 'speakingPeers';
			data: {
				peerVolumes: {
					peerId: PeerId;
					volume: number;
				}[];
			};
	  }
	| {
			name: 'activeSpeaker';
			data: {
				peerId?: PeerId;
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
				layers?: mediasoupTypes.ConsumerLayers;
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
 * Requests sent from server to peer using Protoo protocol.
 */
type RequestFromServer =
	| {
			name: 'newConsumer';
			data: {
				peerId: PeerId;
				transportId: string;
				consumerId: string;
				producerId: string;
				kind: mediasoupTypes.MediaKind;
				rtpParameters: mediasoupTypes.RtpParameters;
				type: mediasoupTypes.ConsumerType;
				producerPaused: boolean;
				consumerScore: mediasoupTypes.ConsumerScore;
				appData: ConsumerAppData;
			};
	  }
	| {
			name: 'newDataConsumer';
			data: {
				// Optional since it is undefined if it's the Bot.
				peerId?: PeerId;
				transportId: string;
				dataConsumerId: string;
				dataProducerId: string;
				sctpStreamParameters: mediasoupTypes.SctpStreamParameters;
				label: string;
				protocol: string;
				appData: DataConsumerAppData;
			};
	  };

export type RequestNameFromServer = keyof RequestNameDataMap<RequestFromServer>;

export type RequestDataFromServer<Name extends RequestNameFromServer> =
	RequestNameDataMap<RequestFromServer>[Name];

export type RequestResponseDataFromServer<Name extends RequestNameFromServer> =
	RequestNameResponseDataMap<RequestFromServer>[Name];
