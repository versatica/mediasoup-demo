/**
 * IMPORTANT:
 *
 * This is not the "configuration file" of mediasoup. This is the configuration
 * file of the mediasoup-demo app. mediasoup itself is a server-side library, It
 * does not read any "configuration file". Instead it exposes an API. This demo
 * application just reads settings from this file and calls the mediasoup API with
 * them when appropriate.
 */

module.exports =
{
	// Listening hostname (just for for `gulp live|open` tasks).
	domain : 'localhost',
	// Signaling settings.
	protoo :
	{
		listenIp   : '0.0.0.0',
		listenPort : 4443, // NOTE: Don't change it (client app assumes 4443).
		tls        :
		{
			cert : `${__dirname}/certs/mediasoup-demo.localhost.cert.pem`,
			key  : `${__dirname}/certs/mediasoup-demo.localhost.key.pem`
		}
	},
	// Media settings.
	mediasoup :
	{
		// mediasoup Worker settings.
		worker :
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
				// 'rbe',
				// 'rtx'
			],
			rtcMinPort : 40000,
			rtcMaxPort : 49999
		},
		// mediasoup Router settings.
		router :
		{
			// Router media codecs.
			mediaCodecs :
			[
				{
					kind       : 'audio',
					name       : 'opus',
					mimeType   : 'audio/opus',
					clockRate  : 48000,
					channels   : 2,
					parameters :
					{
						useinbandfec : 1
					}
				},
				{
					kind       : 'video',
					name       : 'VP8',
					mimeType   : 'video/VP8',
					clockRate  : 90000,
					parameters :
					{
						'x-google-start-bitrate': 1500
					}
				},
				{
					kind       : 'video',
					name       : 'h264',
					mimeType   : 'video/h264',
					clockRate  : 90000,
					parameters :
					{
						'packetization-mode'      : 1,
						'profile-level-id'        : '42e01f',
						'level-asymmetry-allowed' : 1
					}
				}
			]
		},
		// mediasoup WebRtcTransport settings.
		webRtcTransport :
		{
			listenIps :
			[
				{ ip: '1.2.3.4', announcedIp: null }
			],
			maxIncomingBitrate : 1500000
		}
	}
};
