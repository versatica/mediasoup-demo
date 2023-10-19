/**
 * Clones the given value.
 */
exports.clone = function(value)
{
	if (value === undefined)
	{
		return undefined;
	}
	else if (Number.isNaN(value))
	{
		return NaN;
	}
	else if (typeof structuredClone === 'function')
	{
		// Available in Node >= 18.
		return structuredClone(value);
	}
	else
	{
		return JSON.parse(JSON.stringify(value));
	}
}
