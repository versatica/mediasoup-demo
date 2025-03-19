import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// try to get host domain from server/config.js if any
// also get https config
import Module from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import url from 'node:url';
const require = Module.createRequire(import.meta.url);
let host = process.env.DOMAIN || 'localhost';
let cert: Buffer<ArrayBufferLike> | undefined = undefined;
let key: Buffer<ArrayBufferLike> | undefined = undefined;
try {
  const c = require('../server/config');
  host = c.domain || host;
  cert = readTls(c.https.tls?.cert);
  key = readTls(c.https.tls?.key);
} catch (err) {
  // ignore file not found
}
const port = Number(process.env.VITE_LISTEN_PORT) || 3000;
const https = cert && key ? { cert, key } : undefined;

export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: Infinity,
  },
  server: {
    host,
    port,
    https,
  },
});

import qs from 'qs';
import openBrowser from 'react-dev-utils/openBrowser';
import waitPort from 'wait-port';

runDev();

async function runDev() {
  const dev = process.env.DEV;
  if (!dev) {
    return;
  }

  await waitPort({
    host,
    port,
    output: 'silent',
  });

  const default_ = {
    roomId: 'dev',
    _throttleSecret: 'foo',
    info: true,
  };
  const defaultProducer = {
    consume: false,
  };
  const defaultConsumer = {
    produce: false,
  };

  let producer = null;
  let consumer = null;

  if (dev === 'tcp') {
    producer = {
      roomId: 'dev-tcp',
      forceTcp: true,
    };
    consumer = {
      roomId: 'dev-tcp',
      forceTcp: true,
    };
  } else if (dev === 'vp9') {
    producer = {
      roomId: 'dev-vp9',
      forceVP9: true,
      numSimulcastStreams: 3,
      webcamScalabilityMode: 'L1T3',
    };
    consumer = {
      roomId: 'dev-vp9',
      forceVP9: true,
    };
  } else if (dev === 'h264') {
    producer = {
      roomId: 'dev-h264',
      forceH264: true,
    };
    consumer = {
      roomId: 'dev-h264',
      forceH264: true,
    };
  } else if (dev === 'av1') {
    producer = {
      roomId: 'dev-av1',
      forceAV1: true,
    };
    consumer = {
      roomId: 'dev-av1',
      forceAV1: true,
    };
  }

  const qProducer = qs.stringify({
    ...default_,
    ...defaultProducer,
    ...producer,
  });
  open(qProducer);

  const qConsumer = qs.stringify({
    ...default_,
    ...defaultConsumer,
    ...consumer,
  });
  open(qConsumer);
}

function open(query: string) {
  const protocol = https ? 'https' : 'http';
  const url = `${protocol}://${host}:${port}/?${query}`;
  openBrowser(url);
}

function readTls(v: string) {
  if (!v) {
    return;
  }
  if (!path.isAbsolute(v)) {
    const dir = path.dirname(url.fileURLToPath(import.meta.url));
    v = path.join(dir, '../server', v);
  }
  try {
    return fs.readFileSync(v);
  } catch (err) {
    // ignore file not found
  }
}
