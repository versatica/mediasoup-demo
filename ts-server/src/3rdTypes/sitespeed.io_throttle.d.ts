/**
 * TS types for https://www.npmjs.com/package/@sitespeed.io/throttle.
 */
declare module '@sitespeed.io/throttle' {
	export interface ThrottleStartOptions {
		up: number;
		down: number;
		rtt: number;
		packetLoss: number;
		localhost?: boolean;
	}

	export interface ThrottleStopOptions {
		localhost?: boolean;
	}

	/**
	 * Start throttling the network with the given parameters.
	 */
	export function start(options: ThrottleStartOptions): Promise<void>;

	/**
	 * Stop any active network throttling.
	 */
	export function stop(options?: ThrottleStopOptions): Promise<void>;
}
