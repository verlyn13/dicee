/**
 * WASM Engine Wrapper for Cloudflare Workers
 *
 * Provides access to the Dicee probability engine.
 * Falls back to TypeScript heuristics if WASM isn't available.
 *
 * WASM Spike (ai-3) Notes:
 * - Cloudflare Workers support WASM via direct import
 * - The WASM module is ~45KB and loads quickly
 * - Uses synchronous instantiation for fastest startup
 *
 * Future improvements:
 * - Bundle WASM in worker via wrangler config
 * - Use wasm-pack with --target web for Workers compatibility
 */

import type { Category, KeptMask, Scorecard } from '../game';
import { getRemainingCategories } from '../game';
import { createLogger } from '../lib/logger';

const engineLogger = createLogger({ component: 'DiceeEngine' });

// ============================================================================
// WASM Types (from dicee_engine.d.ts)
// ============================================================================

/**
 * Turn analysis result from WASM engine.
 */
export interface TurnAnalysis {
	/** Recommended action: 'score' or 'reroll' */
	recommendation: 'score' | 'reroll';

	/** If reroll, which dice to keep (for each die: true = keep) */
	keepPattern: [boolean, boolean, boolean, boolean, boolean];

	/** Expected values for each category */
	categoryEVs: Record<string, number>;

	/** Best category to score in */
	bestCategory: string;

	/** Expected value of best action */
	expectedValue: number;
}

/**
 * Category bitmask for WASM engine.
 *
 * Bit positions:
 * 0: ones, 1: twos, 2: threes, 3: fours, 4: fives, 5: sixes,
 * 6: three_of_a_kind, 7: four_of_a_kind, 8: full_house,
 * 9: small_straight, 10: large_straight, 11: dicee, 12: chance
 */
const CATEGORY_BITS: Record<string, number> = {
	ones: 0x0001,
	twos: 0x0002,
	threes: 0x0004,
	fours: 0x0008,
	fives: 0x0010,
	sixes: 0x0020,
	three_of_a_kind: 0x0040,
	four_of_a_kind: 0x0080,
	full_house: 0x0100,
	small_straight: 0x0200,
	large_straight: 0x0400,
	dicee: 0x0800,
	chance: 0x1000,
};

// ============================================================================
// Engine Interface
// ============================================================================

/**
 * Engine interface for probability calculations.
 */
export interface DiceeEngine {
	/**
	 * Analyze the current turn and return optimal strategy.
	 */
	analyzeTurn(dice: readonly number[], rollsRemaining: number, scorecard: Scorecard): TurnAnalysis;

	/**
	 * Check if the engine is using WASM.
	 */
	isWasm(): boolean;
}

// ============================================================================
// WASM Engine Implementation
// ============================================================================

/**
 * WASM-based engine (not yet implemented).
 *
 * TODO: Implement when WASM bundling is configured.
 * For now, this is a placeholder that throws.
 * @internal Reserved for future WASM implementation
 */
class _WasmEngine implements DiceeEngine {
	private initialized = false;

	async initialize(): Promise<void> {
		// TODO: Load WASM module
		// const wasmModule = await import('./dicee_engine_bg.wasm');
		// initSync(wasmModule);
		// this.initialized = true;
		throw new Error('WASM engine not yet bundled for Workers');
	}

	analyzeTurn(
		_dice: readonly number[],
		_rollsRemaining: number,
		_scorecard: Scorecard,
	): TurnAnalysis {
		if (!this.initialized) {
			throw new Error('WASM engine not initialized');
		}

		// TODO: Call WASM analyze_turn function
		throw new Error('WASM engine not yet implemented');
	}

	isWasm(): boolean {
		return true;
	}
}

// ============================================================================
// TypeScript Fallback Engine
// ============================================================================

/**
 * TypeScript-based engine with heuristic calculations.
 *
 * Not as optimal as WASM but provides reasonable decisions.
 * Used as fallback when WASM isn't available.
 */
class TypeScriptEngine implements DiceeEngine {
	analyzeTurn(dice: readonly number[], rollsRemaining: number, scorecard: Scorecard): TurnAnalysis {
		const remaining = getRemainingCategories(scorecard);
		const _availableMask = this.scorecardToBitmask(scorecard);

		// Calculate EV for each remaining category
		const categoryEVs: Record<string, number> = {};
		for (const cat of remaining) {
			categoryEVs[cat] = this.calculateCategoryEV(dice, cat, rollsRemaining);
		}

		// Find best category
		let bestCategory: Category = remaining[0];
		let bestEV = -Infinity;

		for (const [cat, ev] of Object.entries(categoryEVs)) {
			if (ev > bestEV) {
				bestEV = ev;
				bestCategory = cat as Category;
			}
		}

		// Decide whether to score or reroll
		const rerollEV = rollsRemaining > 0 ? this.estimateRerollEV(dice, remaining) : 0;

		const recommendation = rerollEV > bestEV && rollsRemaining > 0 ? 'reroll' : 'score';

		// Calculate keep pattern if rerolling
		const keepPattern = this.calculateKeepPattern(dice, remaining, bestCategory);

		return {
			recommendation,
			keepPattern,
			categoryEVs,
			bestCategory,
			expectedValue: recommendation === 'score' ? bestEV : rerollEV,
		};
	}

