const initialState =
{
	id                   : null,
	displayName          : null,
	displayNameSet       : false,
	device               : null,
	canSendMic           : false,
	canSendWebcam        : false,
	canChangeWebcam      : false,
	webcamInProgress     : false,
	shareInProgress      : false,
	audioOnly            : false,
	audioOnlyInProgress  : false,
	audioMuted           : false,
	restartIceInProgress : false
};

const me = (state = initialState, action) =>
{
	switch (action.type)
	{
		case 'SET_ROOM_STATE':
		{
			const roomState = action.payload.state;

			if (roomState === 'closed')
			{
				return {
					...state,
					webcamInProgress     : false,
					shareInProgress      : false,
					audioOnly            : false,
					audioOnlyInProgress  : false,
					audioMuted           : false,
					restartIceInProgress : false
				};
			}
			else
			{
				return state;
			}
		}

		case 'SET_ME':
		{
			const { peerId, displayName, displayNameSet, device } = action.payload;

			return { ...state, id: peerId, displayName, displayNameSet, device };
		}

		case 'SET_MEDIA_CAPABILITIES':
		{
			const { canSendMic, canSendWebcam } = action.payload;

			return { ...state, canSendMic, canSendWebcam };
		}

		case 'SET_CAN_CHANGE_WEBCAM':
		{
			const canChangeWebcam = action.payload;

			return { ...state, canChangeWebcam };
		}

		case 'SET_WEBCAM_IN_PROGRESS':
		{
			const { flag } = action.payload;

			return { ...state, webcamInProgress: flag };
		}

		case 'SET_SHARE_IN_PROGRESS':
		{
			const { flag } = action.payload;

			return { ...state, shareInProgress: flag };
		}

		case 'SET_DISPLAY_NAME':
		{
			let { displayName } = action.payload;

			// Be ready for undefined displayName (so keep previous one).
			if (!displayName)
				displayName = state.displayName;

			return { ...state, displayName, displayNameSet: true };
		}

		case 'SET_AUDIO_ONLY_STATE':
		{
			const { enabled } = action.payload;

			return { ...state, audioOnly: enabled };
		}

		case 'SET_AUDIO_ONLY_IN_PROGRESS':
		{
			const { flag } = action.payload;

			return { ...state, audioOnlyInProgress: flag };
		}

		case 'SET_AUDIO_MUTED_STATE':
		{
			const { enabled } = action.payload;

			return { ...state, audioMuted: enabled };
		}

		case 'SET_RESTART_ICE_IN_PROGRESS':
		{
			const { flag } = action.payload;

			return { ...state, restartIceInProgress: flag };
		}

		default:
			return state;
	}
};

export default me;
