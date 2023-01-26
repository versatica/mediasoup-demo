#!/usr/bin/env bash

function log_info() {
	echo -e "\e[0;36m[run.sh] [INFO] $@\e[0m"
}

function log_error() {
	echo -e "\e[1;31m[run.sh] [ERROR] $@\e[0m" 1>&2;
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
		log_error "OS ${os} not supported by run.sh"
		exit 1
esac

if [ $? -ne 0 ]; then
    log_error "could not determine local IP"
    exit 1
fi

log_info "detected local IP: ${ip}"

# Set env variables (don't override if already set).
export DEBUG=${DEBUG:="mediasoup-demo-server:INFO* *WARN* *ERROR*"}
export INTERACTIVE=${INTERACTIVE:="true"}
export MEDIASOUP_ANNOUNCED_IP="${ip}"

log_info "running mediasoup-demo server.js with envs:"
log_info "- DEBUG=${DEBUG}"
log_info "- INTERACTIVE=${INTERACTIVE}"
for env in $(env)
do
	if [[ $env = MEDIASOUP_* ]]
	then
		log_info "- ${env}"
	fi
done

./server.js
