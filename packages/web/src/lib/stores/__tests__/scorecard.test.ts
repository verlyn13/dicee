/**
 * Scorecard Pure Functions Tests
 * Tests for calculation logic without Svelte runtime
 */

import { describe, expect, it } from 'vitest';
import type { Category } from '../../types.js';
import { ALL_CATEGORIES, LOWER_CATEGORIES, UPPER_CATEGORIES } from '../../types.js';
import {
	calculateLowerTotal,
	calculateUpperBonus,
	calculateUpperSubtotal,
	createEmptyScorecard,
	getCategoriesRemaining,
	isCategoryAvailable,
} from '../scorecard.svelte.js';

// =============================================================================
// Test Fixtures
// =============================================================================

function createScores(
	partial: Partial<Record<Category, number | null>> = {},
): Record<Category, number | null> {
	const scores = {} as Record<Category, number | null>;
	for (const cat of ALL_CATEGORIES) {
		scores[cat] = partial[cat] ?? null;
	}
	return scores;
}

// =============================================================================
// createEmptyScorecard Tests
// =============================================================================

describe('createEmptyScorecard', () => {
	it('creates scorecard with all categories set to null', () => {
		const scorecard = createEmptyScorecard();

		for (const cat of ALL_CATEGORIES) {
			expect(scorecard.scores[cat]).toBeNull();
		}
	});

	it('initializes all totals to zero', () => {
		const scorecard = createEmptyScorecard();

		expect(scorecard.upperSubtotal).toBe(0);
		expect(scorecard.upperBonus).toBe(0);
		expect(scorecard.upperTotal).toBe(0);
		expect(scorecard.lowerTotal).toBe(0);
		expect(scorecard.grandTotal).toBe(0);
	});

	it('includes all 13 categories as remaining', () => {
		const scorecard = createEmptyScorecard();

		expect(scorecard.categoriesRemaining).toHaveLength(13);
		expect(scorecard.turnsCompleted).toBe(0);
	});

	it('categoriesRemaining contains all categories', () => {
		const scorecard = createEmptyScorecard();

		for (const cat of ALL_CATEGORIES) {
			expect(scorecard.categoriesRemaining).toContain(cat);
		}
	});
});

// =============================================================================
// calculateUpperSubtotal Tests
// =============================================================================

describe('calculateUpperSubtotal', () => {
	it('returns 0 for empty scorecard', () => {
		const scores = createScores();
		expect(calculateUpperSubtotal(scores)).toBe(0);
	});

	it('sums only upper section scores', () => {
		const scores = createScores({
			Ones: 3,
			Twos: 6,
			Threes: 9,
			// Lower section - should not be included
			ThreeOfAKind: 25,
		});

		expect(calculateUpperSubtotal(scores)).toBe(18);
	});

	it('sums all upper section categories when present', () => {
		const scores = createScores({
			Ones: 3,
			Twos: 6,
			Threes: 9,
			Fours: 12,
			Fives: 15,
			Sixes: 18,
		});

		expect(calculateUpperSubtotal(scores)).toBe(63);
	});

	it('treats null as 0', () => {
		const scores = createScores({
			Ones: 5,
			Twos: null,
			Threes: 15,
		});

		expect(calculateUpperSubtotal(scores)).toBe(20);
	});

	it('handles maximum possible upper section (all 5s)', () => {
		const scores = createScores({
			Ones: 5, // 5 ones
			Twos: 10, // 5 twos
			Threes: 15, // 5 threes
			Fours: 20, // 5 fours
			Fives: 25, // 5 fives
			Sixes: 30, // 5 sixes
		});

		expect(calculateUpperSubtotal(scores)).toBe(105);
	});
});

// =============================================================================
// calculateUpperBonus Tests
// =============================================================================

describe('calculateUpperBonus', () => {
	it('returns 0 when subtotal is below threshold', () => {
		expect(calculateUpperBonus(0)).toBe(0);
		expect(calculateUpperBonus(62)).toBe(0);
	});

	it('returns 35 when subtotal equals threshold', () => {
		expect(calculateUpperBonus(63)).toBe(35);
	});

	it('returns 35 when subtotal exceeds threshold', () => {
		expect(calculateUpperBonus(64)).toBe(35);
		expect(calculateUpperBonus(100)).toBe(35);
	});

	it('handles edge case at exactly 63', () => {
		expect(calculateUpperBonus(62)).toBe(0);
		expect(calculateUpperBonus(63)).toBe(35);
	});
});

