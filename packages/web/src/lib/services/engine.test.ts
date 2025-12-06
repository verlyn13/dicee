/**
 * WASM Engine Service Tests
 *
 * Tests lazy loading, error handling, and M1-M4 solver API.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Category, DiceArray, TurnAnalysis } from '$lib/types';
import {
	analyzeTurnOptimal,
	EngineInitError,
	getEngineState,
	initializeEngine,
	isEngineReady,
	isNewEngineEnabled,
	preloadEngine,
	resetEngine,
} from './engine';

// =============================================================================
// Mocks
// =============================================================================

// Mock the entire $lib/engine module with new API only
vi.mock('$lib/engine', () => ({
	initEngine: vi.fn(async () => Promise.resolve()),
	isEngineReady: vi.fn(() => true),
	analyzeTurn: vi.fn((dice: DiceArray, rollsRemaining: number, categories: Category[]) => {
		// Check for Yahtzee
		const isYahtzee = dice.every((d) => d === dice[0]);

		if (isYahtzee && categories.includes('Yahtzee')) {
			return {
				action: 'score',
				recommendedCategory: 'Yahtzee',
				categoryScore: 50,
				expectedValue: 50,
				categories: categories.map((cat) => ({
					category: cat,
					immediateScore: cat === 'Yahtzee' ? 50 : 0,
					isValid: true,
					expectedValue: cat === 'Yahtzee' ? 50 : 10,
				})),
			} satisfies TurnAnalysis;
		}

		if (rollsRemaining === 0) {
			return {
				action: 'score',
				recommendedCategory: categories[0],
				categoryScore: 10,
				expectedValue: 10,
				categories: categories.map((cat) => ({
					category: cat,
					immediateScore: 10,
					isValid: true,
					expectedValue: 10,
				})),
			} satisfies TurnAnalysis;
		}

		return {
			action: 'reroll',
			keepRecommendation: {
				keepPattern: [0, 0, 0, 0, 0, 0],
				explanation: 'Mock: Reroll all',
				expectedValue: 15,
			},
			expectedValue: 15,
			categories: categories.map((cat) => ({
				category: cat,
				immediateScore: 5,
				isValid: true,
				expectedValue: 15,
			})),
		} satisfies TurnAnalysis;
	}),
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

	describe('analyzeTurnOptimal', () => {
		it('recommends scoring Yahtzee when applicable', async () => {
			const dice: DiceArray = [5, 5, 5, 5, 5];
			const categories: Category[] = ['Yahtzee', 'Fives', 'Chance'];

			const analysis = await analyzeTurnOptimal(dice, 2, categories);

			expect(analysis.action).toBe('score');
			expect(analysis.recommendedCategory).toBe('Yahtzee');
			expect(analysis.categoryScore).toBe(50);
			expect(analysis.expectedValue).toBe(50);
		});

		it('recommends reroll when rolls remain', async () => {
			const dice: DiceArray = [1, 2, 3, 4, 6];
			const categories: Category[] = ['Ones', 'Twos', 'LargeStraight'];

			const analysis = await analyzeTurnOptimal(dice, 2, categories);

			expect(analysis.action).toBe('reroll');
			expect(analysis.keepRecommendation).toBeDefined();
			expect(analysis.keepRecommendation?.keepPattern).toHaveLength(6);
		});

		it('recommends score when no rolls remaining', async () => {
			const dice: DiceArray = [1, 2, 3, 4, 6];
			const categories: Category[] = ['Ones', 'Twos', 'Chance'];

			const analysis = await analyzeTurnOptimal(dice, 0, categories);

			expect(analysis.action).toBe('score');
			expect(analysis.recommendedCategory).toBeDefined();
		});

		it('returns category analysis for all available categories', async () => {
			const dice: DiceArray = [3, 3, 3, 4, 5];
			const categories: Category[] = ['Threes', 'ThreeOfAKind', 'Chance'];

			const analysis = await analyzeTurnOptimal(dice, 1, categories);

			expect(analysis.categories).toHaveLength(3);
			for (const cat of analysis.categories) {
				expect(cat.category).toBeDefined();
				expect(typeof cat.immediateScore).toBe('number');
				expect(typeof cat.expectedValue).toBe('number');
				expect(typeof cat.isValid).toBe('boolean');
			}
		});

		it('initializes engine if not ready', async () => {
			expect(getEngineState()).toBe('uninitialized');

			const dice: DiceArray = [1, 2, 3, 4, 5];
			await analyzeTurnOptimal(dice, 1, ['Ones']);

			expect(getEngineState()).toBe('ready');
			expect(mockEngine.initEngine).toHaveBeenCalledOnce();
		});
	});

	describe('isNewEngineEnabled', () => {
		it('always returns true in v0.3.0+', () => {
			expect(isNewEngineEnabled()).toBe(true);
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
