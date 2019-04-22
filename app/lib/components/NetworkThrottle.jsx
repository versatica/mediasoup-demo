import React from 'react';
import { connect } from 'react-redux';
import Draggable from 'react-draggable';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import { withRoomContext } from '../RoomContext';
import * as stateActions from '../redux/stateActions';

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
		const {
			uplink,
			downlink,
			rtt,
			disabled
		} = this.state;

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
							disabled={disabled}
						>
							APPLY
						</button>
					</div>
				</form>
			</Draggable>
		);
	}

	_apply()
	{
		const {
			uplink,
			downlink,
			rtt
		} = this.state;

		console.warn('APPLY: uplink:%s, rtt:%s', uplink, rtt);

		this.setState({ disabled: true });

		setTimeout(() => this.setState({ disabled: false }), 1000);
	}

	_reset()
	{
		this.setState(
			{
				uplink   : '',
				downlink : '',
				rtt      : '',
				disabled : false
			});

		// TODO: Send command.
	}
}

NetworkThrottle.propTypes =
{

};

const mapStateToProps = (state) =>
{
	// const producersArray = Object.values(state.producers);
	// const audioProducer =
	// 	producersArray.find((producer) => producer.track.kind === 'audio');
	// const videoProducer =
	// 	producersArray.find((producer) => producer.track.kind === 'video');

	// return {
	// 	connected     : state.room.state === 'connected',
	// 	me            : state.me,
	// 	audioProducer : audioProducer,
	// 	videoProducer : videoProducer,
	// 	faceDetection : state.room.faceDetection
	// };

	return {};
};

const mapDispatchToProps = (dispatch) =>
{
	return {};
};

const NetworkThrottleContainer = withRoomContext(connect(
	mapStateToProps,
	mapDispatchToProps
)(NetworkThrottle));

export default NetworkThrottleContainer;
