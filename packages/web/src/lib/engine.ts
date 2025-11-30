/**
 * WASM Engine Integration Layer
 * Bridges Rust probability engine with TypeScript game state
 */

import init, {
	score_category,
	score_all_categories,
	calculate_probabilities,
} from './wasm/dicee_engine.js';

import type {
	Category,
	CategoryProbability,
	DiceArray,
	KeptMask,
	ProbabilityAnalysis,
} from './types.js';
import { ALL_CATEGORIES, CATEGORY_TO_INDEX } from './types.js';

// =============================================================================
// WASM Result Types (raw from engine)
// =============================================================================

interface WasmScoringResult {
	category: { id: number; name: string; is_upper: boolean };
	score: number;
	valid: boolean;
}

interface WasmCategoryProbability {
	category: { id: number; name: string; is_upper: boolean };
	probability: number;
	expected_value: number;
	current_score: number;
}

interface WasmProbabilityResult {
	categories: WasmCategoryProbability[];
	best_category: { id: number; name: string; is_upper: boolean };
	best_ev: number;
}

// =============================================================================
// Exported Types (for backward compatibility)
// =============================================================================

export interface ScoringResult {
	category: Category;
	score: number;
	valid: boolean;
}

export interface ProbabilityResult {
	categories: CategoryProbability[];
	bestCategory: Category;
	bestEV: number;
}

// =============================================================================
// Initialization
// =============================================================================

let initialized = false;
let initPromise: Promise<void> | null = null;

export async function initEngine(): Promise<void> {
	if (initialized) return;
	if (initPromise) return initPromise;

	initPromise = init().then(() => {
		initialized = true;
	});

	return initPromise;
}

export function isEngineReady(): boolean {
	return initialized;
}

// =============================================================================
// Category Mapping
// =============================================================================

function mapCategoryFromWasm(wasmCategory: {
	id: number;
	name: string;
}): Category {
	return ALL_CATEGORIES[wasmCategory.id];
}

// =============================================================================
// Scoring Functions
// =============================================================================

export function scoreCategory(
	dice: DiceArray,
	category: Category,
): ScoringResult {
	const categoryIndex = CATEGORY_TO_INDEX[category];
	const result = score_category(
		new Uint8Array(dice),
		categoryIndex,
	) as WasmScoringResult;

	return {
		category: mapCategoryFromWasm(result.category),
		score: result.score,
		valid: result.valid,
	};
}

export function scoreAllCategories(dice: DiceArray): ScoringResult[] {
	const results = score_all_categories(
		new Uint8Array(dice),
	) as WasmScoringResult[];

	return results.map((r) => ({
		category: mapCategoryFromWasm(r.category),
		score: r.score,
		valid: r.valid,
	}));
}

export function getScore(dice: DiceArray, category: Category): number {
	const result = scoreCategory(dice, category);
	return result.score;
}

// =============================================================================
// Probability Functions
// =============================================================================

export function calculateProbabilities(
	dice: DiceArray,
	kept: KeptMask,
	rollsRemaining: number,
): ProbabilityResult {
	const keptBytes = kept.map((k) => (k ? 1 : 0));
	const result = calculate_probabilities(
		new Uint8Array(dice),
		new Uint8Array(keptBytes),
		rollsRemaining,
	) as WasmProbabilityResult;

	return {
		categories: result.categories.map((c) => ({
			category: mapCategoryFromWasm(c.category),
			probability: c.probability,
			expectedValue: c.expected_value,
			currentScore: c.current_score,
			isOptimal: c.category.id === result.best_category.id,
		})),
		bestCategory: mapCategoryFromWasm(result.best_category),
		bestEV: result.best_ev,
	};
}

export function analyzePosition(
	dice: DiceArray,
	kept: KeptMask,
	rollsRemaining: number,
	availableCategories: Category[],
): ProbabilityAnalysis {
	const result = calculateProbabilities(dice, kept, rollsRemaining);

	// Filter to only available categories
	const filteredCategories = result.categories.filter((c) =>
		availableCategories.includes(c.category),
	);

	// Find best among available
	const best = filteredCategories.reduce(
		(best, c) => (c.expectedValue > best.expectedValue ? c : best),
		filteredCategories[0],
	);

	// Update isOptimal flags
	const categories = filteredCategories.map((c) => ({
		...c,
		isOptimal: c.category === best.category,
	}));

	return {
		categories,
		bestCategory: best.category,
		bestEV: best.expectedValue,
		rollsRemaining,
	};
}

// =============================================================================
// Convenience Exports
// =============================================================================

export { ALL_CATEGORIES, CATEGORY_TO_INDEX } from './types.js';
export type { Category, DiceArray, KeptMask } from './types.js';
