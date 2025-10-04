# mediasoup-demo-server

mediasoup-demo SFU server written in TypeScript.

Try it at [v3demo.mediasoup.org](https://v3demo.mediasoup.org).

## Resources

- mediasoup website and documentation: [mediasoup.org](https://mediasoup.org)
- mediasoup support forum: [mediasoup.discourse.group](https://mediasoup.discourse.group)

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

- By default, **mediasoup-demo-server** tries to read configuration from a `config.mjs` file in its root directory. However this can be overridden with the `CONFIG_FILE` environment variable. Example:
  ```sh
  export CONFIG_FILE=/home/foo/my-demo-server-config.mjs
  ```
- If you want to listen on HTTPS and WSS (instead of plain HTTP and WS) you need to provide your own TLS certificate in `config.http.tls`.
- Depending on your network setup, you may need to set a proper IP value in `ip` and/or `announcedAddress` in the corresponding `listenInfo` entries of WebRTC and plain transports. Check the mediasoup documentation.

## Running locally

- The `start.sh` script:
  - It detects the host IP and sets the `MEDIASOUP_LISTEN_IP` environment variable, useful if your `config.mjs` reads it.
  - It sets the `DEBUG` environment variable to enable **mediasoup** and **mediasoup-demo-server** logs.
  - It sets `TERMINAL` environment variable if it was called with `--terminal` command line argument. This runs the server with an internative terminal.
  - Then it invokes `npm run watch` if `WATCH` environment variable is set, or `npm start` otherwise.
- `watch.sh` script is a shortcut of `start.sh --watch`, useful for development in case you are modifying TypeScript source code.
- Notice that `start.sh` cannot be called with both `--terminal` and `--watch` command line arguments. Also notice that `watch.sh` cannot be called with `--terminal` command line argument. This is because, when in watch mode, **mediasoup-demo-server** is managed by [nodemon](https://nodemon.io/), which interferes with stdin, making it impossible to launch a terminal in the same process.
- Additionally you can run `npm start` and `npm run watch` directly.

## Connecting a terminal to a running server

The `connect-terminal.mjs` script connects to the running **mediasoup-demo-server** process and provides you with an interactive terminal to interact with it.

```sh
./connect-terminal.mjs
```

## Development

If you change TypeScript code then you need to transpile it to JavaScript for `npm start` and `start.sh` to work:

```sh
npm run typescript:build
```

For more NPM scripts and details, check the `npm-scripts.mjs` file.

## Authors

- Iñaki Baz Castillo [[website](https://inakibaz.me)|[github](https://github.com/ibc/)]
- José Luis Millán [[github](https://github.com/jmillan/)]

## Sponsor

You can support mediasoup by [sponsoring](https://mediasoup.org/sponsor) it. Thanks!

## License

[ISC](./LICENSE)
