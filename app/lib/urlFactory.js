export function getProtooUrl(peerName, roomId, forceH264)
{
	const hostname = window.location.hostname;
	let url = `wss://${hostname}:3443/?peerName=${peerName}&roomId=${roomId}`;

	if (forceH264)
		url = `${url}&forceH264=true`;

	return url;
}
