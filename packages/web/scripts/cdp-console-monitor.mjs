#!/usr/bin/env node
/**
 * Chrome DevTools Protocol Console Monitor
 *
 * Connects to Chrome on Android via ADB port forwarding and streams
 * console messages (log, warn, error, info, debug) for agent monitoring.
 *
 * Prerequisites:
 *   adb forward tcp:9222 localabstract:chrome_devtools_remote
 *
 * Usage:
 *   node cdp-console-monitor.mjs                    # Interactive tab selection
 *   node cdp-console-monitor.mjs --tab <id>         # Connect to specific tab
 *   node cdp-console-monitor.mjs --url <pattern>    # Find tab by URL pattern
 *   node cdp-console-monitor.mjs --list             # List available tabs
 *   node cdp-console-monitor.mjs --production       # Connect to production tab
 *   node cdp-console-monitor.mjs --local            # Connect to localhost tab
 */

import { WebSocket } from 'ws';

const CDP_PORT = 9222;
const CDP_HOST = 'localhost';

// ANSI colors for console output
const colors = {
	reset: '\x1b[0m',
	red: '\x1b[31m',
	yellow: '\x1b[33m',
	blue: '\x1b[34m',
	cyan: '\x1b[36m',
	gray: '\x1b[90m',
	white: '\x1b[37m',
	bold: '\x1b[1m',
	green: '\x1b[32m',
};

const logLevelColors = {
	log: colors.white,
	info: colors.blue,
	warn: colors.yellow,
	error: colors.red,
	debug: colors.gray,
	verbose: colors.gray,
};

// Tab URL patterns for environment detection
const URL_PATTERNS = {
	production: 'dicee\\.games',
	local: 'localhost|192\\.168\\.',
	dicee: 'dicee|localhost:5173|192\\.168.*:5173',
};

async function listTabs() {
	const response = await fetch(`http://${CDP_HOST}:${CDP_PORT}/json`);
	const tabs = await response.json();
	return tabs.filter((t) => t.type === 'page');
}

async function printTabs(tabs) {
	console.log(`\n${colors.cyan}${colors.bold}Available Chrome Tabs:${colors.reset}\n`);
	for (const tab of tabs) {
		const urlShort = tab.url.length > 60 ? `${tab.url.substring(0, 60)}...` : tab.url;
		console.log(`  ${colors.yellow}[${tab.id}]${colors.reset} ${tab.title || '(no title)'}`);
		console.log(`        ${colors.gray}${urlShort}${colors.reset}`);
	}
	console.log('');
}

function formatValue(value) {
	if (value === undefined) return 'undefined';
	if (value === null) return 'null';
	if (typeof value === 'object') {
		try {
			return JSON.stringify(value, null, 2);
		} catch {
			return String(value);
		}
	}
	return String(value);
}

/** Format a single CDP argument to string (extracted for complexity reduction) */
function formatCDPArg(arg) {
	// Primitive types
	if (arg.type === 'string') return arg.value;
	if (arg.type === 'number') return arg.value;
	if (arg.type === 'boolean') return arg.value;
	if (arg.type === 'undefined') return 'undefined';

	// Object with preview
	if (arg.type === 'object' && arg.preview) {
		return formatObjectPreview(arg);
	}

	// Fallback
	return arg.description || formatValue(arg.value) || '[unknown]';
}

/** Format object preview from CDP (extracted helper) */
function formatObjectPreview(arg) {
	if (arg.preview.type === 'object') {
		const props = arg.preview.properties || [];
		const obj = Object.fromEntries(props.map((p) => [p.name, p.value]));
		return JSON.stringify(obj);
	}
	return arg.preview.description || arg.description || '[object]';
}

function formatConsoleMessage(params) {
	const { type, args, timestamp, stackTrace } = params;
	const color = logLevelColors[type] || colors.white;
	const time = new Date(timestamp).toISOString().split('T')[1].replace('Z', '');

	const message = args.map(formatCDPArg).join(' ');

	const typeLabel = type.toUpperCase().padEnd(5);
	let output = `${colors.gray}${time}${colors.reset} ${color}${typeLabel}${colors.reset} ${message}`;

	if (stackTrace?.callFrames?.length > 0) {
		const frame = stackTrace.callFrames[0];
		output += `\n${colors.gray}        at ${frame.functionName || '(anonymous)'} (${frame.url}:${frame.lineNumber}:${frame.columnNumber})${colors.reset}`;
	}

	return output;
}

function formatRuntimeException(params) {
	const { exceptionDetails } = params;
	if (!exceptionDetails) return null;

	const { exception, text, lineNumber, columnNumber, url, stackTrace } = exceptionDetails;

	let output = `${colors.red}${colors.bold}EXCEPTION${colors.reset} `;

	if (exception?.description) {
		output += exception.description;
	} else if (text) {
		output += text;
	}

	if (url) {
		output += `\n${colors.gray}        at ${url}:${lineNumber}:${columnNumber}${colors.reset}`;
	}

	if (stackTrace?.callFrames) {
		for (const frame of stackTrace.callFrames.slice(0, 5)) {
			output += `\n${colors.gray}        at ${frame.functionName || '(anonymous)'} (${frame.url}:${frame.lineNumber}:${frame.columnNumber})${colors.reset}`;
		}
	}

	return output;
}

