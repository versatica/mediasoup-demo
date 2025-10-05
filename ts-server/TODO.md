# TODO

- `ffmpeg-receiver.sh`: Make it work in macOS and Linux.
- Delete `tmp` folder.
- Delete this `TODO.md`.
- Edit `.gitignore` in root folder.
- Edit `README` in app.
- Throttle stuff.
- Logging of `worker.getResourceUsage()` stuff.
- CI stuff.
- `npm run release` stuff. Really?
- Aiortc client. Upps.

## Notes

```ts
consumers = Array.from(producers.values()).map(p => {
	return {
		kind: p.kind,
		id: p.id,
		pt: p.rtpParameters.codecs[0].payloadType,
	};
});

audio = consumers.find(c => c.kind === 'audio');
video = consumers.find(c => c.kind === 'video');

console.log(
	`AUDIO_PRODUCER_ID=${audio.id} AUDIO_PT=${audio.pt} VIDEO_PRODUCER_ID=${video.id} VIDEO_PT=${video.pt} ./test-ffmpeg-receive.sh`
);
```
