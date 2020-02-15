export const setRoomUrl = (url: string): any =>
{
	return {
		type    : 'SET_ROOM_URL',
		payload : { url }
	};
};

export const setRoomState = (state: string): any =>
{
	return {
		type    : 'SET_ROOM_STATE',
		payload : { state }
	};
};

export const setRoomActiveSpeaker = (peerId: string): any =>
{
	return {
		type    : 'SET_ROOM_ACTIVE_SPEAKER',
		payload : { peerId }
	};
};

export const setRoomStatsPeerId = (peerId: string): any =>
{
	return {
		type    : 'SET_ROOM_STATS_PEER_ID',
		payload : { peerId }
	};
};

export const setRoomFaceDetection = (flag: boolean): any =>
{
	return {
		type    : 'SET_FACE_DETECTION',
		payload : flag
	};
};

export const setMe = (
	{ peerId, displayName, displayNameSet, device }:
	{ peerId: string; displayName: string; displayNameSet: boolean; device: any }
): any =>
{
	return {
		type    : 'SET_ME',
		payload : { peerId, displayName, displayNameSet, device }
	};
};

export const setMediaCapabilities = (
	{ canSendMic, canSendWebcam }:
	{ canSendMic: boolean; canSendWebcam: boolean }
): any =>
{
	return {
		type    : 'SET_MEDIA_CAPABILITIES',
		payload : { canSendMic, canSendWebcam }
	};
};

export const setCanChangeWebcam = (flag: boolean): any =>
{
	return {
		type    : 'SET_CAN_CHANGE_WEBCAM',
		payload : flag
	};
};

export const setDisplayName = (displayName: string): any =>
{
	return {
		type    : 'SET_DISPLAY_NAME',
		payload : { displayName }
	};
};

export const setAudioOnlyState = (enabled: boolean): any =>
{
	return {
		type    : 'SET_AUDIO_ONLY_STATE',
		payload : { enabled }
	};
};

export const setAudioOnlyInProgress = (flag: boolean): any =>
{
	return {
		type    : 'SET_AUDIO_ONLY_IN_PROGRESS',
		payload : { flag }
	};
};

export const setAudioMutedState = (enabled: boolean): any =>
{
	return {
		type    : 'SET_AUDIO_MUTED_STATE',
		payload : { enabled }
	};
};

export const setRestartIceInProgress = (flag: boolean): any =>
{
	return {
		type    : 'SET_RESTART_ICE_IN_PROGRESS',
		payload : { flag }
	};
};

export const addProducer = (producer: any): any =>
{
	return {
		type    : 'ADD_PRODUCER',
		payload : { producer }
	};
};

export const removeProducer = (producerId: string): any =>
{
	return {
		type    : 'REMOVE_PRODUCER',
		payload : { producerId }
	};
};

export const setProducerPaused = (producerId: string): any =>
{
	return {
		type    : 'SET_PRODUCER_PAUSED',
		payload : { producerId }
	};
};

export const setProducerResumed = (producerId: string): any =>
{
	return {
		type    : 'SET_PRODUCER_RESUMED',
		payload : { producerId }
	};
};

export const setProducerTrack = (producerId: string, track: any): any =>
{
	return {
		type    : 'SET_PRODUCER_TRACK',
		payload : { producerId, track }
	};
};

export const setProducerScore = (producerId: any, score: number): any =>
{
	return {
		type    : 'SET_PRODUCER_SCORE',
		payload : { producerId, score }
	};
};

export const addDataProducer = (dataProducer: any): any =>
{
	return {
		type    : 'ADD_DATA_PRODUCER',
		payload : { dataProducer }
	};
};

export const removeDataProducer = (dataProducerId: string): any =>
{
	return {
		type    : 'REMOVE_DATA_PRODUCER',
		payload : { dataProducerId }
	};
};

export const setWebcamInProgress = (flag: boolean): any =>
{
	return {
		type    : 'SET_WEBCAM_IN_PROGRESS',
		payload : { flag }
	};
};

export const setShareInProgress = (flag: boolean): any =>
{
	return {
		type    : 'SET_SHARE_IN_PROGRESS',
		payload : { flag }
	};
};

export const addPeer = (peer: any): any =>
{
	return {
		type    : 'ADD_PEER',
		payload : { peer }
	};
};

export const removePeer = (peerId: string): any =>
{
	return {
		type    : 'REMOVE_PEER',
		payload : { peerId }
	};
};

export const setPeerDisplayName = (displayName: string, peerId: string): any =>
{
	return {
		type    : 'SET_PEER_DISPLAY_NAME',
		payload : { displayName, peerId }
	};
};

export const addConsumer = (consumer: any, peerId: string): any =>
{
	return {
		type    : 'ADD_CONSUMER',
		payload : { consumer, peerId }
	};
};

export const removeConsumer = (consumerId: string, peerId: string): any =>
{
	return {
		type    : 'REMOVE_CONSUMER',
		payload : { consumerId, peerId }
	};
};

export const setConsumerPaused = (consumerId: string, originator: string): any =>
{
	return {
		type    : 'SET_CONSUMER_PAUSED',
		payload : { consumerId, originator }
	};
};

export const setConsumerResumed = (consumerId: string, originator: string): any =>
{
	return {
		type    : 'SET_CONSUMER_RESUMED',
		payload : { consumerId, originator }
	};
};

export const setConsumerCurrentLayers =
	(consumerId: string, spatialLayer: number, temporalLayer: number): any =>
	{
		return {
			type    : 'SET_CONSUMER_CURRENT_LAYERS',
			payload : { consumerId, spatialLayer, temporalLayer }
		};
	};

export const setConsumerPreferredLayers =
	(consumerId: string, spatialLayer: number, temporalLayer: number): any =>
	{
		return {
			type    : 'SET_CONSUMER_PREFERRED_LAYERS',
			payload : { consumerId, spatialLayer, temporalLayer }
		};
	};

export const setConsumerPriority = (consumerId: string, priority: number): any =>
{
	return {
		type    : 'SET_CONSUMER_PRIORITY',
		payload : { consumerId, priority }
	};
};

export const setConsumerTrack = (consumerId: string, track: any): any =>
{
	return {
		type    : 'SET_CONSUMER_TRACK',
		payload : { consumerId, track }
	};
};

export const setConsumerScore = (consumerId: string, score: number): any =>
{
	return {
		type    : 'SET_CONSUMER_SCORE',
		payload : { consumerId, score }
	};
};

export const addDataConsumer = (dataConsumer: any, peerId: string): any =>
{
	return {
		type    : 'ADD_DATA_CONSUMER',
		payload : { dataConsumer, peerId }
	};
};

export const removeDataConsumer = (dataConsumerId: string, peerId: string): any =>
{
	return {
		type    : 'REMOVE_DATA_CONSUMER',
		payload : { dataConsumerId, peerId }
	};
};

export const addNotification = (notification: any): any =>
{
	return {
		type    : 'ADD_NOTIFICATION',
		payload : { notification }
	};
};

export const removeNotification = (notificationId: string): any =>
{
	return {
		type    : 'REMOVE_NOTIFICATION',
		payload : { notificationId }
	};
};

export const removeAllNotifications = (): any =>
{
	return {
		type : 'REMOVE_ALL_NOTIFICATIONS'
	};
};
