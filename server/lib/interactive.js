const mediasoup = require('mediasoup');
const readline = require('readline');
const colors = require('colors/safe');
const repl = require('repl');

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
			const args = input.split(/[\s\t]+/);
			const command = args[0];
			const param = args[1];

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
					stdinLog('- h,  help               : show this message');
					stdinLog('- wd, workerdump [pid]   : dump mediasoup Worker with given pid (or the latest created one)');
					stdinLog('- rd, routerdump [id]    : dump mediasoup Router with given id (or the latest created one)');
					stdinLog('- td, transportdump [id] : dump mediasoup Transport with given id (or the latest created one)');
					stdinLog('- pd, producerdump [id]  : dump mediasoup Producer with given id (or the latest created one)');
					stdinLog('- cd, consumerdump [id]  : dump mediasoup Consumer with given id (or the latest created one)');
					stdinLog('- t,  terminal           : open REPL Terminal');
					stdinLog('');
					readStdin();

					break;
				}

				case 'wd':
				case 'workerdump':
				{
					const pid = param || Array.from(workers.keys()).pop();
					const worker = workers.get(Number(pid));

					if (!worker)
					{
						stdinError('Worker not found');
						readStdin();
						break;
					}

					try
					{
						const dump = await worker.dump();

						stdinLog(`worker.dump():\n${JSON.stringify(dump, null, '  ')}`);
						readStdin();
					}
					catch (error)
					{
						stdinError(`worker.dump() failed: ${error}`);
						readStdin();
					}

					break;
				}

				case 'rd':
				case 'routerdump':
				{
					const id = param || Array.from(routers.keys()).pop();
					const router = routers.get(id);

					if (!router)
					{
						stdinError('Router not found');
						readStdin();
						break;
					}

					try
					{
						const dump = await router.dump();

						stdinLog(`router.dump():\n${JSON.stringify(dump, null, '  ')}`);
						readStdin();
					}
					catch (error)
					{
						stdinError(`router.dump() failed: ${error}`);
						readStdin();
					}

					break;
				}

				case 'td':
				case 'transportdump':
				{
					const id = param || Array.from(transports.keys()).pop();
					const transport = transports.get(id);

					if (!transport)
					{
						stdinError('Transport not found');
						readStdin();
						break;
					}

					try
					{
						const dump = await transport.dump();

						stdinLog(`transport.dump():\n${JSON.stringify(dump, null, '  ')}`);
						readStdin();
					}
					catch (error)
					{
						stdinError(`transport.dump() failed: ${error}`);
						readStdin();
					}

					break;
				}

				case 'pd':
				case 'producerdump':
				{
					const id = param || Array.from(producers.keys()).pop();
					const producer = producers.get(id);

					if (!producer)
					{
						stdinError('Producer not found');
						readStdin();
						break;
					}

					try
					{
						const dump = await producer.dump();

						stdinLog(`producer.dump():\n${JSON.stringify(dump, null, '  ')}`);
						readStdin();
					}
					catch (error)
					{
						stdinError(`producer.dump() failed: ${error}`);
						readStdin();
					}

					break;
				}

				case 'cd':
				case 'consumerdump':
				{
					const id = param || Array.from(consumers.keys()).pop();
					const consumer = consumers.get(id);

					if (!consumer)
					{
						stdinError('Consumer not found');
						readStdin();
						break;
					}

					try
					{
						const dump = await consumer.dump();

						stdinLog(`consumer.dump():\n${JSON.stringify(dump, null, '  ')}`);
						readStdin();
					}
					catch (error)
					{
						stdinError(`consumer.dump() failed: ${error}`);
						readStdin();
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

					readStdin();
				}
			}
		});
	}
}

function openTerminal()
{
	stdinLog('\n[opening REPL Terminal...]');
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
		stdinLog('\n[exiting REPL Terminal...]');

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
