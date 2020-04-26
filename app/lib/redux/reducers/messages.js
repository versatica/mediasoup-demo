const initialState = [];

const messages = (state = initialState, action) =>
{
	switch (action.type)
	{
    // only add for now. might need grooming eventually
		case 'ADD_MESSAGE':
		{
			const { message } = action.payload;

			return [ ...state, message ];
		}
	}
  return state
};

export default messages;
