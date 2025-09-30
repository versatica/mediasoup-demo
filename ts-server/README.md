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

- If you want to listen in HTTPS and WSS (instead of plain HTTP and WS) you need to provide your own certificate in `config.http.tls`.
- Depending on your network setup, you may need to set a proper IP value in `ip` and/or `announcedAddress` in the corresponding `listenInfo` or WebRTC and plain transports. Check the mediasoup documentation.

## Running locally

- The `start.sh` script detects the host IP and sets the `MEDIASOUP_LISTEN_IP` environment variable, useful if your `config.mjs` reads it. It also sets `DEBUG` variable to enable **mediasoup** and **mediasoup-demo-server** logs.
- `start.sh --terminal` runs the server with an internative terminal.
- `watch.sh` script is a shortcut of `start.sh --watch`, useful for development in case you are modifying server TypeScript code.
- Notice `start.sh` cannot be called with both `--terminal` and `--watch` command line arguments.
- Additionally you can run `npm run start` and `npm run watch` (see `npm-scripts.mjs`).

## Connecting a terminal to a running server

The `connect-terminal.mjs` script connects to the running **mediasoup-demo-server** to get access to the interactive terminal.

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
