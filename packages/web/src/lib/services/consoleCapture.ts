/**
 * Console/Error Capture Service
 *
 * Captures console output and errors for bug reports.
 * Buffers last 30 entries to manage memory usage.
 */

const BUFFER_SIZE = 30;
let consoleBuffer: string[] = [];
let initialized = false;

// Store original console methods
const originalConsole = {
	log: console.log,
	warn: console.warn,
	error: console.error,
	info: console.info,
};

function addToConsoleBuffer(level: string, ...args: unknown[]): void {
	const timestamp = new Date().toISOString();
	const message = args
		.map((arg) => {
			if (typeof arg === 'object') {
				try {
					return JSON.stringify(arg, null, 2);
				} catch {
					return '[Object]';
				}
			}
			return String(arg);
		})
		.join(' ');

	const entry = `[${timestamp}] ${level.toUpperCase()}: ${message}`;

	consoleBuffer.push(entry);

	if (consoleBuffer.length > BUFFER_SIZE) {
		consoleBuffer.shift();
	}
}

export function initializeConsoleCapture(): void {
	if (initialized) return;

	// Override console methods
	console.log = (...args) => {
		originalConsole.log(...args);
		addToConsoleBuffer('log', ...args);
	};

	console.warn = (...args) => {
		originalConsole.warn(...args);
		addToConsoleBuffer('warn', ...args);
	};

	console.error = (...args) => {
		originalConsole.error(...args);
		addToConsoleBuffer('error', ...args);
	};

	console.info = (...args) => {
		originalConsole.info(...args);
		addToConsoleBuffer('info', ...args);
	};

	initialized = true;
}

export function getConsoleCapture(): string[] {
	return [...consoleBuffer];
}

export function clearConsoleCapture(): void {
	consoleBuffer = [];
}

export function restoreConsole(): void {
	if (!initialized) return;

	Object.assign(console, originalConsole);
	initialized = false;
}
