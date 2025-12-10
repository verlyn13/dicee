/**
 * Multiplayer Types (Wire Format) - UPPERCASE Protocol
 *
 * Re-exports canonical types from @dicee/shared and defines web-specific
 * command/event interfaces for the multiplayer room system.
 *
 * All wire protocol messages use UPPERCASE_SNAKE_CASE for type identifiers.
 * Payloads use camelCase for property names.
 *
 * @see packages/cloudflare-do/src/GameRoom.ts - Server implementation
 * @invariant category_type_consistency
 */

// =============================================================================
// Import types for internal use (needed because re-exports don't make types available in same file)
// =============================================================================
import type {
	ChatErrorCode as ChatErrorCodeType,
	ChatMessage as ChatMessageType,
	DiceArray as DiceArrayType,
	KeptMask as KeptMaskType,
	MessageReactions as MessageReactionsType,
	PlayerGameState as PlayerGameStateType,
	QuickChatKey as QuickChatKeyType,
	ReactionEmoji as ReactionEmojiType,
	RoomCode as RoomCodeType,
	TypingState as TypingStateType,
} from '@dicee/shared';

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
// Command Types (Client → Server) - UPPERCASE format
// =============================================================================

/** Base command interface */
interface BaseCommand {
	type: string;
	payload?: unknown;
}

/** Start the game (host only) */
export interface StartGameCommand extends BaseCommand {
	type: 'START_GAME';
}

/** Start quick play with AI opponents */
export interface QuickPlayStartCommand extends BaseCommand {
	type: 'QUICK_PLAY_START';
	payload: {
		aiProfiles: string[];
	};
}

/** Roll dice */
export interface RollDiceCommand extends BaseCommand {
	type: 'DICE_ROLL';
	payload: {
		kept?: KeptMaskType;
	};
}

/** Keep specific dice */
export interface KeepDiceCommand extends BaseCommand {
	type: 'DICE_KEEP';
	payload: {
		indices: number[];
	};
}

/** Score a category */
export interface ScoreCategoryCommand extends BaseCommand {
	type: 'CATEGORY_SCORE';
	payload: {
		category: string;
	};
}

/** Request rematch (host only, from game_over) */
export interface RematchCommand extends BaseCommand {
	type: 'REMATCH';
}

/** Add AI player to room (host only, during waiting) */
export interface AddAIPlayerCommand extends BaseCommand {
	type: 'ADD_AI_PLAYER';
	payload: {
		profileId: string;
	};
}

/** Heartbeat ping */
export interface PingCommand extends BaseCommand {
	type: 'PING';
}

/** All command types */
export type Command =
	| StartGameCommand
	| QuickPlayStartCommand
	| RollDiceCommand
	| KeepDiceCommand
	| ScoreCategoryCommand
	| RematchCommand
	| AddAIPlayerCommand
	| PingCommand;

// =============================================================================
// Server Event Types (Server → Client) - UPPERCASE format with payload
// =============================================================================

/** Base server event interface */
interface BaseServerEvent {
	type: string;
	payload?: unknown;
	timestamp?: string;
}

/** Initial connection - full room state */
export interface ConnectedEvent extends BaseServerEvent {
	type: 'CONNECTED';
	payload: {
		roomCode: RoomCodeType;
		isHost: boolean;
		players: Array<{
			id: string;
			displayName: string;
			avatarSeed: string;
			isHost: boolean;
			isConnected: boolean;
		}>;
		aiPlayers?: Array<{
			id: string;
			profileId: string;
			displayName: string;
			avatarSeed: string;
		}>;
		spectators: Array<{
			id: string;
			displayName: string;
		}>;
		roomStatus: 'waiting' | 'starting' | 'playing' | 'completed' | 'abandoned';
		spectatorCount: number;
	};
}

/** Player joined the room */
export interface PlayerJoinedEvent extends BaseServerEvent {
	type: 'PLAYER_JOINED';
	payload: {
		userId: string;
		displayName: string;
		avatarSeed: string;
	};
}

