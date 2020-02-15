"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setRoomUrl = (url) => {
    return {
        type: 'SET_ROOM_URL',
        payload: { url }
    };
};
exports.setRoomState = (state) => {
    return {
        type: 'SET_ROOM_STATE',
        payload: { state }
    };
};
exports.setRoomActiveSpeaker = (peerId) => {
    return {
        type: 'SET_ROOM_ACTIVE_SPEAKER',
        payload: { peerId }
    };
};
exports.setRoomStatsPeerId = (peerId) => {
    return {
        type: 'SET_ROOM_STATS_PEER_ID',
        payload: { peerId }
    };
};
exports.setRoomFaceDetection = (flag) => {
    return {
        type: 'SET_FACE_DETECTION',
        payload: flag
    };
};
exports.setMe = ({ peerId, displayName, displayNameSet, device }) => {
    return {
        type: 'SET_ME',
        payload: { peerId, displayName, displayNameSet, device }
    };
};
exports.setMediaCapabilities = ({ canSendMic, canSendWebcam }) => {
    return {
        type: 'SET_MEDIA_CAPABILITIES',
        payload: { canSendMic, canSendWebcam }
    };
};
exports.setCanChangeWebcam = (flag) => {
    return {
        type: 'SET_CAN_CHANGE_WEBCAM',
        payload: flag
    };
};
exports.setDisplayName = (displayName) => {
    return {
        type: 'SET_DISPLAY_NAME',
        payload: { displayName }
    };
};
exports.setAudioOnlyState = (enabled) => {
    return {
        type: 'SET_AUDIO_ONLY_STATE',
        payload: { enabled }
    };
};
exports.setAudioOnlyInProgress = (flag) => {
    return {
        type: 'SET_AUDIO_ONLY_IN_PROGRESS',
        payload: { flag }
    };
};
exports.setAudioMutedState = (enabled) => {
    return {
        type: 'SET_AUDIO_MUTED_STATE',
        payload: { enabled }
    };
};
exports.setRestartIceInProgress = (flag) => {
    return {
        type: 'SET_RESTART_ICE_IN_PROGRESS',
        payload: { flag }
    };
};
exports.addProducer = (producer) => {
    return {
        type: 'ADD_PRODUCER',
        payload: { producer }
    };
};
exports.removeProducer = (producerId) => {
    return {
        type: 'REMOVE_PRODUCER',
        payload: { producerId }
    };
};
exports.setProducerPaused = (producerId) => {
    return {
        type: 'SET_PRODUCER_PAUSED',
        payload: { producerId }
    };
};
exports.setProducerResumed = (producerId) => {
    return {
        type: 'SET_PRODUCER_RESUMED',
        payload: { producerId }
    };
};
exports.setProducerTrack = (producerId, track) => {
    return {
        type: 'SET_PRODUCER_TRACK',
        payload: { producerId, track }
    };
};
exports.setProducerScore = (producerId, score) => {
    return {
        type: 'SET_PRODUCER_SCORE',
        payload: { producerId, score }
    };
};
exports.addDataProducer = (dataProducer) => {
    return {
        type: 'ADD_DATA_PRODUCER',
        payload: { dataProducer }
    };
};
exports.removeDataProducer = (dataProducerId) => {
    return {
        type: 'REMOVE_DATA_PRODUCER',
        payload: { dataProducerId }
    };
};
exports.setWebcamInProgress = (flag) => {
    return {
        type: 'SET_WEBCAM_IN_PROGRESS',
        payload: { flag }
    };
};
exports.setShareInProgress = (flag) => {
    return {
        type: 'SET_SHARE_IN_PROGRESS',
        payload: { flag }
    };
};
exports.addPeer = (peer) => {
    return {
        type: 'ADD_PEER',
        payload: { peer }
    };
};
exports.removePeer = (peerId) => {
    return {
        type: 'REMOVE_PEER',
        payload: { peerId }
    };
};
exports.setPeerDisplayName = (displayName, peerId) => {
    return {
        type: 'SET_PEER_DISPLAY_NAME',
        payload: { displayName, peerId }
    };
};
exports.addConsumer = (consumer, peerId) => {
    return {
        type: 'ADD_CONSUMER',
        payload: { consumer, peerId }
    };
};
exports.removeConsumer = (consumerId, peerId) => {
    return {
        type: 'REMOVE_CONSUMER',
        payload: { consumerId, peerId }
    };
};
exports.setConsumerPaused = (consumerId, originator) => {
    return {
        type: 'SET_CONSUMER_PAUSED',
        payload: { consumerId, originator }
    };
};
exports.setConsumerResumed = (consumerId, originator) => {
    return {
        type: 'SET_CONSUMER_RESUMED',
        payload: { consumerId, originator }
    };
};
exports.setConsumerCurrentLayers = (consumerId, spatialLayer, temporalLayer) => {
    return {
        type: 'SET_CONSUMER_CURRENT_LAYERS',
        payload: { consumerId, spatialLayer, temporalLayer }
    };
};
exports.setConsumerPreferredLayers = (consumerId, spatialLayer, temporalLayer) => {
    return {
        type: 'SET_CONSUMER_PREFERRED_LAYERS',
        payload: { consumerId, spatialLayer, temporalLayer }
    };
};
exports.setConsumerPriority = (consumerId, priority) => {
    return {
        type: 'SET_CONSUMER_PRIORITY',
        payload: { consumerId, priority }
    };
};
exports.setConsumerTrack = (consumerId, track) => {
    return {
        type: 'SET_CONSUMER_TRACK',
        payload: { consumerId, track }
    };
};
exports.setConsumerScore = (consumerId, score) => {
    return {
        type: 'SET_CONSUMER_SCORE',
        payload: { consumerId, score }
    };
};
exports.addDataConsumer = (dataConsumer, peerId) => {
    return {
        type: 'ADD_DATA_CONSUMER',
        payload: { dataConsumer, peerId }
    };
};
exports.removeDataConsumer = (dataConsumerId, peerId) => {
    return {
        type: 'REMOVE_DATA_CONSUMER',
        payload: { dataConsumerId, peerId }
    };
};
exports.addNotification = (notification) => {
    return {
        type: 'ADD_NOTIFICATION',
        payload: { notification }
    };
};
exports.removeNotification = (notificationId) => {
    return {
        type: 'REMOVE_NOTIFICATION',
        payload: { notificationId }
    };
};
exports.removeAllNotifications = () => {
    return {
        type: 'REMOVE_ALL_NOTIFICATIONS'
    };
};
