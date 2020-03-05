import * as repl from 'repl';
import {
	applyMiddleware as applyReduxMiddleware,
	createStore as createReduxStore
} from 'redux';
import thunk from 'redux-thunk';
import { Logger } from './Logger';
import { RoomClient } from './RoomClient';
import reducers from './redux/reducers';

const reduxMiddlewares = [ thunk ];

const logger = new Logger();

const store = createReduxStore(
	reducers,
	undefined,
	applyReduxMiddleware(...reduxMiddlewares)
);

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
