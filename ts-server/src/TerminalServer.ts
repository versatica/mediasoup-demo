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
}

const SOCKET_PATH_UNIX = '/tmp/mediasoup-demo.sock';
const SOCKET_PATH_WIN = path.join(
	'\\\\?\\pipe',
	process.cwd(),
	'mediasoup-demo'
);

export const SOCKET_PATH =
	os.platform() === 'win32' ? SOCKET_PATH_WIN : SOCKET_PATH_UNIX;

const logger = new Logger('TerminalServer');

export class TerminalServer {
	// Maps to store all mediasoup entities indexed by id.
	public static readonly workers: Map<number, mediasoupTypes.Worker> =
		new Map();
	public static readonly webRtcServers: Map<
		string,
		mediasoupTypes.WebRtcServer
	> = new Map();
	public static readonly routers: Map<string, mediasoupTypes.Router> =
		new Map();
	public static readonly transports: Map<string, mediasoupTypes.Transport> =
		new Map();
	public static readonly producers: Map<string, mediasoupTypes.Producer> =
		new Map();
	public static readonly consumers: Map<string, mediasoupTypes.Consumer> =
		new Map();
	public static readonly dataProducers: Map<
		string,
		mediasoupTypes.DataProducer
	> = new Map();
	public static readonly dataConsumers: Map<
		string,
		mediasoupTypes.DataConsumer
	> = new Map();

	readonly #socket: netTypes.Socket;
	#isTerminalOpen: boolean = false;

	static async start(): Promise<void> {
		logger.debug('start()');

		const netServer = net.createServer(socket => {
			const terminalServer = new TerminalServer(socket);

			terminalServer.openCommandConsole();
		});

		await new Promise<void>(resolve => {
			try {
				fs.unlinkSync(SOCKET_PATH);
			} catch (error) {}

			netServer.listen(SOCKET_PATH, resolve);
		});

		TerminalServer.runMediasoupObserver();
	}

	private static runMediasoupObserver(): void {
		mediasoup.observer.on('newworker', worker => {
			// Store the latest worker in a global variable.
			global.worker = worker;

			TerminalServer.workers.set(worker.pid, worker);
			worker.observer.on('close', () => {
				TerminalServer.workers.delete(worker.pid);

				if (global.worker === worker) {
					global.worker = undefined;
				}
			});

			worker.observer.on('newwebrtcserver', webRtcServer => {
				// Store the latest webRtcServer in a global variable.
				global.webRtcServer = webRtcServer;

				TerminalServer.webRtcServers.set(webRtcServer.id, webRtcServer);
				webRtcServer.observer.on('close', () => {
					TerminalServer.webRtcServers.delete(webRtcServer.id);

					if (global.webRtcServer === webRtcServer) {
						global.webRtcServer = undefined;
					}
				});
			});

			worker.observer.on('newrouter', router => {
				// Store the latest router in a global variable.
				global.router = router;

				TerminalServer.routers.set(router.id, router);
				router.observer.on('close', () => {
					TerminalServer.routers.delete(router.id);

					if (global.router === router) {
						global.router = undefined;
					}
				});

				router.observer.on('newtransport', transport => {
					// Store the latest transport in a global variable.
					global.transport = transport;

					TerminalServer.transports.set(transport.id, transport);
					transport.observer.on('close', () => {
						TerminalServer.transports.delete(transport.id);

						if (global.transport === transport) {
							global.transport = undefined;
						}
					});

					transport.observer.on('newproducer', producer => {
						// Store the latest producer in a global variable.
						global.producer = producer;

						TerminalServer.producers.set(producer.id, producer);
						producer.observer.on('close', () => {
							TerminalServer.producers.delete(producer.id);

							if (global.producer === producer) {
								global.producer = undefined;
							}
						});
					});

					transport.observer.on('newconsumer', consumer => {
						// Store the latest consumer in a global variable.
						global.consumer = consumer;

						TerminalServer.consumers.set(consumer.id, consumer);
						consumer.observer.on('close', () => {
							TerminalServer.consumers.delete(consumer.id);

							if (global.consumer === consumer) {
								global.consumer = undefined;
							}
						});
					});

					transport.observer.on('newdataproducer', dataProducer => {
						// Store the latest dataProducer in a global variable.
						global.dataProducer = dataProducer;

						TerminalServer.dataProducers.set(dataProducer.id, dataProducer);
						dataProducer.observer.on('close', () => {
							TerminalServer.dataProducers.delete(dataProducer.id);

							if (global.dataProducer === dataProducer) {
								global.dataProducer = undefined;
							}
						});
					});

					transport.observer.on('newdataconsumer', dataConsumer => {
						// Store the latest dataConsumer in a global variable.
						global.dataConsumer = dataConsumer;

						TerminalServer.dataConsumers.set(dataConsumer.id, dataConsumer);
						dataConsumer.observer.on('close', () => {
							TerminalServer.dataConsumers.delete(dataConsumer.id);

							if (global.dataConsumer === dataConsumer) {
								global.dataConsumer = undefined;
							}
						});
					});
				});
			});
		});
	}

