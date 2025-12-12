/**
 * Multiplayer Zod Schemas - UPPERCASE Protocol
 *
 * Zod 4 schemas for runtime validation of multiplayer messages.
 * All wire protocol messages use UPPERCASE_SNAKE_CASE for type identifiers.
 *
 * Domain schemas (Dice, Scorecard, PlayerGameState) are imported from @dicee/shared
 * to prevent drift. Protocol-specific schemas (Commands, Events) are defined locally.
 *
 * Zod 4 Key Patterns:
 * - Use `{ error: "..." }` not `{ message: "..." }`
 * - String formats are top-level: z.uuid(), z.email()
 * - z.record() requires TWO arguments (key, value)
 * - z.enum() supports native enums
 */

// Import domain schemas from @dicee/shared to prevent drift
import {
	CategorySchema,
	DiceArraySchema,
	KeptMaskSchema,
	PlayerGameStateSchema,
	PlayerRankingSchema,
} from '@dicee/shared';
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

/** Validated room code type */
export type RoomCode = z.output<typeof RoomCodeSchema>;

/**
 * Player ID is a UUID (strict RFC 9562 validation in Zod 4)
 */
export const PlayerIdSchema = z.uuid();

/** Validated player ID type */
export type PlayerId = z.output<typeof PlayerIdSchema>;

/**
 * Display name validation
 */
export const DisplayNameSchema = z
	.string()
	.min(1, { error: 'Display name is required' })
	.max(30, { error: 'Display name must be 30 characters or less' })
	.trim();

/** Validated display name type */
export type DisplayName = z.output<typeof DisplayNameSchema>;

// =============================================================================
// Room Configuration Schema
// =============================================================================

export const RoomConfigSchema = z.object({
	isPublic: z.boolean().default(false),
	allowSpectators: z.boolean().default(false),
	turnTimeoutSeconds: z.number().int().min(0).max(300).default(60),
	maxPlayers: z.union([z.literal(2), z.literal(3), z.literal(4)]).default(2),
});

/** Room config input type (before defaults applied) */
export type RoomConfigInput = z.input<typeof RoomConfigSchema>;

/** Room config output type (after validation with defaults) */
export type RoomConfig = z.output<typeof RoomConfigSchema>;

// =============================================================================
// Room State Schema
// =============================================================================

export const RoomStateSchema = z.enum(['waiting', 'starting', 'playing', 'completed', 'abandoned']);

/** Room state type */
export type RoomState = z.output<typeof RoomStateSchema>;

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

/** Room player type */
export type RoomPlayer = z.output<typeof RoomPlayerSchema>;

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

// =============================================================================
// Chat Command Schemas (Client → Server)
// =============================================================================

/** Send a text chat message */
export const ChatCommandSchema = z.object({
	type: z.literal('CHAT'),
	payload: z.object({
		content: z.string().min(1).max(500),
	}),
});

/** Send a quick chat message */
export const QuickChatCommandSchema = z.object({
	type: z.literal('QUICK_CHAT'),
	payload: z.object({
		key: z.string(),
	}),
});

/** Add or remove a reaction */
export const ReactionCommandSchema = z.object({
	type: z.literal('REACTION'),
	payload: z.object({
		messageId: z.string(),
		emoji: z.string(),
		action: z.enum(['add', 'remove']),
	}),
});

/** Start typing indicator */
export const TypingStartCommandSchema = z.object({
	type: z.literal('TYPING_START'),
});

/** Stop typing indicator */
export const TypingStopCommandSchema = z.object({
	type: z.literal('TYPING_STOP'),
});

// =============================================================================
// Invite Command Schemas (Client → Server)
// =============================================================================

/**
 * Send game invite to online user (host only)
 */
export const SendInviteCommandSchema = z.object({
	type: z.literal('SEND_INVITE'),
	payload: z.object({
		targetUserId: z.uuid(),
	}),
});

/**
 * Cancel a pending invite (host only)
 */
export const CancelInviteCommandSchema = z.object({
	type: z.literal('CANCEL_INVITE'),
	payload: z.object({
		targetUserId: z.uuid(),
	}),
});

/**
 * Respond to an invite (target user)
 */
