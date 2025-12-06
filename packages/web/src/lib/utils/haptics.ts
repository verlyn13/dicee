/**
 * Haptics Utility
 *
 * Provides haptic feedback for touch interactions.
 * Falls back gracefully on devices without vibration support.
 */

/**
 * Haptic feedback patterns
 */
export const HapticPattern = {
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
	/** Roll - dice rolling feedback */
	roll: [15, 30, 15, 30, 15],
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
