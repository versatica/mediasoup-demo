import { createRoot } from 'react-dom/client';
import domready from 'domready';
// import thunk from 'redux-thunk';
import * as utils from './utils';
// import {
// 	applyMiddleware as applyReduxMiddleware,
// 	createStore as createReduxStore
// } from 'redux';
// import { createLogger as createReduxLogger } from 'redux-logger';
import Logger from './Logger';
import React from 'react';
import Room from './components/Room';
import { RoomClientProvider } from './RoomContext';

const logger = new Logger();
// const reduxMiddlewares = [ thunk ];

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

// let roomClient;
// const store = createReduxStore(
// 	reducers,
// 	undefined,
// 	applyReduxMiddleware(...reduxMiddlewares)
// );

// const urlParser = new UrlParse(window.location.href, true);

// window.STORE = store;

// RoomClient.init();

domready(async () =>
{
	logger.debug('DOM ready');

	await utils.initialize();

	run();
});

async function run()
{	
	const domNode = document.getElementById('mediasoup-demo-app-container');
	
	const root = createRoot(domNode);

	root.render(
		<RoomClientProvider>
			<Room />
		</RoomClientProvider>
	);

	return;
}

// NOTE: Debugging stuff.

// window.__sendSdps = function()
// {
// 	logger.warn('>>> send transport local SDP offer:');
// 	logger.warn(
// 		roomClient._sendTransport._handler._pc.localDescription.sdp);
// 
// 	logger.warn('>>> send transport remote SDP answer:');
// 	logger.warn(
// 		roomClient._sendTransport._handler._pc.remoteDescription.sdp);
// };
// 
// window.__recvSdps = function()
// {
// 	logger.warn('>>> recv transport remote SDP offer:');
// 	logger.warn(
// 		roomClient._recvTransport._handler._pc.remoteDescription.sdp);
// 
// 	logger.warn('>>> recv transport local SDP answer:');
// 	logger.warn(
// 		roomClient._recvTransport._handler._pc.localDescription.sdp);
// };
// 
// let dataChannelTestInterval = null;
// 
// window.__startDataChannelTest = function()
// {
// 	let number = 0;
// 
// 	const buffer = new ArrayBuffer(32);
// 	const view = new DataView(buffer);
// 
// 	dataChannelTestInterval = window.setInterval(() =>
// 	{
// 		if (window.DP)
// 		{
// 			view.setUint32(0, number++);
// 			roomClient.sendChatMessage(buffer);
// 		}
// 	}, 100);
// };
// 
// window.__stopDataChannelTest = function()
// {
// 	window.clearInterval(dataChannelTestInterval);
// 
// 	const buffer = new ArrayBuffer(32);
// 	const view = new DataView(buffer);
// 
// 	if (window.DP)
// 	{
// 		view.setUint32(0, Math.pow(2, 32) - 1);
// 		window.DP.send(buffer);
// 	}
// };
// 
// window.__testSctp = async function({ timeout = 100, bot = false } = {})
// {
// 	let dp;
// 
// 	if (!bot)
// 	{
// 		await window.CLIENT.enableChatDataProducer();
// 
// 		dp = window.CLIENT._chatDataProducer;
// 	}
// 	else
// 	{
// 		await window.CLIENT.enableBotDataProducer();
// 
// 		dp = window.CLIENT._botDataProducer;
// 	}
// 
// 	logger.warn(
// 		'<<< testSctp: DataProducer created [bot:%s, streamId:%d, readyState:%s]',
// 		bot ? 'true' : 'false',
// 		dp.sctpStreamParameters.streamId,
// 		dp.readyState);
// 
// 	function send()
// 	{
// 		dp.send(`I am streamId ${dp.sctpStreamParameters.streamId}`);
// 	}
// 
// 	if (dp.readyState === 'open')
// 	{
// 		send();
// 	}
// 	else
// 	{
// 		dp.on('open', () =>
// 		{
// 			logger.warn(
// 				'<<< testSctp: DataChannel open [streamId:%d]',
// 				dp.sctpStreamParameters.streamId);
// 
// 			send();
// 		});
// 	}
// 
// 	setTimeout(() => window.__testSctp({ timeout, bot }), timeout);
// };
// 
// setInterval(() =>
// {
// 	if (window.CLIENT._sendTransport)
// 	{
// 		window.H1 = window.CLIENT._sendTransport._handler;
// 		window.PC1 = window.CLIENT._sendTransport._handler._pc;
// 		window.DP = window.CLIENT._chatDataProducer;
// 	}
// 	else
// 	{
// 		delete window.PC1;
// 		delete window.DP;
// 	}
// 
// 	if (window.CLIENT._recvTransport)
// 	{
// 		window.H2 = window.CLIENT._recvTransport._handler;
// 		window.PC2 = window.CLIENT._recvTransport._handler._pc;
// 	}
// 	else
// 	{
// 		delete window.PC2;
// 	}
// }, 2000);