/** Player left the room */
export interface PlayerLeftEvent extends BaseServerEvent {
	type: 'PLAYER_LEFT';
	payload: {
		userId: string;
		reason: 'left' | 'disconnected' | 'kicked';
	};
}

/** AI player joined the room */
export interface AIPlayerJoinedEvent extends BaseServerEvent {
	type: 'AI_PLAYER_JOINED';
	payload: {
		id: string;
		profileId: string;
		displayName: string;
		avatarSeed: string;
	};
}

/** Game is starting */
export interface GameStartingEvent extends BaseServerEvent {
	type: 'GAME_STARTING';
	payload: {
		playerCount: number;
	};
}

/** Game started */
export interface GameStartedEvent extends BaseServerEvent {
	type: 'GAME_STARTED';
	payload: {
		playerOrder: string[];
		currentPlayerId: string;
		turnNumber: number;
		roundNumber: number;
		phase: string;
		players: Record<string, PlayerGameStateType>;
	};
}

/** Quick play started (solo vs AI) */
export interface QuickPlayStartedEvent extends BaseServerEvent {
	type: 'QUICK_PLAY_STARTED';
	payload: {
		playerOrder: string[];
		currentPlayerId: string;
		turnNumber: number;
		roundNumber: number;
		phase: string;
		players: Record<string, PlayerGameStateType>;
		aiPlayers: Array<{
			id: string;
			profileId: string;
			displayName: string;
			avatarSeed: string;
		}>;
	};
}

/** Turn started */
export interface TurnStartedEvent extends BaseServerEvent {
	type: 'TURN_STARTED';
	payload: {
		playerId: string;
		turnNumber: number;
		roundNumber: number;
	};
}

/** Turn changed to next player */
export interface TurnChangedEvent extends BaseServerEvent {
	type: 'TURN_CHANGED';
	payload: {
		currentPlayerId: string;
		turnNumber: number;
		roundNumber: number;
		phase: string;
	};
}

/** Dice rolled */
export interface DiceRolledEvent extends BaseServerEvent {
	type: 'DICE_ROLLED';
	payload: {
		playerId: string;
		dice: DiceArrayType;
		rollNumber: number;
		rollsRemaining: number;
	};
}

/** Dice kept */
export interface DiceKeptEvent extends BaseServerEvent {
	type: 'DICE_KEPT';
	payload: {
		playerId: string;
		kept: KeptMaskType;
	};
}

/** Category scored */
export interface CategoryScoredEvent extends BaseServerEvent {
	type: 'CATEGORY_SCORED';
	payload: {
		playerId: string;
		category: string;
		score: number;
		totalScore: number;
		isDiceeBonus: boolean;
	};
}

/** Turn skipped (AFK) */
export interface TurnSkippedEvent extends BaseServerEvent {
	type: 'TURN_SKIPPED';
	payload: {
		playerId: string;
		reason: 'timeout' | 'disconnect';
		categoryScored: string;
		score: number;
	};
}

/** AFK warning */
export interface PlayerAfkEvent extends BaseServerEvent {
	type: 'PLAYER_AFK';
	payload: {
		playerId: string;
		secondsRemaining: number;
	};
}

/** Game over */
export interface GameOverEvent extends BaseServerEvent {
	type: 'GAME_OVER';
	payload: {
		rankings: Array<{
			playerId: string;
			displayName: string;
			rank: number;
			score: number;
			diceeCount: number;
		}>;
		duration: number;
	};
}

/** Rematch started - return to waiting room */
export interface RematchStartedEvent extends BaseServerEvent {
	type: 'REMATCH_STARTED';
	payload: {
		roomCode: RoomCodeType;
		players: Array<{
			id: string;
			displayName: string;
			avatarSeed: string;
			isHost: boolean;
			isConnected: boolean;
		}>;
	};
}

/** Error event */
export interface ErrorEvent extends BaseServerEvent {
	type: 'ERROR';
	payload: {
		code: string;
		message: string;
	};
}

