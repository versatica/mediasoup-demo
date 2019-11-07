#!/usr/bin/env bash

set -e

export MEDIASOUP_USE_VALGRIND="true"
export MEDIASOUP_VALGRIND_OPTIONS=${MEDIASOUP_VALGRIND_OPTIONS:="--leak-check=full --track-fds=yes --log-file=./mediasoup_valgrind_%p.log"}
# export MEDIASOUP_VALGRIND_OPTIONS=${MEDIASOUP_VALGRIND_OPTIONS:="--leak-check=full --track-fds=yes"}
export DEBUG="*worker* *WARN* *ERROR* mediasoup_worker*"
export INTERACTIVE="true"

./server.js
