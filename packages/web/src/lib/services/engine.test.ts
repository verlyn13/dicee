/**
 * WASM Engine Service Tests
 *
 * Tests lazy loading, error handling, and API correctness.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DiceArray, KeptMask } from '$lib/types';
import {
	calculateCategoryScore,
	calculateProbabilities,
	calculateScores,
	EngineInitError,
	getBestCategory,
	getEngineState,
	initializeEngine,
	isEngineReady,
	preloadEngine,
	resetEngine,
} from './engine';

// =============================================================================
// Mocks
// =============================================================================

// Mock the entire $lib/engine module
vi.mock('$lib/engine', () => ({
	initEngine: vi.fn(async () => Promise.resolve()),
	isEngineReady: vi.fn(() => true),
	scoreCategory: vi.fn((_dice: DiceArray, category: string) => ({
		category,
		score: 10,
		valid: true,
	})),
	scoreAllCategories: vi.fn((_dice: DiceArray) => [
		{ category: 'Ones', score: 2, valid: true },
		{ category: 'Twos', score: 0, valid: true },
		{ category: 'Threes', score: 3, valid: true },
	]),
	getScore: vi.fn((_dice: DiceArray, _category: string) => 10),
	calculateProbabilities: vi.fn((_dice: DiceArray, _kept: KeptMask, _rollsRemaining: number) => ({
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
	})),
}));

// Get typed mock references
const mockEngine = vi.mocked(await import('$lib/engine'));

// =============================================================================
// Test Suite
// =============================================================================

describe('engine service', () => {
	beforeEach(() => {
		// Reset engine state before each test
		resetEngine();
		vi.clearAllMocks();
	});

	describe('initialization', () => {
		it('starts in uninitialized state', () => {
			expect(getEngineState()).toBe('uninitialized');
			expect(isEngineReady()).toBe(false);
		});

		it('transitions to ready state after initialization', async () => {
			expect(getEngineState()).toBe('uninitialized');

			await initializeEngine();

			expect(getEngineState()).toBe('ready');
			expect(isEngineReady()).toBe(true);
			expect(mockEngine.initEngine).toHaveBeenCalledOnce();
		});

		it('returns immediately on subsequent calls', async () => {
			await initializeEngine();
			await initializeEngine();
			await initializeEngine();

			// initEngine should only be called once
			expect(mockEngine.initEngine).toHaveBeenCalledOnce();
		});

		it('handles concurrent initialization requests', async () => {
			// Start multiple initializations concurrently
			const promises = [initializeEngine(), initializeEngine(), initializeEngine()];

			await Promise.all(promises);

			// WASM should only initialize once
			expect(mockEngine.initEngine).toHaveBeenCalledOnce();
		});

		it('throws EngineInitError on WASM load failure', async () => {
			// Reset and configure mock to fail
			resetEngine();
			mockEngine.initEngine.mockRejectedValueOnce(new Error('WASM compilation failed'));

			await expect(initializeEngine()).rejects.toThrow(EngineInitError);
			await expect(initializeEngine()).rejects.toThrow(
				'Failed to initialize WASM probability engine',
			);

			expect(getEngineState()).toBe('failed');
		});

		it('caches initialization failure', async () => {
			// Reset and configure mock to fail
			resetEngine();
			mockEngine.initEngine.mockRejectedValueOnce(new Error('WASM compilation failed'));

			// First call fails
			await expect(initializeEngine()).rejects.toThrow(EngineInitError);

			// Subsequent calls should throw same error without retrying
			await expect(initializeEngine()).rejects.toThrow(EngineInitError);

			// WASM should only attempt initialization once
			expect(mockEngine.initEngine).toHaveBeenCalledOnce();
		});
	});

	describe('resetEngine', () => {
		it('resets state to uninitialized', async () => {
			await initializeEngine();
			expect(getEngineState()).toBe('ready');

			resetEngine();

			expect(getEngineState()).toBe('uninitialized');
			expect(isEngineReady()).toBe(false);
		});

		it('allows re-initialization after reset', async () => {
			await initializeEngine();
			resetEngine();

			await initializeEngine();

			expect(getEngineState()).toBe('ready');
		});
	});

	describe('calculateScores', () => {
		it('returns scores for all categories', async () => {
			const dice: DiceArray = [1, 1, 3, 4, 6];

			const scores = await calculateScores(dice);

			expect(scores).toEqual([
				{ category: 'Ones', score: 2, valid: true },
				{ category: 'Twos', score: 0, valid: true },
				{ category: 'Threes', score: 3, valid: true },
			]);

			expect(mockEngine.scoreAllCategories).toHaveBeenCalledOnce();
		});

		it('initializes engine if not ready', async () => {
			expect(getEngineState()).toBe('uninitialized');

			const dice: DiceArray = [1, 2, 3, 4, 5];
			await calculateScores(dice);

			expect(getEngineState()).toBe('ready');
			expect(mockEngine.initEngine).toHaveBeenCalledOnce();
		});
	});

	describe('calculateProbabilities', () => {
		it('returns probability data for available categories', async () => {
			const dice: DiceArray = [6, 6, 3, 2, 1];
			const kept: KeptMask = [true, true, false, false, false];

			const probs = await calculateProbabilities(dice, kept, 2);

			expect(probs).toEqual([
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
			]);

			expect(mockEngine.calculateProbabilities).toHaveBeenCalledOnce();
		});

		it('initializes engine if not ready', async () => {
			expect(getEngineState()).toBe('uninitialized');

			const dice: DiceArray = [1, 2, 3, 4, 5];
			const kept: KeptMask = [false, false, false, false, false];
			await calculateProbabilities(dice, kept);

			expect(getEngineState()).toBe('ready');
		});
	});

	describe('calculateCategoryScore', () => {
		it('returns score for specific category', async () => {
			const dice: DiceArray = [1, 1, 3, 4, 6];

			const score = await calculateCategoryScore(dice, 'Ones');

			expect(score).toBe(10);
		});
	});

	describe('getBestCategory', () => {
		it('returns category with highest expected value', async () => {
			const dice: DiceArray = [6, 6, 3, 2, 1];
			const kept: KeptMask = [true, true, false, false, false];

			const best = await getBestCategory(dice, kept);

			expect(best).toEqual({
				category: 'Sixes',
				expectedValue: 4.8,
			});
		});

		it('returns null if no categories available', async () => {
			// Mock empty response
			mockEngine.calculateProbabilities.mockReturnValueOnce({
				categories: [],
				bestCategory: 'Ones' as const,
				bestEV: 0,
			});

			const dice: DiceArray = [1, 2, 3, 4, 5];
			const kept: KeptMask = [false, false, false, false, false];

			const best = await getBestCategory(dice, kept);

			expect(best).toBeNull();
		});
	});

	describe('preloadEngine', () => {
		it('initializes engine without blocking', () => {
			// Should not throw
			expect(() => preloadEngine()).not.toThrow();
		});

		it('handles initialization failures gracefully', async () => {
			resetEngine();
			mockEngine.initEngine.mockRejectedValueOnce(new Error('Network error'));

			const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {
				/* Suppress console output in tests */
			});

			preloadEngine();

			// Wait for promise to settle
			await new Promise((resolve) => setTimeout(resolve, 10));

			expect(consoleWarnSpy).toHaveBeenCalledWith(
				expect.stringContaining('Engine preload failed'),
				expect.any(EngineInitError),
			);

			consoleWarnSpy.mockRestore();
		});
	});

	describe('error handling', () => {
		it('propagates WASM errors with context', async () => {
			resetEngine();
			const originalError = new Error('Out of memory');
			mockEngine.initEngine.mockRejectedValueOnce(originalError);

			try {
				await initializeEngine();
				expect.fail('Should have thrown');
			} catch (err) {
				expect(err).toBeInstanceOf(EngineInitError);
				expect((err as EngineInitError).cause).toBe(originalError);
			}
		});

		it('maintains error state across calls', async () => {
			resetEngine();
			mockEngine.initEngine.mockRejectedValueOnce(new Error('Failure'));

			const error1 = await initializeEngine().catch((e) => e);
			const error2 = await initializeEngine().catch((e) => e);

			expect(error1).toBe(error2); // Same error instance
			expect(mockEngine.initEngine).toHaveBeenCalledOnce(); // No retry
		});
	});
});
