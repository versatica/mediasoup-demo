import { combineReducers } from 'redux';
import room from './room';
import me from './me';
import producers from './producers';
import dataProducers from './dataProducers';
import peers from './peers';
import consumers from './consumers';
import dataConsumers from './dataConsumers';
import messages from './messages';
import notifications from './notifications';

const reducers = combineReducers(
	{
		room,
		me,
		producers,
		dataProducers,
		peers,
		consumers,
		dataConsumers,
    messages,
		notifications
	});

export default reducers;
