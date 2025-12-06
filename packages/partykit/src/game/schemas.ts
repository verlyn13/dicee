/**
 * Game Command & Event Schemas
 *
 * Zod 4 schemas for runtime validation of game messages.
 * Server defines these - client imports inferred types.
 *
 * Zod 4 Patterns:
 * - Use `{ error: "..." }` not `{ message: "..." }`
 * - String formats are top-level: z.uuid()
 */

import { z } from 'zod';
import { ALL_CATEGORIES } from './types';

// =============================================================================
// Primitive Schemas
// =============================================================================

/** Dice value (1-6) */
export const DiceValueSchema = z.number().int().min(1).max(6);

/** Array of 5 dice values */
export const DiceArraySchema = z.tuple([
	DiceValueSchema,
	DiceValueSchema,
	DiceValueSchema,
	DiceValueSchema,
	DiceValueSchema,
]);

/** Keep mask (5 booleans) */
export const KeptMaskSchema = z.tuple([z.boolean(), z.boolean(), z.boolean(), z.boolean(), z.boolean()]);

/** Scoring category */
export const CategorySchema = z.enum([
	'ones',
	'twos',
	'threes',
	'fours',
	'fives',
	'sixes',
	'threeOfAKind',
	'fourOfAKind',
	'fullHouse',
	'smallStraight',
	'largeStraight',
	'yahtzee',
	'chance',
]);

/** Game phase */
export const GamePhaseSchema = z.enum([
	'waiting',
	'starting',
	'turn_roll',
	'turn_decide',
	'turn_score',
	'game_over',
]);

/** Connection status */
export const ConnectionStatusSchema = z.enum(['online', 'away', 'disconnected']);

// =============================================================================
// Command Schemas (Client → Server)
// =============================================================================

/**
 * Start game command (host only)
 */
export const StartGameCommandSchema = z.object({
	type: z.literal('game.start'),
});

/**
 * Roll dice command
 * kept: which dice to keep from previous roll (all false on first roll)
 */
export const RollDiceCommandSchema = z.object({
	type: z.literal('dice.roll'),
	kept: KeptMaskSchema,
});

/**
 * Keep dice command (update kept mask without rolling)
 */
export const KeepDiceCommandSchema = z.object({
	type: z.literal('dice.keep'),
	indices: z.array(z.number().int().min(0).max(4)).max(5),
});

/**
 * Score category command
 */
export const ScoreCategoryCommandSchema = z.object({
	type: z.literal('category.score'),
	category: CategorySchema,
});

/**
 * Request rematch command (host only, from game_over)
 */
export const RematchCommandSchema = z.object({
	type: z.literal('game.rematch'),
});

/**
 * All game commands - discriminated union
 */
export const GameCommandSchema = z.discriminatedUnion('type', [
	StartGameCommandSchema,
	RollDiceCommandSchema,
	KeepDiceCommandSchema,
	ScoreCategoryCommandSchema,
	RematchCommandSchema,
]);

export type GameCommand = z.infer<typeof GameCommandSchema>;

// =============================================================================
// Event Schemas (Server → Client)
// =============================================================================

/** Base event with timestamp */
const BaseEventSchema = z.object({
	timestamp: z.string(),
});

/**
 * Game started event
 */
export const GameStartedEventSchema = BaseEventSchema.extend({
	type: z.literal('game.started'),
	playerOrder: z.array(z.string()),
	currentPlayerId: z.string(),
	turnNumber: z.number().int().min(1).max(13),
});

/**
 * Turn started event
 */
export const TurnStartedEventSchema = BaseEventSchema.extend({
	type: z.literal('turn.started'),
	playerId: z.string(),
	turnNumber: z.number().int().min(1).max(13),
	roundNumber: z.number().int().min(1).max(13),
});

/**
 * Dice rolled event
 */
export const DiceRolledEventSchema = BaseEventSchema.extend({
	type: z.literal('dice.rolled'),
	playerId: z.string(),
	dice: DiceArraySchema,
	rollNumber: z.number().int().min(1).max(3),
	rollsRemaining: z.number().int().min(0).max(2),
});

/**
 * Dice kept event (kept mask updated)
 */
export const DiceKeptEventSchema = BaseEventSchema.extend({
	type: z.literal('dice.kept'),
	playerId: z.string(),
	kept: KeptMaskSchema,
});

/**
 * Category scored event
 */
export const CategoryScoredEventSchema = BaseEventSchema.extend({
	type: z.literal('category.scored'),
	playerId: z.string(),
	category: CategorySchema,
	score: z.number().int().min(0),
	totalScore: z.number().int().min(0),
	isYahtzeeBonus: z.boolean(),
});

/**
 * Turn ended event
 */
export const TurnEndedEventSchema = BaseEventSchema.extend({
	type: z.literal('turn.ended'),
	playerId: z.string(),
});

