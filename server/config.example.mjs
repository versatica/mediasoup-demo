/**
 * IMPORTANT (PLEASE READ THIS):
 *
 * This is not the "configuration file" of mediasoup. This is the configuration
 * file of the mediasoup-demo server. mediasoup is a server-side library, it
 * does not read any "configuration file". Instead it exposes an API. This demo
 * application just reads settings from this file (once copied to config.mjs)
 * and calls the mediasoup API with those settings when appropriate.
 */

import * as os from 'node:os';

/**
 * @type {import('./src/types.ts').ServerConfig}
 */
export const config = {
	/**
	 * Server domain. WebSocket and HTTP API connections with an Origin header
	 * not matching this domain will be rejected.
	 */
	domain: 'localhost',
	/**
	 * Signaling settings (Protoo WebSocket server and HTTP API server).
	 */
	http: {
		listenIp: '0.0.0.0',
		listenPort: Number(process.env['HTTP_LISTEN_PORT'] ?? 4443),
		/**
		 * Optional. If tls is not set, server will use HTTP instead.
		 */
		tls: {
			cert: 'ABSOLUTE_PATH_TO_YOUR_TLS_CERTIFICATE_FULLCHAIN',
			key: 'ABSOLUTE_PATH_TO_YOUR_TLS_CERTIFICATE_PRIVATE_KEY',
		},
	},
	/**
	 * mediasoup settings.
	 */
	mediasoup: {
		// Number of mediasoup workers to launch.
		numWorkers: Object.keys(os.cpus()).length,
		/**
		 * mediasoup WorkerSettings.
		 *
		 * @see https://mediasoup.org/documentation/v3/mediasoup/api/#WorkerSettings
		 */
		workerSettings: {
			dtlsCertificateFile: undefined,
			dtlsPrivateKeyFile: undefined,
			logLevel: 'warn',
			logTags: [
				'info',
				'ice',
				'dtls',
				'rtp',
				'srtp',
				'rtcp',
				'rtx',
				'bwe',
				'score',
				'simulcast',
				'svc',
				'sctp',
			],
			disableLiburing: false,
		},
		/**
		 * mediasoup Router options.
		 *
		 * @see https://mediasoup.org/documentation/v3/mediasoup/api/#RouterOptions
		 */
		routerOptions: {
			mediaCodecs: [
				{
					kind: 'audio',
					mimeType: 'audio/opus',
					clockRate: 48000,
					channels: 2,
				},
				{
					kind: 'video',
					mimeType: 'video/VP8',
					clockRate: 90000,
					parameters: {
						'x-google-start-bitrate': 1000,
					},
				},
				{
					kind: 'video',
					mimeType: 'video/VP9',
					clockRate: 90000,
					parameters: {
						'profile-id': 2,
						'x-google-start-bitrate': 1000,
					},
				},
				{
					kind: 'video',
					mimeType: 'video/h264',
					clockRate: 90000,
					parameters: {
						'packetization-mode': 1,
						'profile-level-id': '4d0032',
						'level-asymmetry-allowed': 1,
						'x-google-start-bitrate': 1000,
					},
				},
				{
					kind: 'video',
					mimeType: 'video/h264',
					clockRate: 90000,
					parameters: {
						'packetization-mode': 1,
						'profile-level-id': '42e01f',
						'level-asymmetry-allowed': 1,
						'x-google-start-bitrate': 1000,
					},
				},
			],
		},
		/**
		 * mediasoup WebRtcServer options for WebRTC endpoints (mediasoup-client,
		 * libmediasoupclient).
		 *
		 * @see https://mediasoup.org/documentation/v3/mediasoup/api/#WebRtcServerOptions
		 *
		 * @remarks
		 * - `port` is mandatory here.
		 * - Room.ts in mediasoup-demo server will increase this port for each
		 *   mediasoup Worker since each Worker is a separate process.
		 */
		webRtcServerOptions: {
			listenInfos: [
				{
					protocol: 'udp',
					ip: process.env['MEDIASOUP_LISTEN_IP'] ?? '0.0.0.0',
					announcedAddress: process.env['MEDIASOUP_ANNOUNCED_ADDRESS'],
					port: 44444,
					sendBufferSize: undefined,
					recvBufferSize: undefined,
				},
				{
					protocol: 'tcp',
					ip: process.env['MEDIASOUP_LISTEN_IP'] ?? '0.0.0.0',
					announcedAddress: process.env['MEDIASOUP_ANNOUNCED_ADDRESS'],
					port: 44444,
					sendBufferSize: undefined,
					recvBufferSize: undefined,
				},
			],
		},
		/**
		 * mediasoup WebRtcTransport options for WebRTC endpoints (mediasoup-client,
		 * libmediasoupclient).
		 *
		 * @see https://mediasoup.org/documentation/v3/mediasoup/api/#WebRtcTransportOptions
		 */
		webRtcTransportOptions: {
			initialAvailableOutgoingBitrate: 1000000,
			minimumAvailableOutgoingBitrate: 600000,
			maxSctpMessageSize: 262144,
		},
		/**
		 * Additional options that are not part of WebRtcTransportOptions but
		 * instead used for function calls.
		 */
		additionalWebRtcTransportOptions: {
			maxIncomingBitrate: undefined,
		},
		/**
		 * mediasoup PlainTransport options for RTP endpoints (FFmpeg, GStreamer).
		 *
		 * @see https://mediasoup.org/documentation/v3/mediasoup/api/#PlainTransportOptions
		 */
		plainTransportOptions: {
			listenInfo: {
				protocol: 'udp',
				ip: process.env['MEDIASOUP_LISTEN_IP'] ?? '0.0.0.0',
				announcedAddress: process.env['MEDIASOUP_ANNOUNCED_ADDRESS'],
				portRange: {
					min: Number(process.env['MEDIASOUP_MIN_PORT'] ?? 40000),
					max: Number(process.env['MEDIASOUP_MAX_PORT'] ?? 40999),
				},
				// sendBufferSize: 2000000,
				// recvBufferSize: 2000000,
			},
			maxSctpMessageSize: 262144,
		},
	},
};
