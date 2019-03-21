import React from 'react';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import { withRoomContext } from '../RoomContext';
import * as stateActions from '../redux/stateActions';

class Stats extends React.Component
{
	constructor(props)
	{
		super(props);

		this.state =
		{
			sendTransportRemoteStats : null,
			recvTransportRemoteStats : null,
			audioProducerRemoteStats : null,
			videoProducerRemoteStats : null,
			audioConsumerRemoteStats : null,
			videoConsumerRemoteStats : null,
			sendTransportLocalStats  : null,
			recvTransportLocalStats  : null,
			audioProducerLocalStats  : null,
			videoProducerLocalStats  : null,
			audioConsumerLocalStats  : null,
			videoConsumerLocalStats  : null
		};

		this._delayTimer = null;
	}

	render()
	{
		const {
			peerId,
			peerDisplayName,
			isMe,
			onClose
		} = this.props;

		const {
			sendTransportRemoteStats,
			recvTransportRemoteStats,
			audioProducerRemoteStats,
			videoProducerRemoteStats,
			audioConsumerRemoteStats,
			videoConsumerRemoteStats,
			sendTransportLocalStats,
			recvTransportLocalStats,
			audioProducerLocalStats,
			videoProducerLocalStats,
			audioConsumerLocalStats,
			videoConsumerLocalStats
		} = this.state;

		return (
			<div data-component='Stats'>
				<div className={classnames('content', { visible: peerId })}>
					<div className='header'>
						<div
							className='close-icon'
							onClick={onClose}
						/>

						<Choose>
							<When condition={isMe}>
								<h1>Your Stats</h1>
							</When>

							<Otherwise>
								<h1>Stats of {peerDisplayName}</h1>
							</Otherwise>
						</Choose>
					</div>

					<div className='stats'>
						<If condition={sendTransportRemoteStats}>
							{this._printStats('send transport remote stats', sendTransportRemoteStats)}
						</If>

						<If condition={recvTransportRemoteStats}>
							{this._printStats('recv transport remote stats', recvTransportRemoteStats)}
						</If>

						<If condition={audioProducerRemoteStats}>
							{this._printStats('audio producer remote stats', audioProducerRemoteStats)}
						</If>

						<If condition={videoProducerRemoteStats}>
							{this._printStats('video producer remote stats', videoProducerRemoteStats)}
						</If>

						<If condition={audioConsumerRemoteStats}>
							{this._printStats('audio consumer remote stats', audioConsumerRemoteStats)}
						</If>

						<If condition={videoConsumerRemoteStats}>
							{this._printStats('video consumer remote stats', videoConsumerRemoteStats)}
						</If>

						<If condition={sendTransportLocalStats}>
							{this._printStats('send transport local stats', sendTransportLocalStats)}
						</If>

						<If condition={recvTransportLocalStats}>
							{this._printStats('recv transport local stats', recvTransportLocalStats)}
						</If>

						<If condition={audioProducerLocalStats}>
							{this._printStats('audio producer local stats', audioProducerLocalStats)}
						</If>

						<If condition={videoProducerLocalStats}>
							{this._printStats('video producer local stats', videoProducerLocalStats)}
						</If>

						<If condition={audioConsumerLocalStats}>
							{this._printStats('audio consumer local stats', audioConsumerLocalStats)}
						</If>

						<If condition={videoConsumerLocalStats}>
							{this._printStats('video consumer local stats', videoConsumerLocalStats)}
						</If>
					</div>
				</div>
			</div>
		);
	}

	componentDidUpdate(prevProps)
	{
		const { peerId } = this.props;

		if (peerId && !prevProps.peerId)
		{
			this._start();
		}
		else if (!peerId && prevProps.peerId)
		{
			this._stop();
		}
		else if (peerId && prevProps.peerId && peerId !== prevProps.peerId)
		{
			this._stop();
			this._start();
		}
	}

