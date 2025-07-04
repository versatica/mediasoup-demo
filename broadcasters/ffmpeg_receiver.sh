#!/usr/bin/env bash

function show_usage()
{
	echo
	echo "USAGE"
	echo "-----"
	echo
	echo "  SERVER_URL=https://my.mediasoup-demo.org:4443 ROOM_ID=test AUDIO_PRODUCER_ID=id1 VIDEO_PRODUCER_ID=id2 ./ffmpeg_receiver.sh"
	echo
	echo "  where:"
	echo "  - SERVER_URL is the URL of the mediasoup-demo API server"
	echo "  - ROOM_ID is the id of the mediasoup-demo room (it must exist in advance)"
	echo "  - AUDIO_PRODUCER_ID is the id of the mediasoup-demo audio producer"
	echo "  - VIDEO_PRODUCER_ID is the id of the mediasoup-demo video producer"
	echo
	echo "REQUIREMENTS"
	echo "------------"
	echo
	echo "  - ffmpeg: stream audio and video (https://www.ffmpeg.org)"
	echo "  - httpie: command line HTTP client (https://httpie.org)"
	echo "  - jq: command-line JSON processor (https://stedolan.github.io/jq)"
	echo
}

echo

if [ -z "${SERVER_URL}" ] ; then
	>&2 echo "ERROR: missing SERVER_URL environment variable"
	show_usage
	exit 1
fi

if [ -z "${ROOM_ID}" ] ; then
	>&2 echo "ERROR: missing ROOM_ID environment variable"
	show_usage
	exit 1
fi

if [ -z "${AUDIO_PRODUCER_ID}" ] ; then
	>&2 echo "ERROR: missing AUDIO_PRODUCER_ID environment variable"
	show_usage
	exit 1
fi

if [ -z "${VIDEO_PRODUCER_ID}" ] ; then
	>&2 echo "ERROR: missing VIDEO_PRODUCER_ID environment variable"
	show_usage
	exit 1
fi

if [ "$(command -v ffmpeg)" == "" ] ; then
	>&2 echo "ERROR: ffmpeg command not found, must install FFmpeg"
	show_usage
	exit 1
fi

if [ "$(command -v http)" == "" ] ; then
	>&2 echo "ERROR: http command not found, must install httpie"
	show_usage
	exit 1
fi

if [ "$(command -v jq)" == "" ] ; then
	>&2 echo "ERROR: jq command not found, must install jq"
	show_usage
	exit 1
fi

set -e

BROADCASTER_ID=$(LC_CTYPE=C tr -dc A-Za-z0-9 < /dev/urandom | fold -w ${1:-32} | head -n 1)
HTTPIE_COMMAND="http --check-status --verify=no"
AUDIO_PT=100
VIDEO_PT=101
LOCAL_IP=127.0.0.1
AUDIO_LOCAL_PORT=10000
AUDIO_LOCAL_RTCP_PORT=10001
VIDEO_LOCAL_PORT=10002
VIDEO_LOCAL_RTCP_PORT=10003

cat > /tmp/ffmpeg.sdp <<EOF
v=0
o=- 0 0 IN IP4 127.0.0.1
s=mediasoup
c=IN IP4 127.0.0.1
t=0 0
a=tool:libavformat 55.7.100
m=audio ${AUDIO_LOCAL_PORT} RTP/AVP ${AUDIO_PT}
a=rtpmap:${AUDIO_PT} opus/48000/2
m=video ${VIDEO_LOCAL_PORT} RTP/AVP ${VIDEO_PT}
a=rtpmap:${VIDEO_PT} VP8/90000
EOF

#
# Verify that a room with id ROOM_ID does exist by sending a simlpe HTTP GET. If
# not abort since we are not allowed to initiate a room..
#
echo ">>> verifying that room '${ROOM_ID}' exists..."

${HTTPIE_COMMAND} \
	GET ${SERVER_URL}/rooms/${ROOM_ID} > /dev/null

#
# Create a Broadcaster entity in the server by sending a POST with our metadata.
# Note that this is not related to mediasoup at all, but will become just a JS
# object in the Node.js application to hold our metadata and mediasoup Transports
# and Producers.
#
echo ">>> creating Broadcaster..."

${HTTPIE_COMMAND} \
	POST ${SERVER_URL}/rooms/${ROOM_ID}/broadcasters \
	id="${BROADCASTER_ID}" \
	displayName="Broadcaster" \
	device:='{"name": "FFmpeg"}' \
	> /dev/null

