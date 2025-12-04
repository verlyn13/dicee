/**
 * WASM Engine Service
 *
 * Provides a modern, lazy-loading interface to the Rust/WASM probability engine.
 * Wraps the existing engine.ts with better error handling and TypeScript types.
 *
 * @module services/engine
 */

import type { Category, CategoryProbability, DiceArray, KeptMask, ScoringResult } from '$lib/types';

// =============================================================================
// Types & Interfaces
// =============================================================================

/**
 * Custom error for WASM initialization failures
 */
export class EngineInitError extends Error {
	constructor(
		message: string,
		public readonly cause?: unknown,
	) {
		super(message);
		this.name = 'EngineInitError';
	}
}

/**
 * Engine initialization state
 */
type EngineState =
	| { status: 'uninitialized' }
	| { status: 'initializing'; promise: Promise<void> }
	| { status: 'ready' }
	| { status: 'failed'; error: EngineInitError };

// =============================================================================
// State Management
// =============================================================================

let state: EngineState = { status: 'uninitialized' };

// Cached engine module
let engineModule: typeof import('$lib/engine') | null = null;

/**
 * Reset engine state (primarily for testing)
 */
export function resetEngine(): void {
	state = { status: 'uninitialized' };
	engineModule = null;
}

// =============================================================================
// Initialization
// =============================================================================

/**
 * Lazy-load and initialize the WASM engine.
 *
 * Uses dynamic import to code-split the ~35KB WASM bundle.
 * Subsequent calls return immediately if already initialized.
 *
 * @throws {EngineInitError} If WASM fails to load or initialize
 *
 * @example
 * ```typescript
 * try {
 *   await initializeEngine();
 *   // Engine ready...
 * } catch (err) {
 *   console.error('WASM unavailable:', err);
 * }
 * ```
 */
export async function initializeEngine(): Promise<void> {
	// Fast path: already initialized
	if (state.status === 'ready') {
		return;
	}

	// Fast path: initialization failed previously
	if (state.status === 'failed') {
		throw state.error;
	}

	// Concurrent initialization: return existing promise
	if (state.status === 'initializing') {
		return state.promise;
	}

	// Initialize for the first time
	const promise = (async () => {
		try {
			// Dynamic import allows Vite to code-split the WASM module
			const engine = await import('$lib/engine');

			// Initialize WASM
			await engine.initEngine();

			engineModule = engine;
			state = { status: 'ready' };
		} catch (err) {
			const error = new EngineInitError('Failed to initialize WASM probability engine', err);
			state = { status: 'failed', error };
			throw error;
		}
	})();

	state = { status: 'initializing', promise };
	return promise;
}

/**
 * Check if engine is ready without triggering initialization
 */
export function isEngineReady(): boolean {
	return state.status === 'ready';
}

/**
 * Get current engine state (primarily for diagnostics)
 */
export function getEngineState(): EngineState['status'] {
	return state.status;
}

// =============================================================================
// Private Helpers
// =============================================================================

/**
 * Ensure engine is initialized, throwing if not
 */
async function ensureEngine(): Promise<typeof import('$lib/engine')> {
	await initializeEngine();
	if (!engineModule) {
		throw new EngineInitError('Engine not initialized');
	}
	return engineModule;
}

// =============================================================================
// Typed API - Scoring
// =============================================================================

/**
 * Calculate scores for all categories given current dice.
 *
 * @param dice - Array of 5 dice values (1-6)
 * @returns Array of scoring results for all 13 categories
 */
export async function calculateScores(dice: DiceArray): Promise<ScoringResult[]> {
	const engine = await ensureEngine();
	return engine.scoreAllCategories(dice);
}

/**
 * Calculate score for a single category.
 *
 * @param dice - Current dice values
 * @param category - Which category to score
 * @returns Score for that category
 */
export async function calculateCategoryScore(dice: DiceArray, category: Category): Promise<number> {
	const engine = await ensureEngine();
	return engine.getScore(dice, category);
}

// =============================================================================
// Typed API - Probabilities
// =============================================================================

/**
 * Calculate probabilities and expected values for all available categories.
 *
 * @param dice - Current dice values (1-6)
 * @param kept - Which dice are being kept (true = kept)
 * @param rollsRemaining - Number of rolls left (1-3)
 * @returns Array of probability data for all categories
 */
export async function calculateProbabilities(
	dice: DiceArray,
	kept: KeptMask,
	rollsRemaining: number = 1,
): Promise<CategoryProbability[]> {
	const engine = await ensureEngine();
	const result = engine.calculateProbabilities(dice, kept, rollsRemaining);
	return result.categories;
}

/**
 * Find the category with the highest expected value.
 *
 * @param dice - Current dice values
 * @param kept - Which dice are kept
 * @param rollsRemaining - Rolls remaining
 * @returns Category with best EV, or null if none available
 */
export async function getBestCategory(
	dice: DiceArray,
	kept: KeptMask,
	rollsRemaining: number = 1,
): Promise<{ category: Category; expectedValue: number } | null> {
	const engine = await ensureEngine();
	const result = engine.calculateProbabilities(dice, kept, rollsRemaining);

	if (result.categories.length === 0) return null;

	return {
		category: result.bestCategory,
		expectedValue: result.bestEV,
	};
}

// =============================================================================
// Convenience Functions
// =============================================================================

/**
 * Pre-initialize the engine for faster first-use.
 *
 * Call this during app startup or route preload.
 * Failures are logged but don't throw to avoid blocking page load.
 *
 * @example
 * ```typescript
 * // In +layout.svelte
 * import { preloadEngine } from '$lib/services/engine';
 * import { onMount } from 'svelte';
 *
 * onMount(() => preloadEngine()); // Fire and forget
 * ```
 */
export function preloadEngine(): void {
	initializeEngine().catch((err) => {
		console.warn('Engine preload failed (stats will be unavailable):', err);
	});
}

/**
 * Check if a specific category can be scored
 */
export async function canScoreCategory(dice: DiceArray, category: Category): Promise<boolean> {
	const engine = await ensureEngine();
	const result = engine.scoreCategory(dice, category);
	return result.valid;
}
