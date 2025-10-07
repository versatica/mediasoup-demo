import * as process from 'node:process';
import * as path from 'node:path';

/**
 * @type string
 */
export function getConfigFile() {
	return (
		process.env['CONFIG_FILE'] ||
		path.join(__dirname, '..', '..', 'server', 'config.mjs')
	);
}
