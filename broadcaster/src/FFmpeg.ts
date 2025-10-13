// import { execa } from 'execa';

import { Logger } from './Logger';
import { EnhancedEventEmitter } from './enhancedEvents';
import { PlainTransportRemoteData } from './types';

const logger = new Logger('FFmpeg');

export type FFmpegCreateOptions = {
	mediaFile: string;
	audioPlainTransportRemoteData: PlainTransportRemoteData;
	videoPlainTransportRemoteData: PlainTransportRemoteData;
	audioSsrc: number;
	audioPt: number;
	videoSsrc: number;
	videoPt: number;
};

type FFmpegConstructorOptions = {
	mediaFile: string;
	audioPlainTransportRemoteData: PlainTransportRemoteData;
	videoPlainTransportRemoteData: PlainTransportRemoteData;
	audioSsrc: number;
	audioPt: number;
	videoSsrc: number;
	videoPt: number;
};

export type FFmpegEvents = {
	/**
	 * Emitted when the FFmpeg is closed no matter how.
	 */
	closed: [];
};

export class FFmpeg extends EnhancedEventEmitter<FFmpegEvents> {
	#mediaFile: string;
	#audioPlainTransportRemoteData: PlainTransportRemoteData;
	#videoPlainTransportRemoteData: PlainTransportRemoteData;
	#audioSsrc: number;
	#audioPt: number;
	#videoSsrc: number;
	#videoPt: number;
	#closed: boolean = false;

	static create({
		mediaFile,
		audioPlainTransportRemoteData,
		videoPlainTransportRemoteData,
		audioSsrc,
		audioPt,
		videoSsrc,
		videoPt,
	}: FFmpegCreateOptions): FFmpeg {
		logger.debug('create() [mediaFile:%o]', mediaFile);

		const ffmpeg = new FFmpeg({
			mediaFile,
			audioPlainTransportRemoteData,
			videoPlainTransportRemoteData,
			audioSsrc,
			audioPt,
			videoSsrc,
			videoPt,
		});

		return ffmpeg;
	}

	private constructor({
		mediaFile,
		audioPlainTransportRemoteData,
		videoPlainTransportRemoteData,
		audioSsrc,
		audioPt,
		videoSsrc,
		videoPt,
	}: FFmpegConstructorOptions) {
		super();

		logger.debug('constructor() [mediaFile:%o]', mediaFile);

		this.#mediaFile = mediaFile;
		this.#audioPlainTransportRemoteData = audioPlainTransportRemoteData;
		this.#videoPlainTransportRemoteData = videoPlainTransportRemoteData;
		this.#audioSsrc = audioSsrc;
		this.#audioPt = audioPt;
		this.#videoSsrc = videoSsrc;
		this.#videoPt = videoPt;
	}

	close(): void {
		logger.debug('close()');

		if (this.#closed) {
			return;
		}

		this.#closed = true;

		this.emit('closed');
	}

	async run(): Promise<void> {
		logger.debug('run()');

		const cmd = `ffmpeg \
-re \
-v info \
-stream_loop -1 \
-i ${this.#mediaFile} \
-map 0:a:0 \
-acodec libopus -ab 128k -ac 2 -ar 48000 \
-map 0:v:0 \
-pix_fmt yuv420p -c:v libvpx -b:v 1000k -deadline realtime -cpu-used 4 \
-f tee \
"[select=a:f=rtp:ssrc=${this.#audioSsrc}:payload_type=${this.#audioPt}]rtp://${this.#audioPlainTransportRemoteData.ip}:${this.#audioPlainTransportRemoteData.port}?rtcpport=${this.#audioPlainTransportRemoteData.rtcpPort ?? ''}|[select=v:f=rtp:ssrc=${this.#videoSsrc}:payload_type=${this.#videoPt}]rtp://${this.#videoPlainTransportRemoteData.ip}:${this.#videoPlainTransportRemoteData.port}?rtcpport=${this.#videoPlainTransportRemoteData.rtcpPort ?? ''}" \
`;

		console.log('--------- cmd:');
		console.log(cmd);

		const { execa } = await import('execa');

		// TODO
		await execa(cmd, {
			shell: true,
			stdout: 'inherit',
			stderr: 'inherit',
			stdin: 'ignore',
		});
	}
}