export const InviteResponseCommandSchema = z.object({
	type: z.literal('INVITE_RESPONSE'),
	payload: z.object({
		inviteId: z.uuid(),
		roomCode: RoomCodeSchema,
		action: z.enum(['accept', 'decline']),
	}),
});

// =============================================================================
// Join Request Command Schemas (Client → Server)
// =============================================================================

/** Time-to-live for join requests (2 minutes) */
export const JOIN_REQUEST_TTL_MS = 2 * 60 * 1000;

/** Join request status */
export const JoinRequestStatusSchema = z.enum([
	'pending',
	'approved',
	'declined',
	'expired',
	'cancelled',
]);
export type JoinRequestStatus = z.infer<typeof JoinRequestStatusSchema>;

/** Join request entity */
export const JoinRequestSchema = z.object({
	id: z.uuid(),
	roomCode: RoomCodeSchema,
	requesterId: z.uuid(),
	requesterDisplayName: DisplayNameSchema,
	requesterAvatarSeed: z.string(),
	createdAt: z.number().int().positive(),
	expiresAt: z.number().int().positive(),
	status: JoinRequestStatusSchema,
});
export type JoinRequest = z.infer<typeof JoinRequestSchema>;

/**
 * Request to join a room (from lobby)
 */
export const RequestJoinCommandSchema = z.object({
	type: z.literal('REQUEST_JOIN'),
	payload: z.object({
		roomCode: RoomCodeSchema,
	}),
});

/**
 * Cancel a pending join request
 */
export const CancelJoinRequestCommandSchema = z.object({
	type: z.literal('CANCEL_JOIN_REQUEST'),
	payload: z.object({
		requestId: z.uuid(),
	}),
});

/**
 * Host response to join request (approve/decline)
 */
export const JoinRequestResponseCommandSchema = z.object({
	type: z.literal('JOIN_REQUEST_RESPONSE'),
	payload: z.object({
		requestId: z.uuid(),
		approved: z.boolean(),
	}),
});

// =============================================================================
// Shout Command Schemas (Client → Server)
// =============================================================================

/** Shout cooldown period (30 seconds) */
export const SHOUT_COOLDOWN_MS = 30_000;

/** Maximum shout message length */
export const SHOUT_MAX_LENGTH = 100;

/** Shout display duration (5 seconds) */
export const SHOUT_DISPLAY_DURATION_MS = 5_000;

/** Shout message entity */
export const ShoutMessageSchema = z.object({
	id: z.uuid(),
	userId: z.uuid(),
	displayName: DisplayNameSchema,
	avatarSeed: z.string(),
	content: z.string().max(SHOUT_MAX_LENGTH),
	timestamp: z.number().int().positive(),
	expiresAt: z.number().int().positive(),
});
export type ShoutMessage = z.infer<typeof ShoutMessageSchema>;

/**
 * Send a shout (ephemeral broadcast message)
 */
export const ShoutCommandSchema = z.object({
	type: z.literal('SHOUT'),
	payload: z.object({
		content: z.string().min(1).max(SHOUT_MAX_LENGTH),
	}),
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
	// Chat commands
	ChatCommandSchema,
	QuickChatCommandSchema,
	ReactionCommandSchema,
	TypingStartCommandSchema,
	TypingStopCommandSchema,
	// Invite commands
	SendInviteCommandSchema,
	CancelInviteCommandSchema,
	InviteResponseCommandSchema,
	// Join request commands
	RequestJoinCommandSchema,
	CancelJoinRequestCommandSchema,
	JoinRequestResponseCommandSchema,
	// Shout command
	ShoutCommandSchema,
]);

/** Command input type (before validation) */
export type CommandInput = z.input<typeof CommandSchema>;

/** Validated command type */
export type Command = z.output<typeof CommandSchema>;

// =============================================================================
// Server Event Schemas (Server → Client) - UPPERCASE format
// =============================================================================

const BaseEventSchema = z.object({
	timestamp: z.string().optional(),
});

// Domain schemas imported from @dicee/shared above:
// - DiceArraySchema
// - KeptMaskSchema
// - CategorySchema
// - ScorecardSchema
// - PlayerGameStateSchema (includes type + aiProfileId fields)
// - PlayerRankingSchema

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