// =============================================================================
// calculateLowerTotal Tests
// =============================================================================

describe('calculateLowerTotal', () => {
	it('returns 0 for empty scorecard', () => {
		const scores = createScores();
		expect(calculateLowerTotal(scores)).toBe(0);
	});

	it('sums only lower section scores', () => {
		const scores = createScores({
			// Upper section - should not be included
			Ones: 5,
			Sixes: 30,
			// Lower section
			ThreeOfAKind: 22,
			FullHouse: 25,
		});

		expect(calculateLowerTotal(scores)).toBe(47);
	});

	it('sums all lower section categories when present', () => {
		const scores = createScores({
			ThreeOfAKind: 20,
			FourOfAKind: 25,
			FullHouse: 25,
			SmallStraight: 30,
			LargeStraight: 40,
			Dicee: 50,
			Chance: 23,
		});

		expect(calculateLowerTotal(scores)).toBe(213);
	});

	it('treats null as 0', () => {
		const scores = createScores({
			FullHouse: 25,
			Dicee: null,
		});

		expect(calculateLowerTotal(scores)).toBe(25);
	});

	it('handles zeros correctly', () => {
		const scores = createScores({
			ThreeOfAKind: 0, // Failed to get three of a kind
			FullHouse: 25,
			Dicee: 0, // Failed Dicee
		});

		expect(calculateLowerTotal(scores)).toBe(25);
	});
});

// =============================================================================
// getCategoriesRemaining Tests
// =============================================================================

describe('getCategoriesRemaining', () => {
	it('returns all 13 categories for empty scorecard', () => {
		const scores = createScores();
		const remaining = getCategoriesRemaining(scores);

		expect(remaining).toHaveLength(13);
	});

	it('excludes scored categories', () => {
		const scores = createScores({
			Ones: 3,
			Dicee: 50,
		});
		const remaining = getCategoriesRemaining(scores);

		expect(remaining).toHaveLength(11);
		expect(remaining).not.toContain('Ones');
		expect(remaining).not.toContain('Dicee');
	});

	it('includes categories with score of 0', () => {
		// A category scored as 0 is still "used"
		const scores = createScores({
			Dicee: 0, // Failed Dicee attempt
		});
		const remaining = getCategoriesRemaining(scores);

		expect(remaining).toHaveLength(12);
		expect(remaining).not.toContain('Dicee');
	});

	it('returns empty array when all categories scored', () => {
		const scores = createScores({
			Ones: 3,
			Twos: 6,
			Threes: 9,
			Fours: 12,
			Fives: 15,
			Sixes: 18,
			ThreeOfAKind: 20,
			FourOfAKind: 25,
			FullHouse: 25,
			SmallStraight: 30,
			LargeStraight: 40,
			Dicee: 50,
			Chance: 23,
		});
		const remaining = getCategoriesRemaining(scores);

		expect(remaining).toHaveLength(0);
	});

	it('preserves category order', () => {
		const scores = createScores({
			Twos: 6,
			Fours: 12,
		});
		const remaining = getCategoriesRemaining(scores);

		// Should maintain ALL_CATEGORIES order
		const onesIndex = remaining.indexOf('Ones');
		const threesIndex = remaining.indexOf('Threes');
		const fivesIndex = remaining.indexOf('Fives');

		expect(onesIndex).toBeLessThan(threesIndex);
		expect(threesIndex).toBeLessThan(fivesIndex);
	});
});

// =============================================================================
// isCategoryAvailable Tests
// =============================================================================

