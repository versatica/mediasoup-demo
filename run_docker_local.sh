#!/bin/sh

# Guess an Ip to be used by mediasoup server. If not ok, replace IP with the proper one you consider
IP=`ifconfig | grep -E "([0-9]{1,3}\.){3}[0-9]{1,3}" | grep -v 127.0.0.1 | awk '{ print $2 }' | cut -f2 -d: | head -n1`
#IP=yourip

# Run interpolating such ip
mediasoup_server_host=$IP docker-compose up
