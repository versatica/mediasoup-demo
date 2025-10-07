#/bin/bash

#
# This script must be placed into any subdirectory in the mediasoup-demo
# project and must be executed from the root folder.
#

set -e

MEDIASOUP_DEMO_PWD=${PWD}

current_dir_name=${MEDIASOUP_DEMO_PWD##*/}
if [ "${current_dir_name}" != "mediasoup-demo" ] && [ "${current_dir_name}" != "v3-mediasoup-demo" ] ; then
	echo ">>> [ERROR] $(basename $0) must be called from mediasoup-demo or v3-mediasoup-demo directory" >&2
	exit 1
fi

if [ "$1" == "" ] || [ "$1" == "web" ]; then
	cd app/
	npm run build
	rm -rf ../server/public
	mv dist ../server/public
	cd ../
fi

if [ "$1" == "" ] || [ "$1" == "node" ]; then
	rsync -avu --delete \
		--exclude=/node_modules \
		--exclude=/config.mjs \
		--exclude=/lib \
		server/ deploy@vhost1-deploy:/var/www/test.mediasoup.org/
fi

# And then ssh v2 with "deploy" user and run ./update-mediasoup-demo-server.sh.
