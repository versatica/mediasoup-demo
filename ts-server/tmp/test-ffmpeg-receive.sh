#!/usr/bin/env bash

read DOMAIN PORT HAS_TLS < <(node -pe "
	import('../config.mjs').then(m => {
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

../../broadcasters/ffmpeg-receiver.sh