// =============================================================================
// AI Event Schemas (Server → Client)
// =============================================================================

/** AI is thinking */
export const AIThinkingEventSchema = BaseEventSchema.extend({
	type: z.literal('AI_THINKING'),
	payload: z.object({
		playerId: z.string(),
		displayName: z.string(),
	}),
});

/** AI is rolling */
export const AIRollingEventSchema = BaseEventSchema.extend({
	type: z.literal('AI_ROLLING'),
	payload: z.object({
		playerId: z.string(),
	}),
});

/** AI is keeping dice */
export const AIKeepingEventSchema = BaseEventSchema.extend({
	type: z.literal('AI_KEEPING'),
	payload: z.object({
		playerId: z.string(),
		kept: KeptMaskSchema,
	}),
});

/** AI is scoring */
export const AIScoringEventSchema = BaseEventSchema.extend({
	type: z.literal('AI_SCORING'),
	payload: z.object({
		playerId: z.string(),
		category: CategorySchema,
	}),
});

// =============================================================================
// Chat Event Schemas (Server → Client)
// =============================================================================

/** Message reactions schema - matches MessageReactions from @dicee/shared */
const MessageReactionsSchema = z.object({
	'👍': z.array(z.string()),
	'🎲': z.array(z.string()),
	'😱': z.array(z.string()),
	'💀': z.array(z.string()),
	'🎉': z.array(z.string()),
});

/** Chat error code schema - matches ChatErrorCode from @dicee/shared */
const ChatErrorCodeSchema = z.enum([
	'INVALID_MESSAGE',
	'RATE_LIMITED',
	'MESSAGE_TOO_LONG',
	'REACTION_FAILED',
	'MESSAGE_NOT_FOUND',
]);

/** Chat message payload schema - matches ChatMessage from @dicee/shared */
const ChatMessagePayloadSchema = z.object({
	id: z.string(),
	userId: z.string(),
	displayName: z.string(),
	content: z.string(),
	timestamp: z.number(), // Unix timestamp in milliseconds
	type: z.enum(['text', 'quick', 'system']),
	reactions: MessageReactionsSchema,
});

/** Chat message received */
export const ChatMessageEventSchema = BaseEventSchema.extend({
	type: z.literal('CHAT_MESSAGE'),
	payload: ChatMessagePayloadSchema,
});

/** Chat history (sent on connect) */
export const ChatHistoryEventSchema = BaseEventSchema.extend({
	type: z.literal('CHAT_HISTORY'),
	payload: z.array(ChatMessagePayloadSchema),
});

/** Reaction updated on a message */
export const ReactionUpdateEventSchema = BaseEventSchema.extend({
	type: z.literal('REACTION_UPDATE'),
	payload: z.object({
		messageId: z.string(),
		reactions: MessageReactionsSchema,
	}),
});

/** Typing indicator state schema */
const TypingStateSchema = z.object({
	userId: z.string(),
	displayName: z.string(),
	startedAt: z.number(),
});

/** Typing indicator update */
export const TypingUpdateEventSchema = BaseEventSchema.extend({
	type: z.literal('TYPING_UPDATE'),
	payload: z.object({
		typing: z.array(TypingStateSchema),
	}),
});

/** Chat error */
export const ChatErrorEventSchema = BaseEventSchema.extend({
	type: z.literal('CHAT_ERROR'),
	payload: z.object({
		code: ChatErrorCodeSchema,
		message: z.string(),
	}),
});

// =============================================================================
// Invite Event Schemas (Server → Client)
// =============================================================================

/**
 * Invite sent confirmation (to host)
 */
export const InviteSentEventSchema = BaseEventSchema.extend({
	type: z.literal('INVITE_SENT'),
	payload: z.object({
		inviteId: z.uuid(),
		targetUserId: z.uuid(),
		targetDisplayName: DisplayNameSchema,
		expiresAt: z.number(), // Unix timestamp ms
	}),
});

/**
 * Invite accepted by target (to host)
 */
