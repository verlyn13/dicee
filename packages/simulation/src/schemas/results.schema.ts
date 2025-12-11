/**
 * Game Result Schemas
 *
 * Output schemas for simulation results at game, turn, and decision levels.
 * Designed for export to NDJSON and conversion to Parquet for analysis.
 *
 * @example
 * import { GameResultSchema, TurnResultSchema } from '@dicee/simulation/schemas';
 *
 * // Validate a game result
 * const result = GameResultSchema.safeParse(data);
 */

import { CategorySchema, DiceArraySchema, KeptMaskSchema, ScorecardSchema } from '@dicee/shared';
import { z } from 'zod';

// =============================================================================
// Player Result Schema
// =============================================================================

/**
 * Result for a single player in a completed game
 */
export const PlayerResultSchema = z.object({
	/** Player identifier within the simulation */
	id: z.string(),

	/** Profile ID used for this player */
	profileId: z.string(),

	/** Final total score */
	finalScore: z.number().int().min(0),

	/** Complete scorecard at end of game */
	scorecard: ScorecardSchema,

	/** Whether player earned the upper section bonus (63+) */
	upperBonus: z.boolean(),

	/** Number of Dicees scored (including bonus Dicees) */
	diceeCount: z.number().int().min(0),

	/** Number of decisions that matched optimal (if tracked) */
	optimalDecisions: z.number().int().min(0).optional(),

	/** Total number of decisions made (if tracked) */
	totalDecisions: z.number().int().min(0).optional(),

	/** Cumulative EV loss from suboptimal decisions (if tracked) */
	evLoss: z.number().min(0).optional(),
});

// =============================================================================
// Game Result Schema
// =============================================================================

/**
 * Complete result for a single game simulation
 */
export const GameResultSchema = z.object({
	/** Unique identifier for this game */
	gameId: z.string().uuid(),

	/** RNG seed used for this game (for reproducibility) */
	seed: z.number().int(),

	/** Experiment ID if part of an experiment run */
	experimentId: z.string().optional(),

	/** ISO timestamp when game started */
	startedAt: z.string().datetime(),

	/** ISO timestamp when game completed */
	completedAt: z.string().datetime(),

	/** Duration in milliseconds */
	durationMs: z.number().int().min(0),

	/** Results for each player */
	players: z.array(PlayerResultSchema).min(1).max(4),

	/** ID of the winning player */
	winnerId: z.string(),

	/** Profile ID of the winning player */
	winnerProfileId: z.string(),
});

// =============================================================================
// Turn Result Schema
// =============================================================================

/**
 * Result for a single turn (one player, one scoring action)
 */
export const TurnResultSchema = z.object({
	/** Unique identifier for this turn */
	turnId: z.string(),

	/** Parent game ID */
	gameId: z.string().uuid(),

	/** Player who took this turn */
	playerId: z.string(),

	/** Profile ID of the player */
	profileId: z.string(),

	/** Turn number (1-13) */
	turnNumber: z.number().int().min(1).max(13),

	/** Number of rolls taken (1-3) */
	rollCount: z.number().int().min(1).max(3),

	/** Final dice configuration before scoring */
	finalDice: DiceArraySchema,

	/** Category selected for scoring */
	scoredCategory: CategorySchema,

	/** Points earned in the selected category */
	scoredPoints: z.number().int().min(0),

	/** Optimal category according to EV calculator (if tracked) */
	optimalCategory: CategorySchema.optional(),

	/** Points that would have been earned with optimal choice (if tracked) */
	optimalPoints: z.number().int().min(0).optional(),

	/** EV difference between chosen and optimal (if tracked) */
	evDifference: z.number().optional(),

	/** Whether the chosen category was optimal (if tracked) */
	wasOptimal: z.boolean().optional(),
});

// =============================================================================
// Decision Result Schema
// =============================================================================

/**
 * Result for a single keep/reroll decision within a turn
 */
export const DecisionResultSchema = z.object({
	/** Unique identifier for this decision */
	decisionId: z.string(),

	/** Parent turn ID */
	turnId: z.string(),

	/** Parent game ID */
	gameId: z.string().uuid(),

	/** Player ID */
	playerId: z.string(),

	/** Roll number when decision was made (1 or 2, decision before roll 2 or 3) */
	rollNumber: z.number().int().min(1).max(2),

	/** Dice values before the decision */
	diceBefore: DiceArraySchema,

	/** Dice values after the reroll */
	diceAfter: DiceArraySchema,

	/** Which dice were kept (true = kept, false = rerolled) */
	keptMask: KeptMaskSchema,

	/** Whether the keep pattern was optimal (if tracked) */
	wasOptimalHold: z.boolean().optional(),

	/** EV loss from non-optimal keep pattern (if tracked) */
	evLoss: z.number().min(0).optional(),
});

// =============================================================================
// Batch Progress Schema
// =============================================================================

/**
 * Progress update during batch simulation
 */
export const BatchProgressSchema = z.object({
	/** Number of games completed */
	gamesCompleted: z.number().int().min(0),

	/** Total games in batch */
	totalGames: z.number().int().min(0),

	/** Percentage complete (0-100) */
	percentComplete: z.number().min(0).max(100),

	/** Elapsed time in milliseconds */
	elapsedMs: z.number().int().min(0),

	/** Estimated time remaining in milliseconds */
	estimatedRemainingMs: z.number().int().min(0).optional(),

	/** Games per second throughput */
	gamesPerSecond: z.number().min(0),
});

// =============================================================================
// Derived Types
// =============================================================================

/** Single player result */
export type PlayerResult = z.infer<typeof PlayerResultSchema>;

/** Complete game result */
export type GameResult = z.infer<typeof GameResultSchema>;

/** Single turn result */
export type TurnResult = z.infer<typeof TurnResultSchema>;

/** Single decision result */
export type DecisionResult = z.infer<typeof DecisionResultSchema>;

/** Batch progress update */
export type BatchProgress = z.infer<typeof BatchProgressSchema>;