describe('isCategoryAvailable', () => {
	it('returns true for unscored category', () => {
		const scores = createScores();

		expect(isCategoryAvailable(scores, 'Ones')).toBe(true);
		expect(isCategoryAvailable(scores, 'Dicee')).toBe(true);
	});

	it('returns false for scored category', () => {
		const scores = createScores({
			Ones: 3,
		});

		expect(isCategoryAvailable(scores, 'Ones')).toBe(false);
	});

	it('returns false for category scored as 0', () => {
		const scores = createScores({
			Dicee: 0,
		});

		expect(isCategoryAvailable(scores, 'Dicee')).toBe(false);
	});

	it('correctly identifies mixed availability', () => {
		const scores = createScores({
			Ones: 4,
			Threes: 0,
			FullHouse: 25,
		});

		expect(isCategoryAvailable(scores, 'Ones')).toBe(false);
		expect(isCategoryAvailable(scores, 'Twos')).toBe(true);
		expect(isCategoryAvailable(scores, 'Threes')).toBe(false);
		expect(isCategoryAvailable(scores, 'FullHouse')).toBe(false);
		expect(isCategoryAvailable(scores, 'Dicee')).toBe(true);
	});
});

// =============================================================================
// Integration: Full Scorecard Calculation Flow
// =============================================================================

describe('Scorecard Calculation Integration', () => {
	it('calculates correct totals for complete game', () => {
		const scores = createScores({
			// Upper: 3+6+9+12+15+18 = 63 → bonus = 35
			Ones: 3,
			Twos: 6,
			Threes: 9,
			Fours: 12,
			Fives: 15,
			Sixes: 18,
			// Lower: 20+25+25+30+40+50+23 = 213
			ThreeOfAKind: 20,
			FourOfAKind: 25,
			FullHouse: 25,
			SmallStraight: 30,
			LargeStraight: 40,
			Dicee: 50,
			Chance: 23,
		});

		const upperSubtotal = calculateUpperSubtotal(scores);
		const upperBonus = calculateUpperBonus(upperSubtotal);
		const lowerTotal = calculateLowerTotal(scores);
		const grandTotal = upperSubtotal + upperBonus + lowerTotal;

		expect(upperSubtotal).toBe(63);
		expect(upperBonus).toBe(35);
		expect(lowerTotal).toBe(213);
		expect(grandTotal).toBe(311);
	});

	it('calculates correct totals when bonus not achieved', () => {
		const scores = createScores({
			// Upper: 2+4+6+8+10+12 = 42 (below 63, no bonus)
			Ones: 2,
			Twos: 4,
			Threes: 6,
			Fours: 8,
			Fives: 10,
			Sixes: 12,
			// Lower: 15+20+25+30+40+0+15 = 145
			ThreeOfAKind: 15,
			FourOfAKind: 20,
			FullHouse: 25,
			SmallStraight: 30,
			LargeStraight: 40,
			Dicee: 0,
			Chance: 15,
		});

		const upperSubtotal = calculateUpperSubtotal(scores);
		const upperBonus = calculateUpperBonus(upperSubtotal);
		const lowerTotal = calculateLowerTotal(scores);
		const grandTotal = upperSubtotal + upperBonus + lowerTotal;

		expect(upperSubtotal).toBe(42);
		expect(upperBonus).toBe(0);
		expect(lowerTotal).toBe(145);
		expect(grandTotal).toBe(187);
	});
});

// =============================================================================
// Type Safety Tests
// =============================================================================

describe('Type Safety', () => {
	it('UPPER_CATEGORIES has exactly 6 categories', () => {
		expect(UPPER_CATEGORIES).toHaveLength(6);
	});

	it('LOWER_CATEGORIES has exactly 7 categories', () => {
		expect(LOWER_CATEGORIES).toHaveLength(7);
	});

	it('ALL_CATEGORIES has exactly 13 categories', () => {
		expect(ALL_CATEGORIES).toHaveLength(13);
	});

	it('ALL_CATEGORIES contains all upper and lower categories', () => {
		for (const cat of UPPER_CATEGORIES) {
			expect(ALL_CATEGORIES).toContain(cat);
		}
		for (const cat of LOWER_CATEGORIES) {
			expect(ALL_CATEGORIES).toContain(cat);
		}
	});

	it('upper and lower categories are disjoint', () => {
		const upperSet = new Set<string>(UPPER_CATEGORIES);
		for (const cat of LOWER_CATEGORIES) {
			expect(upperSet.has(cat)).toBe(false);
		}
	});
});
