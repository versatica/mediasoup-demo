# APP STATE

```js
{
  room :
  {
    url             : 'https://demo.mediasoup.org/?roomId=d0el8y34',
    state           : 'connected', // new/connecting/connected/closed
    activeSpeakerId : 'alice',
    statsPeerId     : null,
    faceDetection   : false
  },
  me :
  {
    id                   : 'bob',
    displayName          : 'Bob McFLower',
    displayNameSet       : false, // true if got from cookie or manually set.
    device               : { flag: 'firefox', name: 'Firefox', version: '61' },
    canSendMic           : true,
    canSendWebcam        : true,
    canChangeWebcam      : false,
    webcamInProgress     : false,
    shareInProgress      : false,
    audioOnly            : false,
    audioOnlyInProgress  : false,
    audioMuted           : false,
    restartIceInProgress : false
  },
  producers :
  {
    '1111-qwer' :
    {
      id            : '1111-qwer',
      paused        : true,
      track         : MediaStreamTrack,
      codec         : 'opus',
      rtpParameters : {},
      score         : [ { ssrc: 1111, score: 10 } ]
    },
    '1112-asdf' :
    {
      id          : '1112-asdf',
      deviceLabel : 'Macbook Webcam',
      type        : 'front', // front/back/share
      paused      : false,
      track       : MediaStreamTrack,
      codec       : 'vp8',
      score       : [ { ssrc: 2221, score: 10 }, { ssrc: 2222, score: 9 } ]
    }
  },
  dataProducers :
  {
    '4444-4444' :
    {
      id                   : '4444-4444',
      sctpStreamParameters : {},
      label                : 'chat',
      protocol             : ''
    },
    '4444-4445' :
    {
      id                   : '4444-4445',
      sctpStreamParameters : {},
      label                : 'bot',
      protocol             : ''
    }
  },
  peers :
  {
    'alice' :
    {
      id              : 'alice',
      displayName     : 'Alice Thomsom',
      device          : { flag: 'chrome', name: 'Chrome', version: '58' },
      consumers       : [ '5551-qwer', '5552-zxzx' ],
      dataConsumers   : [ '6661-asdf' ]
    }
  },
  consumers :
  {
    '5551-qwer' :
    {
      id                     : '5551-qwer',
      type                   : 'simple',
      locallyPaused          : false,
      remotelyPaused         : false,
      rtpParameters          : {},
      codec                  : 'opus',
      spatialLayers          : 1,
      temporalLayers         : 1,
      currentSpatialLayer    : undefined,
      currentTemporalLayer   : undefined,
      preferredSpatialLayer  : undefined,
      preferredTemporalLayer : undefined,
      priority               : 1,
      track                  : MediaStreamTrack,
      score                  : [ { ssrc: 3331, score: 10 } ]
    },
    '5552-zxzx' :
    {
      id                     : '5552-zxzx',
      type                   : 'simulcast',
      locallyPaused          : false,
      remotelyPaused         : true,
      rtpParameters          : {},
      codec                  : 'h264',
      spatialLayers          : 1,
      temporalLayers         : 1,
      currentSpatialLayer    : 1,
      currentTemporalLayer   : 1,
      preferredSpatialLayer  : 2,
      preferredTemporalLayer : 2,
      priority               : 2,
      track                  : MediaStreamTrack,
      score                  : [ { ssrc: 4441, score: 9 }, { ssrc: 4444, score: 8 } ]
    }
  },
  dataConsumers :
  {
    '5551-qwer' :
    {
      id                   : '5551-qwer',
      sctpStreamParameters : {},
      label                : 'chat',
      protocol             : 'something'
    },
    '5552-qwer' :
    {
      id                   : '5552-qwer',
      sctpStreamParameters : {},
      label                : 'bot'
    }
  },
  notifications :
  [
    {
      id     : 'qweasdw43we',
      type   : 'info' // info/error
      text   : 'You joined the room'
    },
    {
      id     : 'j7sdhkjjkcc',
      type   : 'error'
      text   : 'Could not add webcam'
    }
  ]
}
```
