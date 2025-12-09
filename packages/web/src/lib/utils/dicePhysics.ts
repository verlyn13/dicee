/**
 * Dice Physics Utilities
 *
 * Provides timing and animation values for realistic dice rolling animations.
 * Uses CSS custom properties for hardware-accelerated animations.
 */

// =============================================================================
// Types
// =============================================================================

export interface DicePhysicsConfig {
	/** Total animation duration in ms */
	duration: number;
	/** Launch phase duration (lift + rapid spin) */
	launchDuration: number;
	/** Flight phase duration (tumbling) */
	flightDuration: number;
	/** Settle phase duration (spring into position) */
	settleDuration: number;
	/** Reveal phase duration (final value flash) */
	revealDuration: number;
}

export interface DiceAnimationPhase {
	name: 'launch' | 'flight' | 'settle' | 'reveal';
	startTime: number;
	duration: number;
	easing: string;
}

// =============================================================================
// Configuration
// =============================================================================

/** Default physics timing configuration */
export const DEFAULT_PHYSICS_CONFIG: DicePhysicsConfig = {
	duration: 1000,
	launchDuration: 100,
	flightDuration: 300,
	settleDuration: 400,
	revealDuration: 200,
};

/** Animation phases with CSS-compatible timing */
export function getAnimationPhases(config = DEFAULT_PHYSICS_CONFIG): DiceAnimationPhase[] {
	// Compute cumulative start times
	const launchStart = 0;
	const flightStart = launchStart + config.launchDuration;
	const settleStart = flightStart + config.flightDuration;
	const revealStart = settleStart + config.settleDuration;

	return [
		{
			name: 'launch',
			startTime: launchStart,
			duration: config.launchDuration,
			easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
		},
		{
			name: 'flight',
			startTime: flightStart,
			duration: config.flightDuration,
			easing: 'cubic-bezier(0.4, 0, 0.6, 1)',
		},
		{
			name: 'settle',
			startTime: settleStart,
			duration: config.settleDuration,
			easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
		},
		{
			name: 'reveal',
			startTime: revealStart,
			duration: config.revealDuration,
			easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
		},
	];
}

// =============================================================================
// CSS Custom Property Helpers
// =============================================================================

/**
 * Generate CSS custom properties for dice roll animation.
 * These can be applied to the die element and consumed by CSS animations.
 */
export function getDiceRollStyles(index: number, total: number = 5): Record<string, string> {
	// Stagger timing based on die position
	const staggerDelay = index * 30; // 30ms between each die

	// Random variations for natural feel
	const rotationVariance = Math.random() * 60 - 30; // -30 to +30 degrees
	const bounceHeight = 8 + Math.random() * 8; // 8-16px bounce
	const spinRotations = 2 + Math.floor(Math.random() * 2); // 2-3 full rotations

	// Pan position for stereo audio (leftmost = -1, rightmost = +1)
	const panPosition = total > 1 ? (index / (total - 1)) * 2 - 1 : 0;

	return {
		'--roll-delay': `${staggerDelay}ms`,
		'--rotation-variance': `${rotationVariance}deg`,
		'--bounce-height': `${bounceHeight}px`,
		'--spin-rotations': `${spinRotations}`,
		'--pan-position': `${panPosition}`,
		'--die-index': `${index}`,
	};
}

/**
 * Generate CSS custom properties for dice landing animation.
 */
export function getDiceLandStyles(index: number): Record<string, string> {
	// Random landing variations
	const landDelay = index * 25 + Math.random() * 15; // Staggered with randomness
	const settleRotation = Math.random() * 10 - 5; // -5 to +5 degree final settle
	const bounceScale = 0.95 + Math.random() * 0.05; // Slight scale variation

	return {
		'--land-delay': `${landDelay}ms`,
		'--settle-rotation': `${settleRotation}deg`,
		'--bounce-scale': `${bounceScale}`,
	};
}

// =============================================================================
// Animation State Helpers
// =============================================================================

/**
 * Get the current phase of the dice roll animation.
 */
export function getCurrentPhase(
	elapsedMs: number,
	config = DEFAULT_PHYSICS_CONFIG,
): DiceAnimationPhase['name'] | 'idle' {
	if (elapsedMs < 0) return 'idle';
	if (elapsedMs < config.launchDuration) return 'launch';
	if (elapsedMs < config.launchDuration + config.flightDuration) return 'flight';
	if (elapsedMs < config.launchDuration + config.flightDuration + config.settleDuration)
		return 'settle';
	if (elapsedMs < config.duration) return 'reveal';
	return 'idle';
}

/**
 * Check if animation is complete.
 */
export function isAnimationComplete(elapsedMs: number, config = DEFAULT_PHYSICS_CONFIG): boolean {
	return elapsedMs >= config.duration;
}

// =============================================================================
// Prefers Reduced Motion
// =============================================================================

/**
 * Get a reduced motion version of the physics config.
 * Significantly shorter animations for accessibility.
 */
export function getReducedMotionConfig(): DicePhysicsConfig {
	return {
		duration: 300,
		launchDuration: 50,
		flightDuration: 100,
		settleDuration: 100,
		revealDuration: 50,
	};
}

/**
 * Check if user prefers reduced motion.
 */
export function prefersReducedMotion(): boolean {
	if (typeof window === 'undefined') return false;
	if (typeof window.matchMedia !== 'function') return false;
	return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Get appropriate physics config based on user preference.
 */
export function getPhysicsConfig(): DicePhysicsConfig {
	return prefersReducedMotion() ? getReducedMotionConfig() : DEFAULT_PHYSICS_CONFIG;
}
