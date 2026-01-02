/**
 * Device Testing Zod Schemas
 *
 * Zod 4 schemas for mobile device testing infrastructure.
 * Provides type-safe parsing and validation for:
 * - Device connection metadata
 * - Logcat entries
 * - Chrome DevTools console messages
 * - Performance metrics
 * - Test session tracking
 *
 * @module types/device-testing.schema
 */

import { z } from 'zod';

// =============================================================================
// Device Information Schemas
// =============================================================================

/**
 * Android device connection states
 */
export const DeviceStateSchema = z.enum([
	'connected',
	'disconnected',
	'unauthorized',
	'offline',
	'no-permissions',
]);

/**
 * Device transport types (how connected to Mac)
 */
export const DeviceTransportSchema = z.enum(['usb', 'tcp', 'local']);

/**
 * Connected device information from `adb devices -l`
 */
export const DeviceInfoSchema = z.object({
	/** Device serial number or IP:port */
	serial: z.string().min(1),

	/** Connection state */
	state: DeviceStateSchema,

	/** Transport type */
	transport: DeviceTransportSchema,

	/** Device model (e.g., "Pixel 10 Pro XL") */
	model: z.string().nullable(),

	/** Device product name */
	product: z.string().nullable(),

	/** Android device name */
	device: z.string().nullable(),

	/** Transport ID */
	transportId: z.number().int().min(0).nullable(),

	/** Timestamp when device was detected */
	detectedAt: z.string().datetime(),
});

/** Device information type */
export type DeviceInfo = z.infer<typeof DeviceInfoSchema>;

/** Device state type */
export type DeviceState = z.infer<typeof DeviceStateSchema>;

// =============================================================================
// Logcat Entry Schemas
// =============================================================================

/**
 * Android log priority levels
 */
export const LogPrioritySchema = z.enum([
	'V', // Verbose
	'D', // Debug
	'I', // Info
	'W', // Warning
	'E', // Error
	'F', // Fatal
	'S', // Silent
]);

/**
 * Single logcat entry from `adb logcat`
 * Format: MM-DD HH:MM:SS.mmm PID TID Priority Tag: Message
 */
export const LogEntrySchema = z.object({
	/** Unique ID for this log entry */
	id: z.string().uuid(),

	/** Timestamp from device */
	timestamp: z.string(),

	/** Process ID */
	pid: z.number().int().min(0),

	/** Thread ID */
	tid: z.number().int().min(0),

	/** Log priority level */
	priority: LogPrioritySchema,

	/** Log tag (component name) */
	tag: z.string(),

	/** Log message content */
	message: z.string(),

	/** Raw log line (original format) */
	raw: z.string(),

	/** Source capture session ID */
	sessionId: z.string().uuid().optional(),
});

/** Log entry type */
export type LogEntry = z.infer<typeof LogEntrySchema>;

/** Log priority type */
export type LogPriority = z.infer<typeof LogPrioritySchema>;

// =============================================================================
// Chrome DevTools Console Schemas
// =============================================================================

/**
 * Chrome console message levels
 */
export const ConsoleLevelSchema = z.enum([
	'log',
	'debug',
	'info',
	'warn',
	'error',
	'table',
	'trace',
	'dir',
	'group',
	'groupEnd',
	'assert',
]);

/**
 * Chrome DevTools console message
 */
export const ChromeConsoleSchema = z.object({
	/** Unique message ID */
	id: z.string().uuid(),

	/** Console level */
	level: ConsoleLevelSchema,

	/** Message text */
	text: z.string(),

	/** Source URL where message originated */
	url: z.string().nullable(),

	/** Line number in source */
	lineNumber: z.number().int().min(0).nullable(),

	/** Column number in source */
	columnNumber: z.number().int().min(0).nullable(),

	/** Stack trace (if error) */
	stackTrace: z.string().nullable(),

	/** Timestamp from browser */
	timestamp: z.number(),

	/** ISO timestamp */
	timestampIso: z.string().datetime(),

	/** Session ID for correlation */
	sessionId: z.string().uuid().optional(),
});

/** Chrome console message type */
export type ChromeConsole = z.infer<typeof ChromeConsoleSchema>;

/** Console level type */
export type ConsoleLevel = z.infer<typeof ConsoleLevelSchema>;

// =============================================================================
// Performance Metrics Schemas
// =============================================================================

/**
 * Performance metric categories
 */
export const MetricCategorySchema = z.enum([
	'navigation', // Page navigation timing
	'resource', // Resource load timing
	'paint', // First paint, FCP, LCP
	'layout', // Layout shifts
	'longtask', // Long tasks (>50ms)
	'memory', // Memory usage
	'network', // Network requests
]);

