#!/usr/bin/env bash

#
# This script must be placed into any subdirectory in the mediasoup-demo
# project and must be executed from the root folder.
#
# How to use it:
#
# 1. In your `config.mjs` set `preferredPayloadType` 100 for Opus and 101 for
#    VP8.
# 2. Connect a browser with mic and camera.
# 3. Enter the interactive terminal of the server.
# 4. Enter terminal mode.
# 5. Paste this code:
#
# ```ts
# consumers = Array.from(producers.values()).map(p => {
# 	return {
# 		kind: p.kind,
# 		id: p.id,
# 	};
# });
#
# audio = consumers.find(c => c.kind === 'audio');
# video = consumers.find(c => c.kind === 'video');
#
# console.log(
# 	`AUDIO_PRODUCER_ID=${audio.id} VIDEO_PRODUCER_ID=${video.id} AUDIO_CONSUMER_PT=100 VIDEO_CONSUMER_PT=101 ./test-ffmpeg-receive.sh`
# );
# ```
#
# 6. Copy the output and paste it in `ts-server/tmp/` folder.
#

read DOMAIN PORT HAS_TLS < <(node -pe "
	import('./server/config.mjs').then(m => {
		const c = m.config;
		const tls = c.http?.tls ? 'yes' : 'no';
		console.log([c.domain, c.http.listenPort, tls].join(' '));
	});
")

if [ "$HAS_TLS" = "yes" ]; then
  PROTOCOL="https"
else
  PROTOCOL="http"
fi

export SERVER_URL=${SERVER_URL:="${PROTOCOL}://${DOMAIN}:${PORT}"}
export ROOM_ID=${ROOM_ID:="dev"}
# export AUDIO_PRODUCER_ID=
# export VIDEO_PRODUCER_ID=
export AUDIO_CONSUMER_PT=${AUDIO_CONSUMER_PT:="100"}
export VIDEO_CONSUMER_PT=${VIDEO_CONSUMER_PT:="101"}

./broadcasters/ffmpeg-receiver.sh
