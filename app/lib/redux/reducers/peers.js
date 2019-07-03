const initialState = {};

const peers = (state = initialState, action) =>
{
	switch (action.type)
	{
		case 'SET_ROOM_STATE':
		{
			const roomState = action.payload.state;

			if (roomState === 'closed')
				return {};
			else
				return state;
		}

		case 'ADD_PEER':
		{
			const { peer } = action.payload;

			return { ...state, [peer.id]: peer };
		}

		case 'REMOVE_PEER':
		{
			const { peerId } = action.payload;
			const newState = { ...state };

			delete newState[peerId];

			return newState;
		}

		case 'SET_PEER_DISPLAY_NAME':
		{
			const { displayName, peerId } = action.payload;
			const peer = state[peerId];

			if (!peer)
				throw new Error('no Peer found');

			const newPeer = { ...peer, displayName };

			return { ...state, [newPeer.id]: newPeer };
		}

		case 'ADD_CONSUMER':
		{
			const { consumer, peerId } = action.payload;
			const peer = state[peerId];

			if (!peer)
				throw new Error('no Peer found for new Consumer');

			const newConsumers = [ ...peer.consumers, consumer.id ];
			const newPeer = { ...peer, consumers: newConsumers };

			return { ...state, [newPeer.id]: newPeer };
		}

		case 'REMOVE_CONSUMER':
		{
			const { consumerId, peerId } = action.payload;
			const peer = state[peerId];

			// NOTE: This means that the Peer was closed before, so it's ok.
			if (!peer)
				return state;

			const idx = peer.consumers.indexOf(consumerId);

			if (idx === -1)
				throw new Error('Consumer not found');

			const newConsumers = peer.consumers.slice();

			newConsumers.splice(idx, 1);

			const newPeer = { ...peer, consumers: newConsumers };

			return { ...state, [newPeer.id]: newPeer };
		}

		case 'ADD_DATA_CONSUMER':
		{
			const { dataConsumer, peerId } = action.payload;

			// special case for bot DataConsumer.
			if (!peerId)
				return state;

			const peer = state[peerId];

			if (!peer)
				throw new Error('no Peer found for new DataConsumer');

			const newDataConsumers = [ ...peer.dataConsumers, dataConsumer.id ];
			const newPeer = { ...peer, dataConsumers: newDataConsumers };

			return { ...state, [newPeer.id]: newPeer };
		}

		case 'REMOVE_DATA_CONSUMER':
		{
			const { dataConsumerId, peerId } = action.payload;

			// special case for bot DataConsumer.
			if (!peerId)
				return state;

			const peer = state[peerId];

			// NOTE: This means that the Peer was closed before, so it's ok.
			if (!peer)
				return state;

			const idx = peer.dataConsumers.indexOf(dataConsumerId);

			if (idx === -1)
				throw new Error('DataConsumer not found');

			const newDataConsumers = peer.dataConsumers.slice();

			newDataConsumers.splice(idx, 1);

			const newPeer = { ...peer, dataConsumers: newDataConsumers };

			return { ...state, [newPeer.id]: newPeer };
		}

		default:
		{
			return state;
		}
	}
};

export default peers;
