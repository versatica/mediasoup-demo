let mediaQueryDetectorElem;

export function initialize()
{
	return Promise.resolve(
		// Media query detector stuff.
		mediaQueryDetectorElem =
			document.getElementById('mediasoup-demo-app-media-query-detector')
	);
}

export function isDesktop()
{
	return Boolean(mediaQueryDetectorElem.offsetParent);
}

export function isMobile()
{
	return !mediaQueryDetectorElem.offsetParent;
}
