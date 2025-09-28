import * as mediasoupTypes from 'mediasoup/types';

import { Room } from './Room';

export type Config = {
	domain: string;
	https: {
		listenIp: string;
		listenPort: number;
		tls?: {
			certificateFile: string;
			privateKeyFile: string;
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

export type WorkerAppData = {
	idx: number;
};
