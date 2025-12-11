/**
 * User Preferences Schema
 *
 * Zod 4 validation schemas for user preferences.
 * Single source of truth for preferences structure.
 *
 * v1 Scope:
 * - Master volume (0-100)
 * - Mute toggle
 * - Haptics toggle
 *
 * @example
 * import { parsePreferences, DEFAULT_PREFERENCES } from '@dicee/shared';
 *
 * const prefs = parsePreferences(localStorage.getItem('prefs'));
 */

import { z } from 'zod';

// =============================================================================
// Schema Version
// =============================================================================

/**
 * Schema version for future migrations.
 * Increment when making breaking changes to the schema.
 */
export const PREFERENCES_VERSION = 1;

// =============================================================================
// Sub-Schemas
// =============================================================================

/**
 * Audio preferences (v1: master volume and mute only)
 */
export const AudioPreferencesSchema = z.object({
	masterVolume: z.number().min(0).max(100).default(70),
	muted: z.boolean().default(false),
	// Per-category volumes deferred to v2
});

/**
 * Haptics preferences
 */
export const HapticsPreferencesSchema = z.object({
	enabled: z.boolean().default(true),
});

/**
 * Gameplay preferences
 */
export const GameplayPreferencesSchema = z.object({
	keepDiceByDefault: z.boolean().default(true),
});

// =============================================================================
// Main Schema
// =============================================================================

/**
 * Complete user preferences schema
 *
 * Note: New optional fields use .default() to handle migration from older preferences.
 * This ensures users don't lose their existing settings when new fields are added.
 */
export const UserPreferencesSchema = z.object({
	_version: z.literal(PREFERENCES_VERSION),
	audio: AudioPreferencesSchema,
	haptics: HapticsPreferencesSchema,
	gameplay: GameplayPreferencesSchema.default({ keepDiceByDefault: true }),
});

// =============================================================================
// Types
// =============================================================================

export type AudioPreferences = z.infer<typeof AudioPreferencesSchema>;
export type HapticsPreferences = z.infer<typeof HapticsPreferencesSchema>;
export type GameplayPreferences = z.infer<typeof GameplayPreferencesSchema>;
export type UserPreferences = z.infer<typeof UserPreferencesSchema>;

// =============================================================================
// Defaults
// =============================================================================

/**
 * Default preferences for new users
 */
export const DEFAULT_PREFERENCES: UserPreferences = {
	_version: PREFERENCES_VERSION,
	audio: {
		masterVolume: 70,
		muted: false,
	},
	haptics: {
		enabled: true,
	},
	gameplay: {
		keepDiceByDefault: true,
	},
};

// =============================================================================
// Parsing Utilities
// =============================================================================

/**
 * Parse untrusted preferences data (localStorage, Supabase).
 * Returns defaults if parse fails (corrupted data, old version).
 *
 * @param data - Raw data from storage
 * @returns Valid UserPreferences (defaults if parse fails)
 */
export function parsePreferences(data: unknown): UserPreferences {
	// Handle null/undefined
	if (data === null || data === undefined) {
		return DEFAULT_PREFERENCES;
	}

	// Handle string (from localStorage)
	let parsed = data;
	if (typeof data === 'string') {
		try {
			parsed = JSON.parse(data);
		} catch {
			// JSON parse failed - return defaults
			return DEFAULT_PREFERENCES;
		}
	}

	// Validate with Zod
	const result = UserPreferencesSchema.safeParse(parsed);
	if (result.success) {
		return result.data;
	}

	// Schema validation failed - return defaults
	return DEFAULT_PREFERENCES;
}

/**
 * Merge local and remote preferences.
 *
 * Strategy:
 * - Device-specific settings (volume, haptics): LOCAL wins
 *   Rationale: My laptop speakers ≠ my phone speakers
 * - User-identity settings (mute state, gameplay): REMOTE wins
 *   Rationale: "I muted on purpose" should sync
 *
 * @param local - Preferences from localStorage
 * @param remote - Preferences from Supabase
 * @returns Merged preferences
 */
export function mergePreferences(local: UserPreferences, remote: UserPreferences): UserPreferences {
	return {
		_version: PREFERENCES_VERSION,
		audio: {
			// Volume is per-device - local wins
			masterVolume: local.audio.masterVolume,
			// Mute state follows user intent - remote wins
			muted: remote.audio.muted,
		},
		haptics: {
			// Haptics is per-device - local wins
			enabled: local.haptics.enabled,
		},
		gameplay: {
			// Gameplay settings follow user intent - remote wins
			keepDiceByDefault: remote.gameplay?.keepDiceByDefault ?? local.gameplay?.keepDiceByDefault ?? true,
		},
	};
}
