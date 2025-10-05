# TODO

- Verify that when peers or broadcasters join before or later and they produce, all peers (and broadcasters capable of it) consume.
- In `BroadcasterPeer`... we are emitting 'joined' **before** the client creates the consumer plain transport so problems...
- Delete `tmp` folder.
- Delete this `TODO.md`.
- `ApiServer` and adapt broadcaster scripts.
- Don't make client app assume that HTTPS listen port is 4443. Instead make client app read `config.mjs` somehow.
- Edit `.gitignore` in root folder.
- Edit `README` in app.
- Throttle stuff.
- Logging of `worker.getResourceUsage()` stuff.
- CI stuff.
- `npm run release` stuff. Really?
- Aiortc client. Upps.
