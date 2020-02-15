type InitialState =
{
	url: string | null;
	state: 'new' | 'connecting' | 'connected' | 'disconnected' | 'closed';
	activeSpeakerId: string | null;
	statsPeerId: string | null;
	faceDetection: boolean;
};

const initialState: InitialState =
{
	url             : null,
	state           : 'new',
	activeSpeakerId : null,
	statsPeerId     : null,
	faceDetection   : false
};

const room = (state = initialState, action: any): any =>
{
	switch (action.type)
	{
		case 'SET_ROOM_URL':
		{
			const { url } = action.payload;

			return { ...state, url };
		}

		case 'SET_ROOM_STATE':
		{
			const roomState = action.payload.state;

			if (roomState === 'connected')
				return { ...state, state: roomState };
			else
				return { ...state, state: roomState, activeSpeakerId: null, statsPeerId: null };
		}

		case 'SET_ROOM_ACTIVE_SPEAKER':
		{
			const { peerId } = action.payload;

			return { ...state, activeSpeakerId: peerId };
		}

		case 'SET_ROOM_STATS_PEER_ID':
		{
			const { peerId } = action.payload;

			if (state.statsPeerId === peerId)
				return { ...state, statsPeerId: null };

			return { ...state, statsPeerId: peerId };
		}

		case 'SET_FACE_DETECTION':
		{
			const flag = action.payload;

			return { ...state, faceDetection: flag };
		}

		case 'REMOVE_PEER':
		{
			const { peerId } = action.payload;
			const newState = { ...state };

			if (peerId && peerId === state.activeSpeakerId)
				newState.activeSpeakerId = null;

			if (peerId && peerId === state.statsPeerId)
				newState.statsPeerId = null;

			return newState;
		}

		default:
			return state;
	}
};

export default room;
