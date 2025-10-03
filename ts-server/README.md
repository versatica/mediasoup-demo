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

Edit your `config.mjs` according to your preferences.

- If you want to listen on HTTPS and WSS (instead of plain HTTP and WS) you need to provide your own certificate in `config.http.tls`.
- Depending on your network setup, you may need to set a proper IP value in `ip` and/or `announcedAddress` in the corresponding `listenInfo` or WebRTC and plain transports. Check the mediasoup documentation.

## Running locally

- The `start.sh` script detects the host IP and sets the `MEDIASOUP_LISTEN_IP` environment variable, useful if your `config.mjs` reads it. It also sets `DEBUG` variable to enable **mediasoup** and **mediasoup-demo-server** logs.
- Take into account that before being able to use `start.sh` script, you need to transpile TypeScript code to JavaScript:
  ```bash
  npm run typescript:build
  ```
- `start.sh --terminal` runs the server with an internative terminal.
- `watch.sh` script is a shortcut of `start.sh --watch`, useful for development in case you are modifying server TypeScript code.
- Notice that `start.sh` cannot be called with both `--terminal` and `--watch` command line arguments. Also notice that `watch.sh` cannot be called with `--terminal` command line argument. This is because, when in watch mode, **mediasoup-demo-server** is managed by [nodemon](https://nodemon.io/), which interferes with stdin, making it impossible to launch a terminal in the same process.
- Additionally you can run `npm run start` and `npm run watch` (see `npm-scripts.mjs`). Again, you need to transpile TypeScript code to JavaScript before using `npm run start`:
  ```bash
  npm run typescript:build
  ```

## Connecting a terminal to a running server

The `connect-terminal.mjs` script connects to the running **mediasoup-demo-server** process and provides you with an interactive terminal to interact with it.

```sh
./connect-terminal.mjs
```

## Authors

- Iñaki Baz Castillo [[website](https://inakibaz.me)|[github](https://github.com/ibc/)]
- José Luis Millán [[github](https://github.com/jmillan/)]

## Sponsor

You can support mediasoup by [sponsoring](https://mediasoup.org/sponsor) it. Thanks!

## License

[ISC](./LICENSE)
