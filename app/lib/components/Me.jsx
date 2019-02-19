import React from 'react';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import ReactTooltip from 'react-tooltip';
import classnames from 'classnames';
import * as cookiesManager from '../cookiesManager';
import * as appPropTypes from './appPropTypes';
import { withRoomContext } from '../RoomContext';
import PeerView from './PeerView';

class Me extends React.Component
{
	constructor(props)
	{
		super(props);

		this._mounted = false;
		this._rootNode = null;
	}

	render()
	{
		const {
			roomClient,
			connected,
			me,
			micProducer,
			webcamProducer,
			faceDetection
		} = this.props;

		let micState;

		if (!me.canSendMic)
			micState = 'unsupported';
		else if (!micProducer)
			micState = 'unsupported';
		else if (!micProducer.paused)
			micState = 'on';
		else
			micState = 'off';

		let webcamState;

		if (!me.canSendWebcam)
			webcamState = 'unsupported';
		else if (webcamProducer)
			webcamState = 'on';
		else
			webcamState = 'off';

		let changeWebcamState;

		if (Boolean(webcamProducer) && me.canChangeWebcam)
			changeWebcamState = 'on';
		else
			changeWebcamState = 'unsupported';

		const videoVisible = Boolean(webcamProducer) && !webcamProducer.paused;

		let tip;

		if (!me.displayNameSet)
			tip = 'Click on your name to change it';

		return (
			<div
				data-component='Me'
				ref={(node) => (this._rootNode = node)}
				data-tip={tip}
				data-tip-disable={!tip}
			>
				<If condition={connected}>
					<div className='controls'>
						<div
							className={classnames('button', 'mic', micState)}
							onClick={() =>
							{
								micState === 'on'
									? roomClient.muteMic()
									: roomClient.unmuteMic();
							}}
						/>

						<div
							className={classnames('button', 'webcam', webcamState, {
								disabled : me.webcamInProgress
							})}
							onClick={() =>
							{
								if (webcamState === 'on')
								{
									cookiesManager.setDevices({ webcamEnabled: false });
									roomClient.disableWebcam();
								}
								else
								{
									cookiesManager.setDevices({ webcamEnabled: true });
									roomClient.enableWebcam();
								}
							}}
						/>

						<div
							className={classnames('button', 'change-webcam', changeWebcamState, {
								disabled : me.webcamInProgress
							})}
							onClick={() => roomClient.changeWebcam()}
						/>
					</div>
				</If>

				<PeerView
					isMe
					peer={me}
					audioTrack={micProducer ? micProducer.track : null}
					videoTrack={webcamProducer ? webcamProducer.track : null}
					videoVisible={videoVisible}
					audioCodec={micProducer ? micProducer.codec : null}
					videoCodec={webcamProducer ? webcamProducer.codec : null}
					audioScore={micProducer ? micProducer.score : null}
					videoScore={webcamProducer ? webcamProducer.score : null}
					faceDetection={faceDetection}
					onChangeDisplayName={(displayName) =>
					{
						roomClient.changeDisplayName(displayName);
					}}
				/>

				<ReactTooltip
					type='light'
					effect='solid'
					delayShow={100}
					delayHide={100}
					delayUpdate={50}
				/>
			</div>
		);
	}

	componentDidMount()
	{
		this._mounted = true;

		setTimeout(() =>
		{
			if (!this._mounted || this.props.me.displayNameSet)
				return;

			ReactTooltip.show(this._rootNode);
		}, 4000);
	}

	componentWillUnmount()
	{
		this._mounted = false;
	}

	componentWillReceiveProps(nextProps)
	{
		if (nextProps.me.displayNameSet)
			ReactTooltip.hide(this._rootNode);
	}
}

Me.propTypes =
{
	roomClient     : PropTypes.any.isRequired,
	connected      : PropTypes.bool.isRequired,
	me             : appPropTypes.Me.isRequired,
	micProducer    : appPropTypes.Producer,
	webcamProducer : appPropTypes.Producer,
	faceDetection  : PropTypes.bool.isRequired
};

const mapStateToProps = (state) =>
{
	const producersArray = Object.values(state.producers);
	const micProducer =
		producersArray.find((producer) => producer.source === 'mic');
	const webcamProducer =
		producersArray.find((producer) => producer.source === 'webcam');

	return {
		connected      : state.room.state === 'connected',
		me             : state.me,
		micProducer    : micProducer,
		webcamProducer : webcamProducer,
		faceDetection  : state.room.faceDetection
	};
};

const MeContainer = withRoomContext(connect(
	mapStateToProps,
	undefined
)(Me));

export default MeContainer;
