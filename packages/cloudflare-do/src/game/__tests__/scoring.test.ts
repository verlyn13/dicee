/**
 * Scoring Module Unit Tests
 *
 * Tests for all Dicee scoring calculations.
 * Pure functions - no mocking required.
 */

import { describe, it, expect } from 'vitest';
import {
	generateDice,
	rollWithKept,
	calculateCategoryScore,
	calculateAllPotentialScores,
	applyScore,
	calculateTotal,
} from '../scoring';
import { createEmptyScorecard } from '../types';
import type { DiceArray, Scorecard } from '../types';

// =============================================================================
// Test Helpers
// =============================================================================

/** Create dice array with specific values */
function dice(d1: number, d2: number, d3: number, d4: number, d5: number): DiceArray {
	return [d1, d2, d3, d4, d5];
}

// =============================================================================
// generateDice Tests
// =============================================================================

describe('generateDice', () => {
	it('should generate exactly 5 dice', () => {
		const result = generateDice(5);
		expect(result).toHaveLength(5);
	});

	it('should generate values between 1 and 6', () => {
		// Run multiple times to increase confidence
		for (let i = 0; i < 100; i++) {
			const result = generateDice(5);
			for (const value of result) {
				expect(value).toBeGreaterThanOrEqual(1);
				expect(value).toBeLessThanOrEqual(6);
			}
		}
	});

	it('should generate different values over multiple calls', () => {
		const results = new Set<string>();
		// Generate 100 times - with 7776 possible combinations, we should get variety
		for (let i = 0; i < 100; i++) {
			results.add(JSON.stringify(generateDice(5)));
		}
		// Should have at least 50 different combinations (statistically very likely)
		expect(results.size).toBeGreaterThan(50);
	});
});

// =============================================================================
// rollWithKept Tests
// =============================================================================

describe('rollWithKept', () => {
	it('should return all new dice when current is null', () => {
		const kept: [boolean, boolean, boolean, boolean, boolean] = [false, false, false, false, false];
		const result = rollWithKept(null, kept);

		expect(result).toHaveLength(5);
		for (const value of result) {
			expect(value).toBeGreaterThanOrEqual(1);
			expect(value).toBeLessThanOrEqual(6);
		}
	});

	it('should keep dice marked as kept', () => {
		const current: DiceArray = [1, 2, 3, 4, 5];
		const kept: [boolean, boolean, boolean, boolean, boolean] = [true, false, true, false, true];

		// Run multiple times to ensure kept dice are preserved
		for (let i = 0; i < 10; i++) {
			const result = rollWithKept(current, kept);
			expect(result[0]).toBe(1); // kept
			expect(result[2]).toBe(3); // kept
			expect(result[4]).toBe(5); // kept
		}
	});

	it('should reroll dice not marked as kept', () => {
		const current: DiceArray = [1, 1, 1, 1, 1];
		const kept: [boolean, boolean, boolean, boolean, boolean] = [true, true, true, true, false];

		// After many rolls, the 5th die should eventually not be 1
		let foundDifferent = false;
		for (let i = 0; i < 100 && !foundDifferent; i++) {
			const result = rollWithKept(current, kept);
			if (result[4] !== 1) {
				foundDifferent = true;
			}
		}
		expect(foundDifferent).toBe(true);
	});

	it('should keep all dice when all marked as kept', () => {
		const current: DiceArray = [3, 3, 3, 3, 3];
		const kept: [boolean, boolean, boolean, boolean, boolean] = [true, true, true, true, true];

		const result = rollWithKept(current, kept);
		expect(result).toEqual([3, 3, 3, 3, 3]);
	});
});

// =============================================================================
// Upper Section Scoring Tests
// =============================================================================

