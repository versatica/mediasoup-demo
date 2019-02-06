import React from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import Spinner from 'react-spinner';
import hark from 'hark';
import * as faceapi from 'face-api.js';
import * as appPropTypes from './appPropTypes';
import EditableInput from './EditableInput';

const tinyFaceDetectorOptions = new faceapi.TinyFaceDetectorOptions(
	{
		inputSize      : 160,
		scoreThreshold : 0.5
	});

export default class PeerView extends React.Component
{
	constructor(props)
	{
		super(props);

		this.state =
		{
			audioVolume           : 0, // Integer from 0 to 10.,
			videoResolutionWidth  : null,
			videoResolutionHeight : null
		};

		// Latest received video track.
		// @type {MediaStreamTrack}
		this._audioTrack = null;

		// Latest received video track.
		// @type {MediaStreamTrack}
		this._videoTrack = null;

		// Hark instance.
		// @type {Object}
		this._hark = null;

		// Periodic timer for reading video resolution.
		this._videoResolutionPeriodicTimer = null;

		// requestAnimationFrame for face detection.
		this._faceDetectionRequestAnimationFrame = null;
	}

	render()
	{
		const {
			isMe,
			peer,
			videoVisible,
			videoProfile,
			videoPreferredProfile,
			audioCodec,
			videoCodec,
			onChangeDisplayName,
			onChangeVideoPreferredProfile,
			onRequestKeyFrame
		} = this.props;

		const {
			audioVolume,
			videoResolutionWidth,
			videoResolutionHeight
		} = this.state;

		return (
			<div data-component='PeerView'>
				<div className='info'>
					<div className={classnames('media', { 'is-me': isMe })}>
						<div
							className={classnames('box', {
								clickable : !isMe && videoVisible && videoProfile !== 'default'
							})}
							onClick={(event) =>
							{
								event.stopPropagation();

								let newPreferredProfile;

								switch (videoPreferredProfile)
								{
									case 'low':
										newPreferredProfile = 'medium';
										break;

									case 'medium':
										newPreferredProfile = 'high';
										break;

									case 'high':
										newPreferredProfile = 'low';
										break;

									default:
										newPreferredProfile = 'high';
										break;
								}

								onChangeVideoPreferredProfile(newPreferredProfile);
							}}
							onContextMenu={(event) =>
							{
								event.stopPropagation();
								event.preventDefault(); // Don't show the context menu.

								let newPreferredProfile;

								switch (videoPreferredProfile)
								{
									case 'low':
										newPreferredProfile = 'high';
										break;

									case 'medium':
										newPreferredProfile = 'low';
										break;

									case 'high':
										newPreferredProfile = 'medium';
										break;

									default:
										newPreferredProfile = 'medium';
										break;
								}

								onChangeVideoPreferredProfile(newPreferredProfile);
							}}
						>
							<If condition={audioCodec}>
								<p>{audioCodec}</p>
							</If>

							<If condition={videoCodec}>
								<p>
									{videoCodec} {videoProfile}
									{videoPreferredProfile ? ` (pref: ${videoPreferredProfile})` : ''}
								</p>
							</If>

							<If condition={videoVisible && videoResolutionWidth !== null}>
								<p>{videoResolutionWidth}x{videoResolutionHeight}</p>
							</If>

							<If condition={!isMe && videoCodec}>
								<p
									className='clickable'
									onClick={(event) =>
									{
										event.stopPropagation();

										if (!onRequestKeyFrame)
											return;

										onRequestKeyFrame();
									}}
								>
									{'Request keyframe'}
								</p>
							</If>
						</div>
					</div>

					<div className={classnames('peer', { 'is-me': isMe })}>
						<Choose>
							<When condition={isMe}>
								<EditableInput
									value={peer.displayName}
									propName='displayName'
									className='display-name editable'
									classLoading='loading'
									classInvalid='invalid'
									shouldBlockWhileLoading
									editProps={{
										maxLength   : 20,
										autoCorrect : 'false',
										spellCheck  : 'false'
									}}
									onChange={({ displayName }) => onChangeDisplayName(displayName)}
								/>
							</When>

							<Otherwise>
								<span className='display-name'>
									{peer.displayName}
								</span>
							</Otherwise>
						</Choose>

						<div className='row'>
							<span
								className={classnames('device-icon', peer.device.flag)}
							/>
							<span className='device-version'>
								{peer.device.name} {peer.device.version || null}
							</span>
						</div>
					</div>
				</div>

				<video
					ref='video'
					className={classnames({
						hidden  : !videoVisible,
						'is-me' : isMe,
						loading : videoProfile === 'none'
					})}
					autoPlay
					muted={isMe}
				/>

				<canvas
					ref='canvas'
					className={classnames('face-detection', { 'is-me': isMe })}
				/>

				<div className='volume-container'>
					<div className={classnames('bar', `level${audioVolume}`)} />
				</div>

				<If condition={videoProfile === 'none'}>
					<div className='spinner-container'>
						<Spinner />
					</div>
				</If>
			</div>
		);
	}

