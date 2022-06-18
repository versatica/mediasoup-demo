/**
 * Clones the given data.
 */
exports.clone = function(data, defaultValue)
{
	if (typeof data === 'undefined')
		return defaultValue;

	return JSON.parse(JSON.stringify(data));
};
