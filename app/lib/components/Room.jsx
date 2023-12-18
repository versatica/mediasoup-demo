import React, { componentDidMount } from 'react';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import Tooltip from 'react-tooltip';
import classnames from 'classnames';
import clipboardCopy from 'clipboard-copy';
import * as appPropTypes from './appPropTypes';
import * as requestActions from '../redux/requestActions';
import { Appear } from './transitions';
import MeContainer from './Me';
// import ChatInputContainer from './ChatInput';
import Peers from './Peers';
import Stats from './Stats';
import Notifications from './Notifications';
import NetworkThrottle from './NetworkThrottle';
import Logger from '../Logger';
import { UseRoomClient } from '../RoomContext';

const logger = new Logger();

export default function Room()
{
	const roomClient = UseRoomClient();

	logger.debug('Room state: ', state);
	const room = state.room;
	const me = state.me;
	const amActiveSpeaker = state.me.id === state.room.activeSpeakerId;
	const onRoomLinkCopy = () => dispatch(
		requestActions.notify(
			{
				text : 'Room link copied to the clipboard'
			}
		)
	);

	componentDidMount()
	{
		roomClient.join();
	}

	return (
		<Appear duration={300}>
			<div data-component='Room'>
				<Notifications />
				<div className='state'>
					<div className={classnames('icon', room.state)} />
					<p className={classnames('text', room.state)}>{room.state}</p>
				</div>

				<div className='room-link-wrapper'>
					<div className='room-link'>
						<a
							className='link'
							href={room.url}
							target='_blank'
							rel='noopener noreferrer'
							onClick={(event) =>
							{
								// If this is a 'Open in new window/tab' don't prevent
								// click default action.
								if (
									event.ctrlKey || event.shiftKey || event.metaKey ||
									// Middle click (IE > 9 and everyone else).
									(event.button && event.button === 1)
								)
								{
									return;
								}

								event.preventDefault();

								clipboardCopy(room.url)
									.then(onRoomLinkCopy);
							}}
						>
							invitation link
						</a>
					</div>
				</div>

				<Peers />

				<div className={classnames('me-container', {
					'active-speaker' : amActiveSpeaker
				})}
				>
					<MeContainer />
				</div>

				// <div className='chat-input-container'>
				// 	<ChatInputContainer />
				// </div>

				<div className='sidebar'>
					<div
						className={classnames('button', 'hide-videos', {
							on       : me.audioOnly,
							disabled : me.audioOnlyInProgress
						})}
						data-tip={'Show/hide participants\' video'}
						onClick={() =>
						{
							me.audioOnly
								? roomClient.disableAudioOnly()
								: roomClient.enableAudioOnly();
						}}
					/>

					<div
						className={classnames('button', 'mute-audio', {
							on : me.audioMuted
						})}
						data-tip={'Mute/unmute participants\' audio'}
						onClick={() =>
						{
							me.audioMuted
								? roomClient.unmuteAudio()
								: roomClient.muteAudio();
						}}
					/>

					<div
						className={classnames('button', 'restart-ice', {
							disabled : me.restartIceInProgress
						})}
						data-tip='Restart ICE'
						onClick={() => roomClient.restartIce()}
					/>
				</div>

				<Stats />

				<If condition={window.NETWORK_THROTTLE_SECRET}>
					<NetworkThrottle secret={window.NETWORK_THROTTLE_SECRET} />
				</If>

				<Tooltip
					id='my-tooltip'
					type='light'
					effect='solid'
					delayShow={100}
					delayHide={100}
					delayUpdate={50}
				/>
			</div>
		</Appear>

	);

}

Room.propTypes =
{
	// roomClient      : PropTypes.RoomClient.isRequired,
	room            : appPropTypes.Room.isRequired,
	me              : appPropTypes.Me.isRequired,
	amActiveSpeaker : PropTypes.bool.isRequired,
	onRoomLinkCopy  : PropTypes.func.isRequired
};

const mapStateToProps = (state) => (
	{
		room            : state.room,
		me              : state.me,
		amActiveSpeaker : state.me.id === state.room.activeSpeakerId
	});

const mapDispatchToProps = (dispatch) =>
{
	return {
		onRoomLinkCopy : () => dispatch(
			requestActions.notify(
				{
					text : 'Room link copied to the clipboard'
				}
			)
		)
	};
};

// const RoomContainer = withRoomContext(connect(
// 	mapStateToProps,
// 	mapDispatchToProps
// )(Room));

const RoomContainer = connect(
	mapStateToProps,
	mapDispatchToProps
)(Room);
