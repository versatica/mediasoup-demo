#/bin/bash

#
# This script builds mediasoup-demo application and uploads it to our
# server.
#
# It builds the frontend app using the local mediasoup-client code instead
# of the one in the NPM registry.
#
# This script must be executed from the root folder.
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
	# NOTE: Use `build:local` task which uses the local mediasoup-client as it is.
	npm run build:local
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

# And then run deploy-mediasoup-demo-test.sh in the server.
