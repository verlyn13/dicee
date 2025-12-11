/**
 * Seeded Dice Generation
 *
 * Deterministic dice rolling using SeededRandom.
 * Ensures same seed produces same dice sequence across all simulations.
 *
 * @example
 * const rng = new SeededRandom(42);
 * const dice = rollDice(rng);              // [3, 1, 5, 2, 6]
 * const reroll = rerollDice(dice, [true, false, true, false, false], rng);
 */

import type { DiceArray, KeptMask } from '@dicee/shared';
import type { RandomSource } from './seeded-random.js';

/**
 * Roll a single die (1-6)
 */
export function rollDie(rng: RandomSource): number {
	return rng.randomInt(1, 6);
}

/**
 * Roll 5 dice
 */
export function rollDice(rng: RandomSource): DiceArray {
	return [rollDie(rng), rollDie(rng), rollDie(rng), rollDie(rng), rollDie(rng)];
}

/**
 * Reroll dice based on kept mask
 * true = keep the die, false = reroll
 */
export function rerollDice(current: DiceArray, kept: KeptMask, rng: RandomSource): DiceArray {
	return current.map((die, i) => (kept[i] ? die : rollDie(rng))) as DiceArray;
}

/**
 * Generate a complete turn's worth of dice rolls
 * Returns all dice states from initial roll through final state
 */
export interface TurnRolls {
	/** Initial roll (roll 1) */
	roll1: DiceArray;
	/** After first reroll (roll 2), if taken */
	roll2?: DiceArray;
	/** After second reroll (roll 3), if taken */
	roll3?: DiceArray;
	/** Keep decisions made */
	keeps: KeptMask[];
	/** Final dice state */
	final: DiceArray;
}

/**
 * Execute a full turn's dice rolling sequence
 *
 * @param rng - Random source for dice generation
 * @param decideKeep - Function that decides which dice to keep
 * @returns Complete roll sequence for the turn
 */
export function executeTurnRolls(
	rng: RandomSource,
	decideKeep: (dice: DiceArray, rollNumber: 1 | 2) => KeptMask | null,
): TurnRolls {
	const keeps: KeptMask[] = [];

	// Roll 1
	const roll1 = rollDice(rng);
	let current = roll1;

	// Decision after roll 1
	const keep1 = decideKeep(current, 1);
	if (keep1 === null) {
		// Score immediately after roll 1
		return { roll1, keeps, final: current };
	}
	keeps.push(keep1);

	// Roll 2
	const roll2 = rerollDice(current, keep1, rng);
	current = roll2;

	// Decision after roll 2
	const keep2 = decideKeep(current, 2);
	if (keep2 === null) {
		// Score after roll 2
		return { roll1, roll2, keeps, final: current };
	}
	keeps.push(keep2);

	// Roll 3 (final)
	const roll3 = rerollDice(current, keep2, rng);

	return { roll1, roll2, roll3, keeps, final: roll3 };
}

/**
 * Count occurrences of each die value
 */
export function countDice(dice: DiceArray): Map<number, number> {
	const counts = new Map<number, number>();
	for (const die of dice) {
		counts.set(die, (counts.get(die) || 0) + 1);
	}
	return counts;
}

/**
 * Sort dice for display/comparison
 */
export function sortDice(dice: DiceArray): DiceArray {
	return [...dice].sort((a, b) => a - b) as DiceArray;
}

/**
 * Check if dice contain a specific pattern
 */
export function hasNOfAKind(dice: DiceArray, n: number): boolean {
	const counts = countDice(dice);
	return Array.from(counts.values()).some((count) => count >= n);
}

/**
 * Check for straights
 */
export function hasSmallStraight(dice: DiceArray): boolean {
	const sorted = [...new Set(dice)].sort((a, b) => a - b);
	const patterns = [
		[1, 2, 3, 4],
		[2, 3, 4, 5],
		[3, 4, 5, 6],
	];

	return patterns.some((pattern) => pattern.every((v) => sorted.includes(v)));
}

export function hasLargeStraight(dice: DiceArray): boolean {
	const sorted = [...new Set(dice)].sort((a, b) => a - b);
	if (sorted.length !== 5) return false;

	return (
		(sorted[0] === 1 && sorted[4] === 5) || // 1-2-3-4-5
		(sorted[0] === 2 && sorted[4] === 6) // 2-3-4-5-6
	);
}

export function hasFullHouse(dice: DiceArray): boolean {
	const counts = Array.from(countDice(dice).values()).sort((a, b) => a - b);
	return counts.length === 2 && counts[0] === 2 && counts[1] === 3;
}

export function isDicee(dice: DiceArray): boolean {
	return hasNOfAKind(dice, 5);
}

/**
 * Calculate sum of all dice
 */
export function sumDice(dice: DiceArray): number {
	return dice.reduce((sum, die) => sum + die, 0);
}

/**
 * Calculate sum of dice matching a specific value
 */
export function sumMatching(dice: DiceArray, value: number): number {
	return dice.filter((die) => die === value).reduce((sum, die) => sum + die, 0);
}

/**
 * Generate a keep mask from indices
 */
export function indicesToMask(indices: number[]): KeptMask {
	return [
		indices.includes(0),
		indices.includes(1),
		indices.includes(2),
		indices.includes(3),
		indices.includes(4),
	];
}

/**
 * Convert keep mask to indices
 */
export function maskToIndices(mask: KeptMask): number[] {
	return mask.map((kept, i) => (kept ? i : -1)).filter((i) => i !== -1);
}

/**
 * Create all-keep or all-reroll masks
 */
export const KEEP_ALL: KeptMask = [true, true, true, true, true];
export const KEEP_NONE: KeptMask = [false, false, false, false, false];
