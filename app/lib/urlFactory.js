export function getProtooUrl({ roomId, peerId, forceH264 })
{
	const hostname = window.location.hostname;
	let url = `wss://${hostname}:3443/?roomId=${roomId}&peerId=${peerId}`;

	if (forceH264)
		url = `${url}&forceH264=true`;

	return url;
}
