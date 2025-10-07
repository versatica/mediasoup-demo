# mediasoup-demo-server

mediasoup-demo SFU server written in TypeScript.

Try it at [v3demo.mediasoup.org](https://v3demo.mediasoup.org).

_NOTE:_ This is a Node.js application that uses the [mediasoup](https://mediasoup.org) library. mediasoup itself is a server-side library, it does not read any "configuration file". Instead it exposes an API. This demo application just reads configuration settings from a file and calls the mediasoup API with those settings when appropriate.

## Resources

- **mediasoup** website and documentation: [mediasoup.org](https://mediasoup.org)
- **mediasoup** support forum: [mediasoup.discourse.group](https://mediasoup.discourse.group)

## Installation

Install NPM dependencies:

```sh
npm ci
```

## Configuration

Create your own `config.mjs` file:

```sh
cp config.example.mjs config.mjs
```

Edit your `config.mjs` file according to your preferences.

- If you want to listen on HTTPS and WSS (instead of plain HTTP and WS) you need to provide your own TLS certificate in `config.http.tls` in the configuration file.
- Depending on your network setup, you may need to set a proper IP value in `ip` and/or `announcedAddress` in the corresponding `listenInfo` entries in `webRtcServerOptions` and `plainTransportOptions`.

## Environment variables

### `CONFIG_FILE`

By default, **mediasoup-demo-server** tries to read configuration from a `config.mjs` file in its root directory. However this can be overridden with the `CONFIG_FILE` environment variable. Example:

```sh
export CONFIG_FILE=/home/foo/my-demo-server-config.mjs
```

### `DEBUG`

Both **mediasoup-demo-server** application and **mediasoup** library use [debug](https://www.npmjs.com/package/debug) for logging purposes, which is activated based on the value of the `DEBUG` environment variable.

- **mediasoup-demo-server** uses debug namespace prefixes "mediasoup-demo-server", "mediasoup-demo-server:INFO", "mediasoup-demo-server:WARN" and "mediasoup-demo-server:ERROR".
- **mediasoup** uses debug namespace prefixes "mediasoup", "mediasoup:WARN" and "mediasoup:ERROR". Read the full documentation about [mediasoup debugging](https://mediasoup.org/documentation/v3/mediasoup/debugging/#Enable-Logging).

For example, to log everything related to **mediasoup-demo-server** and only warnings and errors related to **mediasoup**, set `DEBUG` environment variable to:

```sh
DEBUG="mediasoup-demo-server* mediasoup:WARN* mediasoup:ERROR*"
```

### `TERMINAL`

If set to "true", an internative terminal client is opened in the same terminal session where **mediasoup-demo-server** has been launched.

Additionally you can open an interactive terminal client from any other terminal session. See the _"Connecting a terminal to a running server"_ section below.

## Running locally

Some shell scripts are provided for convenience:

- The `start.sh` script:
  - It detects the host IP and sets the `MEDIASOUP_LISTEN_IP` environment variable, useful if your `config.mjs` reads it.
  - It sets the `DEBUG` environment variable to activate **mediasoup** and **mediasoup-demo-server** logs.
  - It sets the `TERMINAL` environment variable to "true" if it was called with `--terminal` command line argument. This runs the server with an internative terminal client.
  - Then it invokes `npm run watch` if `--watch` command line argument is given, or `npm start` otherwise.
- `watch.sh` script is a shortcut of `start.sh --watch`, useful for development in case you are modifying TypeScript source code.
- Notice that `start.sh` cannot be called with both `--terminal` and `--watch` command line arguments. Also notice that `watch.sh` cannot be called with `--terminal` command line argument. This is because, when in watch mode, **mediasoup-demo-server** is managed by [nodemon](https://nodemon.io/), which interferes with stdin, making it impossible to launch a terminal in the same process.

Alternatively, you can directly invoke `npm start` or `npm run watch` (see details below).

## Connecting an interactive terminal to a running server

The `src/connect-terminal.mjs` scripts connects to the running **mediasoup-demo-server** process and provides you with an interactive terminal to interact with it.

You need to enter the `mediasoup-demo/server` folder to run it.

```sh
cd /PATH_TO/mediasoup-demo/server
./src/connect-terminal.ts`
```

```txt
[TerminalClient] terminal connected
[TerminalServer] opening Readline Command Console...
[TerminalServer] type help to print available commands
```

## Development

### `npm run typescript:build`

It transpiles TypeScript code (in `src` folder) to JavaScript (in `lib` folder).

This is needed if you modify TypeScript code and later invoke `npm start` or the `start.sh` script.

### `npm run typescript:watch`

It runs `tsc` with `--watch` to transpile TypeScript code to JavaScript automatically when changes are made.

### `npm start`

It runs the server in "production" mode. It requires that the TypeScript code is already transpiled to JavaScript.

### `npm run watch`

It runs the server in "development" (AKA "watch" mode) mode with [nodemon](https://nodemon.io/) and transpiles TypeScript to JavaScript automatically when changes are made (so the server is restarted).

It cannot be used with the `TERMINAL` environment variable set to "true" as explained above (doing it will literally crash the server).

## Authors

- Iñaki Baz Castillo [[website](https://inakibaz.me)|[github](https://github.com/ibc/)]
- José Luis Millán [[github](https://github.com/jmillan/)]

## Sponsor

You can support **mediasoup** by [sponsoring](https://mediasoup.org/sponsor) it. Thanks!

## License

[ISC](../LICENSE)