async function connectToTab(tabId, wsUrl) {
	console.log(`${colors.cyan}Connecting to tab ${tabId}...${colors.reset}`);

	const ws = new WebSocket(wsUrl);
	let messageId = 1;

	const send = (method, params = {}) => {
		const id = messageId++;
		ws.send(JSON.stringify({ id, method, params }));
		return id;
	};

	ws.on('open', () => {
		console.log(
			`${colors.green}${colors.bold}Connected!${colors.reset} Monitoring console output...\n`,
		);
		console.log(`${colors.gray}Press Ctrl+C to stop${colors.reset}\n`);
		console.log('─'.repeat(80));

		// Enable Runtime domain to get console messages
		send('Runtime.enable');
		// Enable Console domain for additional messages
		send('Console.enable');
		// Enable Log domain for browser-level logs
		send('Log.enable');
	});

	ws.on('message', (data) => {
		try {
			const message = JSON.parse(data.toString());
			handleCDPMessage(message);
		} catch {
			// Ignore parse errors for non-JSON messages
		}
	});

	ws.on('error', (err) => {
		console.error(`${colors.red}WebSocket error: ${err.message}${colors.reset}`);
	});

	ws.on('close', () => {
		console.log(`\n${colors.yellow}Connection closed${colors.reset}`);
		process.exit(0);
	});

	// Handle Ctrl+C gracefully
	process.on('SIGINT', () => {
		console.log(`\n${colors.cyan}Disconnecting...${colors.reset}`);
		ws.close();
	});
}

/** Handle incoming CDP message (extracted for clarity) */
function handleCDPMessage(message) {
	// Handle console.log/warn/error/etc via Runtime.consoleAPICalled
	if (message.method === 'Runtime.consoleAPICalled') {
		console.log(formatConsoleMessage(message.params));
		return;
	}

	// Handle uncaught exceptions
	if (message.method === 'Runtime.exceptionThrown') {
		const output = formatRuntimeException(message.params);
		if (output) console.log(output);
		return;
	}

	// Handle Console.messageAdded (legacy)
	if (message.method === 'Console.messageAdded') {
		const { message: msg } = message.params;
		const color = logLevelColors[msg.level] || colors.white;
		console.log(`${color}[Console] ${msg.text}${colors.reset}`);
		return;
	}

	// Handle Log.entryAdded (browser logs)
	if (message.method === 'Log.entryAdded') {
		const { entry } = message.params;
		const color = logLevelColors[entry.level] || colors.white;
		console.log(`${color}[Browser] ${entry.text}${colors.reset}`);
	}
}

function findTabByUrl(tabs, pattern) {
	const regex = new RegExp(pattern, 'i');
	return tabs.find((t) => regex.test(t.url));
}

/** Verify CDP connection is available */
async function verifyCDPConnection() {
	try {
		await fetch(`http://${CDP_HOST}:${CDP_PORT}/json/version`);
		return true;
	} catch {
		console.error(`${colors.red}Cannot connect to Chrome DevTools at port ${CDP_PORT}`);
		console.error(`\nMake sure ADB port forwarding is set up:`);
		console.error(`  adb forward tcp:9222 localabstract:chrome_devtools_remote${colors.reset}`);
		return false;
	}
}

/** Find target tab based on command line arguments */
function resolveTargetTab(args, tabs) {
	if (args.includes('--production')) {
		return findTabByUrl(tabs, URL_PATTERNS.production);
	}

	if (args.includes('--local')) {
		return findTabByUrl(tabs, URL_PATTERNS.local);
	}

	if (args.includes('--tab')) {
		const tabIndex = args.indexOf('--tab');
		const tabId = args[tabIndex + 1];
		return tabs.find((t) => t.id === tabId);
	}

	if (args.includes('--url')) {
		const urlIndex = args.indexOf('--url');
		const pattern = args[urlIndex + 1];
		return findTabByUrl(tabs, pattern);
	}

	// Default: try to auto-select dicee tab
	return findTabByUrl(tabs, URL_PATTERNS.dicee);
}

/** Show error for missing tab and exit */
async function handleMissingTab(tabs, message) {
	console.error(`${colors.red}${message}${colors.reset}`);
	await printTabs(tabs);
	process.exit(1);
}

async function main() {
	const args = process.argv.slice(2);

	// Verify CDP is accessible
	if (!(await verifyCDPConnection())) {
		process.exit(1);
	}

	const tabs = await listTabs();

	if (tabs.length === 0) {
		console.error(`${colors.red}No Chrome tabs found on device${colors.reset}`);
		process.exit(1);
	}

	// Handle --list flag
	if (args.includes('--list')) {
		await printTabs(tabs);
		process.exit(0);
	}

	// Resolve target tab
	const targetTab = resolveTargetTab(args, tabs);

	if (!targetTab) {
		// Determine appropriate error message
		if (args.includes('--production')) {
			await handleMissingTab(tabs, 'No production tab found (dicee.games)');
		} else if (args.includes('--local')) {
			await handleMissingTab(tabs, 'No localhost/local network tab found');
		} else if (args.includes('--tab')) {
			const tabId = args[args.indexOf('--tab') + 1];
			await handleMissingTab(tabs, `Tab ${tabId} not found`);
		} else if (args.includes('--url')) {
			const pattern = args[args.indexOf('--url') + 1];
			await handleMissingTab(tabs, `No tab matching "${pattern}" found`);
		} else {
			// Default mode - just show usage
			await printTabs(tabs);
			console.log(`${colors.yellow}Usage: node cdp-console-monitor.mjs --tab <id>${colors.reset}`);
			process.exit(0);
		}
	}

	// Connect to target tab
	console.log(`\n${colors.cyan}${colors.bold}Target:${colors.reset} ${targetTab.title}`);
	console.log(`${colors.gray}URL: ${targetTab.url}${colors.reset}\n`);

	await connectToTab(targetTab.id, targetTab.webSocketDebuggerUrl);
}

main().catch((err) => {
	console.error(`${colors.red}Error: ${err.message}${colors.reset}`);
	process.exit(1);
});
