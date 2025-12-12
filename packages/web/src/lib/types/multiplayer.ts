/**
 * Multiplayer Types (Wire Format) - UPPERCASE Protocol
 *
 * Re-exports canonical types from @dicee/shared and exports web-specific
 * command/event types derived from Zod schemas for runtime validation.
 *
 * All wire protocol messages use UPPERCASE_SNAKE_CASE for type identifiers.
 * Payloads use camelCase for property names.
 *
 * @see packages/cloudflare-do/src/GameRoom.ts - Server implementation
 * @see multiplayer.schema.ts - Zod schemas for runtime validation
 * @invariant category_type_consistency
 */

import type { z } from 'zod';

// =============================================================================
// Import all schemas for z.infer derivation
// =============================================================================
import type {
	// Command schemas
	AddAIPlayerCommandSchema,
	// Event schemas
	AIKeepingEventSchema,
	AIPlayerJoinedEventSchema,
	AIRollingEventSchema,
	AIScoringEventSchema,
	AIThinkingEventSchema,
	CancelInviteCommandSchema,
	CancelJoinRequestCommandSchema,
	CategoryScoredEventSchema,
	ChatCommandSchema,
	ChatErrorEventSchema,
	ChatHistoryEventSchema,
	ChatMessageEventSchema,
	CommandSchema,
	ConnectedEventSchema,
	DiceKeptEventSchema,
	DiceRolledEventSchema,
	ErrorEventSchema,
	GameOverEventSchema,
	GameStartedEventSchema,
	GameStartingEventSchema,
	InviteAcceptedEventSchema,
	InviteCancelledEventSchema,
	InviteDeclinedEventSchema,
	InviteExpiredEventSchema,
	InviteReceivedEventSchema,
	InviteResponseCommandSchema,
	InviteSentEventSchema,
	JoinApprovedEventSchema,
	JoinDeclinedEventSchema,
	JoinRequestErrorEventSchema,
	JoinRequestExpiredEventSchema,
	JoinRequestReceivedEventSchema,
	JoinRequestResponseCommandSchema,
	JoinRequestSchema,
	JoinRequestSentEventSchema,
	KeepDiceCommandSchema,
	PingCommandSchema,
	PlayerAfkEventSchema,
	PlayerJoinedEventSchema,
	PlayerLeftEventSchema,
	PongEventSchema,
	QuickChatCommandSchema,
	QuickPlayStartCommandSchema,
	QuickPlayStartedEventSchema,
	ReactionCommandSchema,
	ReactionUpdateEventSchema,
	RematchCommandSchema,
	RematchStartedEventSchema,
	RequestJoinCommandSchema,
	RollDiceCommandSchema,
	ScoreCategoryCommandSchema,
	SendInviteCommandSchema,
	ServerEventSchema,
	ShoutCommandSchema,
	ShoutCooldownEventSchema,
	ShoutMessageSchema,
	ShoutReceivedEventSchema,
	StartGameCommandSchema,
	TurnChangedEventSchema,
	TurnSkippedEventSchema,
	TurnStartedEventSchema,
	TypingStartCommandSchema,
	TypingStopCommandSchema,
	TypingUpdateEventSchema,
} from './multiplayer.schema.js';

// Re-export constants from schema file
export {
	JOIN_REQUEST_TTL_MS,
	SHOUT_COOLDOWN_MS,
	SHOUT_DISPLAY_DURATION_MS,
	SHOUT_MAX_LENGTH,
} from './multiplayer.schema.js';

// =============================================================================
// Re-export core types from @dicee/shared
// =============================================================================

export type {
	AIRoomPlayer,
	Category,
	ChatErrorCode,
	ChatMessage,
	ConnectionStatus,
	DiceArray,
	DiceIndex,
	DiceValue,
	GameConfig,
	GamePhase,
	GameRoom,
	GameState,
	KeptMask,
	MessageReactions,
	PlayerGameState,
	PlayerRanking,
	PlayerType,
	QuickChatKey,
	ReactionEmoji,
	RollNumber,
	RollsRemaining,
	RoomCode,
	RoomConfig,
	RoomPlayer,
	RoomState,
	Scorecard,
	TypingState,
} from '@dicee/shared';

