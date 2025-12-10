/**
 * Zod 4 Validation Schemas
 *
 * Runtime validation schemas for WebSocket messages.
 * Uses UPPERCASE_SNAKE_CASE format matching wire protocol.
 *
 * @example
 * import { ServerEventSchema, CommandSchema } from '@dicee/shared';
 *
 * const result = ServerEventSchema.safeParse(rawMessage);
 * if (result.success) {
 *   // result.data is typed as ServerEvent
 * }
 */

import { z } from 'zod';

// =============================================================================
// Primitive Schemas
// =============================================================================

/**
 * Room code: 6 uppercase alphanumeric (no ambiguous chars: 0,O,1,I,L)
 */
export const RoomCodeSchema = z
	.string()
	.length(6, { error: 'Room code must be exactly 6 characters' })
	.regex(/^[A-HJ-NP-Z2-9]+$/, { error: 'Invalid room code format' })
	.transform((val) => val.toUpperCase());

/**
 * Player ID is a UUID
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

/**
 * Dice value (1-6)
 */
export const DiceValueSchema = z.number().int().min(1).max(6);

/**
 * Five dice values
 */
export const DiceArraySchema = z.tuple([
	DiceValueSchema,
	DiceValueSchema,
	DiceValueSchema,
	DiceValueSchema,
	DiceValueSchema,
]);

/**
 * Kept mask (5 booleans)
 */
export const KeptMaskSchema = z.tuple([z.boolean(), z.boolean(), z.boolean(), z.boolean(), z.boolean()]);

/**
 * Category enum (camelCase for data values)
 */
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
	'dicee',
	'chance',
]);

// =============================================================================
// Scorecard Schema
// =============================================================================

