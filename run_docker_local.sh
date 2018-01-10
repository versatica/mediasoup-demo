#!/bin/sh

# Guess an Ip, replace with the proper one if not ok for you
IP=`ifconfig | grep -E "([0-9]{1,3}\.){3}[0-9]{1,3}" | grep -v 127.0.0.1 | awk '{ print $2 }' | cut -f2 -d: | head -n1`

# Run interpolating such ip
mediasoup_server_host=$IP docker-compose up
