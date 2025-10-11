import type * as mediasoupTypes from 'mediasoup-client/types';

import type {
	PeerId,
	PeerDevice,
	PlainTransportAppData,
	PeerProducerAppData,
	RoomId,
	ApiHttpMethod,
	ApiHttpPath,
} from '../types';

/**
 * Requests sent from broadcaster to server using the HTTP API.
 */
type Request =
	| {
			name: 'getRouterRtpCapabilities';
			method: 'GET';
			path: ['rooms', { roomId: RoomId }];
			responseData: {
				routerRtpCapabilities: mediasoupTypes.RtpCapabilities;
			};
	  }
	| {
			name: 'createBroadcasterPeer';
			method: 'POST';
			path: ['rooms', { roomId: RoomId }, 'broadcasters'];
			data: {
				peerId: PeerId;
				displayName: string;
				device: PeerDevice;
			};
	  }
	| {
			name: 'join';
			method: 'POST';
			path: [
				'rooms',
				{ roomId: RoomId },
				'broadcasters',
				{ peerId: PeerId },
				'join',
			];
	  }
	| {
			name: 'disconnect';
			method: 'DELETE';
			path: ['rooms', { roomId: RoomId }, 'broadcasters', { peerId: PeerId }];
	  }
	| {
			name: 'createPlainTransport';
			method: 'POST';
			path: [
				'rooms',
				{ roomId: RoomId },
				'broadcasters',
				{ peerId: PeerId },
				'transports',
			];
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
			method: 'POST';
			path: [
				'rooms',
				{ roomId: RoomId },
				'broadcasters',
				{ peerId: PeerId },
				'transports',
				{ transportId: string },
				'connect',
			];
			data: {
				ip: string;
				port: number;
				rtcpPort?: number;
			};
	  }
	| {
			name: 'produce';
			method: 'POST';
			path: [
				'rooms',
				{ roomId: RoomId },
				'broadcasters',
				{ peerId: PeerId },
				'producers',
			];
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
			method: 'POST';
			path: [
				'rooms',
				{ roomId: RoomId },
				'broadcasters',
				{ peerId: PeerId },
				'consumers',
			];
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
			method: 'POST';
			path: [
				'rooms',
				{ roomId: RoomId },
				'broadcasters',
				{ peerId: PeerId },
				'consumers',
				{ consumerId: string },
				'resume',
			];
	  };

type RequestNameApiHttpMethodMap<
	U extends { name: string; method: ApiHttpMethod },
> = {
	[K in U as K['name']]: K['method'];
};

type RequestNameApiHttpPathMap<U extends { name: string; path: ApiHttpPath }> =
	{
		[K in U as K['name']]: K['path'];
	};

type RequestNameDataMap<U extends { name: string }> = {
	[K in U as K['name']]: K extends { data: infer D } ? D : undefined;
};

type RequestNameResponseDataMap<U extends { name: string }> = {
	[K in U as K['name']]: K extends { responseData: infer R } ? R : undefined;
};

export type RequestName = Request['name'];

export type RequestApiHttpMethod<Name extends RequestName> =
	RequestNameApiHttpMethodMap<Request>[Name];

export type RequestApiHttpPath<Name extends RequestName> =
	RequestNameApiHttpPathMap<Request>[Name];

export type RequestData<Name extends RequestName> =
	RequestNameDataMap<Request>[Name];

export type RequestResponseData<Name extends RequestName> =
	RequestNameResponseDataMap<Request>[Name];

export type TypedApiRequest<Name extends RequestName> = {
	[N in Name]: {
		name: N;
		method: RequestApiHttpMethod<N>;
		path: RequestApiHttpPath<N>;
		data: RequestData<N>;
		accept: RequestResponseData<N> extends undefined
			? () => void
			: (responseData: RequestResponseData<N>) => void;
	};
}[Name];
