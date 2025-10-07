import * as os from 'node:os';
import * as path from 'node:path';
import * as repl from 'node:repl';
import * as readline from 'node:readline';
import * as net from 'node:net';
import * as process from 'node:process';
import type * as netTypes from 'node:net';
import * as fs from 'node:fs';
import * as mediasoup from 'mediasoup';
import type * as mediasoupTypes from 'mediasoup/types';
import picocolors from 'picocolors';
import pidusage from 'pidusage';

import { Logger } from './Logger';
import { EnhancedEventEmitter } from './enhancedEvents';
import { Server } from './Server';
import type { Room } from './Room';
import type { RoomId } from './types';

// We need to expose some globals.
declare global {
	var workers: Map<number, mediasoupTypes.Worker>;
	var webRtcServers: Map<string, mediasoupTypes.WebRtcServer>;
	var routers: Map<string, mediasoupTypes.Router>;
	var transports: Map<string, mediasoupTypes.Transport>;
	var producers: Map<string, mediasoupTypes.Producer>;
	var consumers: Map<string, mediasoupTypes.Consumer>;
	var dataProducers: Map<string, mediasoupTypes.DataProducer>;
	var dataConsumers: Map<string, mediasoupTypes.DataConsumer>;
	var worker: mediasoupTypes.Worker | undefined;
	var webRtcServer: mediasoupTypes.WebRtcServer | undefined;
	var router: mediasoupTypes.Router | undefined;
	var transport: mediasoupTypes.Transport | undefined;
	var producer: mediasoupTypes.Producer | undefined;
	var consumer: mediasoupTypes.Consumer | undefined;
	var dataProducer: mediasoupTypes.DataProducer | undefined;
	var dataConsumer: mediasoupTypes.DataConsumer | undefined;
	var rooms: Map<RoomId, Room>;
}

export const SOCKET_PATH =
	os.platform() === 'win32'
		? path.join('\\\\?\\pipe', __dirname, '..', 'mediasoup-demo-terminal.sock')
		: path.join(__dirname, '..', 'mediasoup-demo-terminal.sock');

const logger = new Logger('TerminalServer');

export type TerminalServerEvents = {
	/**
	 * Emitted when the terminal server is closed no matter how.
	 */
	closed: [];
};

export class TerminalServer extends EnhancedEventEmitter<TerminalServerEvents> {
	static #netServer?: net.Server;
	static #terminalServers: Set<TerminalServer> = new Set();
	// Maps to store all mediasoup entities indexed by id.
	static readonly #workers: Map<number, mediasoupTypes.Worker> = new Map();
	static readonly #webRtcServers: Map<string, mediasoupTypes.WebRtcServer> =
		new Map();
	static readonly #routers: Map<string, mediasoupTypes.Router> = new Map();
	static readonly #transports: Map<string, mediasoupTypes.Transport> =
		new Map();
	static readonly #producers: Map<string, mediasoupTypes.Producer> = new Map();
	static readonly #consumers: Map<string, mediasoupTypes.Consumer> = new Map();
	static readonly #dataProducers: Map<string, mediasoupTypes.DataProducer> =
		new Map();
	static readonly #dataConsumers: Map<string, mediasoupTypes.DataConsumer> =
		new Map();
	// Maps to store all Rooms indexed by id.
	static readonly #rooms: Map<RoomId, Room> = new Map();

	readonly #socket: netTypes.Socket;
	readonly #onQuit: () => void;
	readonly #onForceQuit: () => void;
	#isTerminalOpen: boolean = false;
	#closed: boolean = false;

