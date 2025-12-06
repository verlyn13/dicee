/**
 * WASM Engine Integration Layer
 * Bridges Rust probability engine with TypeScript game state
 */

import type {
	Category,
	CategoryAnalysis,
	DiceArray,
	KeepPattern,
	KeepRecommendation,
	TurnAction,
	TurnAnalysis,
} from './types.js';
import { ALL_CATEGORIES, CATEGORY_TO_INDEX } from './types.js';
import init, { analyze_turn } from './wasm/dicee_engine.js';

// =============================================================================
// WASM Result Types (from M1-M4 Solver)
// =============================================================================
interface WasmCategoryAnalysis {
	category: number; // category index (0-12)
	immediate_score: number;
	is_valid: boolean;
	expected_value: number;
}

interface WasmTurnAnalysis {
	action: 'score' | 'reroll';
	recommended_category: number | null; // category index or null
	category_score: number | null;
	keep_pattern: [number, number, number, number, number, number] | null;
	keep_explanation: string | null;
	expected_value: number;
	categories: WasmCategoryAnalysis[];
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
// Core Functions
// =============================================================================

/**
 * Convert an array of available categories to a bitmask.
 * Bit 0 = Ones, Bit 1 = Twos, ..., Bit 12 = Chance
 */
function categoriesToBitmask(categories: Category[]): number {
	let bitmask = 0;
	for (const category of categories) {
		const index = CATEGORY_TO_INDEX[category];
		bitmask |= 1 << index;
	}
	return bitmask;
}

/**
 * Map a WASM category analysis result to TypeScript type.
 */
function mapCategoryAnalysis(wasm: WasmCategoryAnalysis): CategoryAnalysis {
	return {
		category: ALL_CATEGORIES[wasm.category],
		immediateScore: wasm.immediate_score,
		isValid: wasm.is_valid,
		expectedValue: wasm.expected_value,
	};
}

/**
 * Analyze current turn position using the M1-M4 solver.
 * Returns optimal strategy recommendation (score vs reroll).
 *
 * @param dice - Current dice values (5 dice, values 1-6)
 * @param rollsRemaining - Number of rolls remaining (0-2)
 * @param availableCategories - Categories not yet scored
 * @returns TurnAnalysis with recommended action and expected value
 */
export function analyzeTurn(
	dice: DiceArray,
	rollsRemaining: number,
	availableCategories: Category[],
): TurnAnalysis {
	// Validate inputs
	if (dice.length !== 5) {
		throw new Error(`Invalid dice array length: ${dice.length}, expected 5`);
	}
	if (dice.some((d) => d < 1 || d > 6)) {
		throw new Error(`Invalid die value in: [${dice.join(', ')}]`);
	}
	if (rollsRemaining < 0 || rollsRemaining > 2) {
		throw new Error(`Invalid rolls remaining: ${rollsRemaining}, expected 0-2`);
	}
	if (availableCategories.length === 0) {
		throw new Error('No available categories provided');
	}

	// Convert to WASM types
	const diceBytes = new Uint8Array(dice);
	const categoryBitmask = categoriesToBitmask(availableCategories);

	// Call WASM solver
	const result = analyze_turn(diceBytes, rollsRemaining, categoryBitmask) as WasmTurnAnalysis;

	// Build keep recommendation if action is reroll
	let keepRecommendation: KeepRecommendation | undefined;
	if (result.action === 'reroll' && result.keep_pattern !== null) {
		keepRecommendation = {
			keepPattern: result.keep_pattern as KeepPattern,
			explanation: result.keep_explanation ?? 'Keep optimal dice',
			expectedValue: result.expected_value,
		};
	}

	// Map category analysis
	const categories = result.categories.map(mapCategoryAnalysis);

	// Build result
	const turnAnalysis: TurnAnalysis = {
		action: result.action as TurnAction,
		expectedValue: result.expected_value,
		categories,
	};

	// Add optional fields based on action
	if (result.action === 'score' && result.recommended_category !== null) {
		turnAnalysis.recommendedCategory = ALL_CATEGORIES[result.recommended_category];
		turnAnalysis.categoryScore = result.category_score ?? undefined;
	}

	if (keepRecommendation) {
		turnAnalysis.keepRecommendation = keepRecommendation;
	}

	return turnAnalysis;
}

// =============================================================================
// Convenience Exports
// =============================================================================

export type {
	Category,
	CategoryAnalysis,
	DiceArray,
	KeepPattern,
	KeepRecommendation,
	TurnAction,
	TurnAnalysis,
} from './types.js';
export { ALL_CATEGORIES, CATEGORY_TO_INDEX } from './types.js';
