"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.removeAllNotifications = exports.removeNotification = exports.addNotification = exports.removeDataConsumer = exports.addDataConsumer = exports.setConsumerScore = exports.setConsumerTrack = exports.setConsumerPriority = exports.setConsumerPreferredLayers = exports.setConsumerCurrentLayers = exports.setConsumerResumed = exports.setConsumerPaused = exports.removeConsumer = exports.addConsumer = exports.setPeerDisplayName = exports.removePeer = exports.addPeer = exports.setShareInProgress = exports.setWebcamInProgress = exports.removeDataProducer = exports.addDataProducer = exports.setProducerScore = exports.setProducerTrack = exports.setProducerResumed = exports.setProducerPaused = exports.removeProducer = exports.addProducer = exports.setRestartIceInProgress = exports.setAudioMutedState = exports.setAudioOnlyInProgress = exports.setAudioOnlyState = exports.setDisplayName = exports.setCanChangeWebcam = exports.setMediaCapabilities = exports.setMe = exports.setRoomFaceDetection = exports.setRoomStatsPeerId = exports.setRoomActiveSpeaker = exports.setRoomState = exports.setRoomUrl = void 0;
const setRoomUrl = (url) => {
    return {
        type: 'SET_ROOM_URL',
        payload: { url }
    };
};
exports.setRoomUrl = setRoomUrl;
const setRoomState = (state) => {
    return {
        type: 'SET_ROOM_STATE',
        payload: { state }
    };
};
exports.setRoomState = setRoomState;
const setRoomActiveSpeaker = (peerId) => {
    return {
        type: 'SET_ROOM_ACTIVE_SPEAKER',
        payload: { peerId }
    };
};
exports.setRoomActiveSpeaker = setRoomActiveSpeaker;
const setRoomStatsPeerId = (peerId) => {
    return {
        type: 'SET_ROOM_STATS_PEER_ID',
        payload: { peerId }
    };
};
exports.setRoomStatsPeerId = setRoomStatsPeerId;
const setRoomFaceDetection = (flag) => {
    return {
        type: 'SET_FACE_DETECTION',
        payload: flag
    };
};
exports.setRoomFaceDetection = setRoomFaceDetection;
const setMe = ({ peerId, displayName, displayNameSet, device }) => {
    return {
        type: 'SET_ME',
        payload: { peerId, displayName, displayNameSet, device }
    };
};
exports.setMe = setMe;
const setMediaCapabilities = ({ canSendMic, canSendWebcam }) => {
    return {
        type: 'SET_MEDIA_CAPABILITIES',
        payload: { canSendMic, canSendWebcam }
    };
};
exports.setMediaCapabilities = setMediaCapabilities;
const setCanChangeWebcam = (flag) => {
    return {
        type: 'SET_CAN_CHANGE_WEBCAM',
        payload: flag
    };
};
exports.setCanChangeWebcam = setCanChangeWebcam;
const setDisplayName = (displayName) => {
    return {
        type: 'SET_DISPLAY_NAME',
        payload: { displayName }
    };
};
exports.setDisplayName = setDisplayName;
const setAudioOnlyState = (enabled) => {
    return {
        type: 'SET_AUDIO_ONLY_STATE',
        payload: { enabled }
    };
};
exports.setAudioOnlyState = setAudioOnlyState;
const setAudioOnlyInProgress = (flag) => {
    return {
        type: 'SET_AUDIO_ONLY_IN_PROGRESS',
        payload: { flag }
    };
};
exports.setAudioOnlyInProgress = setAudioOnlyInProgress;
const setAudioMutedState = (enabled) => {
    return {
        type: 'SET_AUDIO_MUTED_STATE',
        payload: { enabled }
    };
};
exports.setAudioMutedState = setAudioMutedState;
const setRestartIceInProgress = (flag) => {
    return {
        type: 'SET_RESTART_ICE_IN_PROGRESS',
        payload: { flag }
    };
};
exports.setRestartIceInProgress = setRestartIceInProgress;
const addProducer = (producer) => {
    return {
        type: 'ADD_PRODUCER',
        payload: { producer }
    };
};
exports.addProducer = addProducer;
const removeProducer = (producerId) => {
    return {
        type: 'REMOVE_PRODUCER',
        payload: { producerId }
    };
};
exports.removeProducer = removeProducer;
const setProducerPaused = (producerId) => {
    return {
        type: 'SET_PRODUCER_PAUSED',
        payload: { producerId }
    };
};
exports.setProducerPaused = setProducerPaused;
const setProducerResumed = (producerId) => {
    return {
        type: 'SET_PRODUCER_RESUMED',
        payload: { producerId }
    };
};
exports.setProducerResumed = setProducerResumed;
const setProducerTrack = (producerId, track) => {
    return {
        type: 'SET_PRODUCER_TRACK',
        payload: { producerId, track }
    };
};
exports.setProducerTrack = setProducerTrack;
const setProducerScore = (producerId, score) => {
    return {
        type: 'SET_PRODUCER_SCORE',
        payload: { producerId, score }
    };
};
exports.setProducerScore = setProducerScore;
const addDataProducer = (dataProducer) => {
    return {
        type: 'ADD_DATA_PRODUCER',
        payload: { dataProducer }
    };
};
exports.addDataProducer = addDataProducer;
const removeDataProducer = (dataProducerId) => {
    return {
        type: 'REMOVE_DATA_PRODUCER',
        payload: { dataProducerId }
    };
};
exports.removeDataProducer = removeDataProducer;
const setWebcamInProgress = (flag) => {
    return {
        type: 'SET_WEBCAM_IN_PROGRESS',
        payload: { flag }
    };
};
exports.setWebcamInProgress = setWebcamInProgress;
const setShareInProgress = (flag) => {
    return {
        type: 'SET_SHARE_IN_PROGRESS',
        payload: { flag }
    };
};
exports.setShareInProgress = setShareInProgress;
const addPeer = (peer) => {
    return {
        type: 'ADD_PEER',
        payload: { peer }
    };
};
exports.addPeer = addPeer;
const removePeer = (peerId) => {
    return {
        type: 'REMOVE_PEER',
        payload: { peerId }
    };
};
exports.removePeer = removePeer;
const setPeerDisplayName = (displayName, peerId) => {
    return {
        type: 'SET_PEER_DISPLAY_NAME',
        payload: { displayName, peerId }
    };
};
exports.setPeerDisplayName = setPeerDisplayName;
const addConsumer = (consumer, peerId) => {
    return {
        type: 'ADD_CONSUMER',
        payload: { consumer, peerId }
    };
};
exports.addConsumer = addConsumer;
const removeConsumer = (consumerId, peerId) => {
    return {
        type: 'REMOVE_CONSUMER',
        payload: { consumerId, peerId }
    };
};
exports.removeConsumer = removeConsumer;
const setConsumerPaused = (consumerId, originator) => {
    return {
        type: 'SET_CONSUMER_PAUSED',
        payload: { consumerId, originator }
    };
};
exports.setConsumerPaused = setConsumerPaused;
const setConsumerResumed = (consumerId, originator) => {
    return {
        type: 'SET_CONSUMER_RESUMED',
        payload: { consumerId, originator }
    };
};
exports.setConsumerResumed = setConsumerResumed;
const setConsumerCurrentLayers = (consumerId, spatialLayer, temporalLayer) => {
    return {
        type: 'SET_CONSUMER_CURRENT_LAYERS',
        payload: { consumerId, spatialLayer, temporalLayer }
    };
};
exports.setConsumerCurrentLayers = setConsumerCurrentLayers;
const setConsumerPreferredLayers = (consumerId, spatialLayer, temporalLayer) => {
    return {
        type: 'SET_CONSUMER_PREFERRED_LAYERS',
        payload: { consumerId, spatialLayer, temporalLayer }
    };
};
exports.setConsumerPreferredLayers = setConsumerPreferredLayers;
const setConsumerPriority = (consumerId, priority) => {
    return {
        type: 'SET_CONSUMER_PRIORITY',
        payload: { consumerId, priority }
    };
};
exports.setConsumerPriority = setConsumerPriority;
const setConsumerTrack = (consumerId, track) => {
    return {
        type: 'SET_CONSUMER_TRACK',
        payload: { consumerId, track }
    };
};
exports.setConsumerTrack = setConsumerTrack;
const setConsumerScore = (consumerId, score) => {
    return {
        type: 'SET_CONSUMER_SCORE',
        payload: { consumerId, score }
    };
};
exports.setConsumerScore = setConsumerScore;
const addDataConsumer = (dataConsumer, peerId) => {
    return {
        type: 'ADD_DATA_CONSUMER',
        payload: { dataConsumer, peerId }
    };
};
exports.addDataConsumer = addDataConsumer;
const removeDataConsumer = (dataConsumerId, peerId) => {
    return {
        type: 'REMOVE_DATA_CONSUMER',
        payload: { dataConsumerId, peerId }
    };
};
exports.removeDataConsumer = removeDataConsumer;
const addNotification = (notification) => {
    return {
        type: 'ADD_NOTIFICATION',
        payload: { notification }
    };
};
exports.addNotification = addNotification;
const removeNotification = (notificationId) => {
    return {
        type: 'REMOVE_NOTIFICATION',
        payload: { notificationId }
    };
};
exports.removeNotification = removeNotification;
const removeAllNotifications = () => {
    return {
        type: 'REMOVE_ALL_NOTIFICATIONS'
    };
};
exports.removeAllNotifications = removeAllNotifications;