	private constructor(socket: netTypes.Socket) {
		logger.debug('constructor()');

		this.#socket = socket;
	}

	private openCommandConsole(): void {
		this.logInfo('\n[opening Readline Command Console...]');
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

			this.logInfo('\nexiting...');

			this.#socket.end();
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
						this.logInfo('');
						this.logInfo('available commands:');
						this.logInfo('- h, help: Show this message');
						this.logInfo(
							'- usage: Show CPU and memory usage of the Node.js and mediasoup-worker processes'
						);
						this.logInfo(
							'- logLevel level: Changes logLevel in all mediasoup Workers'
						);
						this.logInfo(
							'- logTags [tag] [tag]: Changes logTags in all mediasoup Workers (values separated by space)'
						);
						this.logInfo('- dw, dumpWorkers: Dump mediasoup Workers');
						this.logInfo(
							'- dws, dumpWebRtcServer [id]: Dump mediasoup WebRtcServer with given id (or the latest created one)'
						);
						this.logInfo(
							'- dr, dumpRouter [id]: Dump mediasoup Router with given id (or the latest created one)'
						);
						this.logInfo(
							'- dt, dumpTransport [id]: Dump mediasoup Transport with given id (or the latest created one)'
						);
						this.logInfo(
							'- dp, dumpProducer [id]: Dump mediasoup Producer with given id (or the latest created one)'
						);
						this.logInfo(
							'- dc, dumpConsumer [id]: Dump mediasoup Consumer with given id (or the latest created one)'
						);
						this.logInfo(
							'- ddp, dumpDataProducer [id]: Dump mediasoup DataProducer with given id (or the latest created one)'
						);
						this.logInfo(
							'- ddc, dumpDataConsumer [id]: Dump mediasoup DataConsumer with given id (or the latest created one)'
						);
						this.logInfo(
							'- st, statsTransport [id]: Get stats for mediasoup Transport with given id (or the latest created one)'
						);
						this.logInfo(
							'- sp, statsProducer [id]: Get stats for mediasoup Producer with given id (or the latest created one)'
						);
						this.logInfo(
							'- sc, statsConsumer [id]: Get stats for mediasoup Consumer with given id (or the latest created one)'
						);
						this.logInfo(
							'- sdp, statsDataProducer [id]: Get stats for mediasoup DataProducer with given id (or the latest created one)'
						);
						this.logInfo(
							'- sdc, statsDataConsumer [id]: Get stats for mediasoup DataConsumer with given id (or the latest created one)'
						);
						this.logInfo('- t, terminal: Open Node REPL Terminal');
						this.logInfo('');

						readStdin();

						break;
					}

					case 'u':
					case 'usage': {
						let usage = await pidusage(process.pid);

						this.logInfo(
							`Node.js process [pid:${process.pid}]:\n${JSON.stringify(usage, null, '  ')}`
						);

						for (const worker of TerminalServer.workers.values()) {
							usage = await pidusage(worker.pid);

							this.logInfo(
								`mediasoup-worker process [pid:${worker.pid}]:\n${JSON.stringify(usage, null, '  ')}`
							);
						}

						break;
					}

					case 'logLevel': {
						const level = params[0] as mediasoupTypes.WorkerLogLevel;
						const promises = [];

						for (const worker of TerminalServer.workers.values()) {
							promises.push(worker.updateSettings({ logLevel: level }));
						}

						try {
							await Promise.all(promises);

							this.logInfo('done');
						} catch (error) {
							this.logError(String(error));
						}

						break;
					}