/**
 * Single performance metric entry
 */
export const PerformanceMetricSchema = z.object({
	/** Unique metric ID */
	id: z.string().uuid(),

	/** Metric category */
	category: MetricCategorySchema,

	/** Metric name (e.g., "FCP", "LCP", "TTFB") */
	name: z.string(),

	/** Metric value (usually milliseconds) */
	value: z.number(),

	/** Unit of measurement */
	unit: z.enum(['ms', 'bytes', 'count', 'score']),

	/** Rating: good, needs-improvement, poor */
	rating: z.enum(['good', 'needs-improvement', 'poor']).nullable(),

	/** Page URL when metric was captured */
	url: z.string(),

	/** Timestamp of measurement */
	timestamp: z.string().datetime(),

	/** Additional metadata */
	metadata: z.record(z.string(), z.unknown()).optional(),

	/** Session ID for correlation */
	sessionId: z.string().uuid().optional(),
});

/** Performance metric type */
export type PerformanceMetric = z.infer<typeof PerformanceMetricSchema>;

/** Metric category type */
export type MetricCategory = z.infer<typeof MetricCategorySchema>;

// =============================================================================
// Capture Session Schemas
// =============================================================================

/**
 * Capture session states
 */
export const SessionStateSchema = z.enum(['idle', 'capturing', 'paused', 'stopped', 'error']);

/**
 * Capture source types
 */
export const CaptureSourceSchema = z.enum([
	'logcat',
	'chrome-console',
	'network',
	'performance',
	'combined',
]);

/**
 * Log capture session tracking
 */
export const CaptureSessionSchema = z.object({
	/** Unique session ID */
	id: z.string().uuid(),

	/** Human-readable session name */
	name: z.string().min(1),

	/** Session description/notes */
	description: z.string().nullable(),

	/** Current session state */
	state: SessionStateSchema,

	/** What sources are being captured */
	sources: z.array(CaptureSourceSchema),

	/** Device being captured from */
	device: DeviceInfoSchema,

	/** Session start timestamp */
	startedAt: z.string().datetime(),

	/** Session end timestamp (null if still active) */
	stoppedAt: z.string().datetime().nullable(),

	/** Duration in milliseconds */
	durationMs: z.number().int().min(0).nullable(),

	/** Number of entries captured */
	entryCount: z.number().int().min(0),

	/** Output file path (if saving to disk) */
	outputPath: z.string().nullable(),

	/** Logcat filter string used */
	logcatFilter: z.string().nullable(),

	/** Tags/labels for organization */
	tags: z.array(z.string()),
});

/** Capture session type */
export type CaptureSession = z.infer<typeof CaptureSessionSchema>;

/** Session state type */
export type SessionState = z.infer<typeof SessionStateSchema>;

// =============================================================================
// Test Result Schemas
// =============================================================================

/**
 * Test result status
 */
export const TestStatusSchema = z.enum(['passed', 'failed', 'skipped', 'pending', 'error']);

/**
 * Test severity for failures
 */
export const TestSeveritySchema = z.enum(['critical', 'high', 'medium', 'low', 'info']);

/**
 * Individual test case result
 */
export const TestCaseResultSchema = z.object({
	/** Unique test case ID */
	id: z.string().uuid(),

	/** Test case name */
	name: z.string().min(1),

	/** Test suite/group name */
	suite: z.string().nullable(),

	/** Test status */
	status: TestStatusSchema,

	/** Duration in milliseconds */
	durationMs: z.number().int().min(0),

	/** Error message (if failed) */
	errorMessage: z.string().nullable(),

	/** Stack trace (if failed) */
	stackTrace: z.string().nullable(),

	/** Severity of failure */
	severity: TestSeveritySchema.nullable(),

	/** Screenshots captured during test */
	screenshots: z.array(z.string()),

	/** Related log entries */
	logEntryIds: z.array(z.string().uuid()),

	/** Test started timestamp */
	startedAt: z.string().datetime(),

	/** Test completed timestamp */
	completedAt: z.string().datetime(),

	/** Test metadata (steps, assertions, etc.) */
	metadata: z.record(z.string(), z.unknown()).optional(),
});

/** Test case result type */
export type TestCaseResult = z.infer<typeof TestCaseResultSchema>;

/**
 * Test run summary (multiple test cases)
 */