	componentDidMount()
	{
		const { audioTrack, videoTrack } = this.props;

		this._setTracks(audioTrack, videoTrack);
	}

	componentWillUnmount()
	{
		if (this._hark)
			this._hark.stop();

		clearInterval(this._videoResolutionPeriodicTimer);
		cancelAnimationFrame(this._faceDetectionRequestAnimationFrame);
	}

	componentWillReceiveProps(nextProps)
	{
		const { audioTrack, videoTrack } = nextProps;

		this._setTracks(audioTrack, videoTrack);
	}

	_setTracks(audioTrack, videoTrack)
	{
		const { faceDetection } = this.props;

		if (this._audioTrack === audioTrack && this._videoTrack === videoTrack)
			return;

		this._audioTrack = audioTrack;
		this._videoTrack = videoTrack;

		if (this._hark)
			this._hark.stop();

		this._stopVideoResolution();

		if (faceDetection)
			this._stopFaceDetection();

		const { video } = this.refs;

		if (audioTrack || videoTrack)
		{
			const stream = new MediaStream;

			if (audioTrack)
				stream.addTrack(audioTrack);

			if (videoTrack)
				stream.addTrack(videoTrack);

			video.srcObject = stream;

			if (audioTrack)
				this._runHark(stream);

			if (videoTrack)
			{
				this._startVideoResolution();

				if (faceDetection)
					this._startFaceDetection();
			}
		}
		else
		{
			video.srcObject = null;
		}
	}

	_runHark(stream)
	{
		if (!stream.getAudioTracks()[0])
			throw new Error('_runHark() | given stream has no audio track');

		this._hark = hark(stream, { play: false });

		// eslint-disable-next-line no-unused-vars
		this._hark.on('volume_change', (dBs, threshold) =>
		{
			// The exact formula to convert from dBs (-100..0) to linear (0..1) is:
			//   Math.pow(10, dBs / 20)
			// However it does not produce a visually useful output, so let exagerate
			// it a bit. Also, let convert it from 0..1 to 0..10 and avoid value 1 to
			// minimize component renderings.
			let audioVolume = Math.round(Math.pow(10, dBs / 85) * 10);

			if (audioVolume === 1)
				audioVolume = 0;

			if (audioVolume !== this.state.audioVolume)
				this.setState({ audioVolume });
		});
	}

	_startVideoResolution()
	{
		this._videoResolutionPeriodicTimer = setInterval(() =>
		{
			const {
				videoResolutionWidth,
				videoResolutionHeight
			} = this.state;
			const { video } = this.refs;

			if (
				video.videoWidth !== videoResolutionWidth ||
				video.videoHeight !== videoResolutionHeight
			)
			{
				this.setState(
					{
						videoResolutionWidth  : video.videoWidth,
						videoResolutionHeight : video.videoHeight
					});
			}
		}, 1000);
	}

	_stopVideoResolution()
	{
		clearInterval(this._videoResolutionPeriodicTimer);

		this.setState(
			{
				videoResolutionWidth  : null,
				videoResolutionHeight : null
			});
	}

	_startFaceDetection()
	{
		const { video, canvas } = this.refs;

		const step = () =>
		{
			// NOTE: Somehow this is critical. Otherwise the Promise returned by
			// faceapi.detectSingleFace() never resolves or rejects.
			if (!this._videoTrack || video.readyState < 2)
			{
				this._faceDetectionRequestAnimationFrame = requestAnimationFrame(step);

				return;
			}

			faceapi.detectSingleFace(video, tinyFaceDetectorOptions)
				.then((detection) =>
				{
					if (detection)
					{
						const width = video.offsetWidth;
						const height = video.offsetHeight;

						canvas.width = width;
						canvas.height = height;

						const resizedDetection = detection.forSize(width, height);

						faceapi.drawDetection(
							canvas, [ resizedDetection ], { withScore: false });
					}
					else
					{
						// Trick to hide the canvas rectangle.
						canvas.width = 0;
						canvas.height = 0;
					}

					this._faceDetectionRequestAnimationFrame =
						requestAnimationFrame(() => setTimeout(step, 100));
				});
		};

		step();
	}

	_stopFaceDetection()
	{
		cancelAnimationFrame(this._faceDetectionRequestAnimationFrame);

		const { canvas } = this.refs;

		canvas.width = 0;
		canvas.height = 0;
	}
}

PeerView.propTypes =
{
	isMe : PropTypes.bool,
	peer : PropTypes.oneOfType(
		[ appPropTypes.Me, appPropTypes.Peer ]).isRequired,
	audioTrack                    : PropTypes.any,
	videoTrack                    : PropTypes.any,
	videoVisible                  : PropTypes.bool.isRequired,
	videoProfile                  : PropTypes.string,
	videoPreferredProfile         : PropTypes.string,
	audioCodec                    : PropTypes.string,
	videoCodec                    : PropTypes.string,
	faceDetection                 : PropTypes.bool.isRequired,
	onChangeDisplayName           : PropTypes.func,
	onChangeVideoPreferredProfile : PropTypes.func,
	onRequestKeyFrame             : PropTypes.func
};
