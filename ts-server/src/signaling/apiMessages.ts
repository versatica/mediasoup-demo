import type * as mediasoupTypes from 'mediasoup/types';

import { RequestNameDataMap, RequestNameResponseDataMap } from './common';
import type {
	PeerId,
	PeerDevice,
	SerializedPeer,
	TransportDirection,
	PlainTransportAppData,
	PeerProducerAppData,
	ConsumerAppData,
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
				rtpCapabilities?: mediasoupTypes.RtpCapabilities;
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
			name: 'close';
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
	  };
// | {
// 		name: 'connectPlainTransport';
// 		data: {
// 			direction: TransportDirection;
// 			// TODO
// 			dtlsParameters: mediasoupTypes.DtlsParameters;
// 		};
//   }
// | {
// 		name: 'produce';
// 		data: {
// 			kind: mediasoupTypes.MediaKind;
// 			rtpParameters: mediasoupTypes.RtpParameters;
// 			appData: PeerProducerAppData;
// 		};
// 		responseData: { producerId: string };
//   };

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
