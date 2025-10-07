import React from 'react';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import { Appear } from './transitions';
import { withRoomContext } from '../RoomContext';
import * as stateActions from '../redux/stateActions';

class Stats extends React.Component {
	constructor(props) {
		super(props);

		this.state = {
			sendTransportRemoteStats: null,
			sendTransportLocalStats: null,
			recvTransportRemoteStats: null,
			recvTransportLocalStats: null,
			audioProducerRemoteStats: null,
			audioProducerLocalStats: null,
			videoProducerRemoteStats: null,
			videoProducerLocalStats: null,
			chatDataProducerRemoteStats: null,
			botDataProducerRemoteStats: null,
			audioConsumerRemoteStats: null,
			audioConsumerLocalStats: null,
			videoConsumerRemoteStats: null,
			videoConsumerLocalStats: null,
			chatDataConsumerRemoteStats: null,
			botDataConsumerRemoteStats: null,
		};

		this._delayTimer = null;
	}

	render() {
		const { peerId, peerDisplayName, isMe, onClose } = this.props;

		const {
			sendTransportRemoteStats,
			sendTransportLocalStats,
			recvTransportRemoteStats,
			recvTransportLocalStats,
			audioProducerRemoteStats,
			audioProducerLocalStats,
			videoProducerRemoteStats,
			videoProducerLocalStats,
			chatDataProducerRemoteStats,
			botDataProducerRemoteStats,
			audioConsumerRemoteStats,
			audioConsumerLocalStats,
			videoConsumerRemoteStats,
			videoConsumerLocalStats,
			chatDataConsumerRemoteStats,
			botDataConsumerRemoteStats,
		} = this.state;

		return (
			<div data-component="Stats">
				<div className={classnames('content', { visible: peerId })}>
					<div className="header">
						<div className="info">
							<div className="close-icon" onClick={onClose} />

							{isMe ? <h1>Your Stats</h1> : <h1>Stats of {peerDisplayName}</h1>}
						</div>

						<div className="list">
							{(sendTransportRemoteStats || sendTransportLocalStats) && (
								<p>
									{'send transport stats: '}
									<a href="#send-transport-remote-stats">[remote]</a>
									<span> </span>
									<a href="#send-transport-local-stats">[local]</a>
								</p>
							)}

							{(recvTransportRemoteStats || recvTransportLocalStats) && (
								<p>
									{'recv transport stats: '}
									<a href="#recv-transport-remote-stats">[remote]</a>
									<span> </span>
									<a href="#recv-transport-local-stats">[local]</a>
								</p>
							)}

							{(audioProducerRemoteStats || audioProducerLocalStats) && (
								<p>
									{'audio producer stats: '}
									<a href="#audio-producer-remote-stats">[remote]</a>
									<span> </span>
									<a href="#audio-producer-local-stats">[local]</a>
								</p>
							)}

							{(videoProducerRemoteStats || videoProducerLocalStats) && (
								<p>
									{'video producer stats: '}
									<a href="#video-producer-remote-stats">[remote]</a>
									<span> </span>
									<a href="#video-producer-local-stats">[local]</a>
								</p>
							)}

							{chatDataProducerRemoteStats && (
								<p>
									{'chat dataproducer stats: '}
									<a href="#chat-dataproducer-remote-stats">[remote]</a>
									<span> </span>
									<a className="disabled">[local]</a>
								</p>
							)}

							{botDataProducerRemoteStats && (
								<p>
									{'bot dataproducer stats: '}
									<a href="#bot-dataproducer-remote-stats">[remote]</a>
									<span> </span>
									<a className="disabled">[local]</a>
								</p>
							)}

							{(audioConsumerRemoteStats || audioConsumerLocalStats) && (
								<p>
									{'audio consumer stats: '}
									<a href="#audio-consumer-remote-stats">[remote]</a>
									<span> </span>
									<a href="#audio-consumer-local-stats">[local]</a>
								</p>
							)}

							{(videoConsumerRemoteStats || videoConsumerLocalStats) && (
								<p>
									{'video consumer stats: '}
									<a href="#video-consumer-remote-stats">[remote]</a>
									<span> </span>
									<a href="#video-consumer-local-stats">[local]</a>
								</p>
							)}

							{chatDataConsumerRemoteStats && (
								<p>
									{'chat dataconsumer stats: '}
									<a href="#chat-dataconsumer-remote-stats">[remote]</a>
									<span> </span>
									<a className="disabled">[local]</a>
								</p>
							)}

							{botDataConsumerRemoteStats && (
								<p>
									{'bot dataconsumer stats: '}
									<a href="#bot-dataconsumer-remote-stats">[remote]</a>
									<span> </span>
									<a className="disabled">[local]</a>
								</p>
							)}
						</div>
					</div>

					<div className="stats">
						{sendTransportRemoteStats &&
							this._printStats(
								'send transport remote stats',
								sendTransportRemoteStats
							)}

						{sendTransportLocalStats &&
							this._printStats(
								'send transport local stats',
								sendTransportLocalStats
							)}

						{recvTransportRemoteStats &&
							this._printStats(
								'recv transport remote stats',
								recvTransportRemoteStats
							)}

						{recvTransportLocalStats &&
							this._printStats(
								'recv transport local stats',
								recvTransportLocalStats
							)}

						{audioProducerRemoteStats &&
							this._printStats(
								'audio producer remote stats',
								audioProducerRemoteStats
							)}

						{audioProducerLocalStats &&
							this._printStats(
								'audio producer local stats',
								audioProducerLocalStats
							)}

						{videoProducerRemoteStats &&
							this._printStats(
								'video producer remote stats',
								videoProducerRemoteStats
							)}

						{videoProducerLocalStats &&
							this._printStats(
								'video producer local stats',
								videoProducerLocalStats
							)}

						{chatDataProducerRemoteStats &&
							this._printStats(
								'chat dataproducer remote stats',
								chatDataProducerRemoteStats
							)}

						{botDataProducerRemoteStats &&
							this._printStats(
								'bot dataproducer remote stats',
								botDataProducerRemoteStats
							)}

						{audioConsumerRemoteStats &&
							this._printStats(
								'audio consumer remote stats',
								audioConsumerRemoteStats
							)}

						{audioConsumerLocalStats &&
							this._printStats(
								'audio consumer local stats',
								audioConsumerLocalStats
							)}

						{videoConsumerRemoteStats &&
							this._printStats(
								'video consumer remote stats',
								videoConsumerRemoteStats
							)}

						{videoConsumerLocalStats &&
							this._printStats(
								'video consumer local stats',
								videoConsumerLocalStats
							)}

						{chatDataConsumerRemoteStats &&
							this._printStats(
								'chat dataconsumer remote stats',
								chatDataConsumerRemoteStats
							)}

						{botDataConsumerRemoteStats &&
							this._printStats(
								'bot dataconsumer remote stats',
								botDataConsumerRemoteStats
							)}
					</div>
				</div>
			</div>
		);
	}

