/**
 * Personality Brain Implementation
 *
 * Trait-influenced decision-making that creates distinct play styles.
 * Modifies optimal EV decisions based on personality traits.
 */

import type { Category, KeptMask } from '../../game';
import { getRemainingCategories, calculateAllPotentialScores } from '../../game';
import type { AIProfile, AITraits, GameContext, TurnDecision } from '../types';
import type { AIBrain } from './types';
import { OptimalBrain } from './optimal';

/**
 * Personality brain - trait-influenced decisions.
 *
 * Uses traits like riskTolerance, yahtzeeChaser, etc. to modify
 * decisions from the optimal baseline.
 */
export class PersonalityBrain implements AIBrain {
	readonly type = 'personality';
	private profile: AIProfile | null = null;
	private traits: AITraits | null = null;
	private optimalBrain: OptimalBrain;

	constructor() {
		this.optimalBrain = new OptimalBrain(false);
	}

	async initialize(profile: AIProfile): Promise<void> {
		this.profile = profile;
		this.traits = profile.traits;
		await this.optimalBrain.initialize(profile);
	}

	async decide(context: GameContext): Promise<TurnDecision> {
		if (!this.profile || !this.traits) {
			throw new Error('Brain not initialized');
		}

		// Get optimal decision as baseline
		const optimalDecision = await this.optimalBrain.decide(context);

		// Apply trait modifications
		const modifiedDecision = this.applyTraits(context, optimalDecision);

		// Apply skill-based noise
		return this.applySkillNoise(modifiedDecision);
	}

	estimateThinkingTime(context: GameContext, profile: AIProfile): number {
		const baseTime = this.optimalBrain.estimateThinkingTime(context, profile);

		// Traits affect thinking time
		const thinkingMultiplier = 0.5 + profile.traits.thinkingTime;

		return baseTime * thinkingMultiplier;
	}

	dispose(): void {
		this.profile = null;
		this.traits = null;
		this.optimalBrain.dispose();
	}

	// ========================================================================
	// Trait Application
	// ========================================================================

	private applyTraits(
		context: GameContext,
		decision: TurnDecision,
	): TurnDecision {
		const traits = this.traits!;

		// Check for Yahtzee chasing behavior
		if (this.shouldChaseYahtzee(context, decision)) {
			return this.chaseYahtzee(context);
		}

		// Check for risk-influenced decisions
		if (this.shouldTakeRisk(context, decision)) {
			return this.takeRiskyAction(context, decision);
		}

		// Check for upper section focus
		if (this.shouldFocusUpper(context, decision)) {
			return this.focusUpperSection(context, decision);
		}

		// Check for "use all rolls" tendency
		if (this.shouldKeepRolling(context, decision)) {
			return {
				action: 'roll',
				reasoning: 'Still have rolls left!',
				confidence: 0.6,
			};
		}

		return decision;
	}

	private shouldChaseYahtzee(context: GameContext, decision: TurnDecision): boolean {
		const traits = this.traits!;

		// Already scored yahtzee
		if (context.scorecard.yahtzee !== null) {
			return false;
		}

		// Check if we have potential (3+ of a kind)
		const counts = this.countDice(context.dice);
		const maxCount = Math.max(...counts.slice(1));

		// Yahtzee chasers will chase with 3+, others need 4+
		const threshold = traits.yahtzeeChaser > 0.5 ? 3 : 4;

		if (maxCount >= threshold && context.rollsRemaining > 0) {
			// Probability check based on yahtzeeChaser trait
			return Math.random() < traits.yahtzeeChaser;
		}

		return false;
	}

	private chaseYahtzee(context: GameContext): TurnDecision {
		const counts = this.countDice(context.dice);

		// Find value with most occurrences
		let bestValue = 1;
		let bestCount = 0;
		for (let v = 1; v <= 6; v++) {
			if (counts[v] > bestCount) {
				bestCount = counts[v];
				bestValue = v;
			}
		}

		// Keep all of the best value
		const keepMask: KeptMask = [false, false, false, false, false];
		for (let i = 0; i < 5; i++) {
			if (context.dice[i] === bestValue) {
				keepMask[i] = true;
			}
		}

		// If keeping all 5 (already yahtzee), score it
		if (bestCount === 5) {
			const remaining = getRemainingCategories(context.scorecard);
			if (remaining.includes('yahtzee')) {
				return {
					action: 'score',
					category: 'yahtzee' as Category,
					reasoning: 'YAHTZEE!!! 🎲🎲🎲🎲🎲',
					confidence: 1.0,
				};
			}
		}

		return {
			action: 'keep',
			keepMask,
			reasoning: `Going for Yahtzee! Need ${5 - bestCount} more ${bestValue}s`,
			confidence: 0.7,
		};
	}