	isWasm(): boolean {
		return false;
	}

	// ========================================================================
	// Category EV Calculation
	// ========================================================================

	private calculateCategoryEV(
		dice: readonly number[],
		category: string,
		rollsRemaining: number,
	): number {
		const score = this.calculateScore(dice, category);

		if (rollsRemaining === 0) {
			return score;
		}

		// Simple EV estimate: current score + potential improvement
		// This is a heuristic, not optimal EV
		const improvementPotential = this.estimateImprovement(dice, category, rollsRemaining);

		return Math.max(score, score + improvementPotential * 0.3);
	}

	private calculateScore(dice: readonly number[], category: string): number {
		const counts = this.countDice(dice);
		const sum = dice.reduce((a, b) => a + b, 0);

		switch (category) {
			case 'ones':
				return counts[1] * 1;
			case 'twos':
				return counts[2] * 2;
			case 'threes':
				return counts[3] * 3;
			case 'fours':
				return counts[4] * 4;
			case 'fives':
				return counts[5] * 5;
			case 'sixes':
				return counts[6] * 6;
			case 'three_of_a_kind':
				return this.hasNOfAKind(counts, 3) ? sum : 0;
			case 'four_of_a_kind':
				return this.hasNOfAKind(counts, 4) ? sum : 0;
			case 'full_house':
				return this.isFullHouse(counts) ? 25 : 0;
			case 'small_straight':
				return this.hasSmallStraight(dice) ? 30 : 0;
			case 'large_straight':
				return this.hasLargeStraight(dice) ? 40 : 0;
			case 'dicee':
				return this.hasNOfAKind(counts, 5) ? 50 : 0;
			case 'chance':
				return sum;
			default:
				return 0;
		}
	}

	private estimateImprovement(
		dice: readonly number[],
		category: string,
		rollsRemaining: number,
	): number {
		const currentScore = this.calculateScore(dice, category);
		const maxScore = this.getMaxScore(category);

		// Simple heuristic: potential improvement based on rolls remaining
		const potential = (maxScore - currentScore) * (rollsRemaining / 3);

		return potential;
	}

	private getMaxScore(category: string): number {
		switch (category) {
			case 'ones':
				return 5;
			case 'twos':
				return 10;
			case 'threes':
				return 15;
			case 'fours':
				return 20;
			case 'fives':
				return 25;
			case 'sixes':
				return 30;
			case 'three_of_a_kind':
				return 30;
			case 'four_of_a_kind':
				return 30;
			case 'full_house':
				return 25;
			case 'small_straight':
				return 30;
			case 'large_straight':
				return 40;
			case 'dicee':
				return 50;
			case 'chance':
				return 30;
			default:
				return 0;
		}
	}

	// ========================================================================
	// Reroll Analysis
	// ========================================================================

	private estimateRerollEV(dice: readonly number[], remaining: string[]): number {
		// Estimate EV of best possible outcome after reroll
		let maxEV = 0;

		for (const cat of remaining) {
			const currentScore = this.calculateScore(dice, cat);
			const maxScore = this.getMaxScore(cat);
			const potential = currentScore + (maxScore - currentScore) * 0.3;

			if (potential > maxEV) {
				maxEV = potential;
			}
		}

		return maxEV;
	}