export {
	AFK_TIMEOUT_SECONDS,
	AFK_WARNING_SECONDS,
	ALL_CATEGORIES,
	CATEGORY_COUNT,
	CHAT_RATE_LIMITS,
	calculateTotalScore,
	calculateUpperSum,
	createEmptyReactions,
	createEmptyScorecard,
	createPlayerGameState,
	DEFAULT_ROOM_CONFIG,
	DICE_COUNT,
	DICEE_BONUS_VALUE,
	FIXED_SCORES,
	getCurrentPlayer,
	getCurrentPlayerId,
	getRemainingCategories,
	getScoredCategoryCount,
	isCategoryScored,
	isLowerCategory,
	isPlayerTurn,
	isPlayingPhase,
	isScorecardComplete,
	isUpperCategory,
	isValidCategory,
	isValidTransition,
	LOWER_CATEGORIES,
	MAX_PLAYERS,
	MAX_ROLLS_PER_TURN,
	MAX_TURNS,
	MIN_PLAYERS,
	QUICK_CHAT_KEYS,
	QUICK_CHAT_MESSAGES,
	REACTION_EMOJIS,
	ROOM_CLEANUP_MS,
	ROOM_CODE_CHARS,
	ROOM_CODE_LENGTH,
	STARTING_COUNTDOWN_SECONDS,
	UPPER_BONUS_THRESHOLD,
	UPPER_BONUS_VALUE,
	UPPER_CATEGORIES,
} from '@dicee/shared';

// =============================================================================
// Command Types (Client → Server) - Derived from Zod schemas
// =============================================================================

/** Start the game (host only) */
export type StartGameCommand = z.infer<typeof StartGameCommandSchema>;

/** Start quick play with AI opponents */
export type QuickPlayStartCommand = z.infer<typeof QuickPlayStartCommandSchema>;

/** Roll dice */
export type RollDiceCommand = z.infer<typeof RollDiceCommandSchema>;

/** Keep specific dice */
export type KeepDiceCommand = z.infer<typeof KeepDiceCommandSchema>;

/** Score a category */
export type ScoreCategoryCommand = z.infer<typeof ScoreCategoryCommandSchema>;

/** Request rematch (host only, from game_over) */
export type RematchCommand = z.infer<typeof RematchCommandSchema>;

/** Add AI player to room (host only, during waiting) */
export type AddAIPlayerCommand = z.infer<typeof AddAIPlayerCommandSchema>;

/** Heartbeat ping */
export type PingCommand = z.infer<typeof PingCommandSchema>;

// =============================================================================
// Chat Command Types (Client → Server) - Derived from Zod schemas
// =============================================================================

/** Send a text chat message */
export type ChatCommand = z.infer<typeof ChatCommandSchema>;

/** Send a quick chat message */
export type QuickChatCommand = z.infer<typeof QuickChatCommandSchema>;

/** Add or remove a reaction */
export type ReactionCommand = z.infer<typeof ReactionCommandSchema>;

/** Start typing indicator */
export type TypingStartCommand = z.infer<typeof TypingStartCommandSchema>;

/** Stop typing indicator */
export type TypingStopCommand = z.infer<typeof TypingStopCommandSchema>;

// =============================================================================
// Invite Command Types (Client → Server) - Derived from Zod schemas
// =============================================================================

/** Send game invite to online user (host only) */
export type SendInviteCommand = z.infer<typeof SendInviteCommandSchema>;

/** Cancel a pending invite (host only) */
export type CancelInviteCommand = z.infer<typeof CancelInviteCommandSchema>;

/** Respond to an invite (target user) */
export type InviteResponseCommand = z.infer<typeof InviteResponseCommandSchema>;

// =============================================================================
// Join Request Command Types (Client → Server) - Derived from Zod schemas
// =============================================================================

/** Join request entity */
export type JoinRequest = z.infer<typeof JoinRequestSchema>;

/** Request to join a room (from lobby) */
export type RequestJoinCommand = z.infer<typeof RequestJoinCommandSchema>;

/** Cancel a pending join request */
export type CancelJoinRequestCommand = z.infer<typeof CancelJoinRequestCommandSchema>;

/** Host response to join request (approve/decline) */
export type JoinRequestResponseCommand = z.infer<typeof JoinRequestResponseCommandSchema>;

// =============================================================================
// Shout Command Types (Client → Server) - Derived from Zod schemas
// =============================================================================

/** Shout message entity */
export type ShoutMessage = z.infer<typeof ShoutMessageSchema>;

