import React from 'react';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import * as appPropTypes from './appPropTypes';
import { Appear } from './transitions';
import Peer from './Peer';

const Peers = ({ peers, activeSpeakerId, speakingPeerIds }) => {
	return (
		<div data-component="Peers">
			{peers.map(peer => {
				return (
					<Appear key={peer.id} duration={1000}>
						<div
							className={classnames('peer-container', {
								'active-speaker': peer.id === activeSpeakerId,
								speaking: speakingPeerIds.includes(peer.id),
							})}
						>
							<Peer id={peer.id} />
						</div>
					</Appear>
				);
			})}
		</div>
	);
};

Peers.propTypes = {
	peers: PropTypes.arrayOf(appPropTypes.Peer).isRequired,
	activeSpeakerId: PropTypes.string,
	speakingPeerIds: PropTypes.arrayOf(PropTypes.string).isRequired,
};

const mapStateToProps = state => {
	const peersArray = Object.values(state.peers);

	return {
		peers: peersArray,
		activeSpeakerId: state.room.activeSpeakerId,
		speakingPeerIds: state.room.speakingPeerIds,
	};
};

const PeersContainer = connect(mapStateToProps, null, null, {
	areStatesEqual: (next, prev) => {
		return (
			prev.peers === next.peers &&
			prev.room.activeSpeakerId === next.room.activeSpeakerId &&
			prev.room.speakingPeerIds.length === next.room.speakingPeerIds.length
		);
	},
})(Peers);

export default PeersContainer;