export const InviteAcceptedEventSchema = BaseEventSchema.extend({
	type: z.literal('INVITE_ACCEPTED'),
	payload: z.object({
		inviteId: z.uuid(),
		targetUserId: z.uuid(),
		targetDisplayName: DisplayNameSchema,
	}),
});

/**
 * Invite declined by target (to host)
 */
export const InviteDeclinedEventSchema = BaseEventSchema.extend({
	type: z.literal('INVITE_DECLINED'),
	payload: z.object({
		inviteId: z.uuid(),
		targetUserId: z.uuid(),
		targetDisplayName: DisplayNameSchema,
	}),
});

/**
 * Invite expired (to host)
 */
export const InviteExpiredEventSchema = BaseEventSchema.extend({
	type: z.literal('INVITE_EXPIRED'),
	payload: z.object({
		inviteId: z.uuid(),
		targetUserId: z.uuid(),
	}),
});

/**
 * Invite received (to target user via GlobalLobby)
 */
export const InviteReceivedEventSchema = BaseEventSchema.extend({
	type: z.literal('INVITE_RECEIVED'),
	payload: z.object({
		inviteId: z.uuid(),
		roomCode: RoomCodeSchema,
		hostUserId: z.uuid(),
		hostDisplayName: DisplayNameSchema,
		hostAvatarSeed: z.string(),
		game: z.literal('dicee'),
		playerCount: z.number().int().min(1),
		maxPlayers: z.number().int().min(2).max(4),
		expiresAt: z.number(), // Unix timestamp ms
	}),
});

/**
 * Invite cancelled (to target user)
 */
export const InviteCancelledEventSchema = BaseEventSchema.extend({
	type: z.literal('INVITE_CANCELLED'),
	payload: z.object({
		inviteId: z.uuid(),
		roomCode: RoomCodeSchema,
		reason: z.enum(['cancelled', 'host_left', 'room_closed', 'room_full', 'expired']),
	}),
});

// =============================================================================
// Reconnection Events (Phase 3)
// =============================================================================

/**
 * Player disconnected from game (seat reserved for reconnection window)
 */
export const PlayerDisconnectedEventSchema = BaseEventSchema.extend({
	type: z.literal('PLAYER_DISCONNECTED'),
	payload: z.object({
		userId: z.uuid(),
		displayName: DisplayNameSchema,
		reconnectDeadline: z.number(), // Unix timestamp ms when seat expires
	}),
});

/**
 * Player reconnected to game (reclaimed their seat)
 */
export const PlayerReconnectedEventSchema = BaseEventSchema.extend({
	type: z.literal('PLAYER_RECONNECTED'),
	payload: z.object({
		userId: z.uuid(),
		displayName: DisplayNameSchema,
		avatarSeed: z.string().optional(),
	}),
});

/**
 * Player's seat expired (they were removed from game)
 */
export const PlayerSeatExpiredEventSchema = BaseEventSchema.extend({
	type: z.literal('PLAYER_SEAT_EXPIRED'),
	payload: z.object({
		userId: z.uuid(),
		displayName: DisplayNameSchema,
	}),
});

// =============================================================================
// Join Request Event Schemas (Server → Client)
// =============================================================================

/**
 * Join request submitted successfully (to requester)
 */
export const JoinRequestSentEventSchema = BaseEventSchema.extend({
	type: z.literal('JOIN_REQUEST_SENT'),
	payload: z.object({
		requestId: z.uuid(),
		roomCode: RoomCodeSchema,
		expiresAt: z.number().int().positive(),
	}),
});

/**
 * Join request received (to host)
 */
export const JoinRequestReceivedEventSchema = BaseEventSchema.extend({
	type: z.literal('JOIN_REQUEST_RECEIVED'),
	payload: z.object({
		request: JoinRequestSchema,
	}),
});

/**
 * Join request approved (to requester)
 */
export const JoinApprovedEventSchema = BaseEventSchema.extend({
	type: z.literal('JOIN_APPROVED'),
	payload: z.object({
		requestId: z.uuid(),
		roomCode: RoomCodeSchema,
	}),
});

/**
 * Join request declined (to requester)
 */
export const JoinDeclinedEventSchema = BaseEventSchema.extend({
	type: z.literal('JOIN_DECLINED'),
	payload: z.object({
		requestId: z.uuid(),
		reason: z.string().optional(),
	}),
});

