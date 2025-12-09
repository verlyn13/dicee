/**
 * Multiplayer Zod Schemas
 *
 * Zod 4 schemas for runtime validation of multiplayer messages.
 * Shared between web client and PartyKit server.
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
// Command Schemas (Client → Server)
// =============================================================================

export const CreateRoomCommandSchema = z.object({
	type: z.literal('room.create'),
	config: RoomConfigSchema.partial().optional(),
});

export const JoinRoomCommandSchema = z.object({
	type: z.literal('room.join'),
	roomCode: RoomCodeSchema,
});

export const LeaveRoomCommandSchema = z.object({
	type: z.literal('room.leave'),
});

export const StartGameCommandSchema = z.object({
	type: z.literal('game.start'),
});

export const RollDiceCommandSchema = z.object({
	type: z.literal('dice.roll'),
	kept: z.tuple([z.boolean(), z.boolean(), z.boolean(), z.boolean(), z.boolean()]),
});

export const KeepDiceCommandSchema = z.object({
	type: z.literal('dice.keep'),
	indices: z.array(z.number().int().min(0).max(4)).max(5),
});

export const ScoreCategoryCommandSchema = z.object({
	type: z.literal('category.score'),
	category: z.string().min(1),
});

export const RematchCommandSchema = z.object({
	type: z.literal('game.rematch'),
});

/**
 * All commands - discriminated union
 */
export const CommandSchema = z.discriminatedUnion('type', [
	CreateRoomCommandSchema,
	JoinRoomCommandSchema,
	LeaveRoomCommandSchema,
	StartGameCommandSchema,
	RollDiceCommandSchema,
	KeepDiceCommandSchema,
	ScoreCategoryCommandSchema,
	RematchCommandSchema,
]);

export type CommandInput = z.input<typeof CommandSchema>;

// =============================================================================
// Server Event Schemas (Server → Client)
// =============================================================================

const BaseEventSchema = z.object({
	timestamp: z.string(),
});

export const RoomCreatedEventSchema = BaseEventSchema.extend({
	type: z.literal('room.created'),
	roomCode: RoomCodeSchema,
});

export const RoomStateEventSchema = BaseEventSchema.extend({
	type: z.literal('room.state'),
	room: z.object({
		code: RoomCodeSchema,
		config: RoomConfigSchema,
		state: RoomStateSchema,
		players: z.array(RoomPlayerSchema),
		hostId: PlayerIdSchema,
		createdAt: z.string(),
		startedAt: z.string().nullable(),
	}),
});

export const PlayerJoinedEventSchema = BaseEventSchema.extend({
	type: z.literal('player.joined'),
	player: RoomPlayerSchema,
});

export const PlayerLeftEventSchema = BaseEventSchema.extend({
	type: z.literal('player.left'),
	playerId: PlayerIdSchema,
	reason: z.enum(['left', 'disconnected', 'kicked']),
});

export const PlayerConnectionEventSchema = BaseEventSchema.extend({
	type: z.literal('player.connection'),
	playerId: PlayerIdSchema,
	isConnected: z.boolean(),
});

export const GameStartingEventSchema = BaseEventSchema.extend({
	type: z.literal('game.starting'),
	countdown: z.number().int().min(0),
});

export const GameStartedEventSchema = BaseEventSchema.extend({
	type: z.literal('game.started'),
	playerOrder: z.array(PlayerIdSchema),
	currentPlayerId: PlayerIdSchema,
	turnNumber: z.number().int().min(1).optional(),
});

// =============================================================================
// Game Event Schemas (Phase 5)
// =============================================================================

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

const GameStateSchema = z.object({
	roomCode: z.string(),
	phase: z.enum(['waiting', 'starting', 'turn_roll', 'turn_decide', 'turn_score', 'game_over']),
	playerOrder: z.array(z.string()),
	currentPlayerIndex: z.number().int().min(0),
	turnNumber: z.number().int().min(0),
	roundNumber: z.number().int().min(0),
	players: z.record(z.string(), PlayerGameStateSchema),
	turnStartedAt: z.string().nullable(),
	gameStartedAt: z.string().nullable(),
	gameCompletedAt: z.string().nullable(),
	rankings: z.array(PlayerRankingSchema).nullable(),
	config: z.object({
		maxPlayers: z.union([z.literal(2), z.literal(3), z.literal(4)]),
		turnTimeoutSeconds: z.number(),
		isPublic: z.boolean(),
	}),
});

export const TurnStartedEventSchema = BaseEventSchema.extend({
	type: z.literal('turn.started'),
	playerId: PlayerIdSchema,
	turnNumber: z.number().int().min(1),
	roundNumber: z.number().int().min(1),
});

export const DiceRolledEventSchema = BaseEventSchema.extend({
	type: z.literal('dice.rolled'),
	playerId: PlayerIdSchema,
	dice: DiceArraySchema,
	rollNumber: z.number().int().min(1).max(3),
	rollsRemaining: z.number().int().min(0).max(2),
});

export const DiceKeptEventSchema = BaseEventSchema.extend({
	type: z.literal('dice.kept'),
	playerId: PlayerIdSchema,
	kept: KeptMaskSchema,
});

export const CategoryScoredEventSchema = BaseEventSchema.extend({
	type: z.literal('category.scored'),
	playerId: PlayerIdSchema,
	category: CategorySchema,
	score: z.number().int().min(0),
	totalScore: z.number().int().min(0),
	isDiceeBonus: z.boolean(),
});

export const TurnEndedEventSchema = BaseEventSchema.extend({
	type: z.literal('turn.ended'),
	playerId: PlayerIdSchema,
});

export const TurnSkippedEventSchema = BaseEventSchema.extend({
	type: z.literal('turn.skipped'),
	playerId: PlayerIdSchema,
	reason: z.enum(['timeout', 'disconnect']),
	categoryScored: CategorySchema,
	score: z.number().int().min(0),
});

export const AfkWarningEventSchema = BaseEventSchema.extend({
	type: z.literal('player.afk_warning'),
	playerId: PlayerIdSchema,
	secondsRemaining: z.number().int().min(0),
});

export const GameCompletedEventSchema = BaseEventSchema.extend({
	type: z.literal('game.completed'),
	rankings: z.array(PlayerRankingSchema),
	duration: z.number().int().min(0),
});

export const StateSyncEventSchema = BaseEventSchema.extend({
	type: z.literal('state.sync'),
	state: GameStateSchema,
});

export const GameErrorEventSchema = BaseEventSchema.extend({
	type: z.literal('game.error'),
	message: z.string(),
	code: z.string(),
});

export const ErrorEventSchema = BaseEventSchema.extend({
	type: z.literal('error'),
	message: z.string(),
	code: z.string(),
});

/**
 * All server events - discriminated union
 */
export const ServerEventSchema = z.discriminatedUnion('type', [
	RoomCreatedEventSchema,
	RoomStateEventSchema,
	PlayerJoinedEventSchema,
	PlayerLeftEventSchema,
	PlayerConnectionEventSchema,
	GameStartingEventSchema,
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
	ErrorEventSchema,
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
