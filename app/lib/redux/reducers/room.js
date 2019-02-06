const initialState =
{
	url             : null,
	state           : 'new', // new/connecting/connected/disconnected/closed,
	activeSpeakerId : null,
	faceDetection   : false
};

const room = (state = initialState, action) =>
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
				return { ...state, state: roomState, activeSpeakerId: null };
		}

		case 'SET_ROOM_ACTIVE_SPEAKER':
		{
			const { peerId } = action.payload;

			return { ...state, activeSpeakerId: peerId };
		}

		case 'SET_FACE_DETECTION':
		{
			const flag = action.payload;

			return { ...state, faceDetection: flag };
		}

		default:
			return state;
	}
};

export default room;
