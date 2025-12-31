/**
 * Client-side Logger
 *
 * Structured logging utility that respects production/development environments.
 * In production, logs are silenced to prevent console spam.
 * In development, logs are formatted with context for debugging.
 *
 * Usage:
 *   import { logger } from '$lib/utils/logger';
 *   logger.debug('MyService', 'Message', { data });
 *   logger.warn('MyService', 'Warning message');
 *   logger.error('MyService', 'Error occurred', error);
 *
 * @module utils/logger
 */

import { dev } from '$app/environment';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
	[key: string]: unknown;
}

/**
 * Log a message with context
 */
function log(
	level: LogLevel,
	service: string,
	message: string,
	context?: LogContext | Error,
): void {
	// In production, only log errors
	if (!dev && level !== 'error') {
		return;
	}

	const prefix = `[${service}]`;
	const timestamp = new Date().toISOString().slice(11, 23);

	if (dev) {
		// Development: formatted console output
		const args: unknown[] = [`%c${timestamp} ${prefix}`, getStyleForLevel(level), message];
		if (context) {
			args.push(context);
		}

		switch (level) {
			case 'debug':
				console.debug(...args);
				break;
			case 'info':
				console.info(...args);
				break;
			case 'warn':
				console.warn(...args);
				break;
			case 'error':
				console.error(...args);
				break;
		}
	} else if (level === 'error') {
		// Production: only errors, minimal output
		console.error(`${prefix} ${message}`, context ?? '');
	}
}

function getStyleForLevel(level: LogLevel): string {
	switch (level) {
		case 'debug':
			return 'color: #888; font-weight: normal;';
		case 'info':
			return 'color: #0066cc; font-weight: normal;';
		case 'warn':
			return 'color: #cc6600; font-weight: bold;';
		case 'error':
			return 'color: #cc0000; font-weight: bold;';
	}
}

/**
 * Structured logger for client-side services
 */
export const logger = {
	/**
	 * Debug-level logging (dev only)
	 */
	debug(service: string, message: string, context?: LogContext): void {
		log('debug', service, message, context);
	},

	/**
	 * Info-level logging (dev only)
	 */
	info(service: string, message: string, context?: LogContext): void {
		log('info', service, message, context);
	},

	/**
	 * Warning-level logging (dev only)
	 */
	warn(service: string, message: string, context?: LogContext): void {
		log('warn', service, message, context);
	},

	/**
	 * Error-level logging (always logged)
	 */
	error(service: string, message: string, error?: Error | LogContext): void {
		log('error', service, message, error);
	},
};

/**
 * Create a scoped logger for a specific service
 *
 * Usage:
 *   const log = createServiceLogger('RoomService');
 *   log.debug('Connected to room', { roomCode });
 */
export function createServiceLogger(service: string) {
	return {
		debug: (message: string, context?: LogContext) => logger.debug(service, message, context),
		info: (message: string, context?: LogContext) => logger.info(service, message, context),
		warn: (message: string, context?: LogContext) => logger.warn(service, message, context),
		error: (message: string, error?: Error | LogContext) => logger.error(service, message, error),
	};
}
