import React, { componentWillUnmount, useState } from 'react';
import Draggable from 'react-draggable';
import PropTypes from 'prop-types';
import { useRoomClient } from '../RoomContext';

export default function NetworkThrottle(secret)
{
	const [ uplink, setUplink ] = useState('');
	const [ downlink, setDownlink ] = useState('');
	const [ rtt, setRtt ] = useState('');
	const [ packetLoss, setPacketLoss ] = useState('');
	const [ disabled, setDisabled ] = useState(false);

	const roomClient = useRoomClient();
	
	async function _apply()
	{
		setUplink(
			Number(uplink) === uplink ? uplink : 0
		);
		setUplink(
			Number(downlink) === downlink ? downlink : 0
		);
		setUplink(
			Number(rtt) === rtt ? rtt : 0
		);
		setUplink(
			Number(packetLoss) === packetLoss ? packetLoss : 0
		);
	
		setDisabled(true);
	
		await roomClient.applyNetworkThrottle(
			{ secret, uplink, downlink, rtt, packetLoss }
		);
	
		window.onunload = () =>
		{
			roomClient.resetNetworkThrottle({ silent: true, secret });
		};
	
		setDisabled(false);
	}

	async function _reset()
	{
		setUplink('');
		setDownlink('');
		setRtt('');
		setPacketLoss('');
		setDisabled(true);
	
		await roomClient.resetNetworkThrottle({ secret });
	
		setDisabled(false);
	}
	
	componentWillUnmount(() => 
	{
		roomClient.resetNetworkThrottle({ silent: true });
	}
	);
	
	return (
		<Draggable
			bounds='parent'
			defaultPosition={{ x: 20, y: 20 }}
			handle='h1.draggable'
		>
			<form
				data-component='NetworkThrottle'
				onSubmit={(event) =>
				{
					event.preventDefault();

					_apply();
				}}
			>
				<h1 className='draggable'>Network Throttle</h1>

				<div className='inputs'>
					<div className='row'>
						<p className='key'>
							UPLINK (kbps)
						</p>

						<input
							className='value'
							type='text'
							placeholder='NO LIMIT'
							disabled={disabled}
							pattern='[0-9]*'
							value={uplink}
							autoCorrect='false'
							spellCheck='false'
							onChange={(event) => setUplink(event.target.value)}
						/>
					</div>

					<div className='row'>
						<p className='key'>
							DOWNLINK (kbps)
						</p>

						<input
							className='value'
							type='text'
							placeholder='NO LIMIT'
							disabled={disabled}
							pattern='[0-9]*'
							value={downlink}
							autoCorrect='false'
							spellCheck='false'
							onChange={(event) => setDownlink(event.target.value)}
						/>
					</div>

					<div className='row'>
						<p className='key'>
							RTT (ms)
						</p>

						<input
							className='value'
							type='text'
							placeholder='NOT SET'
							disabled={disabled}
							pattern='[0-9]*'
							value={rtt}
							autoCorrect='false'
							spellCheck='false'
							onChange={(event) => setRtt(event.target.value)}
						/>
					</div>

					<div className='row'>
						<p className='key'>
							PACKETLOSS (%)
						</p>

						<input
							className='value'
							type='text'
							placeholder='NOT SET'
							disabled={disabled}
							pattern='[0-9]*'
							value={packetLoss}
							autoCorrect='false'
							spellCheck='false'
							onChange={(event) => setPacketLoss(event.target.value)}
						/>
					</div>
				</div>

				<div className='buttons'>
					<button
						type='button'
						className='reset'
						disabled={disabled}
						onClick={() => _reset()}
					>
						RESET
					</button>

					<button
						type='submit'
						className='apply'
						disabled={
							disabled ||
							(!uplink.trim() && !downlink.trim() && !rtt.trim() && !packetLoss.trim())
						}
					>
						APPLY
					</button>
				</div>
			</form>
		</Draggable>
	);

}

NetworkThrottle.propTypes =
{
	roomClient : PropTypes.any.isRequired,
	secret     : PropTypes.string.isRequired
};
