#!/usr/bin/env bash

#
# This script must be placed into any subdirectory in the mediasoup-demo
# project and must be executed from the root folder.
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
export MEDIA_FILE=${MEDIA_FILE:="${PWD}/app/public/videos/video-audio-stereo.mp4"}

./broadcasters/gstreamer.sh
