const initialState = {};

const producers = (state = initialState, action) =>
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

		case 'ADD_PRODUCER':
		{
			const { producer } = action.payload;

			return { ...state, [producer.id]: producer };
		}

		case 'REMOVE_PRODUCER':
		{
			const { producerId } = action.payload;
			const newState = { ...state };

			delete newState[producerId];

			return newState;
		}

		case 'SET_PRODUCER_PAUSED':
		{
			const { producerId } = action.payload;
			const producer = state[producerId];
			const newProducer = { ...producer, paused: true };

			return { ...state, [producerId]: newProducer };
		}

		case 'SET_PRODUCER_RESUMED':
		{
			const { producerId } = action.payload;
			const producer = state[producerId];
			const newProducer = { ...producer, paused: false };

			return { ...state, [producerId]: newProducer };
		}

		case 'SET_PRODUCER_TRACK':
		{
			const { producerId, track } = action.payload;
			const producer = state[producerId];
			const newProducer = { ...producer, track };

			return { ...state, [producerId]: newProducer };
		}

		case 'SET_PRODUCER_SCORE':
		{
			const { producerId, score } = action.payload;
			const producer = state[producerId];

			if (!producer)
				return state;

			const newProducer = { ...producer, score };

			return { ...state, [producerId]: newProducer };
		}

		default:
		{
			return state;
		}
	}
};

export default producers;
