#!/usr/bin/env bash

function show_usage()
{
	echo
	echo "USAGE"
	echo "-----"
	echo
	echo "  SERVER_URL=https://my.mediasoup-demo.org:4443 ROOM_ID=test AUDIO_PRODUCER_ID=id1 VIDEO_PRODUCER_ID=id2 ./ffmpeg-receiver.sh"
	echo
	echo "  where:"
	echo "  - SERVER_URL is the URL of the mediasoup-demo API server"
	echo "  - ROOM_ID is the id of the mediasoup-demo room (it must exist in advance)"
	echo "  - AUDIO_PRODUCER_ID is the id of the mediasoup-demo audio producer"
	echo "  - VIDEO_PRODUCER_ID is the id of the mediasoup-demo video producer"
	echo "  - AUDIO_CONSUMER_PT is the codec payload type of the Opus codec in the mediasoup Router"
	echo "  - VIDEO_CONSUMER_PT is the codec payload type of the VP8 codec in the mediasoup Router"
	echo
	echo "NOTE"
	echo "----"
	echo
	echo "  This script assumes that the consuming audio and video streams use Opus and VP8 codecs"
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

if [ -z "${AUDIO_CONSUMER_PT}" ] ; then
	>&2 echo "ERROR: missing AUDIO_CONSUMER_PT environment variable"
	show_usage
	exit 1
fi

if [ -z "${VIDEO_CONSUMER_PT}" ] ; then
	>&2 echo "ERROR: missing VIDEO_CONSUMER_PT environment variable"
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

PEER_ID=$(LC_CTYPE=C tr -dc A-Za-z0-9 < /dev/urandom | fold -w ${1:-32} | head -n 1)
HTTPIE_COMMAND="http --check-status --verify=no"
LOCAL_IP=127.0.0.1
AUDIO_LOCAL_PORT=10000
AUDIO_LOCAL_RTCP_PORT=10001
VIDEO_LOCAL_PORT=10002
VIDEO_LOCAL_RTCP_PORT=10003
FFMPEG_PID=""

cat > /tmp/mediasoup-demo-ffmpeg-receiver.sdp <<EOF
v=0
o=- 0 0 IN IP4 127.0.0.1
s=mediasoup
c=IN IP4 127.0.0.1
t=0 0
a=tool:libavformat 55.7.100
m=audio ${AUDIO_LOCAL_PORT} RTP/AVP ${AUDIO_CONSUMER_PT}
a=rtpmap:${AUDIO_CONSUMER_PT} opus/48000/2
m=video ${VIDEO_LOCAL_PORT} RTP/AVP ${VIDEO_CONSUMER_PT}
a=rtpmap:${VIDEO_CONSUMER_PT} VP8/90000
EOF

#
# Verify that a room with id ROOM_ID does exist by sending a simlpe HTTP GET. If
# not abort since we are not allowed to initiate a room..
#
echo ">>> verifying that room '${ROOM_ID}' exists..."

${HTTPIE_COMMAND} \
	GET ${SERVER_URL}/rooms/${ROOM_ID} \
	Origin:${SERVER_URL} \
	> /dev/null

#
# Create a BroadcasterPeer entity in the server by sending a POST with our
# metadata. Note that this is not related to mediasoup at all, but will become
# just a JS object in the Node.js application to hold our metadata and mediasoup
# Transports and Consumers.
#
echo ">>> creating BroadcasterPeer..."

${HTTPIE_COMMAND} \
	POST ${SERVER_URL}/rooms/${ROOM_ID}/broadcasters \
	Origin:${SERVER_URL} \
	peerId="${PEER_ID}" \
	displayName="FFmpeg" \
	device:='{"name": "FFmpeg", "flag": "ffmpeg"}' \
	> /dev/null

#
# Upon script termination delete the BroadcasterPeer in the server by sending a
# HTTP DELETE.
#
trap 'echo ">>> script exited with status code $?"; ${HTTPIE_COMMAND} DELETE ${SERVER_URL}/rooms/${ROOM_ID}/broadcasters/${PEER_ID} Origin:${SERVER_URL} > /dev/null; [ -n "${FFMPEG_PID}" ] && kill -0 ${FFMPEG_PID} 2>/dev/null && kill ${FFMPEG_PID}' EXIT

echo ">>> creating mediasoup PlainTransport for consuming audio..."

res=$(${HTTPIE_COMMAND} \
	POST ${SERVER_URL}/rooms/${ROOM_ID}/broadcasters/${PEER_ID}/transports \
	Origin:${SERVER_URL} \
	direction="consumer" \
	comedia:=false \
	rtcpMux:=false \
	2> /dev/null)

eval "$(echo ${res} | jq -r '@sh "audioTransportId=\(.transportId)"')"

echo ">>> connecting mediasoup PlainTransport for consuming audio..."

${HTTPIE_COMMAND} -v \
	POST ${SERVER_URL}/rooms/${ROOM_ID}/broadcasters/${PEER_ID}/transports/${audioTransportId}/connect \
	Origin:${SERVER_URL} \
	ip="${LOCAL_IP}" \
	port:=${AUDIO_LOCAL_PORT} \
	rtcpPort:=${AUDIO_LOCAL_RTCP_PORT} \
	> /dev/null

echo ">>> creating mediasoup PlainTransport for consuming video..."

res=$(${HTTPIE_COMMAND} \
	POST ${SERVER_URL}/rooms/${ROOM_ID}/broadcasters/${PEER_ID}/transports \
	Origin:${SERVER_URL} \
	direction="consumer" \
	comedia:=false \
	rtcpMux:=false \
	2> /dev/null)

eval "$(echo ${res} | jq -r '@sh "videoTransportId=\(.transportId)"')"

echo ">>> connecting mediasoup PlainTransport for consuming video..."

${HTTPIE_COMMAND} -v \
	POST ${SERVER_URL}/rooms/${ROOM_ID}/broadcasters/${PEER_ID}/transports/${videoTransportId}/connect \
	Origin:${SERVER_URL} \
	ip="${LOCAL_IP}" \
	port:=${VIDEO_LOCAL_PORT} \
	rtcpPort:=${VIDEO_LOCAL_RTCP_PORT} \
	2> /dev/null

#
# Once transports are created, join the room.
#
echo ">>> joining the room..."

${HTTPIE_COMMAND} -v \
	POST ${SERVER_URL}/rooms/${ROOM_ID}/broadcasters/${PEER_ID}/join \
	Origin:${SERVER_URL} \
	> /dev/null

echo ">>> creating mediasoup audio Consumer..."

${HTTPIE_COMMAND} \
	POST ${SERVER_URL}/rooms/${ROOM_ID}/broadcasters/${PEER_ID}/consumers \
	Origin:${SERVER_URL} \
	transportId=${audioTransportId} \
	producerId="${AUDIO_PRODUCER_ID}" \
	paused:=false \
	rtpCapabilities:="{ \"codecs\": [{ \"kind\": \"audio\", \"mimeType\":\"audio/opus\", \"preferredPayloadType\":${AUDIO_CONSUMER_PT}, \"clockRate\": 48000, \"channels\": 2, \"parameters\": { \"useinbandfec\": 1 } }] }" \
	2> /dev/null

eval "$(echo ${res} | jq -r '@sh "audioConsumerId=\(.consumerId)"')"

echo ">>> creating mediasoup video Consumer..."

res=$(${HTTPIE_COMMAND} \
	POST ${SERVER_URL}/rooms/${ROOM_ID}/broadcasters/${PEER_ID}/consumers \
	Origin:${SERVER_URL} \
	transportId=${videoTransportId} \
	producerId="${VIDEO_PRODUCER_ID}" \
	paused:=true \
	rtpCapabilities:="{ \"codecs\": [{ \"kind\": \"video\", \"mimeType\":\"video/VP8\", \"preferredPayloadType\":${VIDEO_CONSUMER_PT}, \"clockRate\": 90000, \"parameters\": {}, \"rtcpFeedback\": [{ \"type\": \"nack\" }] }] }" \
	2> /dev/null)

eval "$(echo ${res} | jq -r '@sh "videoConsumerId=\(.consumerId)"')"

echo ">>> running ffmpeg..."

# NOTE: This is for Linux with Pulse audio.
# ffmpeg \
# 	-v info \
# 	-thread_queue_size 1500 \
# 	-protocol_whitelist file,udp,rtp \
# 	-i /tmp/mediasoup-demo-ffmpeg-receiver.sdp \
# 	-f pulse -device default stream \
# 	-f xv display &
#
# FFMPEG_PID=$!

# NOTE: This is for macOS with ffmpeg with sdl2 support (whatever it is).
# NOTE: brew install ffmpeg --with-sdl2 (it fails, hehe).
# ffmpeg \
# 	-v info \
# 	-thread_queue_size 1500 \
# 	-protocol_whitelist file,udp,rtp \
# 	-i /tmp/mediasoup-demo-ffmpeg-receiver.sdp \
# 	-f audiotoolbox default \
# 	-f sdl2 -
#
# FFMPEG_PID=$!

echo ">>> running ffplay..."

ffplay \
	-protocol_whitelist file,udp,rtp \
	-i /tmp/mediasoup-demo-ffmpeg-receiver.sdp \
	-window_title "mediasoup-demo ffmpeg-receiver" \
	-probesize 5000000 \
	-analyzeduration 10000000 \
	-loglevel repeat+level+debug &

FFMPEG_PID=$!
sleep 2

echo ">>> resuming video Consumer ${videoConsumerId}..."; \

${HTTPIE_COMMAND} -v \
	POST ${SERVER_URL}/rooms/${ROOM_ID}/broadcasters/${PEER_ID}/consumers/${videoConsumerId}/resume \
	Origin:${SERVER_URL} \
	> /dev/null;

wait ${ffmpeg_pid}
