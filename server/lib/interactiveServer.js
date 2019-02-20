const repl = require('repl');
const readline = require('readline');
const net = require('net');
const fs = require('fs');
const mediasoup = require('mediasoup');
const colors = require('colors/safe');
const pidusage = require('pidusage');

// Maps to store all mediasoup objects.
const workers = new Map();
const routers = new Map();
const transports = new Map();
const producers = new Map();
const consumers = new Map();

const SOCKET_PATH = '/tmp/mediasoup-demo.sock';

class Interactive
{
	constructor(socket)
	{
		this._socket = socket;

		this._isTerminalOpen = false;
	}

	openCommandConsole()
	{
		this.log('\n[opening Readline Command Console...]');
		this.log('type help to print available commands');

		const cmd = readline.createInterface(
			{
				input    : this._socket,
				output   : this._socket,
				terminal : true
			});

		cmd.on('close', () =>
		{
			if (this._isTerminalOpen)
				return;

			this.log('\nexiting...');

			this._socket.end();
		});

		const readStdin = () =>
		{
			cmd.question('cmd> ', async (input) =>
			{
				const params = input.split(/[\s\t]+/);
				const command = params.shift();

				switch (command)
				{
					case '':
					{
						readStdin();
						break;
					}

					case 'h':
					case 'help':
					{
						this.log('');
						this.log('available commands:');
						this.log('- h,  help                : show this message');
						this.log('- usage                   : show CPU and memory usage of the Node.js and mediasoup-worker processes');
						this.log('- logLevel level          : changes logLevel in all mediasoup Workers');
						this.log('- logTags [tag] [tag] ... : changes logTags in all mediasoup Workers (values separated by space)"');
						this.log('- dw, dumpWorker [pid]    : dump mediasoup Worker with given pid (or the latest created one)');
						this.log('- dr, dumpRouter [id]     : dump mediasoup Router with given id (or the latest created one)');
						this.log('- dt, dumpTransport [id]  : dump mediasoup Transport with given id (or the latest created one)');
						this.log('- dp, dumpProducer [id]   : dump mediasoup Producer with given id (or the latest created one)');
						this.log('- dc, dumpConsumer [id]   : dump mediasoup Consumer with given id (or the latest created one)');
						this.log('- t,  terminal            : open Node REPL Terminal');
						this.log('');
						readStdin();

						break;
					}

					case 'u':
					case 'usage':
					{
						let usage = await pidusage(process.pid);

						this.log(`Node.js process [pid:${process.pid}]:\n${JSON.stringify(usage, null, '  ')}`);

						for (const worker of workers.values())
						{
							usage = await pidusage(worker.pid);

							this.log(`mediasoup-worker process [pid:${worker.pid}]:\n${JSON.stringify(usage, null, '  ')}`);
						}

						break;
					}

					case 'logLevel':
					{
						const level = params[0];
						const promises = [];

						for (const worker of workers.values())
						{
							promises.push(worker.updateSettings({ logLevel: level }));
						}

						try
						{
							await Promise.all(promises);

							this.log('done');
						}
						catch (error)
						{
							this.error(String(error));
						}

						break;
					}

					case 'logTags':
					{
						const tags = params;
						const promises = [];

						for (const worker of workers.values())
						{
							promises.push(worker.updateSettings({ logTags: tags }));
						}

						try
						{
							await Promise.all(promises);

							this.log('done');
						}
						catch (error)
						{
							this.error(String(error));
						}

						break;
					}

					case 'dw':
					case 'dumpWorker':
					{
						const pid = params[0] || Array.from(workers.keys()).pop();
						const worker = workers.get(Number(pid));

						if (!worker)
						{
							this.error('Worker not found');

							break;
						}

						try
						{
							const dump = await worker.dump();

							this.log(`worker.dump():\n${JSON.stringify(dump, null, '  ')}`);
						}
						catch (error)
						{
							this.error(`worker.dump() failed: ${error}`);
						}

						break;
					}

					case 'dr':
					case 'dumpRouter':
					{
						const id = params[0] || Array.from(routers.keys()).pop();
						const router = routers.get(id);

						if (!router)
						{
							this.error('Router not found');

							break;
						}

						try
						{
							const dump = await router.dump();

							this.log(`router.dump():\n${JSON.stringify(dump, null, '  ')}`);
						}
						catch (error)
						{
							this.error(`router.dump() failed: ${error}`);
						}

						break;
					}

					case 'dt':
					case 'dumpTransport':
					{
						const id = params[0] || Array.from(transports.keys()).pop();
						const transport = transports.get(id);

						if (!transport)
						{
							this.error('Transport not found');

							break;
						}

						try
						{
							const dump = await transport.dump();

							this.log(`transport.dump():\n${JSON.stringify(dump, null, '  ')}`);
						}
						catch (error)
						{
							this.error(`transport.dump() failed: ${error}`);
						}

						break;
					}

					case 'dp':
					case 'dumpProducer':
					{
						const id = params[0] || Array.from(producers.keys()).pop();
						const producer = producers.get(id);

						if (!producer)
						{
							this.error('Producer not found');

							break;
						}

						try
						{
							const dump = await producer.dump();

							this.log(`producer.dump():\n${JSON.stringify(dump, null, '  ')}`);
						}
						catch (error)
						{
							this.error(`producer.dump() failed: ${error}`);
						}

						break;
					}

					case 'dc':
					case 'dumpConsumer':
					{
						const id = params[0] || Array.from(consumers.keys()).pop();
						const consumer = consumers.get(id);

						if (!consumer)
						{
							this.error('Consumer not found');

							break;
						}

						try
						{
							const dump = await consumer.dump();

							this.log(`consumer.dump():\n${JSON.stringify(dump, null, '  ')}`);
						}
						catch (error)
						{
							this.error(`consumer.dump() failed: ${error}`);
						}

						break;
					}

					case 't':
					case 'terminal':
					{
						this._isTerminalOpen = true;

						cmd.close();
						this.openTerminal();

						return;
					}

					default:
					{
						this.error(`unknown command '${command}'`);
						this.log('press \'h\' or \'help\' to get the list of available commands');
					}
				}

				readStdin();
			});
		};

		readStdin();
	}

