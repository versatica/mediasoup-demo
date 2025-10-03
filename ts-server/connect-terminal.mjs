#!/usr/bin/env node

/** @type {import('./src/TerminalClient.ts').TerminalClient} */
import { TerminalClient } from './lib/TerminalClient.js';

void TerminalClient.connect().catch(() => {});
