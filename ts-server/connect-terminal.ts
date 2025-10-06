#!/usr/bin/env -S npx tsx

/**
 * `connect-terminal.ts` connects to a running mediasoup-demo-server process
 * and provides you with an interactive terminal to interact with it.
 *
 * @remarks
 * - This script does NOT require that the mediasoup-demo-server is transpiled
 *   to JavaScript. This is because it uses `tsx` for realtime transpilation.
 * - In production better use the `connect-terminal.mjs` script.
 */

/** @type {import('./src/TerminalClient.ts').TerminalClient} */
import { TerminalClient } from './src/TerminalClient.ts';

void TerminalClient.connect().catch(() => {});