/**
 * Turn skipped event (AFK or disconnect)
 */
export const TurnSkippedEventSchema = BaseEventSchema.extend({
	type: z.literal('turn.skipped'),
	playerId: z.string(),
	reason: z.enum(['timeout', 'disconnect']),
	categoryScored: CategorySchema,
	score: z.number().int().min(0),
});

/**
 * AFK warning event (15 seconds before skip)
 */
export const AfkWarningEventSchema = BaseEventSchema.extend({
	type: z.literal('player.afk_warning'),
	playerId: z.string(),
	secondsRemaining: z.number().int().min(0),
});

/**
 * Game completed event
 */
export const GameCompletedEventSchema = BaseEventSchema.extend({
	type: z.literal('game.completed'),
	rankings: z.array(
		z.object({
			playerId: z.string(),
			displayName: z.string(),
			rank: z.number().int().min(1),
			score: z.number().int().min(0),
			yahtzeeCount: z.number().int().min(0),
		}),
	),
	duration: z.number().int().min(0), // Game duration in seconds
});

/**
 * Full state sync event (for reconnection)
 */
export const StateSyncEventSchema = BaseEventSchema.extend({
	type: z.literal('state.sync'),
	state: z.object({
		roomCode: z.string(),
		phase: GamePhaseSchema,
		playerOrder: z.array(z.string()),
		currentPlayerIndex: z.number().int().min(0),
		turnNumber: z.number().int().min(0).max(13),
		roundNumber: z.number().int().min(0).max(13),
		players: z.record(
			z.string(),
			z.object({
				id: z.string(),
				displayName: z.string(),
				avatarSeed: z.string(),
				isConnected: z.boolean(),
				connectionStatus: ConnectionStatusSchema,
				isHost: z.boolean(),
				totalScore: z.number().int().min(0),
				currentDice: DiceArraySchema.nullable(),
				keptDice: KeptMaskSchema.nullable(),
				rollsRemaining: z.number().int().min(0).max(3),
				scorecard: z.object({
					ones: z.number().nullable(),
					twos: z.number().nullable(),
					threes: z.number().nullable(),
					fours: z.number().nullable(),
					fives: z.number().nullable(),
					sixes: z.number().nullable(),
					threeOfAKind: z.number().nullable(),
					fourOfAKind: z.number().nullable(),
					fullHouse: z.number().nullable(),
					smallStraight: z.number().nullable(),
					largeStraight: z.number().nullable(),
					yahtzee: z.number().nullable(),
					chance: z.number().nullable(),
					yahtzeeBonus: z.number(),
					upperBonus: z.number(),
				}),
			}),
		),
		turnStartedAt: z.string().nullable(),
		gameStartedAt: z.string().nullable(),
		gameCompletedAt: z.string().nullable(),
		rankings: z
			.array(
				z.object({
					playerId: z.string(),
					displayName: z.string(),
					rank: z.number().int().min(1),
					score: z.number().int().min(0),
					yahtzeeCount: z.number().int().min(0),
				}),
			)
			.nullable(),
	}),
});

/**
 * Error event
 */
export const GameErrorEventSchema = BaseEventSchema.extend({
	type: z.literal('game.error'),
	message: z.string(),
	code: z.enum([
		'NOT_YOUR_TURN',
		'INVALID_PHASE',
		'INVALID_CATEGORY',
		'CATEGORY_ALREADY_SCORED',
		'NO_ROLLS_REMAINING',
		'NOT_HOST',
		'NOT_ENOUGH_PLAYERS',
		'GAME_IN_PROGRESS',
		'GAME_NOT_STARTED',
	]),
});

/**
 * All game events - discriminated union
 */
export const GameEventSchema = z.discriminatedUnion('type', [
	GameStartedEventSchema,
	TurnStartedEventSchema,
	DiceRolledEventSchema,
	DiceKeptEventSchema,
	CategoryScoredEventSchema,
	TurnEndedEventSchema,
	TurnSkippedEventSchema,
	AfkWarningEventSchema,
	GameCompletedEventSchema,
	StateSyncEventSchema,
	GameErrorEventSchema,
]);

export type GameEvent = z.infer<typeof GameEventSchema>;

// =============================================================================
// Validation Helpers
// =============================================================================

/**
 * Parse and validate a game command
 */
export function parseGameCommand(input: unknown) {
	return GameCommandSchema.safeParse(input);
}

/**
 * Parse and validate a game event
 */
export function parseGameEvent(input: unknown) {
	return GameEventSchema.safeParse(input);
}

/**
 * Validate category is available in scorecard
 */
export function isCategoryAvailable(
	scorecard: { [K in (typeof ALL_CATEGORIES)[number]]: number | null },
	category: (typeof ALL_CATEGORIES)[number],
): boolean {
	return scorecard[category] === null;
}
