/**
 * Random Brain Implementation
 *
 * Makes valid random decisions.
 * Used for chaos mode AI and as a baseline/fallback.
 */

import type { Category, KeptMask } from '../../game';
import { getRemainingCategories } from '../../game';
import type { AIProfile, GameContext, TurnDecision } from '../types';
import type { AIBrain } from './types';

/**
 * Random brain - makes uniformly random valid decisions.
 */
export class RandomBrain implements AIBrain {
	readonly type = 'random';

	async initialize(profile: AIProfile): Promise<void> {
		this.profile = profile;
	}

	async decide(context: GameContext): Promise<TurnDecision> {
		// If no rolls remaining, must score
		if (context.rollsRemaining === 0) {
			return this.decideScore(context);
		}

		// Randomly decide to roll, keep different dice, or score
		const action = this.randomAction(context);

		switch (action) {
			case 'roll':
				return { action: 'roll', reasoning: 'Rolling for fun!' };
			case 'keep':
				return this.decideKeep(context);
			case 'score':
				return this.decideScore(context);
		}
	}

	estimateThinkingTime(context: GameContext, profile: AIProfile): number {
		const { timing } = profile;
		const base = context.rollsRemaining === 0 ? timing.scoreDecisionMs : timing.rollDecisionMs;

		// Add random variance
		const variance = Math.random() * timing.varianceMs * 2 - timing.varianceMs;

		return Math.max(100, base + variance);
	}

	dispose(): void {
		this.profile = null;
	}

	// ========================================================================
	// Private Methods
	// ========================================================================

	private randomAction(_context: GameContext): 'roll' | 'keep' | 'score' {
		// Weight towards rolling more often
		const roll = Math.random();

		if (roll < 0.4) {
			return 'roll';
		}
		if (roll < 0.7) {
			return 'keep';
		}
		return 'score';
	}

	private decideKeep(_context: GameContext): TurnDecision {
		// Randomly keep 0-5 dice
		const numToKeep = Math.floor(Math.random() * 6);
		const keepMask: KeptMask = [false, false, false, false, false];

		// Randomly select which dice to keep
		const indices = [0, 1, 2, 3, 4];
		this.shuffleArray(indices);

		for (let i = 0; i < numToKeep; i++) {
			keepMask[indices[i]] = true;
		}

		return {
			action: 'keep',
			keepMask,
			reasoning: `Randomly keeping ${numToKeep} dice`,
		};
	}

	private decideScore(context: GameContext): TurnDecision {
		// Get remaining categories
		const remaining = getRemainingCategories(context.scorecard);

		if (remaining.length === 0) {
			// Should not happen, but handle gracefully
			return {
				action: 'score',
				category: 'ones' as Category,
				reasoning: 'No categories left!',
			};
		}

		// Pick a random remaining category
		const index = Math.floor(Math.random() * remaining.length);
		const category = remaining[index];

		return {
			action: 'score',
			category,
			reasoning: `Randomly scoring ${category}`,
		};
	}

	private shuffleArray<T>(array: T[]): void {
		for (let i = array.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[array[i], array[j]] = [array[j], array[i]];
		}
	}
}
