#!/usr/bin/env bash

function log_info() {
	echo -e "\033[0;36m[start.sh] [INFO] $@\033[0m"
}

function log_error() {
	echo -e "\033[0;31m[start.sh] [ERROR] $@\033[0m" 1>&2;
}

function check_os() {
	unameOut="$(uname -s)"

	case "${unameOut}" in
		Linux*)   os=Linux;;
		Darwin*)  os=Mac;;
		CYGWIN*)  os=Cygwin;;
		MINGW*)   os=MinGw;;
		*)        os="UNKNOWN:${unameOut}"
	esac

	echo ${os}
}

function get_local_ip_in_linux() {
	hostname -I | awk '{print $1}'
	if [ $? -eq 0 ] ; then return 0 ; fi

	return 1;
}

function get_local_ip_in_mac() {
	ipconfig getifaddr en0
	if [ $? -eq 0 ] ; then return 0 ; fi

	ipconfig getifaddr en1
	if [ $? -eq 0 ] ; then return 0 ; fi

	ipconfig getifaddr en2
	if [ $? -eq 0 ] ; then return 0 ; fi

	ipconfig getifaddr en3
	if [ $? -eq 0 ] ; then return 0 ; fi

	ipconfig getifaddr en4
	if [ $? -eq 0 ] ; then return 0 ; fi

	return 1;
}

os=$(check_os)

log_info "detected OS: ${os}"

case "${os}" in
	Linux)
		ip=$(get_local_ip_in_linux)
		;;

	Mac)
		ip=$(get_local_ip_in_mac)
		;;

	*)
		log_error "OS ${os} not supported by start.sh"
		exit 1
esac

if [ $? -ne 0 ]; then
		log_error "could not determine local IP"
		exit 1
fi

log_info "detected local IP: \"${ip}\""

# Set env variables (don't override if already set).
export WATCH=${WATCH:="false"}
export TERMINAL=${TERMINAL:="false"}
export DEBUG=${DEBUG:="mediasoup-demo-server* *INFO* *WARN* *ERROR*"}
export MEDIASOUP_LISTEN_IP=${MEDIASOUP_LISTEN_IP:="${ip}"}

# Command line arguments override environment variables.
for arg in "$@"; do
	if [[ "$arg" == "--terminal" ]]; then
		export TERMINAL="true"
	elif [[ "$arg" == "--watch" ]]; then
		export WATCH="true"
	fi
done

if [ "${TERMINAL}" = "true" ] && [ "${WATCH}" = "true" ] ; then
	log_error "TERMINAL and WATCH environment variables cannot both be set to \"true\""

	export TERMINAL="false"
fi

log_info "starting server:"
log_info "- DEBUG: \"${DEBUG}\""
log_info "- TERMINAL: \"${TERMINAL}\""
log_info "- WATCH: \"${WATCH}\""
log_info "- CONFIG_FILE: \"${CONFIG_FILE}\""

while IFS='=' read -r key value; do
	if [[ $key == MEDIASOUP_* ]]; then
		log_info "- ${key}: \"${value}\""
	fi
done < <(env)

if [ "${WATCH}" = "true" ]; then
	npm run watch
else
	npm start
fi
