#!/usr/bin/env bash

export SERVER_URL=${SERVER_URL:="https://local.aliax.net:4443"}
export ROOM_ID=${ROOM_ID:="dev"}
export MEDIA_FILE=${MEDIA_FILE:="../app/public/videos/video-audio-stereo.mp4"}

../../broadcasters/ffmpeg.sh
