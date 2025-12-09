/**
 * Haptics Utility
 *
 * Provides haptic feedback for touch interactions.
 * Falls back gracefully on devices without vibration support.
 */

/**
 * Haptic feedback patterns
 * Values in ms: [vibrate, pause, vibrate, pause, ...]
 */
export const HapticPattern = {
	// =============================================================================
	// Basic Patterns
	// =============================================================================

	/** Light tap - die selection, button press */
	light: [10],
	/** Medium tap - roll action, score selection */
	medium: [20],
	/** Heavy tap - game over, error */
	heavy: [30],
	/** Success - scoring, winning */
	success: [10, 50, 20],
	/** Error - invalid action */
	error: [50, 30, 50],

	// =============================================================================
	// Dice Rolling Patterns
	// =============================================================================

	/** Roll - dice rolling feedback (continuous rumble) */
	roll: [15, 30, 15, 30, 15],
	/** Roll launch - initial dice throw */
	rollLaunch: [10, 20, 10, 20, 10],
	/** Roll settle - dice settling down */
	rollSettle: [30],
	/** Dice land - individual die landing */
	diceLand: [15, 10, 10],

	// =============================================================================
	// Game Event Patterns
	// =============================================================================

	/** Dicee celebration - triumphant rumble */
	dicee: [100, 50, 100, 50, 200],
	/** Bonus achieved - satisfying pulse */
	bonusAchieved: [50, 30, 50, 30, 80],
	/** Turn change - subtle notification */
	turnChange: [15, 15, 15],
	/** Game over - finality */
	gameOver: [100, 50, 100],

	// =============================================================================
	// Coach/Training Mode Patterns
	// =============================================================================

	/** Optimal play confirmation - positive reinforcement */
	optimalPlay: [20, 20, 20],
	/** Suboptimal warning - attention-getting staccato */
	suboptimalWarning: [10, 10, 10, 10, 50],
	/** Hint available - gentle nudge */
	hint: [10, 30, 10],

	// =============================================================================
	// Multiplayer/Spectator Patterns
	// =============================================================================

	/** Spectator reaction - subtle acknowledgment */
	spectatorReaction: [15],
	/** Prediction correct - rewarding pulse */
	predictionCorrect: [50, 30, 50],
	/** Chat message received */
	chatMessage: [10, 20, 10],
	/** Player joined/left */
	playerNotification: [20, 20],
} as const;

export type HapticType = keyof typeof HapticPattern;

/**
 * Check if haptic feedback is supported
 */
export function isHapticsSupported(): boolean {
	return typeof navigator !== 'undefined' && 'vibrate' in navigator;
}

/**
 * Trigger haptic feedback
 *
 * @param type - The type of haptic pattern to use
 * @returns true if vibration was triggered, false otherwise
 */
export function haptic(type: HapticType = 'light'): boolean {
	if (!isHapticsSupported()) {
		return false;
	}

	try {
		const pattern = HapticPattern[type];
		return navigator.vibrate(pattern);
	} catch {
		// Vibration API may throw in some contexts
		return false;
	}
}

/**
 * Cancel any ongoing haptic feedback
 */
export function cancelHaptic(): void {
	if (isHapticsSupported()) {
		try {
			navigator.vibrate(0);
		} catch {
			// Ignore errors
		}
	}
}

/**
 * Play a custom haptic pattern
 *
 * @param pattern - Array of durations in ms [vibrate, pause, vibrate, ...]
 * @returns true if vibration was triggered, false otherwise
 */
export function hapticCustom(pattern: number[]): boolean {
	if (!isHapticsSupported()) {
		return false;
	}

	try {
		return navigator.vibrate(pattern);
	} catch {
		return false;
	}
}

/**
 * Play a sequence of haptic patterns with delays
 *
 * @param sequence - Array of {type, delay} objects
 */
export async function hapticSequence(
	sequence: Array<{ type: HapticType; delay?: number }>,
): Promise<void> {
	for (const { type, delay = 0 } of sequence) {
		if (delay > 0) {
			await new Promise((resolve) => setTimeout(resolve, delay));
		}
		haptic(type);
	}
}

// =============================================================================
// Convenience Functions
// =============================================================================

/** Trigger light haptic (die selection, button press) */
export const hapticLight = () => haptic('light');

/** Trigger medium haptic (roll action, score selection) */
export const hapticMedium = () => haptic('medium');

/** Trigger heavy haptic (game over, error) */
export const hapticHeavy = () => haptic('heavy');

/** Trigger success haptic (scoring, winning) */
export const hapticSuccess = () => haptic('success');

/** Trigger error haptic (invalid action) */
export const hapticError = () => haptic('error');

/** Trigger roll haptic (dice rolling) */
export const hapticRoll = () => haptic('roll');

/** Trigger dicee celebration haptic */
export const hapticDicee = () => haptic('dicee');

/** Trigger turn change notification haptic */
export const hapticTurnChange = () => haptic('turnChange');
