/**
 * Shout Cooldown State Machine
 *
 * Pure functions for managing shout rate limiting.
 * Shouts are ephemeral broadcast messages with a 30-second cooldown per user.
 *
 * Design principles:
 * - Pure functions for testability
 * - Explicit state transitions
 * - Result pattern for error handling
 * - Constants from shared schema
 */

import { err, ok, type Result } from '@dicee/shared';

// =============================================================================
// Constants (import from schema when building)
// =============================================================================

/** Cooldown period between shouts (30 seconds) */
export const SHOUT_COOLDOWN_MS = 30_000;

/** Maximum shout message length */
export const SHOUT_MAX_LENGTH = 100;

/** How long shout bubbles display (5 seconds) */
export const SHOUT_DISPLAY_DURATION_MS = 5_000;

// =============================================================================
// Types
// =============================================================================

/**
 * Per-user shout cooldown state
 */
export interface ShoutCooldownState {
	/** User ID this state belongs to */
	readonly userId: string;
	/** Timestamp of last shout */
	readonly lastShoutAt: number;
	/** Timestamp when cooldown expires */
	readonly cooldownUntil: number;
}

/**
 * Result of checking if user can shout
 */
export interface ShoutCheckResult {
	/** Whether the user is allowed to shout */
	readonly allowed: boolean;
	/** Milliseconds remaining in cooldown (0 if allowed) */
	readonly remainingMs: number;
}

/**
 * Shout message entity
 */
export interface ShoutMessage {
	/** Unique message ID */
	readonly id: string;
	/** User who sent the shout */
	readonly userId: string;
	/** Display name at time of shout */
	readonly displayName: string;
	/** Avatar seed for rendering */
	readonly avatarSeed: string;
	/** The shout content */
	readonly content: string;
	/** When the shout was sent */
	readonly timestamp: number;
	/** When the shout should auto-dismiss */
	readonly expiresAt: number;
}

/**
 * Error codes for shout operations
 */
export type ShoutErrorCode = 'RATE_LIMITED' | 'INVALID_CONTENT' | 'CONTENT_TOO_LONG' | 'CONTENT_EMPTY';

// =============================================================================
// Pure Functions
// =============================================================================

/**
 * Check if a user can shout based on their cooldown state
 *
 * @param state - Current cooldown state (undefined if never shouted)
 * @param now - Current timestamp (injectable for testing)
 * @returns Check result with allowed status and remaining cooldown
 */
export function canShout(state: ShoutCooldownState | undefined, now: number = Date.now()): ShoutCheckResult {
	if (!state) {
		return { allowed: true, remainingMs: 0 };
	}

	if (now >= state.cooldownUntil) {
		return { allowed: true, remainingMs: 0 };
	}

	return {
		allowed: false,
		remainingMs: state.cooldownUntil - now,
	};
}

/**
 * Record a shout and return updated cooldown state
 *
 * @param userId - User who shouted
 * @param now - Current timestamp (injectable for testing)
 * @returns New cooldown state
 */
export function recordShout(userId: string, now: number = Date.now()): ShoutCooldownState {
	return {
		userId,
		lastShoutAt: now,
		cooldownUntil: now + SHOUT_COOLDOWN_MS,
	};
}

/**
 * Validate shout content
 *
 * @param content - Raw content to validate
 * @returns Result with trimmed content or error
 */
export function validateShoutContent(content: string): Result<string, ShoutErrorCode> {
	if (typeof content !== 'string') {
		return err('INVALID_CONTENT', 'Shout content must be a string');
	}

	const trimmed = content.trim();

	if (trimmed.length === 0) {
		return err('CONTENT_EMPTY', 'Shout cannot be empty');
	}

	if (trimmed.length > SHOUT_MAX_LENGTH) {
		return err('CONTENT_TOO_LONG', `Shout must be ${SHOUT_MAX_LENGTH} characters or less`, {
			maxLength: SHOUT_MAX_LENGTH,
			actualLength: trimmed.length,
		});
	}

	return ok(trimmed);
}

/**
 * Create a shout message entity
 *
 * @param userId - User ID
 * @param displayName - Display name
 * @param avatarSeed - Avatar seed
 * @param content - Validated content
 * @param now - Current timestamp (injectable for testing)
 * @returns Shout message with generated ID and expiration
 */
export function createShoutMessage(
	userId: string,
	displayName: string,
	avatarSeed: string,
	content: string,
	now: number = Date.now()
): ShoutMessage {
	return {
		id: crypto.randomUUID(),
		userId,
		displayName,
		avatarSeed,
		content,
		timestamp: now,
		expiresAt: now + SHOUT_DISPLAY_DURATION_MS,
	};
}

/**
 * Process a shout attempt (combines validation, cooldown check, and message creation)
 *
 * @param userId - User attempting to shout
 * @param displayName - User's display name
 * @param avatarSeed - User's avatar seed
 * @param content - Raw shout content
 * @param cooldownState - Current cooldown state
 * @param now - Current timestamp (injectable for testing)
 * @returns Result with shout message and new cooldown state, or error
 */
export function processShout(
	userId: string,
	displayName: string,
	avatarSeed: string,
	content: string,
	cooldownState: ShoutCooldownState | undefined,
	now: number = Date.now()
): Result<{ message: ShoutMessage; newCooldownState: ShoutCooldownState }, ShoutErrorCode> {
	// Validate content first
	const contentResult = validateShoutContent(content);
	if (!contentResult.success) {
		return contentResult;
	}

	// Check cooldown
	const cooldownCheck = canShout(cooldownState, now);
	if (!cooldownCheck.allowed) {
		return err('RATE_LIMITED', `Wait ${Math.ceil(cooldownCheck.remainingMs / 1000)} seconds`, {
			remainingMs: cooldownCheck.remainingMs,
		});
	}

	// Create message and new state
	const message = createShoutMessage(userId, displayName, avatarSeed, contentResult.value, now);
	const newCooldownState = recordShout(userId, now);

	return ok({ message, newCooldownState });
}

// =============================================================================
// State Management Helpers
// =============================================================================

/**
 * Create a shout cooldown manager for use in ChatManager
 * Manages in-memory state for multiple users
 */
export function createShoutCooldownManager() {
	const states = new Map<string, ShoutCooldownState>();

	return {
		/**
		 * Get cooldown state for a user
		 */
		getState(userId: string): ShoutCooldownState | undefined {
			return states.get(userId);
		},

		/**
		 * Update cooldown state for a user
		 */
		setState(state: ShoutCooldownState): void {
			states.set(state.userId, state);
		},

		/**
		 * Check if user can shout
		 */
		canShout(userId: string, now: number = Date.now()): ShoutCheckResult {
			return canShout(states.get(userId), now);
		},

		/**
		 * Process a shout attempt
		 */
		processShout(
			userId: string,
			displayName: string,
			avatarSeed: string,
			content: string,
			now: number = Date.now()
		): Result<ShoutMessage, ShoutErrorCode> {
			const result = processShout(userId, displayName, avatarSeed, content, states.get(userId), now);

			if (result.success) {
				states.set(result.value.newCooldownState.userId, result.value.newCooldownState);
				return ok(result.value.message);
			}

			return result;
		},

		/**
		 * Clear all cooldown states (for testing)
		 */
		clear(): void {
			states.clear();
		},

		/**
		 * Get number of tracked users (for testing/debugging)
		 */
		get size(): number {
			return states.size;
		},
	};
}

export type ShoutCooldownManager = ReturnType<typeof createShoutCooldownManager>;
