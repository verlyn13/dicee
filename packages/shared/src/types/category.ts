/**
 * Scoring Category Types
 *
 * All 13 Dicee scoring categories.
 * Uses camelCase for JSON serialization compatibility.
 *
 * @invariant category_type_consistency
 */

/**
 * All scoring categories in Dicee (camelCase wire format)
 *
 * Upper section: ones through sixes (value = sum of matching dice)
 * Lower section: combinations and special scores
 */
export type Category =
	// Upper section
	| 'ones'
	| 'twos'
	| 'threes'
	| 'fours'
	| 'fives'
	| 'sixes'
	// Lower section
	| 'threeOfAKind'
	| 'fourOfAKind'
	| 'fullHouse'
	| 'smallStraight'
	| 'largeStraight'
	| 'dicee'
	| 'chance';

/** Upper section categories */
export const UPPER_CATEGORIES: readonly Category[] = [
	'ones',
	'twos',
	'threes',
	'fours',
	'fives',
	'sixes',
] as const;

/** Lower section categories */
export const LOWER_CATEGORIES: readonly Category[] = [
	'threeOfAKind',
	'fourOfAKind',
	'fullHouse',
	'smallStraight',
	'largeStraight',
	'dicee',
	'chance',
] as const;

/** All categories (13 total) */
export const ALL_CATEGORIES: readonly Category[] = [
	...UPPER_CATEGORIES,
	...LOWER_CATEGORIES,
] as const;

/** Total number of categories */
export const CATEGORY_COUNT = 13 as const;

/** Upper section bonus threshold */
export const UPPER_BONUS_THRESHOLD = 63 as const;

/** Upper section bonus value */
export const UPPER_BONUS_VALUE = 35 as const;

/** Dicee bonus value (per additional Dicee after first) */
export const DICEE_BONUS_VALUE = 100 as const;

/** Fixed scores for specific categories */
export const FIXED_SCORES = {
	fullHouse: 25,
	smallStraight: 30,
	largeStraight: 40,
	dicee: 50,
} as const;

/**
 * Check if a string is a valid category
 */
export function isValidCategory(value: unknown): value is Category {
	return typeof value === 'string' && ALL_CATEGORIES.includes(value as Category);
}

/**
 * Check if a category is in the upper section
 */
export function isUpperCategory(category: Category): boolean {
	return UPPER_CATEGORIES.includes(category);
}

/**
 * Check if a category is in the lower section
 */
export function isLowerCategory(category: Category): boolean {
	return LOWER_CATEGORIES.includes(category);
}
