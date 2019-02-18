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
		webcamConsumer,
		faceDetection
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

	return (
		<div data-component='Peer'>
			<div className='indicators'>
				<If condition={!micEnabled}>
					<div className='icon mic-off' />
				</If>

				<If condition={!webcamConsumer}>
					<div className='icon webcam-off' />
				</If>
			</div>

			<PeerView
				peer={peer}
				audioTrack={micConsumer ? micConsumer.track : null}
				videoTrack={webcamConsumer ? webcamConsumer.track : null}
				videoVisible={videoVisible}
				videoMultiLayer={webcamConsumer && webcamConsumer.type !== 'simple'}
				videoCurrentSpatialLayer={webcamConsumer ? webcamConsumer.currentSpatialLayer : null}
				videoPreferredSpatialLayer={
					webcamConsumer
						? typeof webcamConsumer.preferredSpatialLayer === 'number'
							? webcamConsumer.preferredSpatialLayer
							: 2 // NOTE: We know that the preferred spatil layer is 2 because we are cool.
						: null
				}
				audioCodec={micConsumer ? micConsumer.codec : null}
				videoCodec={webcamConsumer ? webcamConsumer.codec : null}
				audioScore={micConsumer ? micConsumer.score : null}
				videoScore={webcamConsumer ? webcamConsumer.score : null}
				faceDetection={faceDetection}
				onChangeVideoPreferredSpatialLayer={(spatialLayer) =>
				{
					roomClient.setConsumerPreferredSpatialLayer(webcamConsumer.id, spatialLayer);
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
	webcamConsumer : appPropTypes.Consumer,
	faceDetection  : PropTypes.bool.isRequired
};

const mapStateToProps = (state, { id }) =>
{
	const peer = state.peers[id];
	const consumersArray = peer.consumers
		.map((consumerId) => state.consumers[consumerId]);
	const micConsumer =
		consumersArray.find((consumer) => consumer.source === 'mic');
	const webcamConsumer =
		consumersArray.find((consumer) => consumer.source === 'webcam');

	return {
		peer,
		micConsumer,
		webcamConsumer,
		faceDetection : state.room.faceDetection
	};
};

const PeerContainer = withRoomContext(connect(
	mapStateToProps,
	undefined
)(Peer));

export default PeerContainer;
