/**
 * Multiplayer Zod Schemas - UPPERCASE Protocol
 *
 * Zod 4 schemas for runtime validation of multiplayer messages.
 * All wire protocol messages use UPPERCASE_SNAKE_CASE for type identifiers.
 *
 * Zod 4 Key Patterns:
 * - Use `{ error: "..." }` not `{ message: "..." }`
 * - String formats are top-level: z.uuid(), z.email()
 * - z.record() requires TWO arguments (key, value)
 * - z.enum() supports native enums
 */

import { z } from 'zod';

// =============================================================================
// Primitive Schemas
// =============================================================================

/**
 * Room code: 6 uppercase alphanumeric (no ambiguous chars: 0,O,1,I,L)
 * Alphabet: A-HJ-NP-Z2-9 (excludes 0,1,O,I,L)
 */
export const RoomCodeSchema = z
	.string()
	.length(6, { error: 'Room code must be exactly 6 characters' })
	.regex(/^[A-HJ-NP-Z2-9]+$/, { error: 'Invalid room code format' })
	.transform((val) => val.toUpperCase());

/**
 * Player ID is a UUID (strict RFC 9562 validation in Zod 4)
 */
export const PlayerIdSchema = z.uuid();

/**
 * Display name validation
 */
export const DisplayNameSchema = z
	.string()
	.min(1, { error: 'Display name is required' })
	.max(30, { error: 'Display name must be 30 characters or less' })
	.trim();

// =============================================================================
// Room Configuration Schema
// =============================================================================

export const RoomConfigSchema = z.object({
	isPublic: z.boolean().default(false),
	allowSpectators: z.boolean().default(false),
	turnTimeoutSeconds: z.number().int().min(0).max(300).default(60),
	maxPlayers: z.union([z.literal(2), z.literal(3), z.literal(4)]).default(2),
});

export type RoomConfigInput = z.input<typeof RoomConfigSchema>;

// =============================================================================
// Room State Schema
// =============================================================================

export const RoomStateSchema = z.enum(['waiting', 'starting', 'playing', 'completed', 'abandoned']);

// =============================================================================
// Player Schema
// =============================================================================

export const RoomPlayerSchema = z.object({
	id: PlayerIdSchema,
	displayName: DisplayNameSchema,
	avatarSeed: z.string(),
	isConnected: z.boolean(),
	isHost: z.boolean(),
	joinedAt: z.string(),
});

// =============================================================================
// Command Schemas (Client → Server) - UPPERCASE format
// =============================================================================

export const StartGameCommandSchema = z.object({
	type: z.literal('START_GAME'),
});

export const QuickPlayStartCommandSchema = z.object({
	type: z.literal('QUICK_PLAY_START'),
	payload: z.object({
		aiProfiles: z.array(z.string()),
	}),
});

export const RollDiceCommandSchema = z.object({
	type: z.literal('DICE_ROLL'),
	payload: z.object({
		kept: z.tuple([z.boolean(), z.boolean(), z.boolean(), z.boolean(), z.boolean()]).optional(),
	}),
});

export const KeepDiceCommandSchema = z.object({
	type: z.literal('DICE_KEEP'),
	payload: z.object({
		indices: z.array(z.number().int().min(0).max(4)).max(5),
	}),
});

export const ScoreCategoryCommandSchema = z.object({
	type: z.literal('CATEGORY_SCORE'),
	payload: z.object({
		category: z.string().min(1),
	}),
});

export const RematchCommandSchema = z.object({
	type: z.literal('REMATCH'),
});

export const AddAIPlayerCommandSchema = z.object({
	type: z.literal('ADD_AI_PLAYER'),
	payload: z.object({
		profileId: z.string().min(1),
	}),
});

export const PingCommandSchema = z.object({
	type: z.literal('PING'),
});

/**
 * All commands - discriminated union
 */
export const CommandSchema = z.discriminatedUnion('type', [
	StartGameCommandSchema,
	QuickPlayStartCommandSchema,
	RollDiceCommandSchema,
	KeepDiceCommandSchema,
	ScoreCategoryCommandSchema,
	RematchCommandSchema,
	AddAIPlayerCommandSchema,
	PingCommandSchema,
]);

export type CommandInput = z.input<typeof CommandSchema>;

// =============================================================================
// Server Event Schemas (Server → Client) - UPPERCASE format
// =============================================================================

const BaseEventSchema = z.object({
	timestamp: z.string().optional(),
});

