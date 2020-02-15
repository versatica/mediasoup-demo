let protooPort = 4443;

const hostname = process.env.HOSTNAME || 'test.mediasoup.org';

if (hostname === 'test.mediasoup.org')
	protooPort = 4444;

export function getProtooUrl(
	{ roomId, peerId, forceH264, forceVP8 }:
	{ roomId: string; peerId: string; forceH264: boolean; forceVP8: boolean }): string
{
	let url = `wss://${hostname}:${protooPort}/?roomId=${roomId}&peerId=${peerId}`;

	if (forceH264)
		url = `${url}&forceH264=true`;
	else if (forceVP8)
		url = `${url}&forceVP8=true`;

	return url;
}
