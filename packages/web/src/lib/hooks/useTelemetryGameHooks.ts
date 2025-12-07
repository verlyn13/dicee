/**
 * Telemetry Game Hooks
 *
 * Provides telemetry tracking for game events without modifying the game store.
 * Use these functions in game view components to track player behavior.
 *
 * @module hooks/useTelemetryGameHooks
 */

import { track } from '$lib/services/telemetry';
import type { Category, DecisionFeedback } from '$lib/types';

// Track timing between events
let lastRollTime: number | null = null;
let gameStartTime: number | null = null;
let turnsPlayed = 0;

/**
 * Track game start
 */
export function trackGameStart(mode: 'solo' | 'multiplayer', playerCount = 1): void {
	gameStartTime = Date.now();
	turnsPlayed = 0;
	lastRollTime = null;

	track('game_start', {
		mode,
		player_count: playerCount,
	});
}

/**
 * Track dice roll
 */
export function trackRoll(turn: number, rollNumber: number): void {
	const now = Date.now();
	const timeSinceLast = lastRollTime ? now - lastRollTime : null;
	lastRollTime = now;

	track('roll', {
		turn,
		roll_number: rollNumber,
		time_since_last_ms: timeSinceLast,
	});
}

/**
 * Track category hover (for learning analytics)
 */
export function trackCategoryHover(category: Category, durationMs: number): void {
	// Only track significant hovers (> 200ms)
	if (durationMs < 200) return;

	track('category_hover', {
		category,
		duration_ms: durationMs,
	});
}

/**
 * Track category score
 */
export function trackCategoryScore(
	category: Category,
	points: number,
	wasOptimal: boolean,
	turn: number,
): void {
	turnsPlayed = turn;

	track('category_score', {
		category,
		points,
		was_optimal: wasOptimal,
		turn,
	});
}

/**
 * Track decision quality (from DecisionFeedback)
 */
export function trackDecisionQuality(feedback: DecisionFeedback): void {
	track('decision_quality', {
		quality: feedback.quality,
		ev_difference: feedback.evDifference,
		category: feedback.chosenCategory,
	});
}

/**
 * Track hint request
 */
export function trackHintRequested(
	context: 'scoring' | 'reroll' | 'general',
	turn: number,
	rollNumber: number,
): void {
	track('hint_requested', {
		context,
		turn,
		roll_number: rollNumber,
	});
}

/**
 * Track game completion
 */
export function trackGameComplete(finalScore: number): void {
	const durationMs = gameStartTime ? Date.now() - gameStartTime : 0;

	track('game_complete', {
		final_score: finalScore,
		duration_ms: durationMs,
		turns_played: turnsPlayed,
	});

	// Reset tracking state
	gameStartTime = null;
	lastRollTime = null;
	turnsPlayed = 0;
}

/**
 * Track error
 */
export function trackError(errorCode: string, errorMessage: string, context?: string): void {
	track('error', {
		error_code: errorCode,
		error_message: errorMessage,
		context: context ?? null,
	});
}
