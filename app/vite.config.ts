import path from 'node:path';
import fs from 'node:fs';
import url from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import waitPort from 'wait-port';
import qs from 'qs';
import openBrowser from 'react-dev-utils/openBrowser';

import * as envs from './src/envs';

export default defineConfig(async () => {
  let host: string = 'localhost'; // Default value.
  let cert: Buffer<ArrayBufferLike> | string | undefined = undefined;
  let key: Buffer<ArrayBufferLike> | string | undefined = undefined;
  let configFile = envs.getConfigFile();

  try {
    const { config } = await import(configFile);

    host = config.domain;
    cert = readTls(config.http.tls?.cert);
    key = readTls(config.http.tls?.key);
  } catch (error) {
    console.warn('Failed to read config file %o:', configFile, error);

    process.exit(1);
  }

  const port = Number(process.env.VITE_LISTEN_PORT) || 5555;
  const alias: { [k: string]: string } = {};

  if (process.env.LOCAL) {
    const localClientEntryPoint = '../../mediasoup-client/src/index.ts';

    alias['mediasoup-client'] = path.join(__dirname, localClientEntryPoint);
  }

  // Función para abrir navegador (manteniendo tu estilo)
  function open(query: string) {
    const protocol = cert && key ? 'https' : 'http';
    const urlToOpen = `${protocol}://${host}:${port}/?${query}`;

    openBrowser(urlToOpen);
  }

  // Función dev opcional, si quieres usar runDev()
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

    const devRoom = {
      roomId: 'dev',
      _throttleSecret: 'foo',
      info: true,
      stats: false,
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
      ...devRoom,
      ...defaultProducer,
      ...producer,
    });

    open(qProducer);

    const qConsumer = qs.stringify({
      ...devRoom,
      ...defaultConsumer,
      ...consumer,
    });

    open(qConsumer);
  }

  runDev();

  return {
    plugins: [react()],
    build: {
      chunkSizeWarningLimit: Infinity,
    },
    server: {
      host,
      port,
      https: cert && key ? { cert, key } : undefined,
    },
    resolve: {
      alias,
    },
  };
});

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
