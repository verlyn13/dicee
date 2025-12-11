/**
 * Types Module - Centralized Type Exports
 *
 * Re-exports all public types from a single location.
 * Import from '$lib/types' instead of individual modules.
 *
 * @module types
 */

// =============================================================================
// Multiplayer Types
// =============================================================================

// Domain types (re-exported from @dicee/shared)
// Command types (derived from Zod schemas)
// Event types (derived from Zod schemas)
export type {
	AddAIPlayerCommand,
	AIKeepingEvent,
	AIPlayerJoinedEvent,
	AIRollingEvent,
	AIRoomPlayer,
	AIScoringEvent,
	AIThinkingEvent,
	CancelInviteCommand,
	Category,
	CategoryScoredEvent,
	ChatCommand,
	ChatCommand_Union,
	ChatErrorCode,
	ChatErrorEvent,
	ChatEventType,
	ChatHistoryEvent,
	ChatMessage,
	ChatMessageEvent,
	ChatServerEvent,
	Command,
	CommandType,
	ConnectedEvent,
	ConnectionStatus,
	DiceArray,
	DiceIndex,
	DiceKeptEvent,
	DiceRolledEvent,
	DiceValue,
	ErrorEvent,
	GameConfig,
	GameOverEvent,
	GamePhase,
	GameRoom,
	GameStartedEvent,
	GameStartingEvent,
	GameState,
	GetCommand,
	GetServerEvent,
	InviteAcceptedEvent,
	InviteCancelledEvent,
	InviteDeclinedEvent,
	InviteExpiredEvent,
	InviteReceivedEvent,
	InviteResponseCommand,
	InviteSentEvent,
	KeepDiceCommand,
	KeptMask,
	MessageReactions,
	PingCommand,
	PlayerAfkEvent,
	PlayerGameState,
	PlayerJoinedEvent,
	PlayerLeftEvent,
	PlayerRanking,
	PlayerType,
	PongEvent,
	QuickChatCommand,
	QuickChatKey,
	QuickPlayStartCommand,
	QuickPlayStartedEvent,
	ReactionCommand,
	ReactionEmoji,
	ReactionUpdateEvent,
	RematchCommand,
	RematchStartedEvent,
	RollDiceCommand,
	RollNumber,
	RollsRemaining,
	RoomCode,
	RoomConfig,
	RoomPlayer,
	RoomState,
	ScoreCategoryCommand,
	Scorecard,
	SendInviteCommand,
	ServerEvent,
	ServerEventType,
	StartGameCommand,
	TurnChangedEvent,
	TurnSkippedEvent,
	TurnStartedEvent,
	TypingStartCommand,
	TypingState,
	TypingStopCommand,
	TypingUpdateEvent,
} from './multiplayer.js';
// Domain constants and utilities (from @dicee/shared)
// Type guards
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
	isAIEvent,
	isCategoryScored,
	isChatEvent,
	isInviteEvent,
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
} from './multiplayer.js';

// =============================================================================
// Telemetry Types
// =============================================================================

export type {
	CategoryHoverPayload,
	CategoryScorePayload,
	DecisionQualityPayload,
	ErrorPayload,
	GameCompletePayload,
	GameStartPayload,
	HintRequestedPayload,
	PageViewPayload,
	PredictionPayload,
	RollPayload,
	SessionEndPayload,
	SessionStartPayload,
	TelemetryConfig,
	TelemetryEvent,
	TelemetryEventInput,
	TelemetryEventType,
	TelemetryPayloadMap,
} from './telemetry.js';

export {
	DEFAULT_TELEMETRY_CONFIG,
	isTelemetryEvent,
	isTelemetryEventType,
	parseTelemetryEvent,
	TELEMETRY_EVENT_TYPES,
} from './telemetry.js';

// =============================================================================
// Database Types (Supabase Generated)
// =============================================================================

export type { Database, Tables, TablesInsert, TablesUpdate } from './database.js';

// =============================================================================
// Schema Exports (for Runtime Validation)
// =============================================================================

// Multiplayer schemas
export {
	CommandSchema,
	isCommand,
	isServerEvent,
	isValidRoomCode,
	parseCommand,
	parseServerEvent,
	RoomCodeSchema,
	ServerEventSchema,
} from './multiplayer.schema.js';

// Telemetry schemas
export { TelemetryEventSchema } from './telemetry.schema.js';