export const TestRunSchema = z.object({
	/** Unique test run ID */
	id: z.string().uuid(),

	/** Test run name */
	name: z.string().min(1),

	/** Environment (dev, staging, prod) */
	environment: z.enum(['dev', 'staging', 'prod']),

	/** Device information */
	device: DeviceInfoSchema,

	/** Associated capture session */
	captureSessionId: z.string().uuid().nullable(),

	/** All test case results */
	testCases: z.array(TestCaseResultSchema),

	/** Total tests */
	totalCount: z.number().int().min(0),

	/** Passed count */
	passedCount: z.number().int().min(0),

	/** Failed count */
	failedCount: z.number().int().min(0),

	/** Skipped count */
	skippedCount: z.number().int().min(0),

	/** Error count */
	errorCount: z.number().int().min(0),

	/** Overall duration in milliseconds */
	durationMs: z.number().int().min(0),

	/** Test run started timestamp */
	startedAt: z.string().datetime(),

	/** Test run completed timestamp */
	completedAt: z.string().datetime(),

	/** Git commit hash tested */
	commitHash: z.string().nullable(),

	/** Git branch tested */
	branch: z.string().nullable(),

	/** Test run tags */
	tags: z.array(z.string()),
});

/** Test run type */
export type TestRun = z.infer<typeof TestRunSchema>;

// =============================================================================
// Network Request Schemas (for WebSocket debugging)
// =============================================================================

/**
 * WebSocket connection states
 */
export const WebSocketStateSchema = z.enum(['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED']);

/**
 * WebSocket message direction
 */
export const MessageDirectionSchema = z.enum(['sent', 'received']);

/**
 * WebSocket message entry
 */
export const WebSocketMessageSchema = z.object({
	/** Unique message ID */
	id: z.string().uuid(),

	/** Connection URL */
	url: z.string().url(),

	/** Message direction */
	direction: MessageDirectionSchema,

	/** Message type */
	type: z.enum(['text', 'binary']),

	/** Message payload (parsed if JSON) */
	payload: z.unknown(),

	/** Raw message data */
	rawData: z.string(),

	/** Message size in bytes */
	sizeBytes: z.number().int().min(0),

	/** Timestamp */
	timestamp: z.string().datetime(),

	/** Session ID for correlation */
	sessionId: z.string().uuid().optional(),
});

/** WebSocket message type */
export type WebSocketMessage = z.infer<typeof WebSocketMessageSchema>;

/**
 * WebSocket connection event
 */
export const WebSocketConnectionSchema = z.object({
	/** Unique connection ID */
	id: z.string().uuid(),

	/** Connection URL */
	url: z.string().url(),

	/** Connection state */
	state: WebSocketStateSchema,

	/** Connected timestamp */
	connectedAt: z.string().datetime().nullable(),

	/** Disconnected timestamp */
	disconnectedAt: z.string().datetime().nullable(),

	/** Close code (if closed) */
	closeCode: z.number().int().nullable(),

	/** Close reason (if closed) */
	closeReason: z.string().nullable(),

	/** Messages sent count */
	sentCount: z.number().int().min(0),

	/** Messages received count */
	receivedCount: z.number().int().min(0),

	/** Total bytes sent */
	bytesSent: z.number().int().min(0),

	/** Total bytes received */
	bytesReceived: z.number().int().min(0),

	/** Session ID for correlation */
	sessionId: z.string().uuid().optional(),
});

/** WebSocket connection type */
export type WebSocketConnection = z.infer<typeof WebSocketConnectionSchema>;

// =============================================================================
// Chrome DevTools Protocol (CDP) Schemas
// =============================================================================

/**
 * CDP connection states
 */
export const CDPConnectionStateSchema = z.enum([
	'disconnected',
	'connecting',
	'connected',
	'error',
]);

/**
 * Chrome tab type
 */
export const ChromeTabTypeSchema = z.enum(['page', 'background_page', 'service_worker', 'other']);

/**
 * Chrome tab information from CDP /json endpoint
 */
export const ChromeTabSchema = z.object({
	/** Tab ID (unique per browser session) */
	id: z.string(),

	/** Tab title */
	title: z.string(),

	/** Tab URL */
	url: z.string(),

	/** Tab type */
	type: ChromeTabTypeSchema,

	/** Description (usually empty for pages) */
	description: z.string(),

	/** WebSocket debugger URL for CDP connection */
	webSocketDebuggerUrl: z.string().url().nullable(),

	/** DevTools frontend URL */
	devtoolsFrontendUrl: z.string().nullable(),

	/** Parent target ID (for iframes) */
	parentId: z.string().nullable(),

	/** Favicon URL */
	faviconUrl: z.string().nullable(),
});

/** Chrome tab type */
export type ChromeTab = z.infer<typeof ChromeTabSchema>;