describe('calculateCategoryScore - Upper Section', () => {
	it('should calculate ones correctly', () => {
		expect(calculateCategoryScore(dice(1, 1, 1, 2, 3), 'ones')).toBe(3);
		expect(calculateCategoryScore(dice(1, 1, 1, 1, 1), 'ones')).toBe(5);
		expect(calculateCategoryScore(dice(2, 3, 4, 5, 6), 'ones')).toBe(0);
	});

	it('should calculate twos correctly', () => {
		expect(calculateCategoryScore(dice(2, 2, 1, 3, 4), 'twos')).toBe(4);
		expect(calculateCategoryScore(dice(2, 2, 2, 2, 2), 'twos')).toBe(10);
		expect(calculateCategoryScore(dice(1, 3, 4, 5, 6), 'twos')).toBe(0);
	});

	it('should calculate threes correctly', () => {
		expect(calculateCategoryScore(dice(3, 3, 3, 1, 2), 'threes')).toBe(9);
		expect(calculateCategoryScore(dice(3, 3, 3, 3, 3), 'threes')).toBe(15);
		expect(calculateCategoryScore(dice(1, 2, 4, 5, 6), 'threes')).toBe(0);
	});

	it('should calculate fours correctly', () => {
		expect(calculateCategoryScore(dice(4, 4, 1, 2, 3), 'fours')).toBe(8);
		expect(calculateCategoryScore(dice(4, 4, 4, 4, 4), 'fours')).toBe(20);
		expect(calculateCategoryScore(dice(1, 2, 3, 5, 6), 'fours')).toBe(0);
	});

	it('should calculate fives correctly', () => {
		expect(calculateCategoryScore(dice(5, 5, 5, 1, 2), 'fives')).toBe(15);
		expect(calculateCategoryScore(dice(5, 5, 5, 5, 5), 'fives')).toBe(25);
		expect(calculateCategoryScore(dice(1, 2, 3, 4, 6), 'fives')).toBe(0);
	});

	it('should calculate sixes correctly', () => {
		expect(calculateCategoryScore(dice(6, 6, 1, 2, 3), 'sixes')).toBe(12);
		expect(calculateCategoryScore(dice(6, 6, 6, 6, 6), 'sixes')).toBe(30);
		expect(calculateCategoryScore(dice(1, 2, 3, 4, 5), 'sixes')).toBe(0);
	});
});

// =============================================================================
// Lower Section Scoring Tests
// =============================================================================

