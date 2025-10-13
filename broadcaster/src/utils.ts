import * as crypto from 'node:crypto';

/**
 * Clones the given value.
 */
export function clone<T>(value: T): T {
	if (value === undefined) {
		return undefined as unknown as T;
	} else if (Number.isNaN(value)) {
		return NaN as unknown as T;
	} else if (typeof structuredClone === 'function') {
		// Available in Node >= 18.
		return structuredClone(value);
	} else {
		return JSON.parse(JSON.stringify(value));
	}
}

export function assertUnreachable(key: string, value: never): never {
	throw new TypeError(`invalid ${key}: ${value}`);
}

export function generateRandomString(length: number = 8): string {
	const chars =
		'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	const array = new Uint8Array(length);

	crypto.getRandomValues(array);

	return Array.from(array, x => chars[x % chars.length]).join('');
}

export function isHttpsUrl(url: string): boolean {
	if (!url) {
		return false;
	}

	try {
		const u = new URL(url);

		return u.protocol === 'https:';
	} catch {
		return false;
	}
}

export function splitAndFlattenArgs(array: (string | string[])[]): string[] {
	return array.flatMap(elem => {
		if (Array.isArray(elem)) {
			return splitAndFlattenArgs(elem);
		} else if (typeof elem === 'string') {
			return elem.split(' ').filter(Boolean);
		} else {
			return [String(elem)];
		}
	});
}

export function trimFinalNewline(str: string): string {
	return str.replace(/(\r?\n)$/, '');
}