	static async listen({
		onQuit,
		onForceQuit,
	}: {
		onQuit: () => void;
		onForceQuit: () => void;
	}): Promise<void> {
		logger.debug('listen()');

		TerminalServer.#netServer = net.createServer(socket => {
			const terminalServer = new TerminalServer({
				socket,
				onQuit,
				onForceQuit,
			});

			TerminalServer.#terminalServers.add(terminalServer);

			terminalServer.on('closed', () => {
				TerminalServer.#terminalServers.delete(terminalServer);
			});

			terminalServer.openCommandConsole();
		});

		await new Promise<void>(resolve => {
			try {
				fs.unlinkSync(SOCKET_PATH);
			} catch (error) {}

			TerminalServer.#netServer?.listen({ path: SOCKET_PATH }, resolve);

			logger.info('listen() | listening on %o', SOCKET_PATH);
		});

		// Make maps global so they can be used during the REPL terminal.
		global.workers = TerminalServer.#workers;
		global.routers = TerminalServer.#routers;
		global.transports = TerminalServer.#transports;
		global.producers = TerminalServer.#producers;
		global.consumers = TerminalServer.#consumers;
		global.dataProducers = TerminalServer.#dataProducers;
		global.dataConsumers = TerminalServer.#dataConsumers;
		global.rooms = TerminalServer.#rooms;

		TerminalServer.runMediasoupObserver();
		TerminalServer.runServerObserver();
	}

	static stop(): void {
		logger.debug('stop()');

		// Stop listening for connections.
		TerminalServer.#netServer?.close();

		// Close all existing terminal servers.
		for (const terminalServer of TerminalServer.#terminalServers) {
			terminalServer.close();
		}
	}

	private static runMediasoupObserver(): void {
		mediasoup.observer.on('newworker', worker => {
			// Store the latest worker in a global variable.
			global.worker = worker;

			TerminalServer.#workers.set(worker.pid, worker);
			worker.observer.on('close', () => {
				TerminalServer.#workers.delete(worker.pid);

				if (global.worker === worker) {
					global.worker = undefined;
				}
			});

			worker.observer.on('newwebrtcserver', webRtcServer => {
				// Store the latest webRtcServer in a global variable.
				global.webRtcServer = webRtcServer;

				TerminalServer.#webRtcServers.set(webRtcServer.id, webRtcServer);
				webRtcServer.observer.on('close', () => {
					TerminalServer.#webRtcServers.delete(webRtcServer.id);

					if (global.webRtcServer === webRtcServer) {
						global.webRtcServer = undefined;
					}
				});
			});

			worker.observer.on('newrouter', router => {
				// Store the latest router in a global variable.
				global.router = router;

				TerminalServer.#routers.set(router.id, router);
				router.observer.on('close', () => {
					TerminalServer.#routers.delete(router.id);

					if (global.router === router) {
						global.router = undefined;
					}
				});

				router.observer.on('newtransport', transport => {
					// Store the latest transport in a global variable.
					global.transport = transport;

					TerminalServer.#transports.set(transport.id, transport);
					transport.observer.on('close', () => {
						TerminalServer.#transports.delete(transport.id);

						if (global.transport === transport) {
							global.transport = undefined;
						}
					});

					transport.observer.on('newproducer', producer => {
						// Store the latest producer in a global variable.
						global.producer = producer;

						TerminalServer.#producers.set(producer.id, producer);
						producer.observer.on('close', () => {
							TerminalServer.#producers.delete(producer.id);

							if (global.producer === producer) {
								global.producer = undefined;
							}
						});
					});

					transport.observer.on('newconsumer', consumer => {
						// Store the latest consumer in a global variable.
						global.consumer = consumer;

						TerminalServer.#consumers.set(consumer.id, consumer);
						consumer.observer.on('close', () => {
							TerminalServer.#consumers.delete(consumer.id);

							if (global.consumer === consumer) {
								global.consumer = undefined;
							}
						});
					});

					transport.observer.on('newdataproducer', dataProducer => {
						// Store the latest dataProducer in a global variable.
						global.dataProducer = dataProducer;

						TerminalServer.#dataProducers.set(dataProducer.id, dataProducer);
						dataProducer.observer.on('close', () => {
							TerminalServer.#dataProducers.delete(dataProducer.id);

							if (global.dataProducer === dataProducer) {
								global.dataProducer = undefined;
							}
						});
					});

					transport.observer.on('newdataconsumer', dataConsumer => {
						// Store the latest dataConsumer in a global variable.
						global.dataConsumer = dataConsumer;

						TerminalServer.#dataConsumers.set(dataConsumer.id, dataConsumer);
						dataConsumer.observer.on('close', () => {
							TerminalServer.#dataConsumers.delete(dataConsumer.id);

							if (global.dataConsumer === dataConsumer) {
								global.dataConsumer = undefined;
							}
						});
					});
				});
			});
		});
	}

	private static runServerObserver(): void {
		Server.observer.on('new-server', server => {
			server.on('new-room', room => {
				TerminalServer.#rooms.set(room.id, room);
				room.on('closed', () => {
					TerminalServer.#rooms.delete(room.id);
				});
			});
		});
	}

	private constructor({
		socket,
		onQuit,
		onForceQuit,
	}: {
		socket: netTypes.Socket;
		onQuit: () => void;
		onForceQuit: () => void;
	}) {
		super();

		logger.debug('constructor()');

		this.#socket = socket;
		this.#onQuit = onQuit;
		this.#onForceQuit = onForceQuit;

		this.handleSocket();
	}

	private close(): void {
		logger.debug('close()');

		if (this.#closed) {
			return;
		}

		this.#closed = true;

		this.#socket.destroy();

		this.emit('closed');
	}

	private openCommandConsole(): void {
		this.logInfo('opening Readline Command Console...');
		this.logInfo('type help to print available commands');

		const cmd = readline.createInterface({
			input: this.#socket,
			output: this.#socket,
			terminal: true,
		});

		cmd.on('close', () => {
			if (this.#isTerminalOpen) {
				return;
			}

			this.logInfo('exiting Readline Command Console...');

			this.close();
		});

		const readStdin = (): void => {
			// eslint-disable-next-line @typescript-eslint/no-misused-promises
			cmd.question('cmd> ', async input => {
				const params = input.split(/[\s\t]+/);
				const command = params.shift();

				switch (command) {
					case '': {
						readStdin();

						break;
					}

					case 'h':
					case 'help': {
						this.logInfoWithoutPrefix('available commands:');
						this.logInfoWithoutPrefix('- h, help: show this message');
						this.logInfoWithoutPrefix('- d, dump: show active Rooms');
						this.logInfoWithoutPrefix(
							'- usage: show CPU and memory usage of the Node.js and mediasoup-worker processes'
						);
						this.logInfoWithoutPrefix(
							'- logLevel level: changes logLevel in all mediasoup Workers'
						);
						this.logInfoWithoutPrefix(
							'- logTags [tag] [tag]: changes logTags in all mediasoup Workers (values separated by space)'
						);
						this.logInfoWithoutPrefix(
							'- dw, dumpWorkers: dump mediasoup Workers'
						);
						this.logInfoWithoutPrefix(
							'- dws, dumpWebRtcServer [id]: dump mediasoup WebRtcServer with given id (or the latest created one)'
						);
						this.logInfoWithoutPrefix(
							'- dr, dumpRouter [id]: dump mediasoup Router with given id (or the latest created one)'
						);
						this.logInfoWithoutPrefix(
							'- dt, dumpTransport [id]: dump mediasoup Transport with given id (or the latest created one)'
						);
						this.logInfoWithoutPrefix(
							'- dp, dumpProducer [id]: dump mediasoup Producer with given id (or the latest created one)'
						);
						this.logInfoWithoutPrefix(
							'- dc, dumpConsumer [id]: dump mediasoup Consumer with given id (or the latest created one)'
						);
						this.logInfoWithoutPrefix(
							'- ddp, dumpDataProducer [id]: dump mediasoup DataProducer with given id (or the latest created one)'
						);
						this.logInfoWithoutPrefix(
							'- ddc, dumpDataConsumer [id]: dump mediasoup DataConsumer with given id (or the latest created one)'
						);
						this.logInfoWithoutPrefix(
							'- st, statsTransport [id]: get stats for mediasoup Transport with given id (or the latest created one)'
						);
						this.logInfoWithoutPrefix(
							'- sp, statsProducer [id]: get stats for mediasoup Producer with given id (or the latest created one)'
						);
						this.logInfoWithoutPrefix(
							'- sc, statsConsumer [id]: get stats for mediasoup Consumer with given id (or the latest created one)'
						);
						this.logInfoWithoutPrefix(
							'- sdp, statsDataProducer [id]: get stats for mediasoup DataProducer with given id (or the latest created one)'
						);
						this.logInfoWithoutPrefix(
							'- sdc, statsDataConsumer [id]: get stats for mediasoup DataConsumer with given id (or the latest created one)'
						);
						this.logInfoWithoutPrefix('- t, terminal: open Node REPL Terminal');
						this.logInfoWithoutPrefix('- quit: quit the server');
						this.logInfoWithoutPrefix(
							'- forceQuit: force quit the server (for development purposes)'
						);

						readStdin();

						break;
					}

					case 'd':
					case 'dump': {
						for (const room of TerminalServer.#rooms.values()) {
							const dump = room.serialize();

							this.logInfoWithoutPrefix(
								`room.dump():\n${JSON.stringify(dump, null, '  ')}`
							);
						}

						break;
					}

					case 'u':
					case 'usage': {
						let usage = await pidusage(process.pid);

						this.logInfoWithoutPrefix(
							`Node.js process [pid:${process.pid}]:\n${JSON.stringify(usage, null, '  ')}`
						);

						for (const worker of TerminalServer.#workers.values()) {
							usage = await pidusage(worker.pid);

							this.logInfoWithoutPrefix(
								`mediasoup-worker process [pid:${worker.pid}]:\n${JSON.stringify(usage, null, '  ')}`
							);
						}

						break;
					}

					case 'logLevel': {
						const level = params[0] as mediasoupTypes.WorkerLogLevel;
						const promises: Promise<void>[] = [];

						for (const worker of TerminalServer.#workers.values()) {
							promises.push(worker.updateSettings({ logLevel: level }));
						}

						try {
							await Promise.all(promises);

							this.logInfoWithoutPrefix('done');
						} catch (error) {
							this.logErrorWithoutPrefix(String(error));
						}

						break;
					}

					case 'logTags': {
						const tags = params as mediasoupTypes.WorkerLogTag[];
						const promises: Promise<void>[] = [];

						for (const worker of TerminalServer.#workers.values()) {
							promises.push(worker.updateSettings({ logTags: tags }));
						}

						try {
							await Promise.all(promises);

							this.logInfoWithoutPrefix('done');
						} catch (error) {
							this.logErrorWithoutPrefix(String(error));
						}

						break;
					}

					case 'dw':
					case 'dumpWorkers': {
						for (const worker of TerminalServer.#workers.values()) {
							try {
								const dump = await worker.dump();

								this.logInfoWithoutPrefix(
									`worker.dump():\n${JSON.stringify(dump, null, '  ')}`
								);
							} catch (error) {
								this.logErrorWithoutPrefix(`worker.dump() failed: ${error}`);
							}
						}

						break;
					}

					case 'dwrs':
					case 'dumpWebRtcServer': {
						const id =
							params[0] ??
							Array.from(TerminalServer.#webRtcServers.keys()).pop();
						const webRtcServer = TerminalServer.#webRtcServers.get(id!);

						if (!webRtcServer) {
							this.logErrorWithoutPrefix('WebRtcServer not found');

							break;
						}

						try {
							const dump = await webRtcServer.dump();

							this.logInfoWithoutPrefix(
								`webRtcServer.dump():\n${JSON.stringify(dump, null, '  ')}`
							);
						} catch (error) {
							this.logErrorWithoutPrefix(
								`webRtcServer.dump() failed: ${error}`
							);
						}

						break;
					}

					case 'dr':
					case 'dumpRouter': {
						const id =
							params[0] ?? Array.from(TerminalServer.#routers.keys()).pop();
						const router = TerminalServer.#routers.get(id!);

						if (!router) {
							this.logErrorWithoutPrefix('Router not found');

							break;
						}

						try {
							const dump = await router.dump();

							this.logInfoWithoutPrefix(
								`router.dump():\n${JSON.stringify(dump, null, '  ')}`
							);
						} catch (error) {
							this.logErrorWithoutPrefix(`router.dump() failed: ${error}`);
						}

						break;
					}

					case 'dt':
					case 'dumpTransport': {
						const id =
							params[0] ?? Array.from(TerminalServer.#transports.keys()).pop();
						const transport = TerminalServer.#transports.get(id!);

						if (!transport) {
							this.logErrorWithoutPrefix('Transport not found');

							break;
						}

						try {
							const dump = await transport.dump();

							this.logInfoWithoutPrefix(
								`transport.dump():\n${JSON.stringify(dump, null, '  ')}`
							);
						} catch (error) {
							this.logErrorWithoutPrefix(`transport.dump() failed: ${error}`);
						}

						break;
					}

					case 'dp':
					case 'dumpProducer': {
						const id =
							params[0] ?? Array.from(TerminalServer.#producers.keys()).pop();
						const producer = TerminalServer.#producers.get(id!);

						if (!producer) {
							this.logErrorWithoutPrefix('Producer not found');

							break;
						}

						try {
							const dump = await producer.dump();

							this.logInfoWithoutPrefix(
								`producer.dump():\n${JSON.stringify(dump, null, '  ')}`
							);
						} catch (error) {
							this.logErrorWithoutPrefix(`producer.dump() failed: ${error}`);
						}

						break;
					}

					case 'dc':
					case 'dumpConsumer': {
						const id =
							params[0] ?? Array.from(TerminalServer.#consumers.keys()).pop();
						const consumer = TerminalServer.#consumers.get(id!);

						if (!consumer) {
							this.logErrorWithoutPrefix('Consumer not found');

							break;
						}

						try {
							const dump = await consumer.dump();

							this.logInfoWithoutPrefix(
								`consumer.dump():\n${JSON.stringify(dump, null, '  ')}`
							);
						} catch (error) {
							this.logErrorWithoutPrefix(`consumer.dump() failed: ${error}`);
						}

						break;
					}

					case 'ddp':
					case 'dumpDataProducer': {
						const id =
							params[0] ??
							Array.from(TerminalServer.#dataProducers.keys()).pop();
						const dataProducer = TerminalServer.#dataProducers.get(id!);

						if (!dataProducer) {
							this.logErrorWithoutPrefix('DataProducer not found');

							break;
						}

						try {
							const dump = await dataProducer.dump();

							this.logInfoWithoutPrefix(
								`dataProducer.dump():\n${JSON.stringify(dump, null, '  ')}`
							);
						} catch (error) {
							this.logErrorWithoutPrefix(
								`dataProducer.dump() failed: ${error}`
							);
						}

						break;
					}

					case 'ddc':
					case 'dumpDataConsumer': {
						const id =
							params[0] ??
							Array.from(TerminalServer.#dataConsumers.keys()).pop();
						const dataConsumer = TerminalServer.#dataConsumers.get(id!);

						if (!dataConsumer) {
							this.logErrorWithoutPrefix('DataConsumer not found');

							break;
						}

						try {
							const dump = await dataConsumer.dump();

							this.logInfoWithoutPrefix(
								`dataConsumer.dump():\n${JSON.stringify(dump, null, '  ')}`
							);
						} catch (error) {
							this.logErrorWithoutPrefix(
								`dataConsumer.dump() failed: ${error}`
							);
						}

						break;
					}

					case 'st':
					case 'statsTransport': {
						const id =
							params[0] ?? Array.from(TerminalServer.#transports.keys()).pop();
						const transport = TerminalServer.#transports.get(id!);

						if (!transport) {
							this.logErrorWithoutPrefix('Transport not found');

							break;
						}

						try {
							const stats = await transport.getStats();

							this.logInfoWithoutPrefix(
								`transport.getStats():\n${JSON.stringify(stats, null, '  ')}`
							);
						} catch (error) {
							this.logErrorWithoutPrefix(
								`transport.getStats() failed: ${error}`
							);
						}

						break;
					}

					case 'sp':
					case 'statsProducer': {
						const id =
							params[0] ?? Array.from(TerminalServer.#producers.keys()).pop();
						const producer = TerminalServer.#producers.get(id!);

						if (!producer) {
							this.logErrorWithoutPrefix('Producer not found');

							break;
						}

						try {
							const stats = await producer.getStats();

							this.logInfoWithoutPrefix(
								`producer.getStats():\n${JSON.stringify(stats, null, '  ')}`
							);
						} catch (error) {
							this.logErrorWithoutPrefix(
								`producer.getStats() failed: ${error}`
							);
						}

						break;
					}

					case 'sc':
					case 'statsConsumer': {
						const id =
							params[0] ?? Array.from(TerminalServer.#consumers.keys()).pop();
						const consumer = TerminalServer.#consumers.get(id!);

						if (!consumer) {
							this.logErrorWithoutPrefix('Consumer not found');

							break;
						}

						try {
							const stats = await consumer.getStats();

							this.logInfoWithoutPrefix(
								`consumer.getStats():\n${JSON.stringify(stats, null, '  ')}`
							);
						} catch (error) {
							this.logErrorWithoutPrefix(
								`consumer.getStats() failed: ${error}`
							);
						}

						break;
					}

					case 'sdp':
					case 'statsDataProducer': {
						const id =
							params[0] ??
							Array.from(TerminalServer.#dataProducers.keys()).pop();
						const dataProducer = TerminalServer.#dataProducers.get(id!);

						if (!dataProducer) {
							this.logErrorWithoutPrefix('DataProducer not found');

							break;
						}

						try {
							const stats = await dataProducer.getStats();

							this.logInfoWithoutPrefix(
								`dataProducer.getStats():\n${JSON.stringify(stats, null, '  ')}`
							);
						} catch (error) {
							this.logErrorWithoutPrefix(
								`dataProducer.getStats() failed: ${error}`
							);
						}

						break;
					}

					case 'sdc':
					case 'statsDataConsumer': {
						const id =
							params[0] ??
							Array.from(TerminalServer.#dataConsumers.keys()).pop();
						const dataConsumer = TerminalServer.#dataConsumers.get(id!);

						if (!dataConsumer) {
							this.logErrorWithoutPrefix('DataConsumer not found');

							break;
						}

						try {
							const stats = await dataConsumer.getStats();

							this.logInfoWithoutPrefix(
								`dataConsumer.getStats():\n${JSON.stringify(stats, null, '  ')}`
							);
						} catch (error) {
							this.logErrorWithoutPrefix(
								`dataConsumer.getStats() failed: ${error}`
							);
						}

						break;
					}

					case 't':
					case 'terminal': {
						this.#isTerminalOpen = true;

						cmd.close();
						this.openTerminal();

						// `return` instead of `break` to avoid the call to readStdin()
						// below.
						return;
					}

					case 'quit': {
						this.#onQuit();
						this.logInfoWithoutPrefix('');

						// `return` instead of `break` to avoid the call to readStdin()
						// below.
						return;
					}

					case 'forceQuit': {
						this.#onForceQuit();
						this.logInfoWithoutPrefix('');

						// `return` instead of `break` to avoid the call to readStdin()
						// below.
						return;
					}

					default: {
						this.logErrorWithoutPrefix(`unknown command '${command}'`);
						this.logInfoWithoutPrefix(
							`press 'h' or 'help' to get the list of available commands`
						);
					}
				}

				readStdin();
			});
		};

		readStdin();
	}

	private openTerminal(): void {
		this.logInfo('opening Node REPL Terminal...');

		const terminal = repl.start({
			input: this.#socket,
			output: this.#socket,
			terminal: true,
			prompt: 'terminal> ',
			useColors: true,
			useGlobal: true,
			ignoreUndefined: false,
			preview: false,
		});

		this.#isTerminalOpen = true;

		terminal.on('exit', () => {
			this.logInfo('exiting Node REPL Terminal...');

			this.#isTerminalOpen = false;

			this.openCommandConsole();
		});
	}

	private handleSocket(): void {
		this.#socket.on('close', () => {
			if (this.#closed) {
				return;
			}

			this.close();
		});

		this.#socket.on('error', error => {
			logger.warn(`socket error: ${error}`);
		});
	}

	private logInfo(msg: string): void {
		this.#socket.write(`${picocolors.green(`[TerminalServer] ${msg}`)}\n`);
	}

	private logInfoWithoutPrefix(msg: string): void {
		this.#socket.write(`${picocolors.green(msg)}\n`);
	}

	private logError(msg: string): void {
		this.#socket.write(
			`${picocolors.red('[TerminalServer]')} ${picocolors.red(picocolors.bold('ERROR:'))} ${picocolors.red(msg)}\n`
		);
	}

	private logErrorWithoutPrefix(msg: string): void {
		this.#socket.write(
			`${picocolors.red(picocolors.bold('ERROR:'))} ${picocolors.red(msg)}\n`
		);
	}
}