describe('calculateCategoryScore - Lower Section', () => {
	describe('Three of a Kind', () => {
		it('should score sum of all dice with 3+ of a kind', () => {
			expect(calculateCategoryScore(dice(3, 3, 3, 1, 2), 'threeOfAKind')).toBe(12);
			expect(calculateCategoryScore(dice(5, 5, 5, 5, 1), 'threeOfAKind')).toBe(21);
		});

		it('should score 0 without 3 of a kind', () => {
			expect(calculateCategoryScore(dice(1, 2, 3, 4, 5), 'threeOfAKind')).toBe(0);
			expect(calculateCategoryScore(dice(1, 1, 2, 2, 3), 'threeOfAKind')).toBe(0);
		});
	});

	describe('Four of a Kind', () => {
		it('should score sum of all dice with 4+ of a kind', () => {
			expect(calculateCategoryScore(dice(4, 4, 4, 4, 1), 'fourOfAKind')).toBe(17);
			expect(calculateCategoryScore(dice(6, 6, 6, 6, 6), 'fourOfAKind')).toBe(30);
		});

		it('should score 0 without 4 of a kind', () => {
			expect(calculateCategoryScore(dice(3, 3, 3, 1, 2), 'fourOfAKind')).toBe(0);
			expect(calculateCategoryScore(dice(1, 2, 3, 4, 5), 'fourOfAKind')).toBe(0);
		});
	});

	describe('Full House', () => {
		it('should score 25 for full house', () => {
			expect(calculateCategoryScore(dice(3, 3, 3, 2, 2), 'fullHouse')).toBe(25);
			expect(calculateCategoryScore(dice(1, 1, 6, 6, 6), 'fullHouse')).toBe(25);
		});

		it('should score 0 without full house', () => {
			expect(calculateCategoryScore(dice(1, 1, 1, 1, 2), 'fullHouse')).toBe(0);
			expect(calculateCategoryScore(dice(1, 2, 3, 4, 5), 'fullHouse')).toBe(0);
			// Dicee is NOT a full house in standard rules
			expect(calculateCategoryScore(dice(5, 5, 5, 5, 5), 'fullHouse')).toBe(0);
		});
	});

	describe('Small Straight', () => {
		it('should score 30 for small straight', () => {
			expect(calculateCategoryScore(dice(1, 2, 3, 4, 6), 'smallStraight')).toBe(30);
			expect(calculateCategoryScore(dice(2, 3, 4, 5, 1), 'smallStraight')).toBe(30);
			expect(calculateCategoryScore(dice(3, 4, 5, 6, 6), 'smallStraight')).toBe(30);
		});

		it('should score 30 for large straight (contains small)', () => {
			expect(calculateCategoryScore(dice(1, 2, 3, 4, 5), 'smallStraight')).toBe(30);
			expect(calculateCategoryScore(dice(2, 3, 4, 5, 6), 'smallStraight')).toBe(30);
		});

		it('should score 0 without small straight', () => {
			expect(calculateCategoryScore(dice(1, 2, 3, 5, 6), 'smallStraight')).toBe(0);
			expect(calculateCategoryScore(dice(1, 1, 2, 2, 3), 'smallStraight')).toBe(0);
		});
	});

	describe('Large Straight', () => {
		it('should score 40 for large straight', () => {
			expect(calculateCategoryScore(dice(1, 2, 3, 4, 5), 'largeStraight')).toBe(40);
			expect(calculateCategoryScore(dice(2, 3, 4, 5, 6), 'largeStraight')).toBe(40);
			// Order doesn't matter
			expect(calculateCategoryScore(dice(5, 4, 3, 2, 1), 'largeStraight')).toBe(40);
		});

		it('should score 0 without large straight', () => {
			expect(calculateCategoryScore(dice(1, 2, 3, 4, 6), 'largeStraight')).toBe(0);
			expect(calculateCategoryScore(dice(1, 1, 2, 3, 4), 'largeStraight')).toBe(0);
		});
	});

	describe('Dicee', () => {
		it('should score 50 for dicee', () => {
			expect(calculateCategoryScore(dice(1, 1, 1, 1, 1), 'dicee')).toBe(50);
			expect(calculateCategoryScore(dice(6, 6, 6, 6, 6), 'dicee')).toBe(50);
		});

		it('should score 0 without dicee', () => {
			expect(calculateCategoryScore(dice(1, 1, 1, 1, 2), 'dicee')).toBe(0);
			expect(calculateCategoryScore(dice(1, 2, 3, 4, 5), 'dicee')).toBe(0);
		});
	});

	describe('Chance', () => {
		it('should score sum of all dice', () => {
			expect(calculateCategoryScore(dice(1, 2, 3, 4, 5), 'chance')).toBe(15);
			expect(calculateCategoryScore(dice(6, 6, 6, 6, 6), 'chance')).toBe(30);
			expect(calculateCategoryScore(dice(1, 1, 1, 1, 1), 'chance')).toBe(5);
		});
	});
});

// =============================================================================
// calculateAllPotentialScores Tests
// =============================================================================

describe('calculateAllPotentialScores', () => {
	it('should calculate all scores for a given dice roll', () => {
		const scores = calculateAllPotentialScores(dice(3, 3, 3, 2, 2));

		expect(scores.ones).toBe(0);
		expect(scores.twos).toBe(4);
		expect(scores.threes).toBe(9);
		expect(scores.fours).toBe(0);
		expect(scores.fives).toBe(0);
		expect(scores.sixes).toBe(0);
		expect(scores.threeOfAKind).toBe(13);
		expect(scores.fourOfAKind).toBe(0);
		expect(scores.fullHouse).toBe(25);
		expect(scores.smallStraight).toBe(0);
		expect(scores.largeStraight).toBe(0);
		expect(scores.dicee).toBe(0);
		expect(scores.chance).toBe(13);
	});

	it('should calculate correctly for dicee', () => {
		const scores = calculateAllPotentialScores(dice(5, 5, 5, 5, 5));

		expect(scores.fives).toBe(25);
		expect(scores.threeOfAKind).toBe(25);
		expect(scores.fourOfAKind).toBe(25);
		expect(scores.fullHouse).toBe(0); // Dicee is not a full house
		expect(scores.dicee).toBe(50);
		expect(scores.chance).toBe(25);
	});
});

// =============================================================================
// applyScore Tests
// =============================================================================

