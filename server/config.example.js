/**
 * IMPORTANT (PLEASE READ THIS):
 *
 * This is not the "configuration file" of mediasoup. This is the configuration
 * file of the mediasoup-demo app. mediasoup itself is a server-side library, it
 * does not read any "configuration file". Instead it exposes an API. This demo
 * application just reads settings from this file (once copied to config.js) and
 * calls the mediasoup API with those settings when appropriate.
 */

const os = require('os');

module.exports =
{
	// Listening hostname (just for `gulp live` task).
	domain : 'localhost',
	// Signaling settings (protoo WebSocket server and HTTP API server).
	https  :
	{
		listenIp   : '0.0.0.0',
		// NOTE: Don't change listenPort (client app assumes 4443).
		listenPort : 4443,
		// NOTE: Set your own valid certificate files.
		tls        :
		{
			cert : `${__dirname}/certs/mediasoup-demo.localhost.cert.pem`,
			key  : `${__dirname}/certs/mediasoup-demo.localhost.key.pem`
		}
	},
	// mediasoup settings.
	mediasoup :
	{
		// Number of mediasoup workers to launch.
		numWorkers : Object.keys(os.cpus()).length,
		// mediasoup Worker settings.
		// See https://mediasoup.org/documentation/v3/mediasoup/api/#WorkerSettings
		worker     :
		{
			logLevel : 'warn',
			logTags  :
			[
				'info',
				'ice',
				'dtls',
				'rtp',
				'srtp',
				'rtcp',
				// 'rtx',
				// 'bwe',
				// 'score',
				// 'simulcast',
				// 'svc'
			],
			rtcMinPort : 40000,
			rtcMaxPort : 49999
		},
		// mediasoup Router options.
		// See https://mediasoup.org/documentation/v3/mediasoup/api/#RouterOptions
		router :
		{
			mediaCodecs :
			[
				{
					kind      : 'audio',
					mimeType  : 'audio/opus',
					clockRate : 48000,
					channels  : 2
				},
				{
					kind       : 'video',
					mimeType   : 'video/VP8',
					clockRate  : 90000,
					parameters :
					{
						'x-google-start-bitrate' : 1000
					}
				},
				{
					kind       : 'video',
					mimeType   : 'video/h264',
					clockRate  : 90000,
					parameters :
					{
						'packetization-mode'      : 1,
						'profile-level-id'        : '4d0032',
						'level-asymmetry-allowed' : 1,
						'x-google-start-bitrate'  : 1000
					}
				},
				{
					kind       : 'video',
					mimeType   : 'video/h264',
					clockRate  : 90000,
					parameters :
					{
						'packetization-mode'      : 1,
						'profile-level-id'        : '42e01f',
						'level-asymmetry-allowed' : 1,
						'x-google-start-bitrate'  : 1000
					}
				}
			]
		},
		// mediasoup WebRtcTransport options.
		// See https://mediasoup.org/documentation/v3/mediasoup/api/#WebRtcTransportOptions
		webRtcTransport :
		{
			listenIps :
			[
				{ ip: '1.2.3.4', announcedIp: null }
			],
			maxIncomingBitrate              : 1500000,
			initialAvailableOutgoingBitrate : 1000000,
			minimumAvailableOutgoingBitrate : 300000
		}
	}
};
