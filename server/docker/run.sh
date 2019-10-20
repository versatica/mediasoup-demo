#!/usr/bin/env bash

export DEBUG=${DEBUG:="mediasoup:INFO* *WARN* *ERROR*"}
export INTERACTIVE=${INTERACTIVE:="true"}

# Valgrind related options.
export MEDIASOUP_USE_VALGRIND=${MEDIASOUP_USE_VALGRIND:="false"}
export MEDIASOUP_VALGRIND_OPTIONS=${MEDIASOUP_VALGRIND_OPTIONS:="\
--leak-check=full|\
--track-fds=yes|\
--log-file=/storage/mediasoup_valgrind_`date +%s`.log\
"}

# NOTE: Make sure these values correspond with those provided in config.js.
: ${MEDIASOUP_MIN_PORT:?}
: ${MEDIASOUP_MAX_PORT:?}
: ${PROTOO_LISTEN_PORT:?}

docker run \
	--name=mediasoup-demo \
	-p ${PROTOO_LISTEN_PORT}:${PROTOO_LISTEN_PORT}/tcp \
	-p ${MEDIASOUP_MIN_PORT}-${MEDIASOUP_MAX_PORT}:${MEDIASOUP_MIN_PORT}-${MEDIASOUP_MAX_PORT}/udp \
	-p ${MEDIASOUP_MIN_PORT}-${MEDIASOUP_MAX_PORT}:${MEDIASOUP_MIN_PORT}-${MEDIASOUP_MAX_PORT}/tcp \
	-v ${PWD}:/storage \
	--init \
	-e DEBUG \
	-e INTERACTIVE \
	-e MEDIASOUP_USE_VALGRIND \
	-e MEDIASOUP_VALGRIND_OPTIONS \
	-it \
	--rm \
	mediasoup-demo:latest
