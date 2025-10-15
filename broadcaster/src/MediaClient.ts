import type * as mediasoupTypes from 'mediasoup-client/types';

import { EnhancedEventEmitter } from './enhancedEvents';
import { PlainTransportRemoteData } from './types';

export type MediaClientProduceMediaFileOptions = {
	mediaFile: string;
	audioPlainTransportRemoteData: PlainTransportRemoteData;
	videoPlainTransportRemoteData: PlainTransportRemoteData;
	audioSsrc: number;
	audioPt: number;
	videoSsrc: number;
	videoPt: number;
};

export type MediaClientEvents = {
	/**
	 * Emitted when the MediaClient is closed no matter how.
	 */
	closed: [];
};

export abstract class MediaClient extends EnhancedEventEmitter<MediaClientEvents> {
	constructor() {
		super();
	}

	abstract get rtpCapabilities(): mediasoupTypes.RtpCapabilities;

	abstract close(): Promise<void>;

	abstract sendMediaFile(
		options: MediaClientProduceMediaFileOptions
	): Promise<void>;

	abstract consume(): Promise<void>;
}