/**
 * Join request expired (to requester and host)
 */
export const JoinRequestExpiredEventSchema = BaseEventSchema.extend({
	type: z.literal('JOIN_REQUEST_EXPIRED'),
	payload: z.object({
		requestId: z.uuid(),
	}),
});

/**
 * Join request error (to requester)
 */
export const JoinRequestErrorEventSchema = BaseEventSchema.extend({
	type: z.literal('JOIN_REQUEST_ERROR'),
	payload: z.object({
		code: z.string(),
		message: z.string(),
	}),
});

// =============================================================================
// Shout Event Schemas (Server → Client)
// =============================================================================

/**
 * Shout received (broadcast to all in room except sender)
 */
export const ShoutReceivedEventSchema = BaseEventSchema.extend({
	type: z.literal('SHOUT_RECEIVED'),
	payload: ShoutMessageSchema,
});

/**
 * Shout cooldown active (to sender when rate limited)
 */
export const ShoutCooldownEventSchema = BaseEventSchema.extend({
	type: z.literal('SHOUT_COOLDOWN'),
	payload: z.object({
		remainingMs: z.number().int().nonnegative(),
	}),
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
	// AI events
	AIThinkingEventSchema,
	AIRollingEventSchema,
	AIKeepingEventSchema,
	AIScoringEventSchema,
	// Chat events
	ChatMessageEventSchema,
	ChatHistoryEventSchema,
	ReactionUpdateEventSchema,
	TypingUpdateEventSchema,
	ChatErrorEventSchema,
	// Invite events
	InviteSentEventSchema,
	InviteAcceptedEventSchema,
	InviteDeclinedEventSchema,
	InviteExpiredEventSchema,
	InviteReceivedEventSchema,
	InviteCancelledEventSchema,
	// Reconnection events (Phase 3)
	PlayerDisconnectedEventSchema,
	PlayerReconnectedEventSchema,
	PlayerSeatExpiredEventSchema,
	// Join request events
	JoinRequestSentEventSchema,
	JoinRequestReceivedEventSchema,
	JoinApprovedEventSchema,
	JoinDeclinedEventSchema,
	JoinRequestExpiredEventSchema,
	JoinRequestErrorEventSchema,
	// Shout events
	ShoutReceivedEventSchema,
	ShoutCooldownEventSchema,
]);

/** Server event input type (before validation) */
export type ServerEventInput = z.input<typeof ServerEventSchema>;

/** Validated server event type */
export type ServerEvent = z.output<typeof ServerEventSchema>;

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
 * Validate a room code (simple boolean)
 */
export function isValidRoomCode(code: string): boolean {
	return RoomCodeSchema.safeParse(code).success;
}

// =============================================================================
// Type Guards
// =============================================================================

/**
 * Type guard: Check if input is a valid Command
 */
export function isCommand(input: unknown): input is Command {
	return CommandSchema.safeParse(input).success;
}

/**
 * Type guard: Check if input is a valid ServerEvent
 */
export function isServerEvent(input: unknown): input is ServerEvent {
	return ServerEventSchema.safeParse(input).success;
}

/**
 * Type guard: Check if input is a valid RoomCode
 */
export function isRoomCode(input: unknown): input is RoomCode {
	return RoomCodeSchema.safeParse(input).success;
}

/**
 * Type guard: Check if input is a valid PlayerId (UUID)
 */
export function isPlayerId(input: unknown): input is PlayerId {
	return PlayerIdSchema.safeParse(input).success;
}

/**
 * Type guard: Check if input is a valid RoomConfig
 */
export function isRoomConfig(input: unknown): input is RoomConfig {
	return RoomConfigSchema.safeParse(input).success;
}

/**
 * Type guard: Check if input is a valid RoomState
 */
export function isRoomState(input: unknown): input is RoomState {
	return RoomStateSchema.safeParse(input).success;
}

/**
 * Type guard: Check if input is a valid RoomPlayer
 */
export function isRoomPlayer(input: unknown): input is RoomPlayer {
	return RoomPlayerSchema.safeParse(input).success;
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
