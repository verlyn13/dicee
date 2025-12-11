/**
 * Score Calculation
 *
 * Server-authoritative scoring for all Dicee categories.
 * Uses crypto.getRandomValues for dice generation.
 *
 * Migrated from packages/partykit - no functional changes.
 */

import type { Category, DiceArray, Scorecard } from './types';
import { DICEE_BONUS_VALUE, UPPER_BONUS_THRESHOLD, UPPER_BONUS_VALUE } from './types';

// =============================================================================
// Dice Generation (Server-Authoritative)
// =============================================================================

/**
 * Generate random dice values using cryptographic randomness
 */
export function generateDice(count: 5): DiceArray;
export function generateDice(count: number): number[];
export function generateDice(count: number): number[] {
	const buffer = new Uint8Array(count);
	crypto.getRandomValues(buffer);
	return Array.from(buffer).map((byte) => (byte % 6) + 1);
}

/**
 * Roll dice with kept mask - only re-roll dice not kept
 */
export function rollWithKept(
	currentDice: DiceArray | null,
	kept: [boolean, boolean, boolean, boolean, boolean],
): DiceArray {
	// Generate new random values
	const newValues = generateDice(5);

	// If no current dice, return all new
	if (!currentDice) {
		return newValues as DiceArray;
	}

	// Apply kept mask
	return [
		kept[0] ? currentDice[0] : newValues[0],
		kept[1] ? currentDice[1] : newValues[1],
		kept[2] ? currentDice[2] : newValues[2],
		kept[3] ? currentDice[3] : newValues[3],
		kept[4] ? currentDice[4] : newValues[4],
	];
}

// =============================================================================
// Score Calculation Helpers
// =============================================================================

/**
 * Count occurrences of each dice value
 */
function countValues(dice: DiceArray): Map<number, number> {
	const counts = new Map<number, number>();
	for (const value of dice) {
		counts.set(value, (counts.get(value) ?? 0) + 1);
	}
	return counts;
}

/**
 * Sum all dice
 */
function sumAll(dice: DiceArray): number {
	return dice.reduce((sum, v) => sum + v, 0);
}

/**
 * Sum dice matching a specific value
 */
function sumMatching(dice: DiceArray, value: number): number {
	return dice.filter((v) => v === value).reduce((sum, v) => sum + v, 0);
}

/**
 * Check if dice contain n of a kind
 */
function hasOfAKind(dice: DiceArray, n: number): boolean {
	const counts = countValues(dice);
	for (const count of counts.values()) {
		if (count >= n) return true;
	}
	return false;
}

/**
 * Check for full house (3 of one, 2 of another)
 */
function isFullHouse(dice: DiceArray): boolean {
	const counts = countValues(dice);
	const values = Array.from(counts.values()).sort((a, b) => a - b);
	return values.length === 2 && values[0] === 2 && values[1] === 3;
}

/**
 * Check for small straight (4 consecutive)
 */
function isSmallStraight(dice: DiceArray): boolean {
	const unique = new Set(dice);
	// Possible small straights: 1234, 2345, 3456
	const patterns = [
		[1, 2, 3, 4],
		[2, 3, 4, 5],
		[3, 4, 5, 6],
	];
	return patterns.some((pattern) => pattern.every((v) => unique.has(v)));
}

/**
 * Check for large straight (5 consecutive)
 */
function isLargeStraight(dice: DiceArray): boolean {
	const sorted = [...dice].sort((a, b) => a - b);
	// Must be either 1-2-3-4-5 or 2-3-4-5-6
	return (
		(sorted[0] === 1 && sorted[1] === 2 && sorted[2] === 3 && sorted[3] === 4 && sorted[4] === 5) ||
		(sorted[0] === 2 && sorted[1] === 3 && sorted[2] === 4 && sorted[3] === 5 && sorted[4] === 6)
	);
}

/**
 * Check for Dicee (5 of a kind)
 */
function isDicee(dice: DiceArray): boolean {
	return new Set(dice).size === 1;
}

// =============================================================================
// Category Score Calculation
// =============================================================================

/**
 * Calculate score for a specific category
 */
