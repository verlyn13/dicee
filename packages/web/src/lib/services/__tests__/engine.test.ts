/**
 * Engine Service Integration Tests
 *
 * Tests for the WASM engine service layer, including the new M1-M4 solver API.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Category, DiceArray } from '$lib/types';
import { ALL_CATEGORIES } from '$lib/types';

// Mock the engine module
vi.mock('$lib/engine', () => import('../__mocks__/engine-module'));

describe('Engine Service', () => {
	beforeEach(async () => {
		vi.clearAllMocks();
		// Reset the engine state
		const { __resetForTesting } = await import('../__mocks__/engine-module');
		__resetForTesting();
	});

	describe('initializeEngine', () => {
		it('initializes successfully', async () => {
			const { initializeEngine, isEngineReady } = await import('../engine');

			expect(isEngineReady()).toBe(false);
			await initializeEngine();
			expect(isEngineReady()).toBe(true);
		});

		it('handles concurrent initialization', async () => {
			const { initializeEngine, resetEngine } = await import('../engine');
			resetEngine();

			// Start multiple initializations concurrently
			const results = await Promise.all([
				initializeEngine(),
				initializeEngine(),
				initializeEngine(),
			]);

			// All should resolve without error
			expect(results).toHaveLength(3);
		});
	});

	describe('analyzeTurnOptimal', () => {
		it('returns valid TurnAnalysis for Yahtzee dice', async () => {
			const { initializeEngine, isNewEngineEnabled } = await import('../engine');
			const { analyzeTurnOptimal } = await import('../engine');
			await initializeEngine();

			const dice: DiceArray = [5, 5, 5, 5, 5];
			const rollsRemaining = 2;
			const availableCategories: Category[] = [...ALL_CATEGORIES];

			const result = await analyzeTurnOptimal(dice, rollsRemaining, availableCategories);

			// Both modes should return a valid TurnAnalysis
			expect(result.action).toMatch(/^(score|reroll)$/);
			expect(result.expectedValue).toBeGreaterThanOrEqual(0);
			expect(result.categories).toBeDefined();

			// New engine should recommend scoring Yahtzee immediately
			if (isNewEngineEnabled() && result.action === 'score') {
				expect(result.recommendedCategory).toBe('Yahtzee');
				expect(result.categoryScore).toBe(50);
			}
		});

		it('recommends reroll when rolls remain and not optimal', async () => {
			const { initializeEngine } = await import('../engine');
			const { analyzeTurnOptimal } = await import('../engine');
			await initializeEngine();

			const dice: DiceArray = [1, 2, 3, 4, 5];
			const rollsRemaining = 2;
			const availableCategories: Category[] = [...ALL_CATEGORIES];

			const result = await analyzeTurnOptimal(dice, rollsRemaining, availableCategories);

			expect(result.action).toBe('reroll');
			expect(result.keepRecommendation).toBeDefined();
			expect(result.keepRecommendation?.keepPattern).toHaveLength(6);
		});

		it('recommends score when no rolls remaining', async () => {
			const { initializeEngine } = await import('../engine');
			const { analyzeTurnOptimal } = await import('../engine');
			await initializeEngine();

			const dice: DiceArray = [1, 2, 3, 4, 6];
			const rollsRemaining = 0;
			const availableCategories: Category[] = ['Ones', 'Twos', 'Chance'];

			const result = await analyzeTurnOptimal(dice, rollsRemaining, availableCategories);

			expect(result.action).toBe('score');
			expect(result.recommendedCategory).toBeDefined();
		});

		it('returns category analysis for all available categories', async () => {
			const { initializeEngine } = await import('../engine');
			const { analyzeTurnOptimal } = await import('../engine');
			await initializeEngine();

			const dice: DiceArray = [3, 3, 3, 4, 5];
			const rollsRemaining = 1;
			const availableCategories: Category[] = ['Threes', 'ThreeOfAKind', 'Chance'];

			const result = await analyzeTurnOptimal(dice, rollsRemaining, availableCategories);

			expect(result.categories).toBeDefined();
			expect(result.categories.length).toBeGreaterThan(0);

			// Each category should have expected fields
			for (const cat of result.categories) {
				expect(cat.category).toBeDefined();
				expect(typeof cat.immediateScore).toBe('number');
				expect(typeof cat.expectedValue).toBe('number');
				expect(typeof cat.isValid).toBe('boolean');
			}
		});

		it('returns expected value for the position', async () => {
			const { initializeEngine } = await import('../engine');
			const { analyzeTurnOptimal } = await import('../engine');
			await initializeEngine();

			const dice: DiceArray = [6, 6, 6, 6, 1];
			const rollsRemaining = 1;
			const availableCategories: Category[] = ['Sixes', 'FourOfAKind', 'Yahtzee'];

			const result = await analyzeTurnOptimal(dice, rollsRemaining, availableCategories);

			expect(typeof result.expectedValue).toBe('number');
			expect(result.expectedValue).toBeGreaterThanOrEqual(0);
		});
	});

	describe('isNewEngineEnabled', () => {
		it('returns boolean value', async () => {
			const { isNewEngineEnabled } = await import('../engine');

			const enabled = isNewEngineEnabled();

			expect(typeof enabled).toBe('boolean');
		});
	});
});

describe('TurnAnalysis Type Validation', () => {
	it('TurnAnalysis has required fields when action is score', async () => {
		const { initializeEngine } = await import('../engine');
		const { analyzeTurnOptimal } = await import('../engine');
		await initializeEngine();

		const dice: DiceArray = [5, 5, 5, 5, 5];
		const result = await analyzeTurnOptimal(dice, 0, ['Yahtzee']);

		// Type guard: when action is 'score', these should be defined
		if (result.action === 'score') {
			expect(result.recommendedCategory).toBeDefined();
			// categoryScore may be defined
		}
	});

	it('TurnAnalysis has required fields when action is reroll', async () => {
		const { initializeEngine } = await import('../engine');
		const { analyzeTurnOptimal } = await import('../engine');
		await initializeEngine();

		const dice: DiceArray = [1, 2, 3, 4, 6];
		const result = await analyzeTurnOptimal(dice, 2, ALL_CATEGORIES as unknown as Category[]);

		// Type guard: when action is 'reroll', keepRecommendation should be defined
		if (result.action === 'reroll') {
			expect(result.keepRecommendation).toBeDefined();
			expect(result.keepRecommendation?.keepPattern).toHaveLength(6);
			expect(typeof result.keepRecommendation?.explanation).toBe('string');
			expect(typeof result.keepRecommendation?.expectedValue).toBe('number');
		}
	});
});