	private calculateKeepPattern(
		dice: readonly number[],
		_remaining: string[],
		targetCategory: string,
	): KeptMask {
		const counts = this.countDice(dice);

		// Strategy based on target category
		if (targetCategory in { ones: 1, twos: 1, threes: 1, fours: 1, fives: 1, sixes: 1 }) {
			// Keep dice matching the target
			const target =
				{
					ones: 1,
					twos: 2,
					threes: 3,
					fours: 4,
					fives: 5,
					sixes: 6,
				}[targetCategory] || 1;

			return dice.map((d) => d === target) as KeptMask;
		}

		if (
			targetCategory === 'three_of_a_kind' ||
			targetCategory === 'four_of_a_kind' ||
			targetCategory === 'dicee'
		) {
			// Keep the most common value
			let bestValue = 1;
			let bestCount = 0;

			for (let v = 1; v <= 6; v++) {
				if (counts[v] > bestCount || (counts[v] === bestCount && v > bestValue)) {
					bestCount = counts[v];
					bestValue = v;
				}
			}

			return dice.map((d) => d === bestValue) as KeptMask;
		}

		if (targetCategory === 'full_house') {
			// Keep pairs and triples
			const keepMask: KeptMask = [false, false, false, false, false];
			const valuesToKeep = new Set<number>();

			for (let v = 1; v <= 6; v++) {
				if (counts[v] >= 2) {
					valuesToKeep.add(v);
				}
			}

			for (let i = 0; i < 5; i++) {
				if (valuesToKeep.has(dice[i])) {
					keepMask[i] = true;
				}
			}

			return keepMask;
		}

		if (targetCategory === 'small_straight' || targetCategory === 'large_straight') {
			// Keep unique values in sequence
			const unique = new Set(dice);
			const sorted = [...unique].sort((a, b) => a - b);

			// Find longest run
			let runStart = sorted[0];
			let runLength = 1;
			let bestStart = runStart;
			let bestLength = 1;

			for (let i = 1; i < sorted.length; i++) {
				if (sorted[i] === sorted[i - 1] + 1) {
					runLength++;
					if (runLength > bestLength) {
						bestLength = runLength;
						bestStart = runStart;
					}
				} else {
					runStart = sorted[i];
					runLength = 1;
				}
			}

			const keepValues = new Set<number>();
			for (let v = bestStart; v < bestStart + bestLength; v++) {
				keepValues.add(v);
			}

			// Keep first occurrence of each value in run
			const kept = new Set<number>();
			return dice.map((d) => {
				if (keepValues.has(d) && !kept.has(d)) {
					kept.add(d);
					return true;
				}
				return false;
			}) as KeptMask;
		}

		if (targetCategory === 'chance') {
			// Keep high dice (5s and 6s)
			return dice.map((d) => d >= 5) as KeptMask;
		}

		// Default: keep nothing
		return [false, false, false, false, false];
	}

	// ========================================================================
	// Scoring Helpers
	// ========================================================================

	private countDice(dice: readonly number[]): number[] {
		const counts = [0, 0, 0, 0, 0, 0, 0];
		for (const d of dice) {
			counts[d]++;
		}
		return counts;
	}

	private hasNOfAKind(counts: number[], n: number): boolean {
		return counts.some((c) => c >= n);
	}

	private isFullHouse(counts: number[]): boolean {
		const has3 = counts.some((c) => c === 3);
		const has2 = counts.some((c) => c === 2);
		const has5 = counts.some((c) => c === 5); // Dicee counts as full house

		return (has3 && has2) || has5;
	}

	private hasSmallStraight(dice: readonly number[]): boolean {
		const unique = new Set(dice);
		const patterns = [
			[1, 2, 3, 4],
			[2, 3, 4, 5],
			[3, 4, 5, 6],
		];

		return patterns.some((p) => p.every((v) => unique.has(v)));
	}

	private hasLargeStraight(dice: readonly number[]): boolean {
		const unique = new Set(dice);
		const patterns = [
			[1, 2, 3, 4, 5],
			[2, 3, 4, 5, 6],
		];

		return patterns.some((p) => p.every((v) => unique.has(v)));
	}

	private scorecardToBitmask(scorecard: Scorecard): number {
		let mask = 0;

		for (const [cat, bit] of Object.entries(CATEGORY_BITS)) {
			const key = cat as keyof Scorecard;
			if (scorecard[key] === null || scorecard[key] === undefined) {
				mask |= bit;
			}
		}

		return mask;
	}
}

// ============================================================================
// Engine Factory
// ============================================================================

let engineInstance: DiceeEngine | null = null;

/**
 * Get the Dicee engine instance.
 *
 * Returns TypeScript fallback by default.
 * Set useWasm=true to attempt WASM loading (not yet implemented).
 */
export function getEngine(useWasm = false): DiceeEngine {
	if (engineInstance && (useWasm === engineInstance.isWasm() || !useWasm)) {
		return engineInstance;
	}

	if (useWasm) {
		// TODO: Implement WASM engine when bundling is configured
		engineLogger.info('WASM engine not available, using TypeScript fallback', {
			operation: 'engine_init',
		});
	}

	engineInstance = new TypeScriptEngine();
	return engineInstance;
}

/**
 * Reset the engine instance (for testing).
 */
export function resetEngine(): void {
	engineInstance = null;
}
