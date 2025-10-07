import type * as mediasoupTypes from 'mediasoup/types';

import { RequestNameDataMap, RequestNameResponseDataMap } from './common';
import type {
	PeerId,
	PeerDevice,
	PlainTransportAppData,
	PeerProducerAppData,
} from '../types';

/**
 * Requests sent from broadcaster to server using the HTTP API.
 *
 * @remarks
 * - Those requests are intended for the `Room` instance.
 * - The field `responseData` becomes the HTTP response body (if any).
 */
type RequestFromBroadcasterPeerToRoom =
	| {
			name: 'getRouterRtpCapabilities';
			responseData: {
				routerRtpCapabilities: mediasoupTypes.RouterRtpCapabilities;
			};
	  }
	| {
			name: 'createBroadcasterPeer';
			data: {
				peerId: PeerId;
				remoteAddress: string;
				displayName: string;
				device: PeerDevice;
			};
	  };

export type RequestNameFromBroadcasterPeerToRoom =
	keyof RequestNameDataMap<RequestFromBroadcasterPeerToRoom>;

export type RequestDataFromBroadcasterPeerToRoom<
	Name extends RequestNameFromBroadcasterPeerToRoom,
> = RequestNameDataMap<RequestFromBroadcasterPeerToRoom>[Name];

export type RequestResponseDataFromBroadcasterPeerToRoom<
	Name extends RequestNameFromBroadcasterPeerToRoom,
> = RequestNameResponseDataMap<RequestFromBroadcasterPeerToRoom>[Name];

export type TypedApiRequestFromBroadcasterPeerToRoom = {
	[N in RequestNameFromBroadcasterPeerToRoom]: {
		name: N;
		data: RequestDataFromBroadcasterPeerToRoom<N>;
		accept: RequestResponseDataFromBroadcasterPeerToRoom<N> extends undefined
			? (responseData?: RequestResponseDataFromBroadcasterPeerToRoom<N>) => void
			: (responseData: RequestResponseDataFromBroadcasterPeerToRoom<N>) => void;
	};
}[RequestNameFromBroadcasterPeerToRoom];

/**
 * Requests sent from broadcaster to server using the HTTP API.
 *
 * @remarks
 * - Those requests are intended for the `BroadcastPeer` instance.
 * - The field `responseData` becomes the HTTP response body (if any).
 */
type RequestFromBroadcasterPeer =
	| {
			name: 'join';
	  }
	| {
			name: 'disconnect';
	  }
	| {
			name: 'createPlainTransport';
			data: {
				comedia?: boolean;
				rtcpMux?: boolean;
				appData: PlainTransportAppData;
			};
			responseData: {
				transportId: string;
				ip: string;
				port: number;
				rtcpPort?: number;
			};
	  }
	| {
			name: 'connectPlainTransport';
			data: {
				transportId: string;
				ip: string;
				port: number;
				rtcpPort?: number;
			};
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
			name: 'consume';
			data: {
				transportId: string;
				producerId: string;
				paused?: boolean;
				rtpCapabilities: mediasoupTypes.RtpCapabilities;
			};
			responseData: { consumerId: string };
	  }
	| {
			name: 'resumeConsumer';
			data: {
				consumerId: string;
			};
	  };

export type RequestNameFromBroadcasterPeer =
	keyof RequestNameDataMap<RequestFromBroadcasterPeer>;

export type RequestDataFromBroadcasterPeer<
	Name extends RequestNameFromBroadcasterPeer,
> = RequestNameDataMap<RequestFromBroadcasterPeer>[Name];

export type RequestResponseDataFromBroadcasterPeer<
	Name extends RequestNameFromBroadcasterPeer,
> = RequestNameResponseDataMap<RequestFromBroadcasterPeer>[Name];

export type TypedApiRequestFromBroadcasterPeer = {
	[N in RequestNameFromBroadcasterPeer]: {
		name: N;
		data: RequestDataFromBroadcasterPeer<N>;
		accept: RequestResponseDataFromBroadcasterPeer<N> extends undefined
			? (responseData?: RequestResponseDataFromBroadcasterPeer<N>) => void
			: (responseData: RequestResponseDataFromBroadcasterPeer<N>) => void;
	};
}[RequestNameFromBroadcasterPeer];