export const ScorecardSchema = z.object({
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

// =============================================================================
// Player Schemas
// =============================================================================

export const RoomPlayerSchema = z.object({
	id: PlayerIdSchema,
	displayName: DisplayNameSchema,
	avatarSeed: z.string(),
	isConnected: z.boolean(),
	isHost: z.boolean(),
	joinedAt: z.string(),
});

export const PlayerGameStateSchema = z.object({
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

export const PlayerRankingSchema = z.object({
	playerId: z.string(),
	displayName: z.string(),
	rank: z.number().int().min(1),
	score: z.number().int().min(0),
	diceeCount: z.number().int().min(0),
});

// =============================================================================
// Room Configuration
// =============================================================================

export const RoomConfigSchema = z.object({
	isPublic: z.boolean().default(false),
	allowSpectators: z.boolean().default(false),
	turnTimeoutSeconds: z.number().int().min(0).max(300).default(60),
	maxPlayers: z.union([z.literal(2), z.literal(3), z.literal(4)]).default(2),
});

export const RoomStateValueSchema = z.enum(['waiting', 'starting', 'playing', 'completed', 'abandoned']);

// =============================================================================
// Game State Schema
// =============================================================================

export const GamePhaseSchema = z.enum(['waiting', 'starting', 'turn_roll', 'turn_decide', 'turn_score', 'game_over']);

export const GameStateSchema = z.object({
	roomCode: z.string(),
	phase: GamePhaseSchema,
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

// =============================================================================
// Chat Schemas
// =============================================================================

export const QuickChatKeySchema = z.enum([
	'nice',
	'goodGame',
	'thanks',
	'sorry',
	'wow',
	'oops',
	'hurryUp',
	'goodLuck',
]);

export const ReactionEmojiSchema = z.enum(['thumbsUp', 'thumbsDown', 'laugh', 'sad', 'angry', 'fire', 'heart', 'dice']);

export const ChatMessageSchema = z.object({
	id: z.string(),
	playerId: z.string(),
	displayName: z.string(),
	content: z.string(),
	isQuickChat: z.boolean(),
	quickChatKey: QuickChatKeySchema.nullable(),
	reactions: z.record(ReactionEmojiSchema, z.array(z.string())),
	timestamp: z.string(),
});

export const ChatErrorCodeSchema = z.enum(['RATE_LIMITED', 'MESSAGE_TOO_LONG', 'EMPTY_MESSAGE', 'PROFANITY_DETECTED']);

// =============================================================================
// Command Schemas (Client → Server) - UPPERCASE format
// =============================================================================

const BaseCommandSchema = z.object({});

export const CreateRoomCommandSchema = BaseCommandSchema.extend({
	type: z.literal('CREATE_ROOM'),
	payload: z
		.object({
			config: RoomConfigSchema.partial().optional(),
		})
		.optional(),
});

export const JoinRoomCommandSchema = BaseCommandSchema.extend({
	type: z.literal('JOIN_ROOM'),
	payload: z.object({
		roomCode: RoomCodeSchema,
	}),
});

export const LeaveRoomCommandSchema = BaseCommandSchema.extend({
	type: z.literal('LEAVE_ROOM'),
});

export const AddAICommandSchema = BaseCommandSchema.extend({
	type: z.literal('ADD_AI'),
	payload: z.object({
		profileId: z.string(),
	}),
});

export const RemoveAICommandSchema = BaseCommandSchema.extend({
	type: z.literal('REMOVE_AI'),
	payload: z.object({
		aiPlayerId: z.string(),
	}),
});

export const StartGameCommandSchema = BaseCommandSchema.extend({
	type: z.literal('START_GAME'),
});

export const RematchCommandSchema = BaseCommandSchema.extend({
	type: z.literal('REMATCH'),
});

export const RollDiceCommandSchema = BaseCommandSchema.extend({
	type: z.literal('DICE_ROLL'),
	payload: z
		.object({
			kept: KeptMaskSchema.optional(),
		})
		.optional(),
});

export const KeepDiceCommandSchema = BaseCommandSchema.extend({
	type: z.literal('DICE_KEEP'),
	payload: z.object({
		indices: z.array(z.number().int().min(0).max(4)).max(5),
	}),
});

export const ScoreCategoryCommandSchema = BaseCommandSchema.extend({
	type: z.literal('CATEGORY_SCORE'),
	payload: z.object({
		category: CategorySchema,
	}),
});

export const ChatCommandSchema = BaseCommandSchema.extend({
	type: z.literal('CHAT'),
	payload: z.object({
		content: z.string().min(1).max(500),
	}),
});

export const QuickChatCommandSchema = BaseCommandSchema.extend({
	type: z.literal('QUICK_CHAT'),
	payload: z.object({
		key: QuickChatKeySchema,
	}),
});

export const ReactionCommandSchema = BaseCommandSchema.extend({
	type: z.literal('REACTION'),
	payload: z.object({
		messageId: z.string(),
		emoji: ReactionEmojiSchema,
		action: z.enum(['add', 'remove']),
	}),
});

export const TypingStartCommandSchema = BaseCommandSchema.extend({
	type: z.literal('TYPING_START'),
});

export const TypingStopCommandSchema = BaseCommandSchema.extend({
	type: z.literal('TYPING_STOP'),
});

/**
 * All commands - discriminated union
 */
export const CommandSchema = z.discriminatedUnion('type', [
	CreateRoomCommandSchema,
	JoinRoomCommandSchema,
	LeaveRoomCommandSchema,
	AddAICommandSchema,
	RemoveAICommandSchema,
	StartGameCommandSchema,
	RematchCommandSchema,
	RollDiceCommandSchema,
	KeepDiceCommandSchema,
	ScoreCategoryCommandSchema,
	ChatCommandSchema,
	QuickChatCommandSchema,
	ReactionCommandSchema,
	TypingStartCommandSchema,
	TypingStopCommandSchema,
]);

export type CommandInput = z.input<typeof CommandSchema>;

// =============================================================================
// Server Event Schemas (Server → Client) - UPPERCASE format
// =============================================================================

const BaseEventSchema = z.object({
	timestamp: z.string(),
});

export const RoomCreatedEventSchema = BaseEventSchema.extend({
	type: z.literal('ROOM_CREATED'),
	payload: z.object({
		roomCode: RoomCodeSchema,
	}),
});

export const RoomStateEventSchema = BaseEventSchema.extend({
	type: z.literal('ROOM_STATE'),
	payload: z.object({
		room: z.object({
			code: RoomCodeSchema,
			config: RoomConfigSchema,
			state: RoomStateValueSchema,
			players: z.array(RoomPlayerSchema),
			hostId: PlayerIdSchema,
			createdAt: z.string(),
			startedAt: z.string().nullable(),
		}),
	}),
});

export const PlayerJoinedEventSchema = BaseEventSchema.extend({
	type: z.literal('PLAYER_JOINED'),
	payload: z.object({
		player: RoomPlayerSchema,
	}),
});

export const PlayerLeftEventSchema = BaseEventSchema.extend({
	type: z.literal('PLAYER_LEFT'),
	payload: z.object({
		playerId: PlayerIdSchema,
		reason: z.enum(['left', 'disconnected', 'kicked']),
	}),
});

export const AIJoinedEventSchema = BaseEventSchema.extend({
	type: z.literal('AI_JOINED'),
	payload: z.object({
		player: RoomPlayerSchema.extend({
			isAI: z.literal(true),
			profileId: z.string(),
		}),
	}),
});

export const PlayerConnectionEventSchema = BaseEventSchema.extend({
	type: z.literal('PLAYER_CONNECTION'),
	payload: z.object({
		playerId: PlayerIdSchema,
		isConnected: z.boolean(),
	}),
});

export const GameStartingEventSchema = BaseEventSchema.extend({
	type: z.literal('GAME_STARTING'),
	payload: z.object({
		countdown: z.number().int().min(0),
	}),
});

export const GameStartedEventSchema = BaseEventSchema.extend({
	type: z.literal('GAME_STARTED'),
	payload: z.object({
		playerOrder: z.array(PlayerIdSchema),
		currentPlayerId: PlayerIdSchema,
		turnNumber: z.number().int().min(1),
	}),
});

export const TurnStartedEventSchema = BaseEventSchema.extend({
	type: z.literal('TURN_STARTED'),
	payload: z.object({
		playerId: PlayerIdSchema,
		turnNumber: z.number().int().min(1),
		roundNumber: z.number().int().min(1),
	}),
});

export const TurnEndedEventSchema = BaseEventSchema.extend({
	type: z.literal('TURN_ENDED'),
	payload: z.object({
		playerId: PlayerIdSchema,
	}),
});

export const TurnSkippedEventSchema = BaseEventSchema.extend({
	type: z.literal('TURN_SKIPPED'),
	payload: z.object({
		playerId: PlayerIdSchema,
		reason: z.enum(['timeout', 'disconnect']),
		categoryScored: CategorySchema,
		score: z.number().int().min(0),
	}),
});

export const AfkWarningEventSchema = BaseEventSchema.extend({
	type: z.literal('AFK_WARNING'),
	payload: z.object({
		playerId: PlayerIdSchema,
		secondsRemaining: z.number().int().min(0),
	}),
});

export const GameCompletedEventSchema = BaseEventSchema.extend({
	type: z.literal('GAME_COMPLETED'),
	payload: z.object({
		rankings: z.array(PlayerRankingSchema),
		duration: z.number().int().min(0),
	}),
});

export const DiceRolledEventSchema = BaseEventSchema.extend({
	type: z.literal('DICE_ROLLED'),
	payload: z.object({
		playerId: PlayerIdSchema,
		dice: DiceArraySchema,
		rollNumber: z.union([z.literal(1), z.literal(2), z.literal(3)]),
		rollsRemaining: z.union([z.literal(0), z.literal(1), z.literal(2)]),
	}),
});

export const DiceKeptEventSchema = BaseEventSchema.extend({
	type: z.literal('DICE_KEPT'),
	payload: z.object({
		playerId: PlayerIdSchema,
		kept: KeptMaskSchema,
	}),
});

export const CategoryScoredEventSchema = BaseEventSchema.extend({
	type: z.literal('CATEGORY_SCORED'),
	payload: z.object({
		playerId: PlayerIdSchema,
		category: CategorySchema,
		score: z.number().int().min(0),
		totalScore: z.number().int().min(0),
		isDiceeBonus: z.boolean(),
	}),
});

export const StateSyncEventSchema = BaseEventSchema.extend({
	type: z.literal('STATE_SYNC'),
	payload: z.object({
		state: GameStateSchema,
	}),
});

export const GameErrorEventSchema = BaseEventSchema.extend({
	type: z.literal('GAME_ERROR'),
	payload: z.object({
		message: z.string(),
		code: z.string(),
	}),
});

export const ErrorEventSchema = BaseEventSchema.extend({
	type: z.literal('ERROR'),
	payload: z.object({
		message: z.string(),
		code: z.string(),
	}),
});

export const ChatMessageEventSchema = BaseEventSchema.extend({
	type: z.literal('CHAT_MESSAGE'),
	payload: ChatMessageSchema,
});

export const ChatHistoryEventSchema = BaseEventSchema.extend({
	type: z.literal('CHAT_HISTORY'),
	payload: z.object({
		messages: z.array(ChatMessageSchema),
	}),
});

export const ReactionUpdateEventSchema = BaseEventSchema.extend({
	type: z.literal('REACTION_UPDATE'),
	payload: z.object({
		messageId: z.string(),
		reactions: z.record(ReactionEmojiSchema, z.array(z.string())),
	}),
});

export const TypingUpdateEventSchema = BaseEventSchema.extend({
	type: z.literal('TYPING_UPDATE'),
	payload: z.object({
		typing: z.array(
			z.object({
				playerId: z.string(),
				displayName: z.string(),
			}),
		),
	}),
});

export const ChatErrorEventSchema = BaseEventSchema.extend({
	type: z.literal('CHAT_ERROR'),
	payload: z.object({
		code: ChatErrorCodeSchema,
		message: z.string(),
	}),
});

/**
 * All server events - discriminated union
 */
export const ServerEventSchema = z.discriminatedUnion('type', [
	// Room events
	RoomCreatedEventSchema,
	RoomStateEventSchema,
	PlayerJoinedEventSchema,
	PlayerLeftEventSchema,
	AIJoinedEventSchema,
	PlayerConnectionEventSchema,
	// Game flow events
	GameStartingEventSchema,
	GameStartedEventSchema,
	TurnStartedEventSchema,
	TurnEndedEventSchema,
	TurnSkippedEventSchema,
	AfkWarningEventSchema,
	GameCompletedEventSchema,
	// Dice events
	DiceRolledEventSchema,
	DiceKeptEventSchema,
	// Scoring events
	CategoryScoredEventSchema,
	// Sync events
	StateSyncEventSchema,
	// Error events
	GameErrorEventSchema,
	ErrorEventSchema,
	// Chat events
	ChatMessageEventSchema,
	ChatHistoryEventSchema,
	ReactionUpdateEventSchema,
	TypingUpdateEventSchema,
	ChatErrorEventSchema,
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
