/**
 * Mock for $lib/engine module
 *
 * Used for testing the engine service without actual WASM compilation.
 * Only exports the M1-M4 solver API (legacy deprecated API removed in v0.3.0).
 */

import type { Category, DiceArray, TurnAnalysis } from '$lib/types';

let initialized = false;

export async function initEngine(): Promise<void> {
	initialized = true;
	return Promise.resolve();
}

export function isEngineReady(): boolean {
	return initialized;
}

/**
 * Mock for the M1-M4 solver API.
 * Returns a recommendation to either score or reroll.
 */
export function analyzeTurn(
	dice: DiceArray,
	rollsRemaining: number,
	availableCategories: Category[],
): TurnAnalysis {
	// Check if we have a Yahtzee (all same)
	const isYahtzee = dice.every((d) => d === dice[0]);

	if (isYahtzee && availableCategories.includes('Yahtzee')) {
		return {
			action: 'score',
			recommendedCategory: 'Yahtzee',
			categoryScore: 50,
			expectedValue: 50,
			categories: availableCategories.map((cat) => ({
				category: cat,
				immediateScore: cat === 'Yahtzee' ? 50 : 0,
				isValid: true,
				expectedValue: cat === 'Yahtzee' ? 50 : 10,
			})),
		};
	}

	// If no rolls remaining, must score
	if (rollsRemaining === 0) {
		const bestCategory = availableCategories[0] ?? 'Ones';
		return {
			action: 'score',
			recommendedCategory: bestCategory,
			categoryScore: 10,
			expectedValue: 10,
			categories: availableCategories.map((cat) => ({
				category: cat,
				immediateScore: 10,
				isValid: true,
				expectedValue: 10,
			})),
		};
	}

	// Otherwise recommend reroll
	return {
		action: 'reroll',
		keepRecommendation: {
			keepPattern: [0, 0, 0, 0, 0, 0],
			explanation: 'Mock: Reroll all dice',
			expectedValue: 15,
		},
		expectedValue: 15,
		categories: availableCategories.map((cat) => ({
			category: cat,
			immediateScore: 5,
			isValid: true,
			expectedValue: 15,
		})),
	};
}

// Reset for testing
export function __resetForTesting(): void {
	initialized = false;
}