/** Heartbeat response */
export interface PongEvent extends BaseServerEvent {
	type: 'PONG';
	payload: number;
}

// =============================================================================
// AI Events (Server → Client)
// =============================================================================

/** AI is thinking */
export interface AIThinkingEvent extends BaseServerEvent {
	type: 'AI_THINKING';
	payload: {
		playerId: string;
		displayName: string;
	};
}

/** AI is rolling */
export interface AIRollingEvent extends BaseServerEvent {
	type: 'AI_ROLLING';
	payload: {
		playerId: string;
	};
}

/** AI is keeping dice */
export interface AIKeepingEvent extends BaseServerEvent {
	type: 'AI_KEEPING';
	payload: {
		playerId: string;
		kept: KeptMaskType;
	};
}

/** AI is scoring */
export interface AIScoringEvent extends BaseServerEvent {
	type: 'AI_SCORING';
	payload: {
		playerId: string;
		category: string;
	};
}

// =============================================================================
// All Server Event Types
// =============================================================================

/** All server event types */
export type ServerEvent =
	| ConnectedEvent
	| PlayerJoinedEvent
	| PlayerLeftEvent
	| AIPlayerJoinedEvent
	| GameStartingEvent
	| GameStartedEvent
	| QuickPlayStartedEvent
	| TurnStartedEvent
	| TurnChangedEvent
	| DiceRolledEvent
	| DiceKeptEvent
	| CategoryScoredEvent
	| TurnSkippedEvent
	| PlayerAfkEvent
	| GameOverEvent
	| RematchStartedEvent
	| ErrorEvent
	| PongEvent
	| AIThinkingEvent
	| AIRollingEvent
	| AIKeepingEvent
	| AIScoringEvent;

// =============================================================================
// Chat Commands (Client → Server) - UPPERCASE format
// =============================================================================

/** Send a text chat message */
export interface ChatCommand extends BaseCommand {
	type: 'CHAT';
	payload: { content: string };
}

/** Send a quick chat message */
export interface QuickChatCommand extends BaseCommand {
	type: 'QUICK_CHAT';
	payload: { key: QuickChatKeyType };
}

/** Add or remove a reaction */
export interface ReactionCommand extends BaseCommand {
	type: 'REACTION';
	payload: {
		messageId: string;
		emoji: ReactionEmojiType;
		action: 'add' | 'remove';
	};
}

/** Start typing indicator */
export interface TypingStartCommand extends BaseCommand {
	type: 'TYPING_START';
}

/** Stop typing indicator */
export interface TypingStopCommand extends BaseCommand {
	type: 'TYPING_STOP';
}

/** All chat command types */
export type ChatCommand_Union =
	| ChatCommand
	| QuickChatCommand
	| ReactionCommand
	| TypingStartCommand
	| TypingStopCommand;

// =============================================================================
// Chat Server Events (Server → Client) - UPPERCASE format
// =============================================================================

/** Chat message received */
export interface ChatMessageEvent extends BaseServerEvent {
	type: 'CHAT_MESSAGE';
	payload: ChatMessageType;
}

/** Chat history (sent on connect) */
export interface ChatHistoryEvent extends BaseServerEvent {
	type: 'CHAT_HISTORY';
	payload: ChatMessageType[];
}

/** Reaction updated on a message */
export interface ReactionUpdateEvent extends BaseServerEvent {
	type: 'REACTION_UPDATE';
	payload: {
		messageId: string;
		reactions: MessageReactionsType;
	};
}

/** Typing indicator update */
export interface TypingUpdateEvent extends BaseServerEvent {
	type: 'TYPING_UPDATE';
	payload: {
		typing: TypingStateType[];
	};
}

/** Chat error */
export interface ChatErrorEvent extends BaseServerEvent {
	type: 'CHAT_ERROR';
	payload: {
		code: ChatErrorCodeType;
		message: string;
	};
}

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