					case 'logTags': {
						const tags = params as mediasoupTypes.WorkerLogTag[];
						const promises = [];

						for (const worker of TerminalServer.workers.values()) {
							promises.push(worker.updateSettings({ logTags: tags }));
						}

						try {
							await Promise.all(promises);

							this.logInfo('done');
						} catch (error) {
							this.logError(String(error));
						}

						break;
					}

					case 'dw':
					case 'dumpWorkers': {
						for (const worker of TerminalServer.workers.values()) {
							try {
								const dump = await worker.dump();

								this.logInfo(
									`worker.dump():\n${JSON.stringify(dump, null, '  ')}`
								);
							} catch (error) {
								this.logError(`worker.dump() failed: ${error}`);
							}
						}

						break;
					}

					case 'dwrs':
					case 'dumpWebRtcServer': {
						const id =
							params[0] ??
							Array.from(TerminalServer.webRtcServers.keys()).pop();
						const webRtcServer = TerminalServer.webRtcServers.get(id!);

						if (!webRtcServer) {
							this.logError('WebRtcServer not found');

							break;
						}

						try {
							const dump = await webRtcServer.dump();

							this.logInfo(
								`webRtcServer.dump():\n${JSON.stringify(dump, null, '  ')}`
							);
						} catch (error) {
							this.logError(`webRtcServer.dump() failed: ${error}`);
						}

						break;
					}

					case 'dr':
					case 'dumpRouter': {
						const id =
							params[0] ?? Array.from(TerminalServer.routers.keys()).pop();
						const router = TerminalServer.routers.get(id!);

						if (!router) {
							this.logError('Router not found');

							break;
						}

						try {
							const dump = await router.dump();

							this.logInfo(
								`router.dump():\n${JSON.stringify(dump, null, '  ')}`
							);
						} catch (error) {
							this.logError(`router.dump() failed: ${error}`);
						}

						break;
					}

					case 'dt':
					case 'dumpTransport': {
						const id =
							params[0] ?? Array.from(TerminalServer.transports.keys()).pop();
						const transport = TerminalServer.transports.get(id!);

						if (!transport) {
							this.logError('Transport not found');

							break;
						}

						try {
							const dump = await transport.dump();

							this.logInfo(
								`transport.dump():\n${JSON.stringify(dump, null, '  ')}`
							);
						} catch (error) {
							this.logError(`transport.dump() failed: ${error}`);
						}

						break;
					}

					case 'dp':
					case 'dumpProducer': {
						const id =
							params[0] ?? Array.from(TerminalServer.producers.keys()).pop();
						const producer = TerminalServer.producers.get(id!);

						if (!producer) {
							this.logError('Producer not found');

							break;
						}

						try {
							const dump = await producer.dump();

							this.logInfo(
								`producer.dump():\n${JSON.stringify(dump, null, '  ')}`
							);
						} catch (error) {
							this.logError(`producer.dump() failed: ${error}`);
						}

						break;
					}

					case 'dc':
					case 'dumpConsumer': {
						const id =
							params[0] ?? Array.from(TerminalServer.consumers.keys()).pop();
						const consumer = TerminalServer.consumers.get(id!);

						if (!consumer) {
							this.logError('Consumer not found');

							break;
						}

						try {
							const dump = await consumer.dump();

							this.logInfo(
								`consumer.dump():\n${JSON.stringify(dump, null, '  ')}`
							);
						} catch (error) {
							this.logError(`consumer.dump() failed: ${error}`);
						}

						break;
					}

					case 'ddp':
					case 'dumpDataProducer': {
						const id =
							params[0] ??
							Array.from(TerminalServer.dataProducers.keys()).pop();
						const dataProducer = TerminalServer.dataProducers.get(id!);

						if (!dataProducer) {
							this.logError('DataProducer not found');

							break;
						}

						try {
							const dump = await dataProducer.dump();

							this.logInfo(
								`dataProducer.dump():\n${JSON.stringify(dump, null, '  ')}`
							);
						} catch (error) {
							this.logError(`dataProducer.dump() failed: ${error}`);
						}

						break;
					}

					case 'ddc':
					case 'dumpDataConsumer': {
						const id =
							params[0] ??
							Array.from(TerminalServer.dataConsumers.keys()).pop();
						const dataConsumer = TerminalServer.dataConsumers.get(id!);

						if (!dataConsumer) {
							this.logError('DataConsumer not found');

							break;
						}

						try {
							const dump = await dataConsumer.dump();

							this.logInfo(
								`dataConsumer.dump():\n${JSON.stringify(dump, null, '  ')}`
							);
						} catch (error) {
							this.logError(`dataConsumer.dump() failed: ${error}`);
						}

						break;
					}

