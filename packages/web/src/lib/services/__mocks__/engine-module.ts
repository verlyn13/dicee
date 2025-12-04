/**
 * Mock for $lib/engine module
 *
 * Used for testing the engine service without actual WASM compilation.
 */

import type { Category, DiceArray, KeptMask } from '$lib/types';

let initialized = false;

export async function initEngine(): Promise<void> {
	initialized = true;
	return Promise.resolve();
}

export function isEngineReady(): boolean {
	return initialized;
}

export function scoreCategory(
	_dice: DiceArray,
	_category: Category,
): { category: Category; score: number; valid: boolean } {
	return {
		category: _category,
		score: 10,
		valid: true,
	};
}

export function scoreAllCategories(
	_dice: DiceArray,
): Array<{ category: Category; score: number; valid: boolean }> {
	return [
		{ category: 'Ones', score: 2, valid: true },
		{ category: 'Twos', score: 0, valid: true },
		{ category: 'Threes', score: 3, valid: true },
	];
}

export function getScore(_dice: DiceArray, _category: Category): number {
	return 10;
}

export function calculateProbabilities(
	_dice: DiceArray,
	_kept: KeptMask,
	_rollsRemaining: number,
): {
	categories: Array<{
		category: Category;
		probability: number;
		expectedValue: number;
		currentScore: number;
		isOptimal: boolean;
	}>;
	bestCategory: Category;
	bestEV: number;
} {
	return {
		categories: [
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
		],
		bestCategory: 'Sixes',
		bestEV: 4.8,
	};
}

export function analyzePosition(
	_dice: DiceArray,
	_kept: KeptMask,
	_rollsRemaining: number,
	_availableCategories: Category[],
) {
	return calculateProbabilities(_dice, _kept, _rollsRemaining);
}

// Reset for testing
export function __resetForTesting(): void {
	initialized = false;
}
