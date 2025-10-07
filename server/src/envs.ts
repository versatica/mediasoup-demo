import * as process from 'node:process';
import * as path from 'node:path';

export function getConfigFile(): string {
	return process.env['CONFIG_FILE'] ?? path.join(__dirname, '..', 'config.mjs');
}

export function getDebug(): string | undefined {
	return process.env['DEBUG'];
}

export function getTerminal(): boolean {
	return process.env['TERMINAL'] === 'true';
}

export function getNetworkThrottleSecret(): string | undefined {
	return process.env['NETWORK_THROTTLE_SECRET'];
}
