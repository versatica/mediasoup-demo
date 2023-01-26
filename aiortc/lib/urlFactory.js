"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getProtooUrl = void 0;
let protooPort = 4443;
const hostname = process.env.HOSTNAME || 'test.mediasoup.org';
if (hostname === 'test.mediasoup.org')
    protooPort = 4444;
function getProtooUrl({ roomId, peerId }) {
    return `wss://${hostname}:${protooPort}/?roomId=${roomId}&peerId=${peerId}`;
}
exports.getProtooUrl = getProtooUrl;
