# Docker Settings mediasoup Server


## ENV Variables

* [DEBUG](#debug)
* [PROTOO_LISTEN_PORT](#protoo_listen_port)
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

### `PROTOO_LISTEN_PORT`

The listening port for protoo WebSocket server.

**Important:** Make sure this value corresponds with that provided in [config.js](config.example.js)

* Mandatory
* Valid values: port

### `MEDIASOUP_MIN_PORT`

The min port for audio/video in mediasoup.

**Important:** Make sure this value corresponds with that provided in [config.js](config.example.js)

* Mandatory
* Valid values: port

### `MEDIASOUP_MAX_PORT`

The max port for audio/video in mediasoup.

**Important:** Make sure this value corresponds with that provided in [config.js](config.example.js)

* Mandatory
* Valid values: port

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
