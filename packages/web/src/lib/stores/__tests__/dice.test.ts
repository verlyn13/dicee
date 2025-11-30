/**
 * Dice Pure Functions Tests
 * Tests for dice utilities without Svelte runtime
 */

import { describe, expect, it } from 'vitest';
import type { DiceArray, KeptMask } from '../../types.js';
import {
	allKept,
	countKept,
	noneKept,
	rerollDice,
	rollAllDice,
	rollSingleDie,
} from '../dice.svelte.js';

// =============================================================================
// rollSingleDie Tests
// =============================================================================

describe('rollSingleDie', () => {
	it('returns a value between 1 and 6', () => {
		// Run multiple times to test statistical distribution
		for (let i = 0; i < 100; i++) {
			const result = rollSingleDie();
			expect(result).toBeGreaterThanOrEqual(1);
			expect(result).toBeLessThanOrEqual(6);
		}
	});

	it('returns an integer', () => {
		for (let i = 0; i < 20; i++) {
			const result = rollSingleDie();
			expect(Number.isInteger(result)).toBe(true);
		}
	});

	it('eventually produces all possible values (1-6)', () => {
		const seen = new Set<number>();
		// Roll enough times that we should see all values
		for (let i = 0; i < 500 && seen.size < 6; i++) {
			seen.add(rollSingleDie());
		}
		expect(seen.size).toBe(6);
		expect(seen.has(1)).toBe(true);
		expect(seen.has(6)).toBe(true);
	});
});

// =============================================================================
// rollAllDice Tests
// =============================================================================

describe('rollAllDice', () => {
	it('returns an array of 5 dice', () => {
		const result = rollAllDice();
		expect(result).toHaveLength(5);
	});

	it('all values are between 1 and 6', () => {
		for (let i = 0; i < 20; i++) {
			const result = rollAllDice();
			for (const die of result) {
				expect(die).toBeGreaterThanOrEqual(1);
				expect(die).toBeLessThanOrEqual(6);
			}
		}
	});

	it('returns a new array each time', () => {
		const result1 = rollAllDice();
		const result2 = rollAllDice();
		expect(result1).not.toBe(result2);
	});
});

// =============================================================================
// rerollDice Tests
// =============================================================================

describe('rerollDice', () => {
	it('preserves kept dice', () => {
		const current: DiceArray = [1, 2, 3, 4, 5];
		const kept: KeptMask = [true, false, true, false, true];

		// Run multiple times - kept dice should never change
		for (let i = 0; i < 20; i++) {
			const result = rerollDice(current, kept);
			expect(result[0]).toBe(1); // kept
			expect(result[2]).toBe(3); // kept
			expect(result[4]).toBe(5); // kept
		}
	});

	it('rerolls non-kept dice', () => {
		const current: DiceArray = [1, 1, 1, 1, 1];
		const kept: KeptMask = [true, false, false, false, true];

		// If we run enough times, non-kept dice should change
		let sawChange = false;
		for (let i = 0; i < 50 && !sawChange; i++) {
			const result = rerollDice(current, kept);
			if (result[1] !== 1 || result[2] !== 1 || result[3] !== 1) {
				sawChange = true;
			}
		}
		expect(sawChange).toBe(true);
	});

	it('returns new array (immutable)', () => {
		const current: DiceArray = [1, 2, 3, 4, 5];
		const kept: KeptMask = [false, false, false, false, false];

		const result = rerollDice(current, kept);
		expect(result).not.toBe(current);
	});

	it('rerolls all when none kept', () => {
		const current: DiceArray = [6, 6, 6, 6, 6];
		const kept: KeptMask = [false, false, false, false, false];

		// With all dice being 6 and none kept, we should eventually see non-6s
		let sawNonSix = false;
		for (let i = 0; i < 50 && !sawNonSix; i++) {
			const result = rerollDice(current, kept);
			if (result.some((d) => d !== 6)) {
				sawNonSix = true;
			}
		}
		expect(sawNonSix).toBe(true);
	});

	it('keeps all when all kept', () => {
		const current: DiceArray = [1, 2, 3, 4, 5];
		const kept: KeptMask = [true, true, true, true, true];

		for (let i = 0; i < 10; i++) {
			const result = rerollDice(current, kept);
			expect(result).toEqual([1, 2, 3, 4, 5]);
		}
	});

	it('maintains array length of 5', () => {
		const current: DiceArray = [1, 2, 3, 4, 5];
		const kept: KeptMask = [true, false, true, false, true];

		const result = rerollDice(current, kept);
		expect(result).toHaveLength(5);
	});
});

// =============================================================================
// countKept Tests
// =============================================================================

describe('countKept', () => {
	it('returns 0 when none kept', () => {
		const kept: KeptMask = [false, false, false, false, false];
		expect(countKept(kept)).toBe(0);
	});

	it('returns 5 when all kept', () => {
		const kept: KeptMask = [true, true, true, true, true];
		expect(countKept(kept)).toBe(5);
	});

	it('counts correctly with mixed values', () => {
		expect(countKept([true, false, false, false, false])).toBe(1);
		expect(countKept([true, true, false, false, false])).toBe(2);
		expect(countKept([true, true, true, false, false])).toBe(3);
		expect(countKept([true, true, true, true, false])).toBe(4);
	});

	it('counts non-contiguous kept dice', () => {
		const kept: KeptMask = [true, false, true, false, true];
		expect(countKept(kept)).toBe(3);
	});
});