	openTerminal()
	{
		this.log('\n[opening Node REPL Terminal...]');
		this.log('here you have access to workers, routers, transports, producers and consumers ES6 maps');

		const terminal = repl.start(
			{
				input           : this._socket,
				output          : this._socket,
				terminal        : true,
				prompt          : 'terminal> ',
				useColors       : true,
				useGlobal       : true,
				ignoreUndefined : false
			});

		this._isTerminalOpen = true;

		terminal.on('exit', () =>
		{
			this.log('\n[exiting Node REPL Terminal...]');

			this._isTerminalOpen = false;

			this.openCommandConsole();
		});
	}

	log(msg)
	{
		this._socket.write(`${colors.green(msg)}\n`);
	}

	error(msg)
	{
		this._socket.write(`${colors.red.bold('ERROR: ')}${colors.red(msg)}\n`);
	}
}

function runMediasoupObserver()
{
	mediasoup.observer.on('observer:newworker', (worker) =>
	{
		// Store the latest worker in a global variable.
		global.worker = worker;

		workers.set(worker.pid, worker);
		worker.on('observer:close', () => workers.delete(worker.pid));

		worker.on('observer:newrouter', (router) =>
		{
			// Store the latest router in a global variable.
			global.router = router;

			routers.set(router.id, router);
			router.on('observer:close', () => routers.delete(router.id));

			router.on('observer:newtransport', (transport) =>
			{
				// Store the latest transport in a global variable.
				global.transport = transport;

				transports.set(transport.id, transport);
				transport.on('observer:close', () => transports.delete(transport.id));

				transport.on('observer:newproducer', (producer) =>
				{
					// Store the latest producer in a global variable.
					global.producer = producer;

					producers.set(producer.id, producer);
					producer.on('observer:close', () => producers.delete(producer.id));
				});

				transport.on('observer:newconsumer', (consumer) =>
				{
					// Store the latest consumer in a global variable.
					global.consumer = consumer;

					consumers.set(consumer.id, consumer);
					consumer.on('observer:close', () => consumers.delete(consumer.id));
				});
			});
		});
	});
}

module.exports = async function()
{
	// Run the mediasoup observer API.
	runMediasoupObserver();

	// Make maps global so they can be used during the REPL terminal.
	global.workers = workers;
	global.routers = routers;
	global.transports = transports;
	global.producers = producers;
	global.consumers = consumers;

	const server = net.createServer((socket) =>
	{
		const interactive = new Interactive(socket);

		interactive.openCommandConsole();
	});

	await new Promise((resolve) =>
	{
		try { fs.unlinkSync(SOCKET_PATH); }
		catch (error) {}

		server.listen(SOCKET_PATH, resolve);
	});
};