	componentDidUpdate(prevProps) {
		const { peerId } = this.props;

		if (peerId && !prevProps.peerId) {
			this._delayTimer = setTimeout(() => this._start(), 250);
		} else if (!peerId && prevProps.peerId) {
			this._stop();
		} else if (peerId && prevProps.peerId && peerId !== prevProps.peerId) {
			this._stop();
			this._start();
		}
	}

	async _start() {
		const {
			roomClient,
			isMe,
			audioConsumerId,
			videoConsumerId,
			chatDataConsumerId,
			botDataConsumerId,
		} = this.props;

		let sendTransportRemoteStats = null;
		let sendTransportLocalStats = null;
		let recvTransportRemoteStats = null;
		let recvTransportLocalStats = null;
		let audioProducerRemoteStats = null;
		let audioProducerLocalStats = null;
		let videoProducerRemoteStats = null;
		let videoProducerLocalStats = null;
		let chatDataProducerRemoteStats = null;
		let botDataProducerRemoteStats = null;
		let audioConsumerRemoteStats = null;
		let audioConsumerLocalStats = null;
		let videoConsumerRemoteStats = null;
		let videoConsumerLocalStats = null;
		let chatDataConsumerRemoteStats = null;
		let botDataConsumerRemoteStats = null;

		if (isMe) {
			sendTransportRemoteStats = await roomClient
				.getSendTransportRemoteStats()
				.catch(() => {});

			sendTransportLocalStats = await roomClient
				.getSendTransportLocalStats()
				.catch(() => {});

			recvTransportRemoteStats = await roomClient
				.getRecvTransportRemoteStats()
				.catch(() => {});

			recvTransportLocalStats = await roomClient
				.getRecvTransportLocalStats()
				.catch(() => {});

			audioProducerRemoteStats = await roomClient
				.getAudioRemoteStats()
				.catch(() => {});

			audioProducerLocalStats = await roomClient
				.getAudioLocalStats()
				.catch(() => {});

			videoProducerRemoteStats = await roomClient
				.getVideoRemoteStats()
				.catch(() => {});

			videoProducerLocalStats = await roomClient
				.getVideoLocalStats()
				.catch(() => {});

			chatDataProducerRemoteStats = await roomClient
				.getChatDataProducerRemoteStats()
				.catch(() => {});

			botDataProducerRemoteStats = await roomClient
				.getBotDataProducerRemoteStats()
				.catch(() => {});

			botDataConsumerRemoteStats = await roomClient
				.getDataConsumerRemoteStats(botDataConsumerId)
				.catch(() => {});
		} else {
			audioConsumerRemoteStats = await roomClient
				.getConsumerRemoteStats(audioConsumerId)
				.catch(() => {});

			audioConsumerLocalStats = await roomClient
				.getConsumerLocalStats(audioConsumerId)
				.catch(() => {});

			videoConsumerRemoteStats = await roomClient
				.getConsumerRemoteStats(videoConsumerId)
				.catch(() => {});

			videoConsumerLocalStats = await roomClient
				.getConsumerLocalStats(videoConsumerId)
				.catch(() => {});

			chatDataConsumerRemoteStats = await roomClient
				.getDataConsumerRemoteStats(chatDataConsumerId)
				.catch(() => {});
		}

		this.setState({
			sendTransportRemoteStats,
			sendTransportLocalStats,
			recvTransportRemoteStats,
			recvTransportLocalStats,
			audioProducerRemoteStats,
			audioProducerLocalStats,
			videoProducerRemoteStats,
			videoProducerLocalStats,
			chatDataProducerRemoteStats,
			botDataProducerRemoteStats,
			audioConsumerRemoteStats,
			audioConsumerLocalStats,
			videoConsumerRemoteStats,
			videoConsumerLocalStats,
			chatDataConsumerRemoteStats,
			botDataConsumerRemoteStats,
		});

		this._delayTimer = setTimeout(() => this._start(), 2500);
	}