export function calculateCategoryScore(dice: DiceArray, category: Category): number {
	switch (category) {
		// Upper section - sum of matching dice
		case 'ones':
			return sumMatching(dice, 1);
		case 'twos':
			return sumMatching(dice, 2);
		case 'threes':
			return sumMatching(dice, 3);
		case 'fours':
			return sumMatching(dice, 4);
		case 'fives':
			return sumMatching(dice, 5);
		case 'sixes':
			return sumMatching(dice, 6);

		// Lower section
		case 'threeOfAKind':
			return hasOfAKind(dice, 3) ? sumAll(dice) : 0;
		case 'fourOfAKind':
			return hasOfAKind(dice, 4) ? sumAll(dice) : 0;
		case 'fullHouse':
			return isFullHouse(dice) ? 25 : 0;
		case 'smallStraight':
			return isSmallStraight(dice) ? 30 : 0;
		case 'largeStraight':
			return isLargeStraight(dice) ? 40 : 0;
		case 'dicee':
			return isDicee(dice) ? 50 : 0;
		case 'chance':
			return sumAll(dice);
	}
}

/**
 * Calculate all potential scores for current dice
 */
export function calculateAllPotentialScores(dice: DiceArray): Record<Category, number> {
	return {
		ones: calculateCategoryScore(dice, 'ones'),
		twos: calculateCategoryScore(dice, 'twos'),
		threes: calculateCategoryScore(dice, 'threes'),
		fours: calculateCategoryScore(dice, 'fours'),
		fives: calculateCategoryScore(dice, 'fives'),
		sixes: calculateCategoryScore(dice, 'sixes'),
		threeOfAKind: calculateCategoryScore(dice, 'threeOfAKind'),
		fourOfAKind: calculateCategoryScore(dice, 'fourOfAKind'),
		fullHouse: calculateCategoryScore(dice, 'fullHouse'),
		smallStraight: calculateCategoryScore(dice, 'smallStraight'),
		largeStraight: calculateCategoryScore(dice, 'largeStraight'),
		dicee: calculateCategoryScore(dice, 'dicee'),
		chance: calculateCategoryScore(dice, 'chance'),
	};
}

// =============================================================================
// Scorecard Updates
// =============================================================================

/**
 * Apply a score to a category and update bonuses
 * Returns updated scorecard and whether it was a Dicee bonus
 */
export function applyScore(
	scorecard: Scorecard,
	category: Category,
	dice: DiceArray,
): { scorecard: Scorecard; score: number; isDiceeBonus: boolean } {
	const score = calculateCategoryScore(dice, category);
	let isDiceeBonus = false;

	// Create new scorecard (immutable update)
	const newScorecard: Scorecard = { ...scorecard };

	// Check for Dicee bonus
	// If scoring Dicee and already have a Dicee scored (non-zero), add bonus
	if (isDicee(dice) && scorecard.dicee !== null && scorecard.dicee > 0) {
		newScorecard.diceeBonus = scorecard.diceeBonus + DICEE_BONUS_VALUE;
		isDiceeBonus = true;
	}

	// Apply the score
	newScorecard[category] = score;

	// Recalculate upper bonus
	const upperSum =
		(newScorecard.ones ?? 0) +
		(newScorecard.twos ?? 0) +
		(newScorecard.threes ?? 0) +
		(newScorecard.fours ?? 0) +
		(newScorecard.fives ?? 0) +
		(newScorecard.sixes ?? 0);

	if (upperSum >= UPPER_BONUS_THRESHOLD && newScorecard.upperBonus === 0) {
		newScorecard.upperBonus = UPPER_BONUS_VALUE;
	}

	return { scorecard: newScorecard, score, isDiceeBonus };
}

/**
 * Calculate total score from a scorecard
 */
export function calculateTotal(scorecard: Scorecard): number {
	let total = 0;

	// Upper section
	total += scorecard.ones ?? 0;
	total += scorecard.twos ?? 0;
	total += scorecard.threes ?? 0;
	total += scorecard.fours ?? 0;
	total += scorecard.fives ?? 0;
	total += scorecard.sixes ?? 0;
	total += scorecard.upperBonus;

	// Lower section
	total += scorecard.threeOfAKind ?? 0;
	total += scorecard.fourOfAKind ?? 0;
	total += scorecard.fullHouse ?? 0;
	total += scorecard.smallStraight ?? 0;
	total += scorecard.largeStraight ?? 0;
	total += scorecard.dicee ?? 0;
	total += scorecard.chance ?? 0;
	total += scorecard.diceeBonus;

	return total;
}
