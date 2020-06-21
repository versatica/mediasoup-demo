const protooPort = 4443;

export function getProtooUrl({ roomId, peerId, serverUrl})
{
	return `wss://${serverUrl}:${protooPort}/?roomId=${roomId}&peerId=${peerId}`;
}