// =============================================================================
// allKept Tests
// =============================================================================

describe('allKept', () => {
	it('returns true when all kept', () => {
		const kept: KeptMask = [true, true, true, true, true];
		expect(allKept(kept)).toBe(true);
	});

	it('returns false when none kept', () => {
		const kept: KeptMask = [false, false, false, false, false];
		expect(allKept(kept)).toBe(false);
	});

	it('returns false when some kept', () => {
		expect(allKept([true, true, true, true, false])).toBe(false);
		expect(allKept([true, false, true, true, true])).toBe(false);
		expect(allKept([false, true, true, true, true])).toBe(false);
	});

	it('handles single false correctly', () => {
		const kept: KeptMask = [true, true, false, true, true];
		expect(allKept(kept)).toBe(false);
	});
});

// =============================================================================
// noneKept Tests
// =============================================================================

describe('noneKept', () => {
	it('returns true when none kept', () => {
		const kept: KeptMask = [false, false, false, false, false];
		expect(noneKept(kept)).toBe(true);
	});

	it('returns false when all kept', () => {
		const kept: KeptMask = [true, true, true, true, true];
		expect(noneKept(kept)).toBe(false);
	});

	it('returns false when some kept', () => {
		expect(noneKept([true, false, false, false, false])).toBe(false);
		expect(noneKept([false, false, false, false, true])).toBe(false);
		expect(noneKept([false, false, true, false, false])).toBe(false);
	});

	it('handles single true correctly', () => {
		const kept: KeptMask = [false, false, true, false, false];
		expect(noneKept(kept)).toBe(false);
	});
});

// =============================================================================
// Integration: Dice Rolling Workflow
// =============================================================================

describe('Dice Rolling Workflow', () => {
	it('simulates a typical turn flow', () => {
		// First roll: all new dice
		let dice = rollAllDice();
		let kept: KeptMask = [false, false, false, false, false];

		expect(dice).toHaveLength(5);
		expect(countKept(kept)).toBe(0);
		expect(noneKept(kept)).toBe(true);

		// Player keeps first two dice
		kept = [true, true, false, false, false];
		expect(countKept(kept)).toBe(2);
		expect(allKept(kept)).toBe(false);
		expect(noneKept(kept)).toBe(false);

		// Second roll: reroll non-kept
		const firstTwo = [dice[0], dice[1]];
		dice = rerollDice(dice, kept);

		expect(dice[0]).toBe(firstTwo[0]);
		expect(dice[1]).toBe(firstTwo[1]);
		expect(countKept(kept)).toBe(2);

		// Player keeps all
		kept = [true, true, true, true, true];
		expect(allKept(kept)).toBe(true);

		// Final roll (no changes)
		const finalDice = [...dice];
		dice = rerollDice(dice, kept);
		expect(dice).toEqual(finalDice);
	});

	it('handles yahtzee-hunting scenario', () => {
		// Scenario: Player rolls and gets 3 sixes, keeps them
		const dice: DiceArray = [6, 3, 6, 2, 6];
		const kept: KeptMask = [true, false, true, false, true];

		expect(countKept(kept)).toBe(3);

		// Multiple rerolls trying to get more 6s
		for (let roll = 0; roll < 10; roll++) {
			const result = rerollDice(dice, kept);
			// Kept dice should always be 6
			expect(result[0]).toBe(6);
			expect(result[2]).toBe(6);
			expect(result[4]).toBe(6);
		}
	});
});

// =============================================================================
// Edge Cases and Boundary Conditions
// =============================================================================

describe('Edge Cases', () => {
	it('handles alternating kept pattern', () => {
		const kept: KeptMask = [true, false, true, false, true];
		expect(countKept(kept)).toBe(3);
		expect(allKept(kept)).toBe(false);
		expect(noneKept(kept)).toBe(false);
	});

	it('rerollDice maintains valid die values', () => {
		const current: DiceArray = [1, 2, 3, 4, 5];
		const kept: KeptMask = [false, false, false, false, false];

		for (let i = 0; i < 100; i++) {
			const result = rerollDice(current, kept);
			for (const die of result) {
				expect(die).toBeGreaterThanOrEqual(1);
				expect(die).toBeLessThanOrEqual(6);
				expect(Number.isInteger(die)).toBe(true);
			}
		}
	});

	it('countKept, allKept, noneKept are consistent', () => {
		const testCases: KeptMask[] = [
			[false, false, false, false, false],
			[true, true, true, true, true],
			[true, false, true, false, true],
			[false, true, false, true, false],
			[true, false, false, false, false],
			[false, false, false, false, true],
		];

		for (const kept of testCases) {
			const count = countKept(kept);
			const all = allKept(kept);
			const none = noneKept(kept);

			// Consistency checks
			if (count === 0) {
				expect(none).toBe(true);
				expect(all).toBe(false);
			} else if (count === 5) {
				expect(all).toBe(true);
				expect(none).toBe(false);
			} else {
				expect(all).toBe(false);
				expect(none).toBe(false);
			}
		}
	});
});
