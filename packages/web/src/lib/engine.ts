import init, {
	score_category,
	score_all_categories,
	calculate_probabilities
} from './wasm/dicee_engine.js';

export interface ScoringResult {
	category: string;
	score: number;
	valid: boolean;
}

export interface CategoryProbability {
	category: string;
	probability: number;
	expected_value: number;
	current_score: number;
}

export interface ProbabilityResult {
	categories: CategoryProbability[];
	best_category: string;
	best_ev: number;
}

export const CATEGORIES = [
	'Ones',
	'Twos',
	'Threes',
	'Fours',
	'Fives',
	'Sixes',
	'ThreeOfAKind',
	'FourOfAKind',
	'FullHouse',
	'SmallStraight',
	'LargeStraight',
	'Yahtzee',
	'Chance'
] as const;

export type Category = (typeof CATEGORIES)[number];

let initialized = false;

export async function initEngine(): Promise<void> {
	if (initialized) return;
	await init();
	initialized = true;
}

export function scoreCategory(dice: number[], category: number): ScoringResult {
	const result = score_category(new Uint8Array(dice), category);
	return result as ScoringResult;
}

export function scoreAllCategories(dice: number[]): ScoringResult[] {
	const results = score_all_categories(new Uint8Array(dice));
	return results as ScoringResult[];
}

export function calculateProbabilities(
	dice: number[],
	kept: boolean[],
	rollsRemaining: number
): ProbabilityResult {
	const keptBytes = kept.map((k) => (k ? 1 : 0));
	const result = calculate_probabilities(
		new Uint8Array(dice),
		new Uint8Array(keptBytes),
		rollsRemaining
	);
	return result as ProbabilityResult;
}

export function rollDice(count: number = 5): number[] {
	return Array.from({ length: count }, () => Math.floor(Math.random() * 6) + 1);
}

export function rerollDice(current: number[], kept: boolean[]): number[] {
	return current.map((die, i) => (kept[i] ? die : Math.floor(Math.random() * 6) + 1));
}