	private shouldTakeRisk(context: GameContext, decision: TurnDecision): boolean {
		const traits = this.traits!;

		// Risk tolerance affects willingness to re-roll good hands
		if (decision.action === 'score' && context.rollsRemaining > 0) {
			// Check if current score is "good enough" for the category
			const scores = calculateAllPotentialScores(context.dice as [number, number, number, number, number]);
			const score = scores[decision.category as keyof typeof scores] || 0;

			// Risk-takers will re-roll anything below max score
			if (traits.riskTolerance > 0.7 && score < 30) {
				return Math.random() < traits.riskTolerance - 0.5;
			}
		}

		return false;
	}

	private takeRiskyAction(context: GameContext, decision: TurnDecision): TurnDecision {
		// Risk-takers often just roll everything
		return {
			action: 'roll',
			reasoning: 'Taking a risk!',
			confidence: 0.5,
		};
	}

	private shouldFocusUpper(context: GameContext, decision: TurnDecision): boolean {
		const traits = this.traits!;

		// Check upper section progress
		const upperCats = ['ones', 'twos', 'threes', 'fours', 'fives', 'sixes'];
		let upperSum = 0;
		let upperRemaining = 0;

		for (const cat of upperCats) {
			const val = context.scorecard[cat as keyof typeof context.scorecard];
			if (val !== null && val !== undefined) {
				upperSum += val as number;
			} else {
				upperRemaining++;
			}
		}

		// If close to bonus and trait says focus upper
		const needForBonus = 63 - upperSum;
		if (needForBonus > 0 && upperRemaining > 0 && traits.upperSectionFocus > 0.6) {
			return Math.random() < traits.upperSectionFocus;
		}

		return false;
	}

	private focusUpperSection(context: GameContext, decision: TurnDecision): TurnDecision {
		const remaining = getRemainingCategories(context.scorecard);
		const scores = calculateAllPotentialScores(context.dice as [number, number, number, number, number]);
		const upperCats: Category[] = ['ones', 'twos', 'threes', 'fours', 'fives', 'sixes'];

		// Find best upper section category
		let bestCat: Category | null = null;
		let bestScore = 0;

		for (const cat of upperCats) {
			if (remaining.includes(cat)) {
				const score = scores[cat as keyof typeof scores] || 0;
				if (score > bestScore) {
					bestScore = score;
					bestCat = cat;
				}
			}
		}

		if (bestCat !== null && bestScore >= 3) {
			// Only switch if we have a decent score
			return {
				action: 'score',
				category: bestCat,
				reasoning: `Focusing on upper section bonus`,
				confidence: 0.7,
			};
		}

		return decision;
	}

	private shouldKeepRolling(context: GameContext, decision: TurnDecision): boolean {
		const traits = this.traits!;

		if (decision.action === 'score' && context.rollsRemaining > 0) {
			// usesAllRolls trait determines tendency to keep rolling
			return Math.random() < traits.usesAllRolls * 0.5;
		}

		return false;
	}

	// ========================================================================
	// Skill Noise
	// ========================================================================

	private applySkillNoise(decision: TurnDecision): TurnDecision {
		const skillLevel = this.profile!.skillLevel;

		// Higher skill = less noise
		if (Math.random() > skillLevel) {
			// Add slight random modification
			if (decision.action === 'keep' && decision.keepMask) {
				const newKeep: KeptMask = [...decision.keepMask];
				const flipIndex = Math.floor(Math.random() * 5);

				// Small chance to flip a keep decision
				if (Math.random() < 0.3) {
					newKeep[flipIndex] = !newKeep[flipIndex];
					return {
						...decision,
						keepMask: newKeep,
						confidence: (decision.confidence || 0.5) * 0.8,
					};
				}
			}
		}

		return decision;
	}

	// ========================================================================
	// Utility
	// ========================================================================

	private countDice(dice: readonly number[]): number[] {
		const counts = [0, 0, 0, 0, 0, 0, 0];
		for (const d of dice) {
			counts[d]++;
		}
		return counts;
	}
}