#
# Upon script termination delete the Broadcaster in the server by sending a
# HTTP DELETE.
#
trap 'echo ">>> script exited with status code $?"; ${HTTPIE_COMMAND} DELETE ${SERVER_URL}/rooms/${ROOM_ID}/broadcasters/${BROADCASTER_ID} > /dev/null' EXIT

# audio
echo ">>> creating mediasoup PlainTransport for consuming audio..."
res=$(${HTTPIE_COMMAND} \
	POST ${SERVER_URL}/rooms/${ROOM_ID}/broadcasters/${BROADCASTER_ID}/transports \
	type="plain" \
	comedia:=false \
	rtcpMux:=false \
	enableSctp:=false \
	2> /dev/null)
eval "$(echo ${res} | jq -r '@sh "audioTransportId=\(.id)"')"

echo ">>> connecting mediasoup PlainTransport for consuming audio..."
${HTTPIE_COMMAND} -v \
	POST ${SERVER_URL}/rooms/${ROOM_ID}/broadcasters/${BROADCASTER_ID}/transports/${audioTransportId}/connect \
	ip="${LOCAL_IP}" \
	port:=${AUDIO_LOCAL_PORT} \
	rtcpPort:=${AUDIO_LOCAL_RTCP_PORT} \
	> /dev/null

echo ">>> creating mediasoup audio Consumer..."
${HTTPIE_COMMAND} \
	POST ${SERVER_URL}/rooms/${ROOM_ID}/broadcasters/${BROADCASTER_ID}/transports/${audioTransportId}/consume \
	producerId="${AUDIO_PRODUCER_ID}" \
	paused:=false \
	rtpCapabilities:="{ \"codecs\": [{ \"kind\": \"audio\", \"mimeType\":\"audio/opus\", \"preferredPayloadType\":${AUDIO_PT}, \"clockRate\": 48000, \"channels\": 2, \"parameters\": { \"useinbandfec\": 1 } }] }" \
	> /dev/null

# video
echo ">>> creating mediasoup PlainTransport for consuming video..."
res=$(${HTTPIE_COMMAND} \
	POST ${SERVER_URL}/rooms/${ROOM_ID}/broadcasters/${BROADCASTER_ID}/transports \
	type="plain" \
	comedia:=false \
	rtcpMux:=false \
	enableSctp:=false \
	2> /dev/null)
eval "$(echo ${res} | jq -r '@sh "videoTransportId=\(.id)"')"

echo ">>> connecting mediasoup PlainTransport for consuming video..."
${HTTPIE_COMMAND} -v \
	POST ${SERVER_URL}/rooms/${ROOM_ID}/broadcasters/${BROADCASTER_ID}/transports/${videoTransportId}/connect \
	ip="${LOCAL_IP}" \
	port:=${VIDEO_LOCAL_PORT} \
	rtcpPort:=${VIDEO_LOCAL_RTCP_PORT} \
	> /dev/null

echo ">>> creating mediasoup video Consumer..."
res=$(${HTTPIE_COMMAND} \
	POST ${SERVER_URL}/rooms/${ROOM_ID}/broadcasters/${BROADCASTER_ID}/transports/${videoTransportId}/consume \
	producerId="${VIDEO_PRODUCER_ID}" \
	paused:=true \
	rtpCapabilities:="{ \"codecs\": [{ \"kind\": \"video\", \"mimeType\":\"video/VP8\", \"preferredPayloadType\":${VIDEO_PT}, \"clockRate\": 90000, \"parameters\": {}, \"rtcpFeedback\": [{ \"type\": \"nack\" }] }] }" \
	2> /dev/null)
eval "$(echo ${res} | jq -r '@sh "videoConsumerId=\(.id)"')"

echo ">>> running ffmpeg..."
/usr/bin/ffmpeg \
	-v info \
	-thread_queue_size 1500 \
	-protocol_whitelist file,udp,rtp \
	-i /tmp/ffmpeg.sdp \
	-f pulse -device default stream \
	-f xv display &
ffmpeg_pid=$!

echo ">>> resuming video Consumer ${videoConsumerId}..."; \
${HTTPIE_COMMAND} -v \
	POST ${SERVER_URL}/rooms/${ROOM_ID}/broadcasters/${BROADCASTER_ID}/transports/${videoTransportId}/resume \
	consumerId="${videoConsumerId}" \
	> /dev/null;

wait ${ffmpeg_pid}
