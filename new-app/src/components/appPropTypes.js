import PropTypes from 'prop-types';

export const Room = PropTypes.shape(
	{
		url   : PropTypes.string.isRequired,
		state : PropTypes.oneOf(
			[ 'new', 'connecting', 'connected', 'closed' ]).isRequired,
		activeSpeakerName : PropTypes.string
	});

export const Device = PropTypes.shape(
	{
		flag    : PropTypes.string.isRequired,
		name    : PropTypes.string,
		version : PropTypes.string
	});

export const Me = PropTypes.shape(
	{
		id                   : PropTypes.string.isRequired,
		displayName          : PropTypes.string,
		displayNameSet       : PropTypes.bool.isRequired,
		device               : Device.isRequired,
		canSendMic           : PropTypes.bool.isRequired,
		canSendWebcam        : PropTypes.bool.isRequired,
		canChangeWebcam      : PropTypes.bool.isRequired,
		webcamInProgress     : PropTypes.bool.isRequired,
		audioOnly            : PropTypes.bool.isRequired,
		audioOnlyInProgress  : PropTypes.bool.isRequired,
		restartIceInProgress : PropTypes.bool.isRequired
	});

export const Producer = PropTypes.shape(
	{
		id            : PropTypes.string.isRequired,
		deviceLabel   : PropTypes.string,
		type          : PropTypes.oneOf([ 'front', 'back', 'share' ]),
		paused        : PropTypes.bool.isRequired,
		track         : PropTypes.any.isRequired,
		rtpParameters : PropTypes.object.isRequired,
		codec         : PropTypes.string.isRequired
	});

export const DataProducer = PropTypes.shape(
	{
		id                   : PropTypes.string.isRequired,
		sctpStreamParameters : PropTypes.object.isRequired
	});

export const Peer = PropTypes.shape(
	{
		id          : PropTypes.string.isRequired,
		displayName : PropTypes.string,
		device      : Device.isRequired,
		consumers   : PropTypes.arrayOf(PropTypes.string).isRequired
	});

export const Consumer = PropTypes.shape(
	{
		id                    : PropTypes.string.isRequired,
		locallyPaused         : PropTypes.bool.isRequired,
		remotelyPaused        : PropTypes.bool.isRequired,
		currentSpatialLayer   : PropTypes.number,
		preferredSpatialLayer : PropTypes.number,
		track                 : PropTypes.any,
		codec                 : PropTypes.string
	});

export const DataConsumer = PropTypes.shape(
	{
		id                   : PropTypes.string.isRequired,
		sctpStreamParameters : PropTypes.object.isRequired
	});

export const Notification = PropTypes.shape(
	{
		id      : PropTypes.string.isRequired,
		type    : PropTypes.oneOf([ 'info', 'error' ]).isRequired,
		timeout : PropTypes.number
	});
