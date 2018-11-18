import React from 'react';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import * as appPropTypes from './appPropTypes';
import { withRoomContext } from '../RoomContext';
import PeerView from './PeerView';

const Peer = (props) =>
{
	const {
		roomClient,
		peer,
		micConsumer,
		webcamConsumer
	} = props;

	const micEnabled = (
		Boolean(micConsumer) &&
		!micConsumer.locallyPaused &&
		!micConsumer.remotelyPaused
	);

	const videoVisible = (
		Boolean(webcamConsumer) &&
		!webcamConsumer.locallyPaused &&
		!webcamConsumer.remotelyPaused
	);

	let videoProfile;

	if (webcamConsumer)
		videoProfile = webcamConsumer.profile;

	let videoPreferredProfile;

	if (webcamConsumer)
		videoPreferredProfile = webcamConsumer.preferredProfile;

	return (
		<div data-component='Peer'>
			<div className='indicators'>
				<If condition={!micEnabled}>
					<div className='icon mic-off' />
				</If>

				<If condition={!videoVisible}>
					<div className='icon webcam-off' />
				</If>
			</div>

			<If condition={videoVisible && !webcamConsumer.supported}>
				<div className='incompatible-video'>
					<p>incompatible video</p>
				</div>
			</If>

			<PeerView
				peer={peer}
				audioTrack={micConsumer ? micConsumer.track : null}
				videoTrack={webcamConsumer ? webcamConsumer.track : null}
				videoVisible={videoVisible}
				videoProfile={videoProfile}
				videoPreferredProfile={videoPreferredProfile}
				audioCodec={micConsumer ? micConsumer.codec : null}
				videoCodec={webcamConsumer ? webcamConsumer.codec : null}
				onChangeVideoPreferredProfile={(profile) =>
				{
					roomClient.changeConsumerPreferredProfile(webcamConsumer.id, profile);
				}}
				onRequestKeyFrame={() =>
				{
					roomClient.requestConsumerKeyFrame(webcamConsumer.id);
				}}
			/>
		</div>
	);
};

Peer.propTypes =
{
	roomClient     : PropTypes.any.isRequired,
	peer           : appPropTypes.Peer.isRequired,
	micConsumer    : appPropTypes.Consumer,
	webcamConsumer : appPropTypes.Consumer
};

const mapStateToProps = (state, { name }) =>
{
	const peer = state.peers[name];
	const consumersArray = peer.consumers
		.map((consumerId) => state.consumers[consumerId]);
	const micConsumer =
		consumersArray.find((consumer) => consumer.source === 'mic');
	const webcamConsumer =
		consumersArray.find((consumer) => consumer.source === 'webcam');

	return {
		peer,
		micConsumer,
		webcamConsumer
	};
};

const PeerContainer = withRoomContext(connect(
	mapStateToProps,
	undefined
)(Peer));

export default PeerContainer;
