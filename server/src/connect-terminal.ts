#!/usr/bin/env -S npx tsx

/**
 * `connect-terminal.ts` connects to a running mediasoup-demo-server process
 * and provides you with an interactive terminal to interact with it.
 *
 * @remarks
 * - This script does NOT require that the mediasoup-demo-server is transpiled
 *   to JavaScript. This is because it uses `tsx` for realtime transpilation.
 */

import { TerminalClient } from './TerminalClient';

void TerminalClient.connect().catch(() => {});
