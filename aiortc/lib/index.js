"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const repl = __importStar(require("repl"));
const redux_1 = require("redux");
const redux_thunk_1 = __importDefault(require("redux-thunk"));
const Logger_1 = require("./Logger");
const RoomClient_1 = require("./RoomClient");
const reducers_1 = __importDefault(require("./redux/reducers"));
const reduxMiddlewares = [redux_thunk_1.default];
const logger = new Logger_1.Logger();
const store = redux_1.createStore(reducers_1.default, undefined, redux_1.applyMiddleware(...reduxMiddlewares));
RoomClient_1.RoomClient.init({ store });
const roomId = process.env.ROOM_ID || 'test';
const peerId = process.env.PEER_ID || 'mediasoup-client-aiortc-id';
const displayName = process.env.DISPLAY_NAME || 'mediasoup-client-aiortc';
const forceTcp = process.env.FORCE_TCP === 'true' ? true : false;
const produce = process.env.PRODUCE === 'false' ? false : true;
const consume = process.env.CONSUME === 'false' ? false : true;
const forceH264 = process.env.FORCE_H264 === 'true' ? true : false;
const forceVP8 = process.env.FORCE_VP8 === 'true' ? true : false;
const datachannel = process.env.DATACHANNEL === 'false' ? false : true;
const externalAudio = process.env.EXTERNAL_AUDIO || '';
const externalVideo = process.env.EXTERNAL_VIDEO || '';
const options = {
    roomId,
    peerId,
    displayName,
    useSimulcast: false,
    useSharingSimulcast: false,
    forceTcp,
    produce,
    consume,
    forceH264,
    forceVP8,
    datachannel,
    externalAudio,
    externalVideo
};
logger.debug(`starting mediasoup-demo-aiortc: ${JSON.stringify(options, undefined, 2)}`);
const roomClient = new RoomClient_1.RoomClient(options);
// For the interactive terminal.
global.store = store;
global.roomClient = roomClient;
// Run an interactive terminal.
const terminal = repl.start({
    terminal: true,
    prompt: 'terminal> ',
    useColors: true,
    useGlobal: true,
    ignoreUndefined: false
});
terminal.on('exit', () => process.exit(0));
// Join!!
roomClient.join();
// NOTE: Debugging stuff.
global.__sendSdps = function () {
    // eslint-disable-next-line no-console
    console.warn('>>> send transport local SDP offer:');
    // @ts-ignore
    roomClient._sendTransport._handler._channel.request('handler.getLocalDescription', 
    // @ts-ignore
    roomClient._sendTransport._handler._internal)
        .then((desc) => {
        logger.warn(desc.sdp);
    });
};
