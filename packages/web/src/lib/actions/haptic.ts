/**
 * Svelte Action: haptic
 *
 * Declarative haptic feedback for interactive elements.
 * Gracefully degrades on unsupported platforms (iOS).
 * Respects user's haptic preference from audioStore.
 *
 * NOTE: iOS Safari does NOT support the Vibration API.
 * This action only works on Android and some desktop browsers.
 *
 * @example
 * <button use:haptic>Tap</button>
 * <button use:haptic={'success'}>Submit</button>
 * <button use:haptic={[100, 50, 100]}>Custom</button>
 */

import { audioStore } from '$lib/stores/audio.svelte';
import { type HapticType, isHapticsSupported, haptic as triggerHaptic } from '$lib/utils/haptics';

type HapticOptions = HapticType | number[];

/**
 * Svelte action to trigger haptic feedback on interaction.
 *
 * @param node - The HTML element to attach to
 * @param pattern - Haptic pattern name or custom pattern array
 */
export function haptic(node: HTMLElement, pattern: HapticOptions = 'light') {
	let currentPattern = pattern;

	// Early exit if haptics not supported (iOS, old browsers)
	if (!isHapticsSupported()) {
		return {
			update() {
				// No-op when haptics not supported
			},
			destroy() {
				// No-op when haptics not supported
			},
		};
	}

	function handler() {
		// Check user preference (also checks platform support)
		if (!audioStore.hapticsEnabled) return;

		if (typeof currentPattern === 'string') {
			triggerHaptic(currentPattern);
		} else if (Array.isArray(currentPattern)) {
			// Custom pattern - use vibrate directly
			try {
				navigator.vibrate(currentPattern);
			} catch {
				// Ignore errors
			}
		}
	}

	// Trigger on both click and touchstart for immediate feedback
	// touchstart gives more responsive feel on mobile
	node.addEventListener('click', handler);
	node.addEventListener('touchstart', handler, { passive: true });

	return {
		update(newPattern: HapticOptions) {
			currentPattern = newPattern;
		},
		destroy() {
			node.removeEventListener('click', handler);
			node.removeEventListener('touchstart', handler);
		},
	};
}

/**
 * Combined action for both sound and haptic feedback.
 * Convenience wrapper for common use case.
 *
 * @example
 * <button use:feedback={{ sound: 'buttonClick', haptic: 'light' }}>Click</button>
 */
export function feedback(
	node: HTMLElement,
	options: {
		sound?: string;
		haptic?: HapticOptions;
	} = {},
) {
	let currentOptions = options;

	async function handler() {
		// Trigger haptic immediately for responsiveness
		// audioStore.hapticsEnabled checks both user preference and platform support
		if (currentOptions.haptic && audioStore.hapticsEnabled) {
			if (typeof currentOptions.haptic === 'string') {
				triggerHaptic(currentOptions.haptic);
			} else if (Array.isArray(currentOptions.haptic)) {
				try {
					navigator.vibrate(currentOptions.haptic);
				} catch {
					// Ignore
				}
			}
		}

		// Sound is handled separately through audioStore
		// Components should use both use:haptic and use:playSound for full feedback
	}

	node.addEventListener('click', handler);
	node.addEventListener('touchstart', handler, { passive: true });

	return {
		update(newOptions: typeof options) {
			currentOptions = newOptions;
		},
		destroy() {
			node.removeEventListener('click', handler);
			node.removeEventListener('touchstart', handler);
		},
	};
}
