#!/usr/bin/env bash

set -e

export MEDIASOUP_USE_VALGRIND="true"
export MEDIASOUP_VALGRIND_OPTIONS=${MEDIASOUP_VALGRIND_OPTIONS:="--leak-check=full --track-fds=yes --log-file=./mediasoup_valgrind_%p.log"}

./run.sh