describe('applyScore', () => {
	it('should apply score to the correct category', () => {
		const scorecard = createEmptyScorecard();
		const result = applyScore(scorecard, 'threes', dice(3, 3, 3, 1, 2));

		expect(result.scorecard.threes).toBe(9);
		expect(result.score).toBe(9);
		expect(result.isDiceeBonus).toBe(false);
	});

	it('should not modify original scorecard (immutable)', () => {
		const scorecard = createEmptyScorecard();
		const result = applyScore(scorecard, 'ones', dice(1, 1, 1, 2, 3));

		expect(scorecard.ones).toBeNull();
		expect(result.scorecard.ones).toBe(3);
	});

	it('should apply upper bonus when threshold reached', () => {
		const scorecard: Scorecard = {
			...createEmptyScorecard(),
			ones: 3, // 3
			twos: 6, // 6
			threes: 12, // 12
			fours: 16, // 16
			fives: 20, // 20
			// Need 6 more to reach 63
		};

		// Score 6 sixes = 36, total upper = 63+
		const result = applyScore(scorecard, 'sixes', dice(6, 6, 6, 6, 6));

		expect(result.scorecard.sixes).toBe(30);
		expect(result.scorecard.upperBonus).toBe(35);
	});

	it('should apply dicee bonus when already have dicee', () => {
		const scorecard: Scorecard = {
			...createEmptyScorecard(),
			dicee: 50, // Already scored a dicee
		};

		// Roll another dicee
		const result = applyScore(scorecard, 'fives', dice(5, 5, 5, 5, 5));

		expect(result.scorecard.fives).toBe(25);
		expect(result.scorecard.diceeBonus).toBe(100);
		expect(result.isDiceeBonus).toBe(true);
	});

	it('should stack dicee bonuses', () => {
		const scorecard: Scorecard = {
			...createEmptyScorecard(),
			dicee: 50,
			diceeBonus: 100, // Already have one bonus
		};

		const result = applyScore(scorecard, 'sixes', dice(6, 6, 6, 6, 6));

		expect(result.scorecard.diceeBonus).toBe(200);
		expect(result.isDiceeBonus).toBe(true);
	});

	it('should not give dicee bonus if dicee was scored as 0', () => {
		const scorecard: Scorecard = {
			...createEmptyScorecard(),
			dicee: 0, // Scored dicee as 0 (no dicee)
		};

		const result = applyScore(scorecard, 'fives', dice(5, 5, 5, 5, 5));

		expect(result.scorecard.diceeBonus).toBe(0);
		expect(result.isDiceeBonus).toBe(false);
	});
});

// =============================================================================
// calculateTotal Tests
// =============================================================================

describe('calculateTotal', () => {
	it('should calculate 0 for empty scorecard', () => {
		const scorecard = createEmptyScorecard();
		expect(calculateTotal(scorecard)).toBe(0);
	});

	it('should sum all scored categories', () => {
		const scorecard: Scorecard = {
			ones: 3,
			twos: 6,
			threes: 9,
			fours: 12,
			fives: 15,
			sixes: 18,
			threeOfAKind: 20,
			fourOfAKind: 25,
			fullHouse: 25,
			smallStraight: 30,
			largeStraight: 40,
			dicee: 50,
			chance: 25,
			upperBonus: 0,
			diceeBonus: 0,
		};

		expect(calculateTotal(scorecard)).toBe(278);
	});

	it('should include upper bonus', () => {
		const scorecard: Scorecard = {
			...createEmptyScorecard(),
			ones: 3,
			twos: 6,
			threes: 12,
			fours: 16,
			fives: 20,
			sixes: 18,
			upperBonus: 35,
		};

		expect(calculateTotal(scorecard)).toBe(110); // 75 + 35
	});

	it('should include dicee bonus', () => {
		const scorecard: Scorecard = {
			...createEmptyScorecard(),
			dicee: 50,
			diceeBonus: 200,
		};

		expect(calculateTotal(scorecard)).toBe(250);
	});

	it('should handle null categories as 0', () => {
		const scorecard: Scorecard = {
			...createEmptyScorecard(),
			ones: 3,
			// rest are null
		};

		expect(calculateTotal(scorecard)).toBe(3);
	});
});