/** Send a shout (ephemeral broadcast message) */
export type ShoutCommand = z.infer<typeof ShoutCommandSchema>;

// =============================================================================
// All Command Types - Derived from discriminated union schema
// =============================================================================

/** All command types */
export type Command = z.infer<typeof CommandSchema>;

/** All chat command types (including shout) */
export type ChatCommand_Union =
	| ChatCommand
	| QuickChatCommand
	| ReactionCommand
	| TypingStartCommand
	| TypingStopCommand
	| ShoutCommand;

// =============================================================================
// Server Event Types (Server → Client) - Derived from Zod schemas
// =============================================================================

/** Initial connection - full room state */
export type ConnectedEvent = z.infer<typeof ConnectedEventSchema>;

/** Player joined the room */
export type PlayerJoinedEvent = z.infer<typeof PlayerJoinedEventSchema>;

/** Player left the room */
export type PlayerLeftEvent = z.infer<typeof PlayerLeftEventSchema>;

/** AI player joined the room */
export type AIPlayerJoinedEvent = z.infer<typeof AIPlayerJoinedEventSchema>;

/** Game is starting */
export type GameStartingEvent = z.infer<typeof GameStartingEventSchema>;

/** Game started */
export type GameStartedEvent = z.infer<typeof GameStartedEventSchema>;

/** Quick play started (solo vs AI) */
export type QuickPlayStartedEvent = z.infer<typeof QuickPlayStartedEventSchema>;

/** Turn started */
export type TurnStartedEvent = z.infer<typeof TurnStartedEventSchema>;

/** Turn changed to next player */
export type TurnChangedEvent = z.infer<typeof TurnChangedEventSchema>;

/** Dice rolled */
export type DiceRolledEvent = z.infer<typeof DiceRolledEventSchema>;

/** Dice kept */
export type DiceKeptEvent = z.infer<typeof DiceKeptEventSchema>;

/** Category scored */
export type CategoryScoredEvent = z.infer<typeof CategoryScoredEventSchema>;

/** Turn skipped (AFK) */
export type TurnSkippedEvent = z.infer<typeof TurnSkippedEventSchema>;

/** AFK warning */
export type PlayerAfkEvent = z.infer<typeof PlayerAfkEventSchema>;

/** Game over */
export type GameOverEvent = z.infer<typeof GameOverEventSchema>;

/** Rematch started - return to waiting room */
export type RematchStartedEvent = z.infer<typeof RematchStartedEventSchema>;

/** Error event */
export type ErrorEvent = z.infer<typeof ErrorEventSchema>;

/** Heartbeat response */
export type PongEvent = z.infer<typeof PongEventSchema>;

// =============================================================================
// AI Event Types (Server → Client) - Derived from Zod schemas
// =============================================================================

/** AI is thinking */
export type AIThinkingEvent = z.infer<typeof AIThinkingEventSchema>;

/** AI is rolling */
export type AIRollingEvent = z.infer<typeof AIRollingEventSchema>;

/** AI is keeping dice */
export type AIKeepingEvent = z.infer<typeof AIKeepingEventSchema>;

/** AI is scoring */
export type AIScoringEvent = z.infer<typeof AIScoringEventSchema>;

// =============================================================================
// Chat Event Types (Server → Client) - Derived from Zod schemas
// =============================================================================

/** Chat message received */
export type ChatMessageEvent = z.infer<typeof ChatMessageEventSchema>;

/** Chat history (sent on connect) */
export type ChatHistoryEvent = z.infer<typeof ChatHistoryEventSchema>;

/** Reaction updated on a message */
export type ReactionUpdateEvent = z.infer<typeof ReactionUpdateEventSchema>;

/** Typing indicator update */
export type TypingUpdateEvent = z.infer<typeof TypingUpdateEventSchema>;

/** Chat error */
export type ChatErrorEvent = z.infer<typeof ChatErrorEventSchema>;

// =============================================================================
// Invite Event Types (Server → Client) - Derived from Zod schemas
// =============================================================================

/** Invite sent confirmation (to host) */
export type InviteSentEvent = z.infer<typeof InviteSentEventSchema>;

/** Invite accepted by target (to host) */
export type InviteAcceptedEvent = z.infer<typeof InviteAcceptedEventSchema>;

/** Invite declined by target (to host) */
export type InviteDeclinedEvent = z.infer<typeof InviteDeclinedEventSchema>;

