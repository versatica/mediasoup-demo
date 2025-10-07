#!/usr/bin/env bash

set -e

rm -f output.wav

# -report: generates a log file.
# -timeout N: Exit after N seconds without receiving RTP.

ffmpeg -loglevel debug -protocol_whitelist file,udp,rtp -async 1 -timeout 10000 -i test.sdp output.wav



# more:
#
# https://github.com/kevinGodell/ffmpeg-watchdog
