export const setRoomUrl = (url) =>
{
	return {
		type    : 'SET_ROOM_URL',
		payload : { url }
	};
};

export const setRoomState = (state) =>
{
	return {
		type    : 'SET_ROOM_STATE',
		payload : { state }
	};
};

export const setRoomActiveSpeaker = (peerId) =>
{
	return {
		type    : 'SET_ROOM_ACTIVE_SPEAKER',
		payload : { peerId }
	};
};

export const setRoomStatsPeerId = (peerId) =>
{
	return {
		type    : 'SET_ROOM_STATS_PEER_ID',
		payload : { peerId }
	};
};

export const setRoomFaceDetection = (flag) =>
{
	return {
		type    : 'SET_FACE_DETECTION',
		payload : flag
	};
};

export const setMe = ({ peerId, displayName, displayNameSet, device }) =>
{
	return {
		type    : 'SET_ME',
		payload : { peerId, displayName, displayNameSet, device }
	};
};

export const setMediaCapabilities = ({ canSendMic, canSendWebcam }) =>
{
	return {
		type    : 'SET_MEDIA_CAPABILITIES',
		payload : { canSendMic, canSendWebcam }
	};
};

export const setCanChangeWebcam = (flag) =>
{
	return {
		type    : 'SET_CAN_CHANGE_WEBCAM',
		payload : flag
	};
};

export const setDisplayName = (displayName) =>
{
	return {
		type    : 'SET_DISPLAY_NAME',
		payload : { displayName }
	};
};

export const setAudioOnlyState = (enabled) =>
{
	return {
		type    : 'SET_AUDIO_ONLY_STATE',
		payload : { enabled }
	};
};

export const setAudioOnlyInProgress = (flag) =>
{
	return {
		type    : 'SET_AUDIO_ONLY_IN_PROGRESS',
		payload : { flag }
	};
};

export const setAudioMutedState = (enabled) =>
{
	return {
		type    : 'SET_AUDIO_MUTED_STATE',
		payload : { enabled }
	};
};

export const setRestartIceInProgress = (flag) =>
{
	return {
		type    : 'SET_RESTART_ICE_IN_PROGRESS',
		payload : { flag }
	};
};

export const addProducer = (producer) =>
{
	return {
		type    : 'ADD_PRODUCER',
		payload : { producer }
	};
};

export const removeProducer = (producerId) =>
{
	return {
		type    : 'REMOVE_PRODUCER',
		payload : { producerId }
	};
};

export const setProducerPaused = (producerId) =>
{
	return {
		type    : 'SET_PRODUCER_PAUSED',
		payload : { producerId }
	};
};

export const setProducerResumed = (producerId) =>
{
	return {
		type    : 'SET_PRODUCER_RESUMED',
		payload : { producerId }
	};
};

export const setProducerTrack = (producerId, track) =>
{
	return {
		type    : 'SET_PRODUCER_TRACK',
		payload : { producerId, track }
	};
};

export const setProducerScore = (producerId, score) =>
{
	return {
		type    : 'SET_PRODUCER_SCORE',
		payload : { producerId, score }
	};
};

export const addDataProducer = (dataProducer) =>
{
	return {
		type    : 'ADD_DATA_PRODUCER',
		payload : { dataProducer }
	};
};

export const removeDataProducer = (dataProducerId) =>
{
	return {
		type    : 'REMOVE_DATA_PRODUCER',
		payload : { dataProducerId }
	};
};

export const setWebcamInProgress = (flag) =>
{
	return {
		type    : 'SET_WEBCAM_IN_PROGRESS',
		payload : { flag }
	};
};

export const setShareInProgress = (flag) =>
{
	return {
		type    : 'SET_SHARE_IN_PROGRESS',
		payload : { flag }
	};
};

export const addPeer = (peer) =>
{
	return {
		type    : 'ADD_PEER',
		payload : { peer }
	};
};

export const removePeer = (peerId) =>
{
	return {
		type    : 'REMOVE_PEER',
		payload : { peerId }
	};
};

export const setPeerDisplayName = (displayName, peerId) =>
{
	return {
		type    : 'SET_PEER_DISPLAY_NAME',
		payload : { displayName, peerId }
	};
};

export const addConsumer = (consumer, peerId) =>
{
	return {
		type    : 'ADD_CONSUMER',
		payload : { consumer, peerId }
	};
};

export const removeConsumer = (consumerId, peerId) =>
{
	return {
		type    : 'REMOVE_CONSUMER',
		payload : { consumerId, peerId }
	};
};

export const setConsumerPaused = (consumerId, originator) =>
{
	return {
		type    : 'SET_CONSUMER_PAUSED',
		payload : { consumerId, originator }
	};
};

export const setConsumerResumed = (consumerId, originator) =>
{
	return {
		type    : 'SET_CONSUMER_RESUMED',
		payload : { consumerId, originator }
	};
};

export const setConsumerCurrentLayers = (consumerId, spatialLayer, temporalLayer) =>
{
	return {
		type    : 'SET_CONSUMER_CURRENT_LAYERS',
		payload : { consumerId, spatialLayer, temporalLayer }
	};
};

export const setConsumerPreferredLayers = (consumerId, spatialLayer, temporalLayer) =>
{
	return {
		type    : 'SET_CONSUMER_PREFERRED_LAYERS',
		payload : { consumerId, spatialLayer, temporalLayer }
	};
};

export const setConsumerPriority = (consumerId, priority) =>
{
	return {
		type    : 'SET_CONSUMER_PRIORITY',
		payload : { consumerId, priority }
	};
};

export const setConsumerTrack = (consumerId, track) =>
{
	return {
		type    : 'SET_CONSUMER_TRACK',
		payload : { consumerId, track }
	};
};

export const setConsumerScore = (consumerId, score) =>
{
	return {
		type    : 'SET_CONSUMER_SCORE',
		payload : { consumerId, score }
	};
};

export const addDataConsumer = (dataConsumer, peerId) =>
{
	return {
		type    : 'ADD_DATA_CONSUMER',
		payload : { dataConsumer, peerId }
	};
};

export const removeDataConsumer = (dataConsumerId, peerId) =>
{
	return {
		type    : 'REMOVE_DATA_CONSUMER',
		payload : { dataConsumerId, peerId }
	};
};

export const addNotification = (notification) =>
{
	return {
		type    : 'ADD_NOTIFICATION',
		payload : { notification }
	};
};

export const removeNotification = (notificationId) =>
{
	return {
		type    : 'REMOVE_NOTIFICATION',
		payload : { notificationId }
	};
};

export const removeAllNotifications = () =>
{
	return {
		type : 'REMOVE_ALL_NOTIFICATIONS'
	};
};
