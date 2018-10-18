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
import { createLogger as createReduxLogger } from 'redux-logger';
import { getDeviceInfo } from 'mediasoup-client';
import randomString from 'random-string';
import randomName from 'node-random-name';
import Logger from './Logger';
import * as utils from './utils';
import * as cookiesManager from './cookiesManager';
import * as requestActions from './redux/requestActions';
import * as stateActions from './redux/stateActions';
import reducers from './redux/reducers';
import roomClientMiddleware from './redux/roomClientMiddleware';
import Room from './components/Room';

const logger = new Logger();
const reduxMiddlewares =
[
	thunk,
	roomClientMiddleware
];

if (process.env.NODE_ENV === 'development')
{
	const reduxLogger = createReduxLogger(
		{
			duration  : true,
			timestamp : false,
			level     : 'log',
			logErrors : true
		});

	reduxMiddlewares.push(reduxLogger);
}

const store = createReduxStore(
	reducers,
	undefined,
	applyReduxMiddleware(...reduxMiddlewares)
);

domready(() =>
{
	logger.debug('DOM ready');

	// Load stuff and run
	utils.initialize()
		.then(run);
});

function run()
{
	logger.debug('run() [environment:%s]', process.env.NODE_ENV);

	const peerName = randomString({ length: 8 }).toLowerCase();
	const urlParser = new UrlParse(window.location.href, true);
	let roomId = urlParser.query.roomId;
	const produce = urlParser.query.produce !== 'false';
	let displayName = urlParser.query.displayName;
	const isSipEndpoint = urlParser.query.sipEndpoint === 'true';
	const useSimulcast = urlParser.query.simulcast !== 'false';
	const forceTcp = urlParser.query.forceTcp === 'true';

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
				break;
			default:
				delete roomUrlParser.query[key];
		}
	}
	delete roomUrlParser.hash;

	const roomUrl = roomUrlParser.toString();

	// Get displayName from cookie (if not already given as param).
	const userCookie = cookiesManager.getUser() || {};
	let displayNameSet;

	if (!displayName)
		displayName = userCookie.displayName;

	if (displayName)
	{
		displayNameSet = true;
	}
	else
	{
		displayName = randomName();
		displayNameSet = false;
	}

	// Get current device.
	const device = getDeviceInfo();

	// If a SIP endpoint mangle device info.
	if (isSipEndpoint)
	{
		device.flag = 'sipendpoint';
		device.name = 'SIP Endpoint';
		device.version = undefined;
	}

	// NOTE: I don't like this.
	store.dispatch(
		stateActions.setRoomUrl(roomUrl));

	// NOTE: I don't like this.
	store.dispatch(
		stateActions.setMe({ peerName, displayName, displayNameSet, device }));

	// NOTE: I don't like this.
	store.dispatch(
		requestActions.joinRoom(
			{ roomId, peerName, displayName, device, useSimulcast, forceTcp, produce }));

	render(
		<Provider store={store}>
			<Room />
		</Provider>,
		document.getElementById('mediasoup-demo-app-container')
	);
}

// TODO: Debugging stuff.

let sendTransport;
let recvTransport;
let micProducer;
let webcamProducer;
let micConsumer;
let webcamConsumer;

setInterval(() =>
{
	sendTransport = global.CLIENT._sendTransport;
	recvTransport = global.CLIENT._recvTransport;
	micProducer = global.CLIENT._micProducer;
	webcamProducer = global.CLIENT._webcamProducer;

	if (global.CLIENT._room.peers[0])
	{
		const peer = global.CLIENT._room.peers[0];

		micConsumer = peer.consumers.find((c) => c.kind === 'audio');
		webcamConsumer = peer.consumers.find((c) => c.kind === 'video');
	}
	else
	{
		micConsumer = undefined;
		webcamConsumer = undefined;
	}
}, 2000);

global.__enableSendTransportStats = function()
{
	if (!sendTransport)
	{
		logger.warn('no send transport producer');

		return;
	}

	sendTransport.enableStats(5000);
	sendTransport.on('stats', (stats) => printStats('send transport producer stats', stats));
};

global.__disableSendTransportStats = function()
{
	if (!sendTransport)
		return;

	sendTransport.disableStats();
	sendTransport.removeAllListeners('stats');
};

global.__enableRecvTransportStats = function()
{
	if (!recvTransport)
	{
		logger.warn('no recv transport producer');

		return;
	}

	recvTransport.enableStats(5000);
	recvTransport.on('stats', (stats) => printStats('recv transport producer stats', stats));
};

global.__disableRecvTransportStats = function()
{
	if (!recvTransport)
		return;

	recvTransport.disableStats();
	recvTransport.removeAllListeners('stats');
};

global.__enableMicProducerStats = function()
{
	if (!micProducer)
	{
		logger.warn('no mic producer');

		return;
	}

	micProducer.enableStats(5000);
	micProducer.on('stats', (stats) => printStats('mic producer stats', stats));
};

global.__disableMicProducerStats = function()
{
	if (!micProducer)
		return;

	micProducer.disableStats();
	micProducer.removeAllListeners('stats');
};

global.__enableWebcamProducerStats = function()
{
	if (!webcamProducer)
	{
		logger.warn('no webcam producer');

		return;
	}

	webcamProducer.enableStats(5000);
	webcamProducer.on('stats', (stats) => printStats('webcam producer stats', stats));
};

global.__disableWebcamProducerStats = function()
{
	if (!webcamProducer)
		return;

	webcamProducer.disableStats();
	webcamProducer.removeAllListeners('stats');
};

global.__enableMicConsumerStats = function()
{
	if (!micConsumer)
	{
		logger.warn('no mic consumer');

		return;
	}

	micConsumer.enableStats(5000);
	micConsumer.on('stats', (stats) => printStats('first mic consumer stats', stats));
};

global.__disableMicConsumerStats = function()
{
	if (!micConsumer)
		return;

	micConsumer.disableStats();
	micConsumer.removeAllListeners('stats');
};

global.__enableWebcamConsumerStats = function()
{
	if (!webcamConsumer)
	{
		logger.warn('no webcam consumer');

		return;
	}

	webcamConsumer.enableStats(5000);
	webcamConsumer.on('stats', (stats) => printStats('first webcam consumer stats', stats));
};

global.__disableWebcamConsumerStats = function()
{
	if (!webcamConsumer)
		return;

	webcamConsumer.disableStats();
	webcamConsumer.removeAllListeners('stats');
};

global.__showSendSdps = function()
{
	logger.warn('>>> send transport local SDP offer:');
	logger.warn(
		global.CLIENT._sendTransport._handler._pc.localDescription.sdp);

	logger.warn('>>> send transport remote SDP answer:');
	logger.warn(
		global.CLIENT._sendTransport._handler._pc.remoteDescription.sdp);
};

global.__showRecvSdps = function()
{
	logger.warn('>>> recv transport remote SDP offer:');
	logger.warn(
		global.CLIENT._recvTransport._handler._pc.remoteDescription.sdp);

	logger.warn('>>> recv transport local SDP answer:');
	logger.warn(
		global.CLIENT._recvTransport._handler._pc.localDescription.sdp);
};

function printStats(title, stats)
{
	logger.warn('>>> %s:', title);
	logger.warn(JSON.stringify(stats, null, '  '));
}
