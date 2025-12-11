/**
 * Probabilistic Brain Implementation
 *
 * EV-based decision-making with configurable variance.
 * Makes mostly optimal decisions but occasionally "mistakes".
 */

import type { Category, KeptMask } from '../../game';
import { calculateAllPotentialScores, getRemainingCategories } from '../../game';
import type { AIProfile, GameContext, TurnDecision } from '../types';
import { OptimalBrain } from './optimal';
import type { AIBrain } from './types';

/**
 * Probabilistic brain - optimal with variance.
 *
 * Uses skill level to determine how often to follow optimal strategy.
 * Lower skill = more random deviations from optimal.
 */
export class ProbabilisticBrain implements AIBrain {
	readonly type = 'probabilistic';
	private profile: AIProfile | null = null;
	private optimalBrain: OptimalBrain;

	constructor() {
		this.optimalBrain = new OptimalBrain(false);
	}

	async initialize(profile: AIProfile): Promise<void> {
		this.profile = profile;
		await this.optimalBrain.initialize(profile);
	}

	async decide(context: GameContext): Promise<TurnDecision> {
		if (!this.profile) {
			throw new Error('Brain not initialized');
		}

		// Get optimal decision
		const optimalDecision = await this.optimalBrain.decide(context);

		// Skill level determines how often we follow optimal
		const followOptimal = Math.random() < this.profile.skillLevel;

		if (followOptimal) {
			return {
				...optimalDecision,
				confidence: 0.9,
			};
		}

		// Make a suboptimal decision
		return this.makeSuboptimalDecision(context, optimalDecision);
	}

	estimateThinkingTime(context: GameContext, profile: AIProfile): number {
		// Slightly faster than optimal (less calculation)
		return this.optimalBrain.estimateThinkingTime(context, profile) * 0.8;
	}

	dispose(): void {
		this.profile = null;
		this.optimalBrain.dispose();
	}

	// ========================================================================
	// Suboptimal Decision Making
	// ========================================================================

	private makeSuboptimalDecision(
		context: GameContext,
		optimalDecision: TurnDecision,
	): TurnDecision {
		// Different types of suboptimal moves
		const mistakeType = Math.random();

		if (mistakeType < 0.3 && context.rollsRemaining > 0) {
			// Roll when should keep/score
			return {
				action: 'roll',
				reasoning: 'Going for it!',
				confidence: 0.5,
			};
		}

		if (mistakeType < 0.6 && optimalDecision.action === 'keep') {
			// Keep different dice
			// biome-ignore lint/style/noNonNullAssertion: keepMask exists when action is 'keep'
			return this.makeAlternativeKeep(context, optimalDecision.keepMask!);
		}

		if (optimalDecision.action === 'score' || context.rollsRemaining === 0) {
			// Score in a different category
			return this.makeAlternativeScore(context, optimalDecision.category);
		}

		// Default to optimal
		return optimalDecision;
	}

	private makeAlternativeKeep(_context: GameContext, optimalKeep: KeptMask): TurnDecision {
		// Flip one random keep decision
		const newKeep: KeptMask = [...optimalKeep];
		const index = Math.floor(Math.random() * 5);
		newKeep[index] = !newKeep[index];

		return {
			action: 'keep',
			keepMask: newKeep,
			reasoning: 'Trying something different',
			confidence: 0.4,
		};
	}

	private makeAlternativeScore(context: GameContext, optimalCategory?: Category): TurnDecision {
		const remaining = getRemainingCategories(context.scorecard);
		const scores = calculateAllPotentialScores(
			context.dice as [number, number, number, number, number],
		);

		// Find categories with non-zero scores
		const nonZero = remaining.filter((cat) => {
			const score = scores[cat as keyof typeof scores];
			return score !== undefined && score > 0;
		});

		if (nonZero.length > 1) {
			// Pick a random non-optimal category
			const alternatives = nonZero.filter((cat) => cat !== optimalCategory);
			if (alternatives.length > 0) {
				const index = Math.floor(Math.random() * alternatives.length);
				return {
					action: 'score',
					category: alternatives[index] as Category,
					reasoning: 'Taking a chance',
					confidence: 0.3,
				};
			}
		}

		// Fall back to any remaining category
		if (remaining.length > 0) {
			const index = Math.floor(Math.random() * remaining.length);
			return {
				action: 'score',
				category: remaining[index] as Category,
				reasoning: 'Making do',
				confidence: 0.3,
			};
		}

		// Should not happen
		return {
			action: 'score',
			category: optimalCategory || ('ones' as Category),
			reasoning: 'No choice',
			confidence: 0.1,
		};
	}
}
