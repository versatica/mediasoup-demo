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

		default:
			return state;
	}
};

export default peers;
