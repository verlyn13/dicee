/**
 * Animation Utilities
 *
 * Helpers for creating smooth, performant animations.
 * Uses CSS custom properties for runtime control.
 */

/**
 * Easing functions for animations
 */
export const Easing = {
	/** Standard ease-out for UI elements */
	easeOut: 'cubic-bezier(0.33, 1, 0.68, 1)',
	/** Bounce effect for playful interactions */
	bounce: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
	/** Spring effect for natural motion */
	spring: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)',
	/** Elastic for exaggerated feedback */
	elastic: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
	/** Sharp deceleration */
	decel: 'cubic-bezier(0, 0, 0.2, 1)',
	/** Sharp acceleration */
	accel: 'cubic-bezier(0.4, 0, 1, 1)',
} as const;

/**
 * Duration presets in milliseconds
 */
export const Duration = {
	instant: 50,
	fast: 150,
	normal: 300,
	slow: 500,
	verySlow: 800,
} as const;

/**
 * Animate a number from start to end value
 *
 * @param from - Starting value
 * @param to - Ending value
 * @param duration - Animation duration in ms
 * @param onUpdate - Callback with current value
 * @param onComplete - Optional callback when complete
 * @returns Cancel function
 */
export function animateValue(
	from: number,
	to: number,
	duration: number,
	onUpdate: (value: number) => void,
	onComplete?: () => void,
): () => void {
	const startTime = performance.now();
	let animationId: number;

	function tick(currentTime: number) {
		const elapsed = currentTime - startTime;
		const progress = Math.min(elapsed / duration, 1);

		// Ease out quad
		const eased = 1 - (1 - progress) * (1 - progress);
		const value = from + (to - from) * eased;

		onUpdate(value);

		if (progress < 1) {
			animationId = requestAnimationFrame(tick);
		} else {
			onComplete?.();
		}
	}

	animationId = requestAnimationFrame(tick);

	return () => {
		cancelAnimationFrame(animationId);
	};
}

/**
 * Create a staggered animation delay for a list of items
 *
 * @param index - Item index
 * @param baseDelay - Base delay in ms
 * @param stagger - Delay between items in ms
 * @returns Total delay for this item
 */
export function staggerDelay(index: number, baseDelay = 0, stagger = 50): number {
	return baseDelay + index * stagger;
}

/**
 * Generate CSS keyframes for a shake animation
 *
 * @param intensity - Shake intensity (1-10)
 * @returns CSS transform values for keyframes
 */
export function shakeKeyframes(intensity = 5): string[] {
	const angle = intensity * 0.6;
	const offset = intensity * 0.4;
	return [
		`translate(0, 0) rotate(0deg)`,
		`translate(${offset}px, -${offset}px) rotate(${angle}deg)`,
		`translate(-${offset}px, ${offset}px) rotate(-${angle}deg)`,
		`translate(${offset}px, ${offset}px) rotate(${angle}deg)`,
		`translate(-${offset}px, -${offset}px) rotate(-${angle}deg)`,
		`translate(0, 0) rotate(0deg)`,
	];
}

/**
 * Prefers reduced motion check
 */
export function prefersReducedMotion(): boolean {
	if (typeof window === 'undefined') return false;
	return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Get animation duration respecting reduced motion preference
 */
export function getAnimationDuration(duration: number): number {
	return prefersReducedMotion() ? 0 : duration;
}