/**
 * CDP session tracking for console monitoring
 */
export const CDPSessionSchema = z.object({
	/** Unique session ID */
	id: z.string().uuid(),

	/** Target tab */
	tab: ChromeTabSchema,

	/** Connection state */
	state: CDPConnectionStateSchema,

	/** Session started timestamp */
	startedAt: z.string().datetime(),

	/** Session ended timestamp */
	endedAt: z.string().datetime().nullable(),

	/** Messages received count */
	messageCount: z.number().int().min(0),

	/** Errors received count */
	errorCount: z.number().int().min(0),

	/** Last message timestamp */
	lastMessageAt: z.string().datetime().nullable(),

	/** Device information (if from mobile) */
	device: DeviceInfoSchema.nullable(),

	/** CDP port used */
	cdpPort: z.number().int().min(1).max(65535),

	/** Environment being monitored */
	environment: z.enum(['local', 'staging', 'production']),
});

/** CDP session type */
export type CDPSession = z.infer<typeof CDPSessionSchema>;

/**
 * CDP Runtime.consoleAPICalled event parameters
 */
export const CDPConsoleAPICalledSchema = z.object({
	/** Console API type (log, warn, error, etc.) */
	type: ConsoleLevelSchema,

	/** Console arguments */
	args: z.array(
		z.object({
			type: z.string(),
			value: z.unknown().optional(),
			description: z.string().optional(),
			preview: z
				.object({
					type: z.string(),
					description: z.string().optional(),
					properties: z
						.array(
							z.object({
								name: z.string(),
								value: z.string().optional(),
								type: z.string().optional(),
							}),
						)
						.optional(),
				})
				.optional(),
		}),
	),

	/** Execution context ID */
	executionContextId: z.number().int(),

	/** Timestamp (milliseconds since epoch) */
	timestamp: z.number(),

	/** Stack trace (if available) */
	stackTrace: z
		.object({
			callFrames: z.array(
				z.object({
					functionName: z.string(),
					scriptId: z.string(),
					url: z.string(),
					lineNumber: z.number().int(),
					columnNumber: z.number().int(),
				}),
			),
		})
		.optional(),
});

/** CDP console API called type */
export type CDPConsoleAPICalled = z.infer<typeof CDPConsoleAPICalledSchema>;

/**
 * CDP Runtime.exceptionThrown event parameters
 */
export const CDPExceptionThrownSchema = z.object({
	/** Timestamp (milliseconds since epoch) */
	timestamp: z.number(),

	/** Exception details */
	exceptionDetails: z.object({
		/** Exception ID */
		exceptionId: z.number().int(),

		/** Exception text */
		text: z.string(),

		/** Line number */
		lineNumber: z.number().int(),

		/** Column number */
		columnNumber: z.number().int(),

		/** Script ID */
		scriptId: z.string().optional(),

		/** URL */
		url: z.string().optional(),

		/** Stack trace */
		stackTrace: z
			.object({
				callFrames: z.array(
					z.object({
						functionName: z.string(),
						scriptId: z.string(),
						url: z.string(),
						lineNumber: z.number().int(),
						columnNumber: z.number().int(),
					}),
				),
			})
			.optional(),

		/** Exception object */
		exception: z
			.object({
				type: z.string(),
				subtype: z.string().optional(),
				className: z.string().optional(),
				description: z.string().optional(),
				value: z.unknown().optional(),
			})
			.optional(),

		/** Execution context ID */
		executionContextId: z.number().int().optional(),
	}),
});

/** CDP exception thrown type */
export type CDPExceptionThrown = z.infer<typeof CDPExceptionThrownSchema>;

// =============================================================================
// Bug Report Schema
// =============================================================================

/**
 * Bug report generated from device testing
 */
export const BugReportSchema = z.object({
	/** Unique bug report ID */
	id: z.string().uuid(),

	/** Bug title */
	title: z.string().min(1),

	/** Detailed description */
	description: z.string(),

	/** Steps to reproduce */
	stepsToReproduce: z.array(z.string()),

	/** Expected behavior */
	expectedBehavior: z.string(),

	/** Actual behavior */
	actualBehavior: z.string(),

	/** Severity */
	severity: TestSeveritySchema,

	/** Device information */
	device: DeviceInfoSchema,

	/** Environment tested */
	environment: z.enum(['dev', 'staging', 'prod']),

	/** URL where bug occurred */
	url: z.string().url(),

	/** Related capture session */
	captureSessionId: z.string().uuid().nullable(),

	/** Related log entry IDs */
	logEntryIds: z.array(z.string().uuid()),

	/** Screenshot paths */
	screenshots: z.array(z.string()),

	/** Network HAR file path */
	harPath: z.string().nullable(),

	/** Bug report file path */
	bugreportPath: z.string().nullable(),

	/** Created timestamp */
	createdAt: z.string().datetime(),

	/** Reporter */
	reporter: z.string(),

	/** Tags */
	tags: z.array(z.string()),
});

