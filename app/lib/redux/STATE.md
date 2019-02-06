# APP STATE

```js
{
  room :
  {
    url             : 'https://demo.mediasoup.org/?roomId=d0el8y34',
    state           : 'connected', // new/connecting/connected/closed
    activeSpeakerId : 'alice',
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
    audioOnly            : false,
    audioOnlyInProgress  : false,
    restartIceInProgress : false
  },
  producers :
  {
    '1111-qwer' :
    {
      id     : '1111-qwer',
      source : 'mic', // mic/webcam,
      paused : true,
      track  : MediaStreamTrack,
      codec  : 'opus'
    },
    '1112-asdf' :
    {
      id          : '1112-asdf',
      source      : 'webcam', // mic/webcam
      deviceLabel : 'Macbook Webcam',
      type        : 'front', // front/back
      paused      : false,
      track       : MediaStreamTrack,
      codec       : 'vp8',
    }
  },
  peers :
  {
    'alice' :
    {
      id        : 'alice',
      displayName : 'Alice Thomsom',
      device      : { flag: 'chrome', name: 'Chrome', version: '58' },
      consumers   : [ '5551-qwer', '5552-zxzx' ]
    }
  },
  consumers :
  {
    '5551-qwer' :
    {
      id                    : '5551-qwer',
      source                : 'mic', // mic/webcam
      locallyPaused         : false,
      remotelyPaused        : false,
      currentSpatialLayer   : undefined,
      preferredSpatialLayer : undefined,
      track                 : MediaStreamTrack,
      codec                 : 'opus'
    },
    '5552-zxzx' :
    {
      id                    : '5552-zxzx',
      source                : 'webcam',
      locallyPaused         : false,
      remotelyPaused        : true,
      currentSpatialLayer   : 1,
      preferredSpatialLayer : 2,
      track                 : null,
      codec                 : 'h264'
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
