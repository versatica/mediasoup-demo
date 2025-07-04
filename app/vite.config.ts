import Module from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import url from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import qs from 'qs';
import waitPort from 'wait-port';
import openBrowser from 'react-dev-utils/openBrowser';

const require = Module.createRequire(import.meta.url);

let host = process.env.DOMAIN || 'localhost';
let cert: Buffer<ArrayBufferLike> | undefined = undefined;
let key: Buffer<ArrayBufferLike> | undefined = undefined;

// Try to read server/config.js.
try {
  const c = require('../server/config');

  host = c.domain || host;
  cert = readTls(c.https.tls?.cert);
  key = readTls(c.https.tls?.key);
} catch (error) {
  // ignore file not found
}

const port = Number(process.env.VITE_LISTEN_PORT) || 5555;
const https = cert && key ? { cert, key } : undefined;
const alias: { [k: string]: string } = {};

// Use mediasoup-client from same folder to allow hot reload when changing code
// in mediasoup-client.
if (process.env.LOCAL) {
  const localClientEntryPoint = '../../mediasoup-client/src/index.ts';

  alias['mediasoup-client'] = path.join(__dirname, localClientEntryPoint);
}

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
  resolve: {
    alias,
  },
});

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

  switch (dev) {
    case 'tcp': {
      producer = {
        roomId: 'dev-tcp',
        forceTcp: true,
      };

      consumer = {
        roomId: 'dev-tcp',
        forceTcp: true,
      };

      break;
    }

    case 'vp9': {
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

      break;
    }

    case 'h264': {
      producer = {
        roomId: 'dev-h264',
        forceH264: true,
      };

      consumer = {
        roomId: 'dev-h264',
        forceH264: true,
      };

      break;
    }

    case 'av1': {
      producer = {
        roomId: 'dev-av1',
        forceAV1: true,
      };

      consumer = {
        roomId: 'dev-av1',
        forceAV1: true,
      };

      break;
    }
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
  } catch (error) {
    // Ignore file not found.
  }
}