/** Bug report type */
export type BugReport = z.infer<typeof BugReportSchema>;

// =============================================================================
// Validation Helpers
// =============================================================================

/**
 * Parse and validate a log entry
 */
export function parseLogEntry(input: unknown) {
	return LogEntrySchema.safeParse(input);
}

/**
 * Parse logcat line into LogEntry
 * Format: MM-DD HH:MM:SS.mmm PID TID Priority Tag: Message
 */
export function parseLogcatLine(line: string, sessionId?: string): LogEntry | null {
	// Example: 12-15 10:30:45.123  1234  5678 D chromium: WebSocket connected
	const regex =
		/^(\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}\.\d{3})\s+(\d+)\s+(\d+)\s+([VDIWEFS])\s+(\S+):\s*(.*)$/;
	const match = line.match(regex);

	if (!match) return null;

	const [, timestamp, pid, tid, priority, tag, message] = match;

	return {
		id: crypto.randomUUID(),
		timestamp,
		pid: parseInt(pid, 10),
		tid: parseInt(tid, 10),
		priority: priority as LogPriority,
		tag,
		message,
		raw: line,
		sessionId,
	};
}

/**
 * Type guard: Check if input is a valid DeviceInfo
 */
export function isDeviceInfo(input: unknown): input is DeviceInfo {
	return DeviceInfoSchema.safeParse(input).success;
}

/**
 * Type guard: Check if input is a valid LogEntry
 */
export function isLogEntry(input: unknown): input is LogEntry {
	return LogEntrySchema.safeParse(input).success;
}

/**
 * Type guard: Check if input is a valid CaptureSession
 */
export function isCaptureSession(input: unknown): input is CaptureSession {
	return CaptureSessionSchema.safeParse(input).success;
}

// =============================================================================
// Constants
// =============================================================================

/**
 * Common logcat tags for web app debugging
 */
export const CHROME_LOGCAT_TAGS = [
	'chromium',
	'Chrome',
	'WebView',
	'WebViewChromium',
	'WebViewCallback',
	'WebViewTimersExtension',
	'CrRendererMain',
	'ContentViewCore',
	'NetworkController',
] as const;

/**
 * Port forwarding defaults for local development
 */
export const DEFAULT_PORT_FORWARDS = {
	vite: 5173,
	sveltekit: 3000,
	wrangler: 8787,
	supabase: 54321,
	studioSupabase: 54323,
} as const;

/**
 * CDP configuration defaults
 */
export const CDP_CONFIG = {
	/** Default CDP port for ADB forwarding */
	port: 9222,
	/** Chrome DevTools remote debugging socket */
	androidSocket: 'chrome_devtools_remote',
	/** CDP JSON endpoint path */
	jsonPath: '/json',
	/** CDP version endpoint path */
	versionPath: '/json/version',
} as const;

/**
 * URL patterns for environment detection
 */
export const ENVIRONMENT_PATTERNS = {
	local: /localhost|127\.0\.0\.1|192\.168\.|10\.\d+\.\d+\.|172\.(1[6-9]|2\d|3[01])\./,
	staging: /staging\.|preview\.|dev\./,
	production: /dicee\.games/,
} as const;

/**
 * Detect environment from URL
 */
export function detectEnvironment(url: string): 'local' | 'staging' | 'production' {
	if (ENVIRONMENT_PATTERNS.production.test(url)) return 'production';
	if (ENVIRONMENT_PATTERNS.local.test(url)) return 'local';
	if (ENVIRONMENT_PATTERNS.staging.test(url)) return 'staging';
	return 'production'; // Default to production for unknown URLs
}

/**
 * Parse Chrome tab from CDP /json response
 */
export function parseChromeTab(input: unknown): ChromeTab | null {
	const result = ChromeTabSchema.safeParse(input);
	return result.success ? result.data : null;
}

/**
 * Type guard: Check if input is a valid ChromeTab
 */
export function isChromeTab(input: unknown): input is ChromeTab {
	return ChromeTabSchema.safeParse(input).success;
}

/**
 * Type guard: Check if input is a valid CDPSession
 */
export function isCDPSession(input: unknown): input is CDPSession {
	return CDPSessionSchema.safeParse(input).success;
}
