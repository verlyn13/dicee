/**
 * Scorecard Types
 *
 * Player scorecard interface and utility functions.
 */

import type { Category } from './category.js';
import {
	ALL_CATEGORIES,
	UPPER_BONUS_THRESHOLD,
	UPPER_BONUS_VALUE,
} from './category.js';

/**
 * Player scorecard - all 13 categories plus bonuses
 *
 * null = not yet scored (category available)
 * number = scored value (category used)
 */
export interface Scorecard {
	// Upper section (value = sum of matching dice)
	ones: number | null;
	twos: number | null;
	threes: number | null;
	fours: number | null;
	fives: number | null;
	sixes: number | null;

	// Lower section
	threeOfAKind: number | null; // Sum of all dice if valid
	fourOfAKind: number | null; // Sum of all dice if valid
	fullHouse: number | null; // 25 points if valid
	smallStraight: number | null; // 30 points if valid
	largeStraight: number | null; // 40 points if valid
	dicee: number | null; // 50 points if valid
	chance: number | null; // Sum of all dice (always valid)

	// Bonuses (calculated, not set by player)
	diceeBonus: number; // 0, 100, 200, 300... (100 per additional Dicee)
	upperBonus: number; // 0 or 35 (if upper section >= 63)
}

/**
 * Create an empty scorecard
 */
export function createEmptyScorecard(): Scorecard {
	return {
		ones: null,
		twos: null,
		threes: null,
		fours: null,
		fives: null,
		sixes: null,
		threeOfAKind: null,
		fourOfAKind: null,
		fullHouse: null,
		smallStraight: null,
		largeStraight: null,
		dicee: null,
		chance: null,
		diceeBonus: 0,
		upperBonus: 0,
	};
}

/**
 * Calculate upper section sum
 */
export function calculateUpperSum(scorecard: Scorecard): number {
	return (
		(scorecard.ones ?? 0) +
		(scorecard.twos ?? 0) +
		(scorecard.threes ?? 0) +
		(scorecard.fours ?? 0) +
		(scorecard.fives ?? 0) +
		(scorecard.sixes ?? 0)
	);
}

/**
 * Calculate total score including bonuses
 */
export function calculateTotalScore(scorecard: Scorecard): number {
	const upper = calculateUpperSum(scorecard);
	const upperBonus = upper >= UPPER_BONUS_THRESHOLD ? UPPER_BONUS_VALUE : 0;

	const lower =
		(scorecard.threeOfAKind ?? 0) +
		(scorecard.fourOfAKind ?? 0) +
		(scorecard.fullHouse ?? 0) +
		(scorecard.smallStraight ?? 0) +
		(scorecard.largeStraight ?? 0) +
		(scorecard.dicee ?? 0) +
		(scorecard.chance ?? 0);

	return upper + upperBonus + lower + scorecard.diceeBonus;
}

/**
 * Get remaining (unscored) categories
 */
export function getRemainingCategories(scorecard: Scorecard): Category[] {
	return ALL_CATEGORIES.filter((cat) => scorecard[cat] === null);
}

/**
 * Check if scorecard is complete (all 13 categories scored)
 */
export function isScorecardComplete(scorecard: Scorecard): boolean {
	return getRemainingCategories(scorecard).length === 0;
}

/**
 * Check if a category has been scored
 */
export function isCategoryScored(
	scorecard: Scorecard,
	category: Category
): boolean {
	return scorecard[category] !== null;
}

/**
 * Get count of scored categories
 */
export function getScoredCategoryCount(scorecard: Scorecard): number {
	return ALL_CATEGORIES.length - getRemainingCategories(scorecard).length;
}
