import domready from 'domready';
import UrlParse from 'url-parse';
import React from 'react';
import { render } from 'react-dom';
import { Provider } from 'react-redux';
import {
	applyMiddleware as applyReduxMiddleware,
	createStore as createReduxStore
} from 'redux';
import thunk from 'redux-thunk';
// import { createLogger as createReduxLogger } from 'redux-logger';
import randomString from 'random-string';
import * as faceapi from 'face-api.js';
import Logger from './Logger';
import * as utils from './utils';
import randomName from './randomName';
import deviceInfo from './deviceInfo';
import RoomClient from './RoomClient';
import RoomContext from './RoomContext';
import * as cookiesManager from './cookiesManager';
import * as stateActions from './redux/stateActions';
import reducers from './redux/reducers';
import Room from './components/Room';

const logger = new Logger();
const reduxMiddlewares = [ thunk ];

// if (process.env.NODE_ENV === 'development')
// {
// 	const reduxLogger = createReduxLogger(
// 		{
// 			duration  : true,
// 			timestamp : false,
// 			level     : 'log',
// 			logErrors : true
// 		});

// 	reduxMiddlewares.push(reduxLogger);
// }

let roomClient;
const store = createReduxStore(
	reducers,
	undefined,
	applyReduxMiddleware(...reduxMiddlewares)
);

window.STORE = store;

RoomClient.init({ store });

domready(async () =>
{
	logger.debug('DOM ready');

	await utils.initialize();

	run();
});

async function run()
{
	logger.debug('run() [environment:%s]', process.env.NODE_ENV);

	const urlParser = new UrlParse(window.location.href, true);
	const peerId = randomString({ length: 8 }).toLowerCase();
	let roomId = urlParser.query.roomId;
	let displayName =
		urlParser.query.displayName || (cookiesManager.getUser() || {}).displayName;
	const handler = urlParser.query.handler;
	const useSimulcast = urlParser.query.simulcast !== 'false';
	const useSharingSimulcast = urlParser.query.sharingSimulcast !== 'false';
	const forceTcp = urlParser.query.forceTcp === 'true';
	const produce = urlParser.query.produce !== 'false';
	const consume = urlParser.query.consume !== 'false';
	const forceH264 = urlParser.query.forceH264 === 'true';
	const forceVP9 = urlParser.query.forceVP9 === 'true';
	const svc = urlParser.query.svc;
	const info = urlParser.query.info === 'true';
	const faceDetection = urlParser.query.faceDetection === 'true';
	const externalVideo = urlParser.query.externalVideo === 'true';
	const datachannel = urlParser.query.datachannel === 'true';
	const throttleSecret = urlParser.query.throttleSecret;

	// Enable face detection on demand.
	if (faceDetection)
		await faceapi.loadTinyFaceDetectorModel('/resources/face-detector-models');

	if (info)
		window.SHOW_INFO = true;

	if (throttleSecret)
		window.NETWORK_THROTTLE_SECRET = throttleSecret;

	if (!roomId)
	{
		roomId = randomString({ length: 8 }).toLowerCase();

		urlParser.query.roomId = roomId;
		window.history.pushState('', '', urlParser.toString());
	}

	// Get the effective/shareable Room URL.
	const roomUrlParser = new UrlParse(window.location.href, true);

	for (const key of Object.keys(roomUrlParser.query))
	{
		// Don't keep some custom params.
		switch (key)
		{
			case 'roomId':
			case 'simulcast':
			case 'sharingSimulcast':
			case 'produce':
			case 'consume':
			case 'forceH264':
			case 'forceVP9':
			case 'svc':
			case 'info':
			case 'faceDetection':
			case 'externalVideo':
			case 'datachannel':
				break;
			default:
				delete roomUrlParser.query[key];
		}
	}
	delete roomUrlParser.hash;

	const roomUrl = roomUrlParser.toString();

	let displayNameSet;

	// If displayName was provided via URL or Cookie, we are done.
	if (displayName)
	{
		displayNameSet = true;
	}
	// Otherwise pick a random name and mark as "not set".
	else
	{
		displayNameSet = false;
		displayName = randomName();
	}

	// Get current device info.
	const device = deviceInfo();

	store.dispatch(
		stateActions.setRoomUrl(roomUrl));

	store.dispatch(
		stateActions.setRoomFaceDetection(faceDetection));

	store.dispatch(
		stateActions.setMe({ peerId, displayName, displayNameSet, device }));

	roomClient = new RoomClient(
		{
			roomId,
			peerId,
			displayName,
			device,
			handler,
			useSimulcast,
			useSharingSimulcast,
			forceTcp,
			produce,
			consume,
			forceH264,
			forceVP9,
			svc,
			externalVideo,
			datachannel
		});

	// NOTE: For debugging.
	window.CLIENT = roomClient;
	window.CC = roomClient;

	render(
		<Provider store={store}>
			<RoomContext.Provider value={roomClient}>
				<Room />
			</RoomContext.Provider>
		</Provider>,
		document.getElementById('mediasoup-demo-app-container')
	);
}

// NOTE: Debugging stuff.

window.__sendSdps = function()
{
	logger.warn('>>> send transport local SDP offer:');
	logger.warn(
		roomClient._sendTransport._handler._pc.localDescription.sdp);

	logger.warn('>>> send transport remote SDP answer:');
	logger.warn(
		roomClient._sendTransport._handler._pc.remoteDescription.sdp);
};

window.__recvSdps = function()
{
	logger.warn('>>> recv transport remote SDP offer:');
	logger.warn(
		roomClient._recvTransport._handler._pc.remoteDescription.sdp);

	logger.warn('>>> recv transport local SDP answer:');
	logger.warn(
		roomClient._recvTransport._handler._pc.localDescription.sdp);
};

setInterval(() =>
{
	if (window.CLIENT._sendTransport)
	{
		window.PC1 = window.CLIENT._sendTransport._handler._pc;
		window.DP = window.CLIENT._dataProducer;
	}
	else
	{
		delete window.PC1;
		delete window.DP;
	}

	if (window.CLIENT._recvTransport)
		window.PC2 = window.CLIENT._recvTransport._handler._pc;
	else
		delete window.PC2;
}, 2000);
