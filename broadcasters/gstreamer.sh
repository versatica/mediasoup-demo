#!/usr/bin/env bash

function show_usage()
{
	echo
	echo "USAGE"
	echo "-----"
	echo
	echo "  SERVER_URL=https://my.mediasoup-demo.org:4443 ROOM_ID=test MEDIA_FILE=./test.mp4 ./gstreamer.sh"
	echo
	echo "  where:"
	echo "  - SERVER_URL is the URL of the mediasoup-demo API server"
	echo "  - ROOM_ID is the id of the mediasoup-demo room (it must exist in advance)"
	echo "  - MEDIA_FILE is the path to a audio+video file (such as a .mp4 file)"
	echo
	echo "REQUIREMENTS"
	echo "------------"
	echo
	echo "  - gstreamer: stream audio and video (https://gstreamer.freedesktop.org)"
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

if [ -z "${MEDIA_FILE}" ] ; then
	>&2 echo "ERROR: missing MEDIA_FILE environment variable"
	show_usage
	exit 1
fi

if [ "$(command -v gst-launch-1.0)" == "" ] ; then
	>&2 echo "ERROR: gst-launch-1.0 command not found, must install GStreamer"
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
HTTPIE_COMMAND="http --check-status"
AUDIO_SSRC=1111
AUDIO_PT=100
VIDEO_SSRC=2222
VIDEO_PT=101

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
	device:='{"name": "GStreamer"}' \
	> /dev/null

#
# Upon script termination delete the Broadcaster in the server by sending a
# HTTP DELETE.
#
trap 'echo ">>> script exited with status code $?"; ${HTTPIE_COMMAND} DELETE ${SERVER_URL}/rooms/${ROOM_ID}/broadcasters/${BROADCASTER_ID} > /dev/null' EXIT

#
# Create a PlainTransport in the mediasoup to send our audio using plain RTP
# over UDP. Do it via HTTP post specifying type:"plain" and comedia:true and
# rtcpMux:false.
#
echo ">>> creating mediasoup PlainTransport for producing audio..."

res=$(${HTTPIE_COMMAND} \
	POST ${SERVER_URL}/rooms/${ROOM_ID}/broadcasters/${BROADCASTER_ID}/transports \
	type="plain" \
	comedia:=true \
	rtcpMux:=false \
	2> /dev/null)

#
# Parse JSON response into Shell variables and extract the PlainTransport id,
# IP, port and RTCP port.
#
eval "$(echo ${res} | jq -r '@sh "audioTransportId=\(.id) audioTransportIp=\(.ip) audioTransportPort=\(.port) audioTransportRtcpPort=\(.rtcpPort)"')"

#
# Create a PlainTransport in the mediasoup to send our video using plain RTP
# over UDP. Do it via HTTP post specifying type:"plain" and comedia:true and
# rtcpMux:false.
#
echo ">>> creating mediasoup PlainTransport for producing video..."

res=$(${HTTPIE_COMMAND} \
	POST ${SERVER_URL}/rooms/${ROOM_ID}/broadcasters/${BROADCASTER_ID}/transports \
	type="plain" \
	comedia:=true \
	rtcpMux:=false \
	2> /dev/null)

#
# Parse JSON response into Shell variables and extract the PlainTransport id,
# IP, port and RTCP port.
#
eval "$(echo ${res} | jq -r '@sh "videoTransportId=\(.id) videoTransportIp=\(.ip) videoTransportPort=\(.port) videoTransportRtcpPort=\(.rtcpPort)"')"

#
# Create a mediasoup Producer to send audio by sending our RTP parameters via a
# HTTP POST.
#
echo ">>> creating mediasoup audio Producer..."

${HTTPIE_COMMAND} -v \
	POST ${SERVER_URL}/rooms/${ROOM_ID}/broadcasters/${BROADCASTER_ID}/transports/${audioTransportId}/producers \
	kind="audio" \
	rtpParameters:="{ \"codecs\": [{ \"mimeType\":\"audio/opus\", \"payloadType\":${AUDIO_PT}, \"clockRate\":48000, \"channels\":2, \"parameters\":{ \"sprop-stereo\":1 } }], \"encodings\": [{ \"ssrc\":${AUDIO_SSRC} }] }" \
	> /dev/null

#
# Create a mediasoup Producer to send video by sending our RTP parameters via a
# HTTP POST.
#
echo ">>> creating mediasoup video Producer..."

${HTTPIE_COMMAND} -v \
	POST ${SERVER_URL}/rooms/${ROOM_ID}/broadcasters/${BROADCASTER_ID}/transports/${videoTransportId}/producers \
	kind="video" \
	rtpParameters:="{ \"codecs\": [{ \"mimeType\":\"video/vp8\", \"payloadType\":${VIDEO_PT}, \"clockRate\":90000 }], \"encodings\": [{ \"ssrc\":${VIDEO_SSRC} }] }" \
	> /dev/null

#
# Run gstreamer command and make it send audio and video RTP with codec payload and
# SSRC values matching those that we have previously signaled in the Producers
# creation above. Also, tell gstreamer to send the RTP to the mediasoup
# PlainTransports' ip and port.
#
echo ">>> running gstreamer..."

gst-launch-1.0 \
	rtpbin name=rtpbin \
	filesrc location=${MEDIA_FILE} \
	! qtdemux name=demux \
	demux.video_0 \
	! queue \
	! decodebin \
	! videoconvert \
	! vp8enc target-bitrate=1000000 deadline=1 cpu-used=4 \
	! rtpvp8pay pt=${VIDEO_PT} ssrc=${VIDEO_SSRC} picture-id-mode=2 \
	! rtpbin.send_rtp_sink_0 \
	rtpbin.send_rtp_src_0 ! udpsink host=${videoTransportIp} port=${videoTransportPort} \
	rtpbin.send_rtcp_src_0 ! udpsink host=${videoTransportIp} port=${videoTransportRtcpPort} sync=false async=false \
	demux.audio_0 \
	! queue \
	! decodebin \
	! audioresample \
	! audioconvert \
	! opusenc \
	! rtpopuspay pt=${AUDIO_PT} ssrc=${AUDIO_SSRC} \
	! rtpbin.send_rtp_sink_1 \
	rtpbin.send_rtp_src_1 ! udpsink host=${audioTransportIp} port=${audioTransportPort} \
    rtpbin.send_rtcp_src_1 ! udpsink host=${audioTransportIp} port=${audioTransportRtcpPort} sync=false async=false
