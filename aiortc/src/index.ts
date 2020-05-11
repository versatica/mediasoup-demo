import * as repl from 'repl';
import { configureStore } from '@reduxjs/toolkit';
import { Logger } from './Logger';
import { RoomClient } from './RoomClient';
import room from './redux/reducers/room';
import me from './redux/reducers/me';
import producers from './redux/reducers/producers';
import dataProducers from './redux/reducers/dataProducers';
import peers from './redux/reducers/peers';
import consumers from './redux/reducers/consumers';
import dataConsumers from './redux/reducers/dataConsumers';

const logger = new Logger();

const store = configureStore({
	reducer: {
		room,
		me,
		producers,
		dataProducers,
		peers,
		consumers,
		dataConsumers
	}
});

RoomClient.init({ store });

const roomId = process.env.ROOM_ID || 'test';
const peerId = process.env.PEER_ID || 'mediasoup-client-aiortc-id';
const displayName = process.env.DISPLAY_NAME || 'mediasoup-client-aiortc';
const forceTcp = process.env.FORCE_TCP === 'true' ? true : false;
const produce = process.env.PRODUCE === 'false' ? false : true;
const consume = process.env.CONSUME === 'false' ? false : true;
const forceH264 = process.env.FORCE_H264 === 'true' ? true : false;
const forceVP8 = process.env.FORCE_VP8 === 'true' ? true : false;
const datachannel = process.env.DATACHANNEL === 'false' ? false : true;
const externalAudio = process.env.EXTERNAL_AUDIO || '';
const externalVideo = process.env.EXTERNAL_VIDEO || '';

const options =
{
	roomId,
	peerId,
	displayName,
	useSimulcast        : false,
	useSharingSimulcast : false,
	forceTcp,
	produce,
	consume,
	forceH264,
	forceVP8,
	datachannel,
	externalAudio,
	externalVideo
};

logger.debug(`starting mediasoup-demo-aiortc: ${JSON.stringify(options, undefined, 2)}`);

const roomClient = new RoomClient(options);

// For the interactive terminal.
(global as any).store = store;
(global as any).roomClient = roomClient;

// Run an interactive terminal.
const terminal = repl.start({
	terminal        : true,
	prompt          : 'terminal> ',
	useColors       : true,
	useGlobal       : true,
	ignoreUndefined : false
});

terminal.on('exit', () => process.exit(0));

// Join!!
roomClient.join();

// NOTE: Debugging stuff.

(global as any).__sendSdps = function(): void
{
	// eslint-disable-next-line no-console
	console.warn('>>> send transport local SDP offer:');
	// @ts-ignore
	roomClient._sendTransport._handler._channel.request(
		'handler.getLocalDescription',
		// @ts-ignore
		roomClient._sendTransport._handler._internal)
		.then((desc: any) =>
		{
			logger.warn(desc.sdp);
		});
};
