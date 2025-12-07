/**
 * Telemetry Types
 *
 * Event types for UX metrics and learning analytics.
 * Follows RFC-003 three-stream architecture (telemetry stream, 30-day retention).
 *
 * @module types/telemetry
 */

// =============================================================================
// Event Type Constants
// =============================================================================

/**
 * Telemetry event types following RFC-003 naming conventions
 */
export const TelemetryEventType = {
	// Session events
	SESSION_START: 'session_start',
	SESSION_END: 'session_end',
	PAGE_VIEW: 'page_view',

	// Game lifecycle
	GAME_START: 'game_start',
	GAME_COMPLETE: 'game_complete',

	// Turn events (lightweight telemetry, not full domain events)
	ROLL: 'roll',
	CATEGORY_HOVER: 'category_hover',
	CATEGORY_SCORE: 'category_score',

	// Learning events
	HINT_REQUESTED: 'hint_requested',
	DECISION_QUALITY: 'decision_quality',
	PREDICTION: 'prediction',

	// Errors and diagnostics
	ERROR: 'error',
} as const;

export type TelemetryEventType = (typeof TelemetryEventType)[keyof typeof TelemetryEventType];

// =============================================================================
// Payload Interfaces
// =============================================================================

/**
 * Session start payload
 */
export interface SessionStartPayload {
	entry_page: string;
	referrer: string | null;
}

/**
 * Session end payload
 */
export interface SessionEndPayload {
	duration_ms: number;
	page_count: number;
}

/**
 * Page view payload
 */
export interface PageViewPayload {
	page: string;
	previous_page: string | null;
}

/**
 * Game start payload
 */
export interface GameStartPayload {
	mode: 'solo' | 'multiplayer';
	player_count: number;
}

/**
 * Game complete payload
 */
export interface GameCompletePayload {
	final_score: number;
	duration_ms: number;
	turns_played: number;
}

/**
 * Roll event payload (lightweight telemetry)
 */
export interface RollPayload {
	turn: number;
	roll_number: number;
	time_since_last_ms: number | null;
}

/**
 * Category hover payload
 */
export interface CategoryHoverPayload {
	category: string;
	duration_ms: number;
}

/**
 * Category score payload
 */
export interface CategoryScorePayload {
	category: string;
	points: number;
	was_optimal: boolean;
	turn: number;
}

/**
 * Hint requested payload
 */
export interface HintRequestedPayload {
	context: 'scoring' | 'reroll' | 'general';
	turn: number;
	roll_number: number;
}

/**
 * Decision quality payload
 */
export interface DecisionQualityPayload {
	quality: 'optimal' | 'excellent' | 'good' | 'acceptable' | 'suboptimal' | 'poor';
	ev_difference: number;
	category: string;
}

/**
 * Prediction payload
 */
export interface PredictionPayload {
	predicted: string;
	actual: string;
	accuracy: number;
}

/**
 * Error payload
 */
export interface ErrorPayload {
	error_code: string;
	error_message: string;
	context: string | null;
}

// =============================================================================
// Union Type for All Payloads
// =============================================================================

/**
 * Payload type map for type-safe event creation
 */
export interface TelemetryPayloadMap {
	session_start: SessionStartPayload;
	session_end: SessionEndPayload;
	page_view: PageViewPayload;
	game_start: GameStartPayload;
	game_complete: GameCompletePayload;
	roll: RollPayload;
	category_hover: CategoryHoverPayload;
	category_score: CategoryScorePayload;
	hint_requested: HintRequestedPayload;
	decision_quality: DecisionQualityPayload;
	prediction: PredictionPayload;
	error: ErrorPayload;
}

/**
 * Generic telemetry event
 */
export interface TelemetryEvent<T extends TelemetryEventType = TelemetryEventType> {
	id?: string;
	session_id: string;
	user_id?: string | null;
	event_type: T;
	payload: T extends keyof TelemetryPayloadMap ? TelemetryPayloadMap[T] : Record<string, unknown>;
	page_url?: string | null;
	referrer?: string | null;
	user_agent?: string | null;
	timestamp: string;
}

// =============================================================================
// Configuration
// =============================================================================

/**
 * Telemetry service configuration
 */
export interface TelemetryConfig {
	/** Enable/disable telemetry collection */
	enabled: boolean;
	/** Batch size before auto-flush */
	batchSize: number;
	/** Flush interval in milliseconds */
	flushIntervalMs: number;
	/** Enable debug logging */
	debug: boolean;
}

/**
 * Default telemetry configuration
 */
export const DEFAULT_TELEMETRY_CONFIG: TelemetryConfig = {
	enabled: true,
	batchSize: 10,
	flushIntervalMs: 5000,
	debug: false,
};
