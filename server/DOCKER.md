# Docker Settings mediasoup Server


## ENV Variables

* [DEBUG](#debug)
* [DOMAIN](#domain)
* [PROTOO_LISTEN_PORT](#protoo_listen_port)
* [MEDIASOUP_LISTEN_IP](#mediasoup_listen_ip)
* [MEDIASOUP_ANNOUNCED_IP](#mediasoup_announced_ip)
* [MEDIASOUP_MIN_PORT](#mediasoup_min_port)
* [MEDIASOUP_MAX_PORT](#mediasoup_max_port)
* [MEDIASOUP_USE_VALGRIND](#mediasoup_use_valgrind)
* [MEDIASOUP_VALGRIND_OPTIONS](#mediasoup_valgrind_options)


### `DEBUG`

The value to control what the NPM [debug](https://www.npmjs.com/package/debug) module logs.

Example: "mediasoup:INFO* *WARN* *ERROR*"

* Optional
* Valid values: Check `debug` module manual
* Default: ""

### `DOMAIN`

The service domain.

Example: "local.me.dev"

* Optional
* Valid values: Domain
* Default: ""

### `PROTOO_LISTEN_PORT`

The listening port for protoo WebSocket server.

* Optional
* Valid values: port
* Default: 4443

### `MEDIASOUP_LISTEN_IP`

The listening IP for audio/video in mediasoup.

* Optional
* Valid values: IPv4 or IPv6
* Default: "127.0.0.1"

### `MEDIASOUP_ANNOUNCED_IP`

The announced IP for audio/video in mediasoup.

* Optional
* Valid values: IPv4 or IPv6
* Default: ""

### `MEDIASOUP_MIN_PORT`

The min port for audio/video in mediasoup.

* Optional
* Valid values: port
* Default: 2000

### `MEDIASOUP_MAX_PORT`

The max port for audio/video in mediasoup.

* Optional
* Valid values: port
* Default: 2020

### `MEDIASOUP_USE_VALGRIND`

Flag to indicate whether valgrind is to be used.

* Optional
* Valid values: bool
* Default: false

### `MEDIASOUP_VALGRIND_OPTIONS`

Valgrind options separated by '|' symbol.

Example:

`"--leak-check=full|--track-fds=yes|--log-file=/storage/mediasoup_valgrind_`date +%s`.log"`

* Optional
* Valid values: Check `valgrind` manual
* Default: Check docker/run.sh
