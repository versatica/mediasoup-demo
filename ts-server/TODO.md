# TODO

- Delete `tmp` folder.
- Delete this `TODO.md`.
- Edit `.gitignore` in root folder.
- Edit `README` in app.
- CI stuff.
- `npm run release` stuff. Really?
- Aiortc client. Upps.

# Notes

## `ffmpeg-receiver.sh`

1. In your `config.mjs` set `preferredPayloadType` 100 for Opus and 101 for VP8.
2. Connect a browser with mic and camera.
3. Enter the interactive terminal of the server.
4. Enter terminal mode.
5. Paste this code:

```ts
consumers = Array.from(producers.values()).map(p => {
	return {
		kind: p.kind,
		id: p.id,
	};
});

audio = consumers.find(c => c.kind === 'audio');
video = consumers.find(c => c.kind === 'video');

console.log(
	`AUDIO_PRODUCER_ID=${audio.id} VIDEO_PRODUCER_ID=${video.id} AUDIO_CONSUMER_PT=100 VIDEO_CONSUMER_PT=101 ./test-ffmpeg-receive.sh`
);
```

6. Copy the output and paste it in `ts-server/tmp/` folder.
