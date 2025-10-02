import type * as mediasoupTypes from 'mediasoup/types';

import type { PeerId, PeerDevice } from '../types';

type NotificationMap<U extends { name: string }> = {
	[K in U as K['name']]: K extends { data: infer D } ? D : undefined;
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
	keyof NotificationMap<NotificationFromClient>;

export type NotificationDataFromClient<
	Name extends keyof NotificationMap<NotificationFromClient>,
> = NotificationMap<NotificationFromClient>[Name];

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