const DiceArraySchema = z.tuple([
	z.number().int().min(1).max(6),
	z.number().int().min(1).max(6),
	z.number().int().min(1).max(6),
	z.number().int().min(1).max(6),
	z.number().int().min(1).max(6),
]);

const KeptMaskSchema = z.tuple([z.boolean(), z.boolean(), z.boolean(), z.boolean(), z.boolean()]);

const CategorySchema = z.enum([
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
	'dicee',
	'chance',
]);

const ScorecardSchema = z.object({
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
	dicee: z.number().nullable(),
	chance: z.number().nullable(),
	diceeBonus: z.number(),
	upperBonus: z.number(),
});

const PlayerGameStateSchema = z.object({
	id: z.string(),
	displayName: z.string(),
	avatarSeed: z.string(),
	isConnected: z.boolean(),
	connectionId: z.string().nullable(),
	lastActive: z.string(),
	connectionStatus: z.enum(['online', 'away', 'disconnected']),
	isHost: z.boolean(),
	joinedAt: z.string(),
	scorecard: ScorecardSchema,
	totalScore: z.number(),
	currentDice: DiceArraySchema.nullable(),
	keptDice: KeptMaskSchema.nullable(),
	rollsRemaining: z.number(),
});

const PlayerRankingSchema = z.object({
	playerId: z.string(),
	displayName: z.string(),
	rank: z.number().int().min(1),
	score: z.number().int().min(0),
	diceeCount: z.number().int().min(0),
});

const PlayerInfoSchema = z.object({
	id: z.string(),
	displayName: z.string(),
	avatarSeed: z.string(),
	isHost: z.boolean(),
	isConnected: z.boolean(),
});

const AIPlayerInfoSchema = z.object({
	id: z.string(),
	profileId: z.string(),
	displayName: z.string(),
	avatarSeed: z.string(),
});

// Event Schemas
export const ConnectedEventSchema = BaseEventSchema.extend({
	type: z.literal('CONNECTED'),
	payload: z.object({
		roomCode: RoomCodeSchema,
		isHost: z.boolean(),
		players: z.array(PlayerInfoSchema),
		aiPlayers: z.array(AIPlayerInfoSchema).optional(),
		spectators: z.array(z.object({ id: z.string(), displayName: z.string() })),
		roomStatus: RoomStateSchema,
		spectatorCount: z.number().int().min(0),
	}),
});

export const PlayerJoinedEventSchema = BaseEventSchema.extend({
	type: z.literal('PLAYER_JOINED'),
	payload: z.object({
		userId: z.string(),
		displayName: z.string(),
		avatarSeed: z.string(),
	}),
});

export const PlayerLeftEventSchema = BaseEventSchema.extend({
	type: z.literal('PLAYER_LEFT'),
	payload: z.object({
		userId: z.string(),
		reason: z.enum(['left', 'disconnected', 'kicked']),
	}),
});

export const AIPlayerJoinedEventSchema = BaseEventSchema.extend({
	type: z.literal('AI_PLAYER_JOINED'),
	payload: AIPlayerInfoSchema,
});

export const GameStartingEventSchema = BaseEventSchema.extend({
	type: z.literal('GAME_STARTING'),
	payload: z.object({
		playerCount: z.number().int().min(2),
	}),
});

export const GameStartedEventSchema = BaseEventSchema.extend({
	type: z.literal('GAME_STARTED'),
	payload: z.object({
		playerOrder: z.array(z.string()),
		currentPlayerId: z.string(),
		turnNumber: z.number().int().min(1),
		roundNumber: z.number().int().min(1),
		phase: z.string(),
		players: z.record(z.string(), PlayerGameStateSchema),
	}),
});

export const QuickPlayStartedEventSchema = BaseEventSchema.extend({
	type: z.literal('QUICK_PLAY_STARTED'),
	payload: z.object({
		playerOrder: z.array(z.string()),
		currentPlayerId: z.string(),
		turnNumber: z.number().int().min(1),
		roundNumber: z.number().int().min(1),
		phase: z.string(),
		players: z.record(z.string(), PlayerGameStateSchema),
		aiPlayers: z.array(AIPlayerInfoSchema),
	}),
});

export const TurnStartedEventSchema = BaseEventSchema.extend({
	type: z.literal('TURN_STARTED'),
	payload: z.object({
		playerId: z.string(),
		turnNumber: z.number().int().min(1),
		roundNumber: z.number().int().min(1),
	}),
});

