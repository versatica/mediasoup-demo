import React, {
	createContext,
	useContext,
	useState
} from 'react';
import RoomClientContextComponent from './components/RoomClientContextComponent';
import Logger from './Logger';
const logger = new Logger();

export const RoomClientContext = createContext(null);

export const RoomClientUpdateContext = createContext(null);

export function UseRoomClient()
{
	return useContext(RoomClientContext);
}

export function UseRoomClientUpdate()
{
	return useContext(RoomClientUpdateContext);
}

export function RoomClientProvider({ children })
{
	logger.debug('children: ', children);

	const [ roomClient, setRoomClient ] = useState(UseRoomClient());

	function setRoomClientInstance(data)
	{
		logger.debug('RoomContext.setRoomClientInstance(data): ', data);
		setRoomClient(data);
	}

	return (
		<RoomClientContext.Provider value={roomClient}>
			<RoomClientUpdateContext.Provider value={setRoomClientInstance}>
				<RoomClientContextComponent>
					{children}
				</RoomClientContextComponent>
			</RoomClientUpdateContext.Provider>
		</RoomClientContext.Provider>
	);
}