/** Invite expired (to host) */
export type InviteExpiredEvent = z.infer<typeof InviteExpiredEventSchema>;

/** Invite received (to target user via GlobalLobby) */
export type InviteReceivedEvent = z.infer<typeof InviteReceivedEventSchema>;

/** Invite cancelled (to target user) */
export type InviteCancelledEvent = z.infer<typeof InviteCancelledEventSchema>;

// =============================================================================
// Join Request Event Types (Server → Client) - Derived from Zod schemas
// =============================================================================

/** Join request submitted successfully (to requester) */
export type JoinRequestSentEvent = z.infer<typeof JoinRequestSentEventSchema>;

/** Join request received (to host) */
export type JoinRequestReceivedEvent = z.infer<typeof JoinRequestReceivedEventSchema>;

/** Join request approved (to requester) */
export type JoinApprovedEvent = z.infer<typeof JoinApprovedEventSchema>;

/** Join request declined (to requester) */
export type JoinDeclinedEvent = z.infer<typeof JoinDeclinedEventSchema>;

/** Join request expired (to requester and host) */
export type JoinRequestExpiredEvent = z.infer<typeof JoinRequestExpiredEventSchema>;

/** Join request error (to requester) */
export type JoinRequestErrorEvent = z.infer<typeof JoinRequestErrorEventSchema>;

// =============================================================================
// Shout Event Types (Server → Client) - Derived from Zod schemas
// =============================================================================

/** Shout received (broadcast to all in room except sender) */
export type ShoutReceivedEvent = z.infer<typeof ShoutReceivedEventSchema>;

/** Shout cooldown active (to sender when rate limited) */
export type ShoutCooldownEvent = z.infer<typeof ShoutCooldownEventSchema>;

// =============================================================================
// All Server Event Types - Derived from discriminated union schema
// =============================================================================

/** All server event types */
export type ServerEvent = z.infer<typeof ServerEventSchema>;

/** All chat server event types */
export type ChatServerEvent =
	| ChatMessageEvent
	| ChatHistoryEvent
	| ReactionUpdateEvent
	| TypingUpdateEvent
	| ChatErrorEvent;

// =============================================================================
// Utility Types
// =============================================================================

/** Extract event type from ServerEvent union */
export type ServerEventType = ServerEvent['type'];

/** Extract command type from Command union */
export type CommandType = Command['type'];

/** Get specific event by type */
export type GetServerEvent<T extends ServerEventType> = Extract<ServerEvent, { type: T }>;

/** Get specific command by type */
export type GetCommand<T extends CommandType> = Extract<Command, { type: T }>;

/** Chat event type names */
export type ChatEventType = ChatServerEvent['type'];

// =============================================================================
// Type Guards (use schema-based validation from multiplayer.schema.ts)
// =============================================================================

/** Check if an event is a chat event */
export function isChatEvent(event: { type: string }): event is ChatServerEvent {
	return [
		'CHAT_MESSAGE',
		'CHAT_HISTORY',
		'REACTION_UPDATE',
		'TYPING_UPDATE',
		'CHAT_ERROR',
	].includes(event.type);
}

/** Check if an event is an AI event (for UI display) */
export function isAIEvent(event: { type: string }): boolean {
	return ['AI_THINKING', 'AI_ROLLING', 'AI_KEEPING', 'AI_SCORING'].includes(event.type);
}

/** Check if an event is an invite event */
export function isInviteEvent(event: { type: string }): boolean {
	return [
		'INVITE_SENT',
		'INVITE_ACCEPTED',
		'INVITE_DECLINED',
		'INVITE_EXPIRED',
		'INVITE_RECEIVED',
		'INVITE_CANCELLED',
	].includes(event.type);
}

/** Check if an event is a join request event */
export function isJoinRequestEvent(event: { type: string }): boolean {
	return [
		'JOIN_REQUEST_SENT',
		'JOIN_REQUEST_RECEIVED',
		'JOIN_APPROVED',
		'JOIN_DECLINED',
		'JOIN_REQUEST_EXPIRED',
		'JOIN_REQUEST_ERROR',
	].includes(event.type);
}

/** Check if an event is a shout event */
export function isShoutEvent(event: { type: string }): boolean {
	return ['SHOUT_RECEIVED', 'SHOUT_COOLDOWN'].includes(event.type);
}
