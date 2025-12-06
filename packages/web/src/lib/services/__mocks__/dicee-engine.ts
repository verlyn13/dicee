/**
 * Mock WASM Engine Module
 *
 * Used for testing the engine service without actual WASM compilation.
 */

export default async function init(): Promise<void> {
	// Simulate WASM initialization
	return Promise.resolve();
}

export function calculate_category_scores(_dice: Uint8Array): Uint8Array {
	// Mock response: simple JSON encoding
	const result = [
		{ category: 'Ones', score: 2, valid: true },
		{ category: 'Twos', score: 0, valid: true },
		{ category: 'Threes', score: 3, valid: true },
	];
	const json = JSON.stringify(result);
	return new TextEncoder().encode(json);
}

export function calculate_probabilities(_dice: Uint8Array, _kept: Uint8Array): Uint8Array {
	// Mock response: probability data
	const result = [
		{
			category: 'Ones',
			probability: 0.5,
			expectedValue: 2.5,
			currentScore: 2,
			isOptimal: false,
		},
		{
			category: 'Sixes',
			probability: 0.3,
			expectedValue: 4.8,
			currentScore: 0,
			isOptimal: true,
		},
	];
	const json = JSON.stringify(result);
	return new TextEncoder().encode(json);
}

/**
 * Mock for the new M1-M4 solver WASM export.
 * Returns a TurnAnalysisJs structure.
 */
export function analyze_turn(
	dice: Uint8Array,
	rolls_remaining: number,
	available_categories: number,
): {
	action: 'score' | 'reroll';
	recommended_category: number | null;
	category_score: number | null;
	keep_pattern: [number, number, number, number, number, number] | null;
	keep_explanation: string | null;
	expected_value: number;
	categories: Array<{
		category: number;
		immediate_score: number;
		is_valid: boolean;
		expected_value: number;
	}>;
} {
	// Check if all dice are the same (Yahtzee)
	const diceArray = Array.from(dice);
	const isYahtzee = diceArray.every((d) => d === diceArray[0]);

	// Check if Yahtzee category is available (bit 11)
	const yahtzeeAvailable = (available_categories & (1 << 11)) !== 0;

	if (isYahtzee && yahtzeeAvailable) {
		return {
			action: 'score',
			recommended_category: 11, // Yahtzee
			category_score: 50,
			keep_pattern: null,
			keep_explanation: null,
			expected_value: 50,
			categories: [{ category: 11, immediate_score: 50, is_valid: true, expected_value: 50 }],
		};
	}

	// If no rolls remaining, score the first available category
	if (rolls_remaining === 0) {
		// Find first available category
		let firstCategory = 0;
		for (let i = 0; i < 13; i++) {
			if ((available_categories & (1 << i)) !== 0) {
				firstCategory = i;
				break;
			}
		}

		return {
			action: 'score',
			recommended_category: firstCategory,
			category_score: 10,
			keep_pattern: null,
			keep_explanation: null,
			expected_value: 10,
			categories: [
				{ category: firstCategory, immediate_score: 10, is_valid: true, expected_value: 10 },
			],
		};
	}

	// Otherwise recommend reroll
	return {
		action: 'reroll',
		recommended_category: null,
		category_score: null,
		keep_pattern: [0, 0, 0, 0, 0, 0],
		keep_explanation: 'Mock: Reroll all dice',
		expected_value: 15,
		categories: [{ category: 0, immediate_score: 5, is_valid: true, expected_value: 15 }],
	};
}
