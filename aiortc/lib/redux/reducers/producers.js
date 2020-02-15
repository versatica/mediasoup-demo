"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const initialState = {};
const producers = (state = initialState, action) => {
    switch (action.type) {
        case 'SET_ROOM_STATE':
            {
                const roomState = action.payload.state;
                if (roomState === 'closed')
                    return {};
                else
                    return state;
            }
        case 'ADD_PRODUCER':
            {
                const { producer } = action.payload;
                return Object.assign(Object.assign({}, state), { [producer.id]: producer });
            }
        case 'REMOVE_PRODUCER':
            {
                const { producerId } = action.payload;
                const newState = Object.assign({}, state);
                // @ts-ignore
                delete newState[producerId];
                return newState;
            }
        case 'SET_PRODUCER_PAUSED':
            {
                const { producerId } = action.payload;
                // @ts-ignore
                const producer = state[producerId];
                const newProducer = Object.assign(Object.assign({}, producer), { paused: true });
                return Object.assign(Object.assign({}, state), { [producerId]: newProducer });
            }
        case 'SET_PRODUCER_RESUMED':
            {
                const { producerId } = action.payload;
                // @ts-ignore
                const producer = state[producerId];
                const newProducer = Object.assign(Object.assign({}, producer), { paused: false });
                return Object.assign(Object.assign({}, state), { [producerId]: newProducer });
            }
        case 'SET_PRODUCER_TRACK':
            {
                const { producerId, track } = action.payload;
                // @ts-ignore
                const producer = state[producerId];
                const newProducer = Object.assign(Object.assign({}, producer), { track });
                return Object.assign(Object.assign({}, state), { [producerId]: newProducer });
            }
        case 'SET_PRODUCER_SCORE':
            {
                const { producerId, score } = action.payload;
                // @ts-ignore
                const producer = state[producerId];
                if (!producer)
                    return state;
                const newProducer = Object.assign(Object.assign({}, producer), { score });
                return Object.assign(Object.assign({}, state), { [producerId]: newProducer });
            }
        default:
            {
                return state;
            }
    }
};
exports.default = producers;