					case 'st':
					case 'statsTransport': {
						const id =
							params[0] ?? Array.from(TerminalServer.transports.keys()).pop();
						const transport = TerminalServer.transports.get(id!);

						if (!transport) {
							this.logError('Transport not found');

							break;
						}

						try {
							const stats = await transport.getStats();

							this.logInfo(
								`transport.getStats():\n${JSON.stringify(stats, null, '  ')}`
							);
						} catch (error) {
							this.logError(`transport.getStats() failed: ${error}`);
						}

						break;
					}

					case 'sp':
					case 'statsProducer': {
						const id =
							params[0] ?? Array.from(TerminalServer.producers.keys()).pop();
						const producer = TerminalServer.producers.get(id!);

						if (!producer) {
							this.logError('Producer not found');

							break;
						}

						try {
							const stats = await producer.getStats();

							this.logInfo(
								`producer.getStats():\n${JSON.stringify(stats, null, '  ')}`
							);
						} catch (error) {
							this.logError(`producer.getStats() failed: ${error}`);
						}

						break;
					}

					case 'sc':
					case 'statsConsumer': {
						const id =
							params[0] ?? Array.from(TerminalServer.consumers.keys()).pop();
						const consumer = TerminalServer.consumers.get(id!);

						if (!consumer) {
							this.logError('Consumer not found');

							break;
						}

						try {
							const stats = await consumer.getStats();

							this.logInfo(
								`consumer.getStats():\n${JSON.stringify(stats, null, '  ')}`
							);
						} catch (error) {
							this.logError(`consumer.getStats() failed: ${error}`);
						}

						break;
					}

					case 'sdp':
					case 'statsDataProducer': {
						const id =
							params[0] ??
							Array.from(TerminalServer.dataProducers.keys()).pop();
						const dataProducer = TerminalServer.dataProducers.get(id!);

						if (!dataProducer) {
							this.logError('DataProducer not found');

							break;
						}

						try {
							const stats = await dataProducer.getStats();

							this.logInfo(
								`dataProducer.getStats():\n${JSON.stringify(stats, null, '  ')}`
							);
						} catch (error) {
							this.logError(`dataProducer.getStats() failed: ${error}`);
						}

						break;
					}

					case 'sdc':
					case 'statsDataConsumer': {
						const id =
							params[0] ??
							Array.from(TerminalServer.dataConsumers.keys()).pop();
						const dataConsumer = TerminalServer.dataConsumers.get(id!);

						if (!dataConsumer) {
							this.logError('DataConsumer not found');

							break;
						}

						try {
							const stats = await dataConsumer.getStats();

							this.logInfo(
								`dataConsumer.getStats():\n${JSON.stringify(stats, null, '  ')}`
							);
						} catch (error) {
							this.logError(`dataConsumer.getStats() failed: ${error}`);
						}

						break;
					}

					case 't':
					case 'terminal': {
						this.#isTerminalOpen = true;

						cmd.close();
						this.openTerminal();

						return;
					}

					default: {
						this.logError(`unknown command '${command}'`);
						this.logInfo(
							"press 'h' or 'help' to get the list of available commands"
						);
					}
				}

				readStdin();
			});
		};

		readStdin();
	}

	private openTerminal(): void {
		this.logInfo('\n[opening Node REPL Terminal...]');

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
			this.logInfo('\n[exiting Node REPL Terminal...]');

			this.#isTerminalOpen = false;

			this.openCommandConsole();
		});
	}

	private logInfo(msg: string): void {
		this.#socket.write(`${picocolors.green(msg)}\n`);
	}

	private logError(msg: string): void {
		this.#socket.write(
			`${picocolors.red(picocolors.bold('ERROR: '))}${picocolors.red(msg)}\n`
		);
	}
}

// Make maps global so they can be used during the REPL terminal.
global.workers = TerminalServer.workers;
global.routers = TerminalServer.routers;
global.transports = TerminalServer.transports;
global.producers = TerminalServer.producers;
global.consumers = TerminalServer.consumers;
global.dataProducers = TerminalServer.dataProducers;
global.dataConsumers = TerminalServer.dataConsumers;
