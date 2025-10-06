#!/usr/bin/env node

/**
 * `connect-terminal.mjs` connects to a running mediasoup-demo-server process
 * and provides you with an interactive terminal to interact with it.
 *
 * @remarks
 * - This script requires that the mediasoup-demo-server is transpiled to
 *   JavaScript.
 * - For development, for example while running the server in watch mode,
 *   better use the `connect-terminal.ts` script.
 */

/** @type {import('./src/TerminalClient.ts').TerminalClient} */
import { TerminalClient } from './lib/TerminalClient.js';

void TerminalClient.connect().catch(() => {});
