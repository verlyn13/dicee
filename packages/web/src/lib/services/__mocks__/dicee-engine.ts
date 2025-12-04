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
