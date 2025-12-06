/**
 * WASM Engine Service
 *
 * Provides a modern, lazy-loading interface to the Rust/WASM probability engine.
 * Wraps the existing engine.ts with better error handling and TypeScript types.
 *
 * @module services/engine
 */

import type { Category, DiceArray, TurnAnalysis } from '$lib/types';

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

// =============================================================================
// M1-M4 Solver API
// =============================================================================

/**
 * Analyze the current turn position using the M1-M4 solver.
 *
 * Returns optimal strategy recommendation:
 * - "score": Immediately score the recommended category
 * - "reroll": Keep specific dice and reroll others
 *
 * @param dice - Current dice values (5 dice, values 1-6)
 * @param rollsRemaining - Number of rolls remaining (0-2)
 * @param availableCategories - Categories not yet scored
 * @returns TurnAnalysis with recommended action and expected value
 *
 * @example
 * ```typescript
 * const analysis = await analyzeTurnOptimal([5,5,5,5,5], 0, ['Yahtzee']);
 * if (analysis.action === 'score') {
 *   console.log(`Score ${analysis.categoryScore} in ${analysis.recommendedCategory}`);
 * } else {
 *   console.log(`Reroll: ${analysis.keepRecommendation?.explanation}`);
 * }
 * ```
 */
export async function analyzeTurnOptimal(
	dice: DiceArray,
	rollsRemaining: number,
	availableCategories: Category[],
): Promise<TurnAnalysis> {
	const engine = await ensureEngine();
	return engine.analyzeTurn(dice, rollsRemaining, availableCategories);
}

/**
 * Check if the new engine API is enabled.
 * Always returns true in v0.3.0+ (legacy API removed).
 */
export function isNewEngineEnabled(): boolean {
	return true;
}
