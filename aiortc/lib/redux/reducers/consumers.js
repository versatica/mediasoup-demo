"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const initialState = {};
const consumers = (state = initialState, action) => {
    switch (action.type) {
        case 'SET_ROOM_STATE':
            {
                const roomState = action.payload.state;
                if (roomState === 'closed')
                    return {};
                else
                    return state;
            }
        case 'ADD_CONSUMER':
            {
                const { consumer } = action.payload;
                return Object.assign(Object.assign({}, state), { [consumer.id]: consumer });
            }
        case 'REMOVE_CONSUMER':
            {
                const { consumerId } = action.payload;
                const newState = Object.assign({}, state);
                // @ts-ignore
                delete newState[consumerId];
                return newState;
            }
        case 'SET_CONSUMER_PAUSED':
            {
                const { consumerId, originator } = action.payload;
                // @ts-ignore
                const consumer = state[consumerId];
                let newConsumer;
                if (originator === 'local')
                    newConsumer = Object.assign(Object.assign({}, consumer), { locallyPaused: true });
                else
                    newConsumer = Object.assign(Object.assign({}, consumer), { remotelyPaused: true });
                return Object.assign(Object.assign({}, state), { [consumerId]: newConsumer });
            }
        case 'SET_CONSUMER_RESUMED':
            {
                const { consumerId, originator } = action.payload;
                // @ts-ignore
                const consumer = state[consumerId];
                let newConsumer;
                if (originator === 'local')
                    newConsumer = Object.assign(Object.assign({}, consumer), { locallyPaused: false });
                else
                    newConsumer = Object.assign(Object.assign({}, consumer), { remotelyPaused: false });
                return Object.assign(Object.assign({}, state), { [consumerId]: newConsumer });
            }
        case 'SET_CONSUMER_CURRENT_LAYERS':
            {
                const { consumerId, spatialLayer, temporalLayer } = action.payload;
                // @ts-ignore
                const consumer = state[consumerId];
                const newConsumer = Object.assign(Object.assign({}, consumer), { currentSpatialLayer: spatialLayer, currentTemporalLayer: temporalLayer });
                return Object.assign(Object.assign({}, state), { [consumerId]: newConsumer });
            }
        case 'SET_CONSUMER_PREFERRED_LAYERS':
            {
                const { consumerId, spatialLayer, temporalLayer } = action.payload;
                // @ts-ignore
                const consumer = state[consumerId];
                const newConsumer = Object.assign(Object.assign({}, consumer), { preferredSpatialLayer: spatialLayer, preferredTemporalLayer: temporalLayer });
                return Object.assign(Object.assign({}, state), { [consumerId]: newConsumer });
            }
        case 'SET_CONSUMER_PRIORITY':
            {
                const { consumerId, priority } = action.payload;
                // @ts-ignore
                const consumer = state[consumerId];
                const newConsumer = Object.assign(Object.assign({}, consumer), { priority });
                return Object.assign(Object.assign({}, state), { [consumerId]: newConsumer });
            }
        case 'SET_CONSUMER_TRACK':
            {
                const { consumerId, track } = action.payload;
                // @ts-ignore
                const consumer = state[consumerId];
                const newConsumer = Object.assign(Object.assign({}, consumer), { track });
                return Object.assign(Object.assign({}, state), { [consumerId]: newConsumer });
            }
        case 'SET_CONSUMER_SCORE':
            {
                const { consumerId, score } = action.payload;
                // @ts-ignore
                const consumer = state[consumerId];
                if (!consumer)
                    return state;
                const newConsumer = Object.assign(Object.assign({}, consumer), { score });
                return Object.assign(Object.assign({}, state), { [consumerId]: newConsumer });
            }
        default:
            {
                return state;
            }
    }
};
exports.default = consumers;
