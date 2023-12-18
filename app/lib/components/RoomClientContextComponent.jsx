import React from 'react';
import RoomClient from '../RoomClient';
import { UseRoomClientUpdate } from '../RoomContext';
import UrlParse from 'url-parse';
import {
	applyMiddleware as applyReduxMiddleware,
	createStore as createReduxStore
} from 'redux';
import * as faceapi from 'face-api.js';
import deviceInfo from '../deviceInfo';
import randomName from '../randomName';
import randomString from 'random-string';
import reducers from '../redux/reducers';
import * as cookiesManager from '../cookiesManager';
import { Provider } from 'react-redux';
import thunk from 'redux-thunk';
import Logger from '../Logger';
import * as stateActions from '../redux/stateActions';

const reduxMiddlewares = [ thunk ];
const logger = new Logger();

async function waitForFaceApi()
{
	return await faceapi.loadTinyFaceDetectorModel('/resources/face-detector-models');
}

export default function RoomClientContextComponent(props)
{
	logger.debug('RoomClientContextComponent(props): ', props);

	const setRoomClientInstance = UseRoomClientUpdate();

	const store = createReduxStore(
		reducers,
		undefined,
		applyReduxMiddleware(...reduxMiddlewares)
	);

	RoomClient.init(store);

	const urlParser = new UrlParse(window.location.href, true);

	logger.debug('run() [environment:%s]', process.env.NODE_ENV);

	const peerId = randomString({ length: 8 }).toLowerCase();
	let roomId = urlParser.query.roomId;
	let displayName =
        urlParser.query.displayName || (cookiesManager.getUser() || {}).displayName;
	const handlerName = urlParser.query.handlerName || urlParser.query.handler;
	const forceTcp = urlParser.query.forceTcp === 'true';
	const produce = urlParser.query.produce !== 'false';
	const consume = urlParser.query.consume !== 'false';
	const datachannel = urlParser.query.datachannel !== 'false';
	const forceVP8 = urlParser.query.forceVP8 === 'true';
	const forceH264 = urlParser.query.forceH264 === 'true';
	const forceVP9 = urlParser.query.forceVP9 === 'true';
	const enableWebcamLayers = urlParser.query.enableWebcamLayers !== 'false';
	const enableSharingLayers = urlParser.query.enableSharingLayers !== 'false';
	const webcamScalabilityMode = urlParser.query.webcamScalabilityMode;
	const sharingScalabilityMode = urlParser.query.sharingScalabilityMode;
	const numSimulcastStreams = urlParser.query.numSimulcastStreams ?
		Number(urlParser.query.numSimulcastStreams) : 3;
	const info = urlParser.query.info === 'true';
	const faceDetection = urlParser.query.faceDetection === 'true';
	const externalVideo = urlParser.query.externalVideo === 'true';
	const throttleSecret = urlParser.query.throttleSecret;
	const e2eKey = urlParser.query.e2eKey;
	const consumerReplicas = urlParser.query.consumerReplicas;

	// Enable face detection on demand.
	if (faceDetection)
	{
		waitForFaceApi();
	}

	if (info)
	{
		// eslint-disable-next-line require-atomic-updates
		window.SHOW_INFO = true;
	}

	if (throttleSecret)
	{
		// eslint-disable-next-line require-atomic-updates
		window.NETWORK_THROTTLE_SECRET = throttleSecret;
	}

	if (!roomId)
	{
		roomId = randomString({ length: 8 }).toLowerCase();

		urlParser.query.roomId = roomId;
		window.history.pushState('', '', urlParser.toString());
	}

	// Get the effective/shareable Room URL instead of full URL.
	const roomUrlParser = new UrlParse(window.location.href, true);

	for (const key of Object.keys(roomUrlParser.query))
	{
		// Don't keep some custom params.
		switch (key)
		{
			case 'roomId':
			case 'handlerName':
			case 'handler':
			case 'forceTcp':
			case 'produce':
			case 'consume':
			case 'datachannel':
			case 'forceVP8':
			case 'forceH264':
			case 'forceVP9':
			case 'enableWebcamLayers':
			case 'enableSharingLayers':
			case 'webcamScalabilityMode':
			case 'sharingScalabilityMode':
			case 'numSimulcastStreams':
			case 'info':
			case 'faceDetection':
			case 'externalVideo':
			case 'throttleSecret':
			case 'e2eKey':
			case 'consumerReplicas':
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
		stateActions.setRoomUrl(roomUrl)
	);

	store.dispatch(
		stateActions.setRoomFaceDetection(faceDetection)
	);

	store.dispatch(
		stateActions.setMe({ peerId, displayName, displayNameSet, device })
	);

	// From RoomContext.js
	setRoomClientInstance(
		new RoomClient(
			{
				roomId,
				peerId,
				displayName,
				device,
				handlerName,
				forceTcp,
				produce,
				consume,
				datachannel,
				enableWebcamLayers,
				enableSharingLayers,
				webcamScalabilityMode,
				sharingScalabilityMode,
				numSimulcastStreams,
				forceVP8,
				forceH264,
				forceVP9,
				externalVideo,
				e2eKey,
				consumerReplicas
			}
		)
	);

	// NOTE: For debugging.
	// eslint-disable-next-line require-atomic-updates
	window.CLIENT = props.roomClient;
	// eslint-disable-next-line require-atomic-updates
	window.CC = props.roomClient;

	window.STORE = store;

	return (
		<Provider store={store}/>
	);

}