	async _start()
	{
		const { roomClient, isMe, audioConsumerId, videoConsumerId } = this.props;
		let sendTransportRemoteStats = null;
		let recvTransportRemoteStats = null;
		let audioProducerRemoteStats = null;
		let videoProducerRemoteStats = null;
		let audioConsumerRemoteStats = null;
		let videoConsumerRemoteStats = null;
		let sendTransportLocalStats = null;
		let recvTransportLocalStats = null;
		let audioProducerLocalStats = null;
		let videoProducerLocalStats = null;
		let audioConsumerLocalStats = null;
		let videoConsumerLocalStats = null;

		if (isMe)
		{
			sendTransportRemoteStats = await roomClient.getSendTransportRemoteStats()
				.catch(() => {});

			recvTransportRemoteStats = await roomClient.getRecvTransportRemoteStats()
				.catch(() => {});

			audioProducerRemoteStats = await roomClient.getMicRemoteStats()
				.catch(() => {});

			videoProducerRemoteStats = await roomClient.getWebcamRemoteStats()
				.catch(() => {});

			sendTransportLocalStats = await roomClient.getSendTransportLocalStats()
				.catch(() => {});

			recvTransportLocalStats = await roomClient.getRecvTransportLocalStats()
				.catch(() => {});

			audioProducerLocalStats = await roomClient.getMicLocalStats()
				.catch(() => {});

			videoProducerLocalStats = await roomClient.getWebcamLocalStats()
				.catch(() => {});
		}
		else
		{
			audioConsumerRemoteStats = await roomClient.getConsumerRemoteStats(audioConsumerId)
				.catch(() => {});

			videoConsumerRemoteStats = await roomClient.getConsumerRemoteStats(videoConsumerId)
				.catch(() => {});

			audioConsumerLocalStats = await roomClient.getConsumerLocalStats(audioConsumerId)
				.catch(() => {});

			videoConsumerLocalStats = await roomClient.getConsumerLocalStats(videoConsumerId)
				.catch(() => {});
		}

		this.setState(
			{
				sendTransportRemoteStats,
				recvTransportRemoteStats,
				audioProducerRemoteStats,
				videoProducerRemoteStats,
				audioConsumerRemoteStats,
				videoConsumerRemoteStats,
				sendTransportLocalStats,
				recvTransportLocalStats,
				audioProducerLocalStats,
				videoProducerLocalStats,
				audioConsumerLocalStats,
				videoConsumerLocalStats
			});

		this._delayTimer = setTimeout(() => this._start(), 2500);
	}

	_stop()
	{
		clearTimeout(this._delayTimer);

		this.setState(
			{
				sendTransportRemoteStats : null,
				recvTransportRemoteStats : null,
				audioProducerRemoteStats : null,
				videoProducerRemoteStats : null,
				audioConsumerRemoteStats : null,
				videoConsumerRemoteStats : null,
				sendTransportLocalStats  : null,
				recvTransportLocalStats  : null,
				audioProducerLocalStats  : null,
				videoProducerLocalStats  : null,
				audioConsumerLocalStats  : null,
				videoConsumerLocalStats  : null
			});
	}

	_printStats(title, stats)
	{
		if (typeof stats.values === 'function')
			stats = Array.from(stats.values());

		return (
			<div className='items'>
				<h2>{title}</h2>

				{
					stats.map((item, idx) => (
						<div className='item' key={idx}>
							{
								Object.keys(item).map((key) => (
									<div className='line' key={key}>
										<p className='key'>{key}</p>
										<p className='value'>{JSON.stringify(item[key], null, '  ')}</p>
									</div>
								))
							}
						</div>
					))
				}
			</div>
		);
	}
}

Stats.propTypes =
{
	roomClient      : PropTypes.any.isRequired,
	peerId          : PropTypes.string,
	peerDisplayName : PropTypes.string,
	isMe            : PropTypes.bool,
	audioConsumerId : PropTypes.string,
	videoConsumerId : PropTypes.string,
	onClose         : PropTypes.func.isRequired
};

const mapStateToProps = (state) =>
{
	const { room, me, peers, consumers } = state;
	const { statsPeerId } = room;

	if (!statsPeerId)
		return {};

	const isMe = statsPeerId === me.id;
	const peer = isMe ? me : peers[statsPeerId];
	let audioConsumerId;
	let videoConsumerId;

	if (!isMe)
	{
		for (const consumerId of peer.consumers)
		{
			const consumer = consumers[consumerId];

			switch (consumer.track.kind)
			{
				case 'audio':
					audioConsumerId = consumer.id;
					break;

				case 'video':
					videoConsumerId = consumer.id;
					break;
			}
		}
	}

	return {
		peerId          : peer.id,
		peerDisplayName : peer.displayName,
		isMe,
		audioConsumerId,
		videoConsumerId
	};
};

const mapDispatchToProps = (dispatch) =>
{
	return {
		onClose : () => dispatch(stateActions.setRoomStatsPeerId(null))
	};
};

const StatsContainer = withRoomContext(connect(
	mapStateToProps,
	mapDispatchToProps
)(Stats));

export default StatsContainer;
