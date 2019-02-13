const repl = require('repl');
const readline = require('readline');
const mediasoup = require('mediasoup');
const colors = require('colors/safe');
const pidusage = require('pidusage');

// Maps to store all mediasoup objects.
const workers = new Map();
const routers = new Map();
const transports = new Map();
const producers = new Map();
const consumers = new Map();

let isTerminalOpen = false;

module.exports = function()
{
	// Run the mediasoup observer API.
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

	// Make maps global so they can be used during the REPL terminal.
	global.workers = workers;
	global.routers = routers;
	global.transports = transports;
	global.producers = producers;
	global.consumers = consumers;

	// Open the command console.
	openCommandConsole();
};

function openCommandConsole()
{
	stdinLog('\n[opening Readline Command Console...]');
	stdinLog('type help to print available commands');

	const cmd = readline.createInterface(
		{
			input  : process.stdin,
			output : process.stdout
		});

	cmd.on('close', () =>
	{
		if (isTerminalOpen)
			return;

		stdinLog('\nexiting...');

		process.exit();
	});

	readStdin();

	function readStdin()
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
					stdinLog('');
					stdinLog('available commands:');
					stdinLog('- h,  help                : show this message');
					stdinLog('- usage                   : show CPU and memory usage of the Node.js and mediasoup-worker processes');
					stdinLog('- logLevel level          : changes logLevel in all mediasoup Workers');
					stdinLog('- logTags [tag] [tag] ... : changes logTags in all mediasoup Workers (values separated by space)"');
					stdinLog('- dw, dumpWorker [pid]    : dump mediasoup Worker with given pid (or the latest created one)');
					stdinLog('- dr, dumpRouter [id]     : dump mediasoup Router with given id (or the latest created one)');
					stdinLog('- dt, dumpTransport [id]  : dump mediasoup Transport with given id (or the latest created one)');
					stdinLog('- dp, dumpProducer [id]   : dump mediasoup Producer with given id (or the latest created one)');
					stdinLog('- dc, dumpConsumer [id]   : dump mediasoup Consumer with given id (or the latest created one)');
					stdinLog('- t,  terminal            : open Node REPL Terminal');
					stdinLog('');
					readStdin();

					break;
				}

				case 'u':
				case 'usage':
				{
					let usage = await pidusage(process.pid);

					stdinLog(`Node.js process [pid:${process.pid}]:\n${JSON.stringify(usage, null, '  ')}`);

					for (const worker of workers.values())
					{
						usage = await pidusage(worker.pid);

						stdinLog(`mediasoup-worker process [pid:${worker.pid}]:\n${JSON.stringify(usage, null, '  ')}`);
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

						stdinLog('done');
					}
					catch (error)
					{
						stdinError(String(error));
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

						stdinLog('done');
					}
					catch (error)
					{
						stdinError(String(error));
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
						stdinError('Worker not found');

						break;
					}

					try
					{
						const dump = await worker.dump();

						stdinLog(`worker.dump():\n${JSON.stringify(dump, null, '  ')}`);
					}
					catch (error)
					{
						stdinError(`worker.dump() failed: ${error}`);
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
						stdinError('Router not found');

						break;
					}

					try
					{
						const dump = await router.dump();

						stdinLog(`router.dump():\n${JSON.stringify(dump, null, '  ')}`);
					}
					catch (error)
					{
						stdinError(`router.dump() failed: ${error}`);
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
						stdinError('Transport not found');

						break;
					}

					try
					{
						const dump = await transport.dump();

						stdinLog(`transport.dump():\n${JSON.stringify(dump, null, '  ')}`);
					}
					catch (error)
					{
						stdinError(`transport.dump() failed: ${error}`);
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
						stdinError('Producer not found');

						break;
					}

					try
					{
						const dump = await producer.dump();

						stdinLog(`producer.dump():\n${JSON.stringify(dump, null, '  ')}`);
					}
					catch (error)
					{
						stdinError(`producer.dump() failed: ${error}`);
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
						stdinError('Consumer not found');

						break;
					}

					try
					{
						const dump = await consumer.dump();

						stdinLog(`consumer.dump():\n${JSON.stringify(dump, null, '  ')}`);
					}
					catch (error)
					{
						stdinError(`consumer.dump() failed: ${error}`);
					}

					break;
				}

				case 't':
				case 'terminal':
				{
					isTerminalOpen = true;

					cmd.close();
					openTerminal();

					break;
				}

				default:
				{
					stdinError(`unknown command '${command}'`);
					stdinLog('press \'h\' or \'help\' to get the list of available commands');
				}
			}

			readStdin();
		});
	}
}

function openTerminal()
{
	stdinLog('\n[opening Node REPL Terminal...]');
	stdinLog('here you have access to workers, routers, transports, producers and consumers ES6 maps');

	const terminal = repl.start(
		{
			prompt          : 'terminal> ',
			useColors       : true,
			useGlobal       : true,
			ignoreUndefined : false
		});

	isTerminalOpen = true;

	terminal.on('exit', () =>
	{
		stdinLog('\n[exiting Node REPL Terminal...]');

		isTerminalOpen = false;

		openCommandConsole();
	});
}

function stdinLog(msg)
{
	// eslint-disable-next-line no-console
	console.log(colors.green(msg));
}

function stdinError(msg)
{
	// eslint-disable-next-line no-console
	console.error(colors.red.bold('ERROR: ') + colors.red(msg));
}
