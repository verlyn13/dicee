/**
 * Scorecard State Management
 * Svelte 5 runes-based scorecard with automatic calculations
 */

import type { Category, Scorecard } from '../types.js';
import { ALL_CATEGORIES, UPPER_CATEGORIES } from '../types.js';

// =============================================================================
// Constants
// =============================================================================

const UPPER_BONUS_THRESHOLD = 63;
const UPPER_BONUS_VALUE = 35;

// =============================================================================
// Factory Functions
// =============================================================================

export function createEmptyScorecard(): Scorecard {
	const scores = {} as Record<Category, number | null>;
	for (const cat of ALL_CATEGORIES) {
		scores[cat] = null;
	}

	return {
		scores,
		upperSubtotal: 0,
		upperBonus: 0,
		upperTotal: 0,
		lowerTotal: 0,
		grandTotal: 0,
		categoriesRemaining: [...ALL_CATEGORIES],
		turnsCompleted: 0,
	};
}

// =============================================================================
// Calculation Functions (Pure)
// =============================================================================

export function calculateUpperSubtotal(
	scores: Record<Category, number | null>,
): number {
	return UPPER_CATEGORIES.reduce((sum, cat) => sum + (scores[cat] ?? 0), 0);
}

export function calculateUpperBonus(upperSubtotal: number): number {
	return upperSubtotal >= UPPER_BONUS_THRESHOLD ? UPPER_BONUS_VALUE : 0;
}

export function calculateLowerTotal(
	scores: Record<Category, number | null>,
): number {
	const lowerCats: Category[] = [
		'ThreeOfAKind',
		'FourOfAKind',
		'FullHouse',
		'SmallStraight',
		'LargeStraight',
		'Yahtzee',
		'Chance',
	];
	return lowerCats.reduce((sum, cat) => sum + (scores[cat] ?? 0), 0);
}

export function getCategoriesRemaining(
	scores: Record<Category, number | null>,
): Category[] {
	return ALL_CATEGORIES.filter((cat) => scores[cat] === null);
}

export function isCategoryAvailable(
	scores: Record<Category, number | null>,
	category: Category,
): boolean {
	return scores[category] === null;
}

// =============================================================================
// Scorecard Class (Svelte 5 Runes)
// =============================================================================

export class ScorecardState {
	// Reactive state
	#scores = $state<Record<Category, number | null>>(
		Object.fromEntries(ALL_CATEGORIES.map((cat) => [cat, null])) as Record<
			Category,
			number | null
		>,
	);

	// Derived values (automatically recalculated)
	readonly upperSubtotal = $derived(calculateUpperSubtotal(this.#scores));
	readonly upperBonus = $derived(calculateUpperBonus(this.upperSubtotal));
	readonly upperTotal = $derived(this.upperSubtotal + this.upperBonus);
	readonly lowerTotal = $derived(calculateLowerTotal(this.#scores));
	readonly grandTotal = $derived(this.upperTotal + this.lowerTotal);
	readonly categoriesRemaining = $derived(getCategoriesRemaining(this.#scores));
	readonly turnsCompleted = $derived(13 - this.categoriesRemaining.length);
	readonly isComplete = $derived(this.categoriesRemaining.length === 0);

	// Upper section progress toward bonus
	readonly upperBonusProgress = $derived({
		current: this.upperSubtotal,
		target: UPPER_BONUS_THRESHOLD,
		remaining: Math.max(0, UPPER_BONUS_THRESHOLD - this.upperSubtotal),
		achieved: this.upperBonus > 0,
		percentage: Math.min(
			100,
			(this.upperSubtotal / UPPER_BONUS_THRESHOLD) * 100,
		),
	});

	// Getters
	get scores(): Record<Category, number | null> {
		return this.#scores;
	}

	getScore(category: Category): number | null {
		return this.#scores[category];
	}

	isAvailable(category: Category): boolean {
		return this.#scores[category] === null;
	}

	// Actions
	setScore(category: Category, score: number): boolean {
		if (!this.isAvailable(category)) {
			console.warn(`Category ${category} already scored`);
			return false;
		}

		if (score < 0) {
			console.warn(`Invalid score: ${score}`);
			return false;
		}

		this.#scores[category] = score;
		return true;
	}

	reset(): void {
		for (const cat of ALL_CATEGORIES) {
			this.#scores[cat] = null;
		}
	}

	// Serialization
	toJSON(): Scorecard {
		return {
			scores: { ...this.#scores },
			upperSubtotal: this.upperSubtotal,
			upperBonus: this.upperBonus,
			upperTotal: this.upperTotal,
			lowerTotal: this.lowerTotal,
			grandTotal: this.grandTotal,
			categoriesRemaining: [...this.categoriesRemaining],
			turnsCompleted: this.turnsCompleted,
		};
	}

	fromJSON(data: Scorecard): void {
		for (const cat of ALL_CATEGORIES) {
			this.#scores[cat] = data.scores[cat];
		}
	}
}

// =============================================================================
// Singleton Instance
// =============================================================================

export const scorecard = new ScorecardState();
