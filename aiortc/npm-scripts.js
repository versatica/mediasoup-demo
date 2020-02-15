const process = require('process');
const fs = require('fs');
const { execSync } = require('child_process');
const { version } = require('./package.json');

const task = process.argv.slice(2).join(' ');

// eslint-disable-next-line no-console
console.log(`npm-scripts.js [INFO] running task "${task}"`);

switch (task)
{
	case 'typescript:build':
	{
		execute('rm -rf lib');
		execute('tsc');

		break;
	}

	case 'typescript:watch':
	{
		const TscWatchClient = require('tsc-watch/client');

		execute('rm -rf lib');

		const watch = new TscWatchClient();

		watch.start('--pretty');

		break;
	}

	case 'lint':
	{
		execute('MEDIASOUP_NODE_LANGUAGE=typescript eslint -c .eslintrc.js --ext=ts src/');

		break;
	}

	case 'lint:fix':
	{
		execute('MEDIASOUP_NODE_LANGUAGE=typescript eslint -c .eslintrc.js --fix --ext=ts src/');

		break;
	}

	default:
	{
		throw new TypeError(`unknown task "${task}"`);
	}
}

function execute(command)
{
	// eslint-disable-next-line no-console
	console.log(`npm-scripts.js [INFO] executing command: ${command}`);

	try
	{
		execSync(command,	{ stdio: [ 'ignore', process.stdout, process.stderr ] });
	}
	catch (error)
	{
		process.exit(1);
	}
}