export const TurnChangedEventSchema = BaseEventSchema.extend({
	type: z.literal('TURN_CHANGED'),
	payload: z.object({
		currentPlayerId: z.string(),
		turnNumber: z.number().int().min(1),
		roundNumber: z.number().int().min(1),
		phase: z.string(),
	}),
});

export const DiceRolledEventSchema = BaseEventSchema.extend({
	type: z.literal('DICE_ROLLED'),
	payload: z.object({
		playerId: z.string(),
		dice: DiceArraySchema,
		rollNumber: z.number().int().min(1).max(3),
		rollsRemaining: z.number().int().min(0).max(2),
	}),
});

export const DiceKeptEventSchema = BaseEventSchema.extend({
	type: z.literal('DICE_KEPT'),
	payload: z.object({
		playerId: z.string(),
		kept: KeptMaskSchema,
	}),
});

export const CategoryScoredEventSchema = BaseEventSchema.extend({
	type: z.literal('CATEGORY_SCORED'),
	payload: z.object({
		playerId: z.string(),
		category: CategorySchema,
		score: z.number().int().min(0),
		totalScore: z.number().int().min(0),
		isDiceeBonus: z.boolean(),
	}),
});

export const TurnSkippedEventSchema = BaseEventSchema.extend({
	type: z.literal('TURN_SKIPPED'),
	payload: z.object({
		playerId: z.string(),
		reason: z.enum(['timeout', 'disconnect']),
		categoryScored: CategorySchema,
		score: z.number().int().min(0),
	}),
});

export const PlayerAfkEventSchema = BaseEventSchema.extend({
	type: z.literal('PLAYER_AFK'),
	payload: z.object({
		playerId: z.string(),
		secondsRemaining: z.number().int().min(0),
	}),
});

export const GameOverEventSchema = BaseEventSchema.extend({
	type: z.literal('GAME_OVER'),
	payload: z.object({
		rankings: z.array(PlayerRankingSchema),
		duration: z.number().int().min(0),
	}),
});

export const RematchStartedEventSchema = BaseEventSchema.extend({
	type: z.literal('REMATCH_STARTED'),
	payload: z.object({
		roomCode: RoomCodeSchema,
		players: z.array(PlayerInfoSchema),
	}),
});

export const ErrorEventSchema = BaseEventSchema.extend({
	type: z.literal('ERROR'),
	payload: z.object({
		code: z.string(),
		message: z.string(),
	}),
});

export const PongEventSchema = BaseEventSchema.extend({
	type: z.literal('PONG'),
	payload: z.number(),
});

/**
 * All server events - discriminated union
 */
export const ServerEventSchema = z.discriminatedUnion('type', [
	ConnectedEventSchema,
	PlayerJoinedEventSchema,
	PlayerLeftEventSchema,
	AIPlayerJoinedEventSchema,
	GameStartingEventSchema,
	GameStartedEventSchema,
	QuickPlayStartedEventSchema,
	TurnStartedEventSchema,
	TurnChangedEventSchema,
	DiceRolledEventSchema,
	DiceKeptEventSchema,
	CategoryScoredEventSchema,
	TurnSkippedEventSchema,
	PlayerAfkEventSchema,
	GameOverEventSchema,
	RematchStartedEventSchema,
	ErrorEventSchema,
	PongEventSchema,
]);

export type ServerEventInput = z.input<typeof ServerEventSchema>;

// =============================================================================
// Validation Helpers
// =============================================================================

/**
 * Parse and validate a command from raw input
 */
export function parseCommand(input: unknown) {
	return CommandSchema.safeParse(input);
}

/**
 * Parse and validate a server event from raw input
 */
export function parseServerEvent(input: unknown) {
	return ServerEventSchema.safeParse(input);
}

/**
 * Validate a room code
 */
export function isValidRoomCode(code: string): boolean {
	return RoomCodeSchema.safeParse(code).success;
}

// =============================================================================
// Room Code Generation
// =============================================================================

/** Alphabet for room codes (no ambiguous chars: 0,O,1,I,L) */
const ROOM_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/**
 * Generate a random room code
 */
export function generateRoomCode(): string {
	const array = new Uint8Array(6);
	crypto.getRandomValues(array);
	return Array.from(array, (byte) => ROOM_CODE_ALPHABET[byte % ROOM_CODE_ALPHABET.length]).join('');
}
