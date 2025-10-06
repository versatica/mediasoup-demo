#!/usr/bin/env node

import * as process from 'node:process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { execSync } from 'node:child_process';
import pkg from './package.json' with { type: 'json' };

const RELEASE_BRANCH = 'v3';
const RELEASE_TASK_IMPLEMENTED = false;

// Paths for ESLint to check. Converted to string for convenience.
const ESLINT_PATHS = [
	'eslint.config.mjs',
	'npm-scripts.mjs',
	'config.example.mjs',
	fs.existsSync('config.mjs') ? 'config.mjs' : undefined,
	'src',
]
	.filter(Boolean)
	.join(' ');

// Paths for ESLint to ignore. Converted to string argument for convenience.
const ESLINT_IGNORE_PATTERN_ARGS = []
	.map(entry => `--ignore-pattern ${entry}`)
	.join(' ');

// Paths for Prettier to check/write. Converted to string for convenience.
// NOTE: Prettier ignores paths in .gitignore so we don't need to care about
// node/src/fbs.
const PRETTIER_PATHS = [
	'README.md',
	'eslint.config.mjs',
	'npm-scripts.mjs',
	'package.json',
	'tsconfig.json',
	'tsconfig.config.example.mjs.json',
	'tsconfig.config.mjs.json',
	'config.example.mjs',
	fs.existsSync('config.mjs') ? 'config.mjs' : undefined,
	'src',
]
	.filter(Boolean)
	.join(' ');

// Paths for Nodemon to watch.
const NODEMON_WATCH_PATHS = [
	'tsconfig.json',
	fs.existsSync('config.mjs') ? 'config.mjs' : undefined,
	'src',
]
	.filter(Boolean)
	.map(item => `--watch ${item}`)
	.join(' ');

const task = process.argv[2];
const taskArgs = process.argv.slice(3).join(' ');

void run();

async function run() {
	logInfo(taskArgs ? `[args:"${taskArgs}"]` : '');

	switch (task) {
		// As per NPM documentation (https://docs.npmjs.com/cli/v9/using-npm/scripts)
		// `prepare` script:
		//
		// - Runs BEFORE the package is packed, i.e. during `npm publish` and
		//   `npm pack`.
		// - Runs on local `npm install` without any arguments.
		// - NOTE: If a package being installed through git contains a `prepare`
		//   script, its dependencies and devDependencies will be installed, and
		//   the `prepare` script will be run, before the package is packaged and
		//   installed.
		//
		// So here we compile TypeScript to JavaScript.
		case 'prepare': {
			buildTypescript({ force: false });

			break;
		}

		case 'typescript:build': {
			buildTypescript({ force: true });

			break;
		}

		case 'typescript:watch': {
			watchTypescript();

			break;
		}

		case 'lint': {
			lint();

			break;
		}

		case 'format': {
			format();

			break;
		}

		case 'release:check': {
			checkRelease();

			break;
		}

		case 'release': {
			release();

			break;
		}

		case 'watch': {
			watch();

			break;
		}

		default: {
			logError('unknown task');

			exitWithError();
		}
	}
}

function deleteLib() {
	if (!fs.existsSync('lib')) {
		return;
	}

	logInfo('deleteLib()');

	fs.rmSync('lib', { recursive: true, force: true });
}

function buildTypescript({ force }) {
	if (!force && fs.existsSync('lib')) {
		return;
	}

	logInfo('buildTypescript()');

	deleteLib();

	// Generate .js CommonJS code and .d.ts TypeScript declaration files in lib/.
	executeCmd(`tsc ${taskArgs}`);

	// Give execution permission to lib/index.js.
	if (process.platform !== 'win32') {
		const indexPath = path.resolve('lib', 'index.js');
		const connectTerminalPath = path.resolve('lib', 'connect-terminal.js');

		fs.chmodSync(indexPath, 0o755);
		fs.chmodSync(connectTerminalPath, 0o755);
	}
}

function watchTypescript() {
	logInfo('watchTypescript()');

	deleteLib();

	executeCmd(`tsc --watch --noEmit ${taskArgs}`);
}

function lint() {
	logInfo('lint()');

	// Ensure there are no rules that are unnecessary or conflict with Prettier
	// rules.
	executeCmd('eslint-config-prettier eslint.config.mjs');

	executeCmd(
		`eslint -c eslint.config.mjs --max-warnings 0 ${ESLINT_IGNORE_PATTERN_ARGS} ${ESLINT_PATHS}`
	);

	executeCmd(`prettier --check ${PRETTIER_PATHS}`);

	// Validate config.example.mjs at TypeScript level.
	executeCmd(
		`tsc --project tsconfig.config.example.mjs.json --noEmit ${taskArgs}`
	);

	// Validate config.mjs at TypeScript level if it exists.
	if (fs.existsSync('config.mjs')) {
		executeCmd(`tsc --project tsconfig.config.mjs.json --noEmit ${taskArgs}`);
	}
}

function format() {
	logInfo('format()');

	executeCmd(`prettier --write ${PRETTIER_PATHS}`);
}

function installDeps() {
	logInfo('installDeps()');

	// Install/update deps.
	executeCmd('npm ci --ignore-scripts');

	// Update package-lock.json.
	executeCmd('npm install --package-lock-only --ignore-scripts');

	// Check vulnerabilities in deps.
	executeCmd('npm audit');
}

function checkRelease() {
	logInfo('checkRelease()');

	installDeps();
	buildTypescript({ force: true });
	lint();
}

function release() {
	logInfo('release()');

	if (!RELEASE_TASK_IMPLEMENTED) {
		logError('release task not yet implemented');

		exitWithError();
	}

	checkRelease();
	executeCmd(`git commit -am '${pkg.version}'`);
	executeCmd(`git tag -a ${pkg.version} -m '${pkg.version}'`);
	executeCmd(`git push origin ${RELEASE_BRANCH}`);
	executeCmd(`git push origin '${pkg.version}'`);
	executeInteractiveCmd('npm publish');
}

function watch() {
	logInfo('watch()');

	executeInteractiveCmd(
		`cross-env NODE_ENV=debug nodemon ${NODEMON_WATCH_PATHS} -e ts,mjs,json --exec tsx src/index.ts`
	);
}

function executeCmd(command) {
	logInfo(`executeCmd(): ${command}`);

	try {
		execSync(command, { stdio: ['ignore', process.stdout, process.stderr] });
	} catch (error) {
		logError(`executeCmd() failed, exiting: ${error}`);

		exitWithError();
	}
}

function executeInteractiveCmd(command) {
	logInfo(`executeInteractiveCmd(): ${command}`);

	try {
		execSync(command, { stdio: 'inherit', env: process.env });
	} catch (error) {
		logError(`executeInteractiveCmd() failed, exiting: ${error}`);

		exitWithError();
	}
}

function logInfo(...args) {
	// eslint-disable-next-line no-console
	console.log(`npm-scripts.mjs \x1b[36m[INFO] [${task}]\x1b[0m`, ...args);
}

// eslint-disable-next-line no-unused-vars
function logWarn(...args) {
	// eslint-disable-next-line no-console
	console.warn(`npm-scripts.mjs \x1b[33m[WARN] [${task}]\x1b\0m`, ...args);
}

function logError(...args) {
	// eslint-disable-next-line no-console
	console.error(`npm-scripts.mjs \x1b[31m[ERROR] [${task}]\x1b[0m`, ...args);
}

function exitWithError() {
	process.exit(1);
}
