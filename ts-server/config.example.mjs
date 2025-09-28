/**
 * IMPORTANT (PLEASE READ THIS):
 *
 * This is not the "configuration file" of mediasoup. This is the server
 * configuration file in the mediasoup-demo app. mediasoup is a server-side
 * library, it* does not read any "configuration file". Instead it exposes an
 * API. This demo application just reads settings from this file (once copied
 * to config.mjs) and calls the mediasoup API with those settings when
 * appropriate.
 */

import * as os from 'node:os';
import * as url from 'node:url';
import * as path from 'node:path';

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** @type {import('./src/types.ts').Config} */
const config = {
	/**
	 * Listening hostname for browser app Vite development server.
	 */
	domain: 'localhost',
	/**
	 * Signaling settings (protoo WebSocket server and HTTP API server).
	 */
	https: {
		listenIp: '0.0.0.0',
		/**
		 * @remarks
		 * - Don't change listenPort (client app assumes 4443).
		 */
		listenPort: process.env['PROTOO_LISTEN_PORT']
			? Number(process.env['PROTOO_LISTEN_PORT'])
			: 4443,
		/**
		 * Optional. If tls is not set, server will use HTTP instead.
		 */
		tls: {
			certificateFile:
				process.env['HTTPS_CERTIFICATE_FILE'] ??
				`${__dirname}/certs/fullchain.pem`,
			privateKeyFile:
				process.env['HTTPS_PRIVATE_KEY_FILE'] ??
				`${__dirname}/certs/privkey.pem`,
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
					announcedAddress: process.env['MEDIASOUP_ANNOUNCED_IP'],
					port: 44444,
				},
				{
					protocol: 'tcp',
					ip: process.env['MEDIASOUP_LISTEN_IP'] ?? '0.0.0.0',
					announcedAddress: process.env['MEDIASOUP_ANNOUNCED_IP'],
					port: 44444,
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
			// Additional options that are not part of WebRtcTransportOptions.
			maxIncomingBitrate: 1500000,
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
				announcedAddress: process.env['MEDIASOUP_ANNOUNCED_IP'],
				portRange: {
					min: Number(process.env['MEDIASOUP_MIN_PORT']) || 40000,
					max: Number(process.env['MEDIASOUP_MAX_PORT']) || 49999,
				},
			},
			maxSctpMessageSize: 262144,
		},
	},
};

export default config;
