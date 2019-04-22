import React from 'react';
import Draggable from 'react-draggable';
import PropTypes from 'prop-types';
import { withRoomContext } from '../RoomContext';

class NetworkThrottle extends React.Component
{
	constructor(props)
	{
		super(props);

		this.state =
		{
			uplink   : '',
			downlink : '',
			rtt      : '',
			disabled : false
		};
	}

	render()
	{
		const { uplink, downlink, rtt, disabled } = this.state;

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

						this._apply();
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
								onChange={(event) => this.setState({ uplink: event.target.value })}
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
								onChange={(event) => this.setState({ downlink: event.target.value })}
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
								onChange={(event) => this.setState({ rtt: event.target.value })}
							/>
						</div>
					</div>

					<div className='buttons'>
						<button
							type='button'
							className='reset'
							disabled={disabled}
							onClick={() => this._reset()}
						>
							RESET
						</button>

						<button
							type='submit'
							className='apply'
							disabled={
								disabled ||
								(!uplink.trim() && !downlink.trim() && !rtt.trim())
							}
						>
							APPLY
						</button>
					</div>
				</form>
			</Draggable>
		);
	}

	componentWillUnmount()
	{
		const { roomClient } = this.props;

		roomClient.resetNetworkThrottle({ silent: true });
	}

	async _apply()
	{
		const { roomClient, secret } = this.props;
		let { uplink, downlink, rtt } = this.state;

		uplink = Number(uplink) || 0;
		downlink = Number(downlink) || 0;
		rtt = Number(rtt) || 0;

		this.setState({ disabled: true });

		await roomClient.applyNetworkThrottle(
			{ uplink, downlink, rtt, secret });

		window.onunload = () =>
		{
			roomClient.resetNetworkThrottle({ silent: true, secret });
		};

		this.setState({ disabled: false });
	}

	async _reset()
	{
		const { roomClient, secret } = this.props;

		this.setState(
			{
				uplink   : '',
				downlink : '',
				rtt      : '',
				disabled : false
			});

		this.setState({ disabled: true });

		await roomClient.resetNetworkThrottle({ secret });

		this.setState({ disabled: false });
	}
}

NetworkThrottle.propTypes =
{
	roomClient : PropTypes.any.isRequired,
	secret     : PropTypes.string.isRequired
};

export default withRoomContext(NetworkThrottle);
