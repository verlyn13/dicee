/**
 * AI Brain Interface
 *
 * Defines the contract for AI decision-making implementations.
 * Each brain type implements this interface with different strategies.
 */

import type { AIProfile, GameContext, TurnDecision } from '../types';

/**
 * AI Brain interface - the decision-making engine.
 *
 * A brain receives game context and produces turn decisions.
 * Different implementations provide different strategies:
 * - OptimalBrain: Pure EV maximization
 * - ProbabilisticBrain: EV with variance
 * - PersonalityBrain: Trait-influenced decisions
 * - RandomBrain: Valid random moves
 */
export interface AIBrain {
	/**
	 * Brain type identifier.
	 */
	readonly type: string;

	/**
	 * Initialize the brain with a profile.
	 * Called once when the AI player is created.
	 *
	 * @param profile - The AI profile to use
	 */
	initialize(profile: AIProfile): Promise<void>;

	/**
	 * Decide the next action to take.
	 * Called repeatedly during a turn until scoring.
	 *
	 * @param context - Current game state
	 * @returns The decision for this step
	 */
	decide(context: GameContext): Promise<TurnDecision>;

	/**
	 * Estimate thinking time for a decision.
	 * Used for natural-feeling delays.
	 *
	 * @param context - Current game state
	 * @param profile - The AI profile (for timing settings)
	 * @returns Estimated time in milliseconds
	 */
	estimateThinkingTime(context: GameContext, profile: AIProfile): number;

	/**
	 * Clean up any resources.
	 * Called when the game ends or AI is removed.
	 */
	dispose(): void;
}

/**
 * Options for brain decision-making.
 */
export interface BrainOptions {
	/** Maximum time allowed for decision (ms) */
	timeoutMs?: number;

	/** Whether to include reasoning in decisions */
	includeReasoning?: boolean;

	/** Seed for deterministic testing */
	randomSeed?: number;
}

/**
 * Result of EV calculation for a category.
 */
export interface CategoryEV {
	/** The category */
	category: string;

	/** Expected value if scoring now */
	immediateEV: number;

	/** Expected value if continuing to roll */
	rollEV: number;

	/** Recommended action based on EV */
	recommendation: 'score' | 'roll';

	/** Confidence in the recommendation (0-1) */
	confidence: number;
}

/**
 * Result of keep decision analysis.
 */
export interface KeepAnalysis {
	/** Recommended dice to keep */
	keepMask: [boolean, boolean, boolean, boolean, boolean];

	/** Expected value of this keep pattern */
	expectedValue: number;

	/** Target category being pursued */
	targetCategory?: string;

	/** Alternative keep options considered */
	alternatives?: Array<{
		keepMask: [boolean, boolean, boolean, boolean, boolean];
		expectedValue: number;
	}>;
}