	_stop() {
		clearTimeout(this._delayTimer);

		this.setState({
			sendTransportRemoteStats: null,
			sendTransportLocalStats: null,
			recvTransportRemoteStats: null,
			recvTransportLocalStats: null,
			audioProducerRemoteStats: null,
			audioProducerLocalStats: null,
			videoProducerRemoteStats: null,
			videoProducerLocalStats: null,
			chatDataProducerRemoteStats: null,
			botDataProducerRemoteStats: null,
			audioConsumerRemoteStats: null,
			audioConsumerLocalStats: null,
			videoConsumerRemoteStats: null,
			videoConsumerLocalStats: null,
			chatDataConsumerRemoteStats: null,
			botDataConsumerRemoteStats: null,
		});
	}

	_printStats(title, stats) {
		const anchor = title.replace(/[ ]+/g, '-');

		if (typeof stats.values === 'function') stats = Array.from(stats.values());

		return (
			<Appear duration={150}>
				<div className="items">
					<h2 id={anchor}>{title}</h2>

					{stats.map((item, idx) => (
						<div className="item" key={idx}>
							{Object.keys(item).map(key => (
								<div className="line" key={key}>
									<p className="key">{key}</p>
									<div className="value">
										<pre>
											{typeof item[key] === 'number'
												? JSON.stringify(
														Math.round(item[key] * 100) / 100,
														null,
														'  '
													)
												: JSON.stringify(item[key], null, '  ')}
										</pre>
									</div>
								</div>
							))}
						</div>
					))}
				</div>
			</Appear>
		);
	}
}

Stats.propTypes = {
	roomClient: PropTypes.any.isRequired,
	peerId: PropTypes.string,
	peerDisplayName: PropTypes.string,
	isMe: PropTypes.bool,
	audioConsumerId: PropTypes.string,
	videoConsumerId: PropTypes.string,
	chatDataConsumerId: PropTypes.string,
	botDataConsumerId: PropTypes.string,
	onClose: PropTypes.func.isRequired,
};

const mapStateToProps = state => {
	const { room, me, peers, consumers, dataConsumers } = state;
	const { statsPeerId } = room;

	if (!statsPeerId) return {};

	const isMe = statsPeerId === me.id;
	const peer = isMe ? me : peers[statsPeerId];
	let audioConsumerId;
	let videoConsumerId;
	let chatDataConsumerId;
	let botDataConsumerId;

	if (isMe) {
		for (const dataConsumerId of Object.keys(dataConsumers)) {
			const dataConsumer = dataConsumers[dataConsumerId];

			if (dataConsumer.label === 'bot') botDataConsumerId = dataConsumer.id;
		}
	} else {
		for (const consumerId of peer.consumers) {
			const consumer = consumers[consumerId];

			switch (consumer.track.kind) {
				case 'audio':
					audioConsumerId = consumer.id;
					break;

				case 'video':
					videoConsumerId = consumer.id;
					break;
			}
		}

		for (const dataConsumerId of peer.dataConsumers) {
			const dataConsumer = dataConsumers[dataConsumerId];

			if (dataConsumer.label === 'chat') chatDataConsumerId = dataConsumer.id;
		}
	}

	return {
		peerId: peer.id,
		peerDisplayName: peer.displayName,
		isMe,
		audioConsumerId,
		videoConsumerId,
		chatDataConsumerId,
		botDataConsumerId,
	};
};

const mapDispatchToProps = dispatch => {
	return {
		onClose: () => dispatch(stateActions.setRoomStatsPeerId(null)),
	};
};

const StatsContainer = withRoomContext(
	connect(mapStateToProps, mapDispatchToProps)(Stats)
);

export default StatsContainer;
