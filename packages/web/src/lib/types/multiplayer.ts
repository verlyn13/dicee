/**
 * Multiplayer Types (Wire Format)
 *
 * TypeScript interfaces for the multiplayer room system.
 * These are the canonical types used by both web client and PartyKit server.
 *
 * IMPORTANT: These types represent the JSON wire format for WebSocket messages.
 * Category uses camelCase ('ones', 'yahtzee') for JSON serialization compatibility.
 *
 * For internal TypeScript use, import from '$lib/types.ts' which uses PascalCase.
 * Use category-convert.ts utilities when crossing the boundary:
 *
 * @example
 * import { toWireCategory, toCoreCategory } from '$lib/types/category-convert';
 * const wire = toWireCategory('Yahtzee');  // 'yahtzee'
 * const core = toCoreCategory('yahtzee');  // 'Yahtzee'
 *
 * @see $lib/types.ts - Internal TypeScript types (PascalCase)
 * @see $lib/types/category-convert.ts - Conversion utilities
 * @invariant category_type_consistency
 */

// =============================================================================
// Game State Types (from PartyKit server)
// =============================================================================

/** Game phase states */
export type GamePhase =
	| 'waiting'
	| 'starting'
	| 'turn_roll'
	| 'turn_decide'
	| 'turn_score'
	| 'game_over';

/** Dice array (5 dice, values 1-6) */
export type DiceArray = [number, number, number, number, number];

/** Kept mask (which dice are kept) */
export type KeptMask = [boolean, boolean, boolean, boolean, boolean];

/** Connection status */
export type ConnectionStatus = 'online' | 'away' | 'disconnected';

/**
 * Scoring category (Wire Format - camelCase)
 *
 * This is the wire format used in JSON messages. For internal TypeScript
 * use, prefer importing Category from '$lib/types.ts' (PascalCase).
 *
 * @see $lib/types/category-convert.ts for conversion utilities
 */
export type Category =
	| 'ones'
	| 'twos'
	| 'threes'
	| 'fours'
	| 'fives'
	| 'sixes'
	| 'threeOfAKind'
	| 'fourOfAKind'
	| 'fullHouse'
	| 'smallStraight'
	| 'largeStraight'
	| 'yahtzee'
	| 'chance';

/** Player scorecard */
export interface Scorecard {
	ones: number | null;
	twos: number | null;
	threes: number | null;
	fours: number | null;
	fives: number | null;
	sixes: number | null;
	threeOfAKind: number | null;
	fourOfAKind: number | null;
	fullHouse: number | null;
	smallStraight: number | null;
	largeStraight: number | null;
	yahtzee: number | null;
	chance: number | null;
	yahtzeeBonus: number;
	upperBonus: number;
}

/** Player game state */
export interface PlayerGameState {
	id: string;
	displayName: string;
	avatarSeed: string;
	isConnected: boolean;
	connectionId: string | null;
	lastActive: string;
	connectionStatus: ConnectionStatus;
	isHost: boolean;
	joinedAt: string;
	scorecard: Scorecard;
	totalScore: number;
	currentDice: DiceArray | null;
	keptDice: KeptMask | null;
	rollsRemaining: number;
}

/** Player ranking (for game over) */
export interface PlayerRanking {
	playerId: string;
	displayName: string;
	rank: number;
	score: number;
	yahtzeeCount: number;
}

/** Full multiplayer game state */
export interface GameState {
	roomCode: string;
	phase: GamePhase;
	playerOrder: string[];
	currentPlayerIndex: number;
	turnNumber: number;
	roundNumber: number;
	players: Record<string, PlayerGameState>;
	turnStartedAt: string | null;
	gameStartedAt: string | null;
	gameCompletedAt: string | null;
	rankings: PlayerRanking[] | null;
	config: {
		maxPlayers: 2 | 3 | 4;
		turnTimeoutSeconds: number;
		isPublic: boolean;
	};
}

// =============================================================================
// Room Types
// =============================================================================

/** 6-character alphanumeric room code (no ambiguous chars: 0,O,1,I,L) */
export type RoomCode = string;

/** Room configuration options */
export interface RoomConfig {
	/** Whether the room is listed in public lobby */
	isPublic: boolean;
	/** Allow spectators to watch the game */
	allowSpectators: boolean;
	/** Turn timeout in seconds (0 = no timeout) */
	turnTimeoutSeconds: number;
	/** Maximum players (2-4) */
	maxPlayers: 2 | 3 | 4;
}

/** Room state */
export type RoomState = 'waiting' | 'starting' | 'playing' | 'completed' | 'abandoned';

/** Game room */
export interface GameRoom {
	/** Room code (6-char alphanumeric) */
	code: RoomCode;
	/** Room configuration */
	config: RoomConfig;
	/** Current room state */
	state: RoomState;
	/** Connected players */
	players: RoomPlayer[];
	/** Host player ID */
	hostId: string;
	/** When the room was created */
	createdAt: string;
	/** When the game started (if playing) */
	startedAt: string | null;
}

// =============================================================================
// Player Types
// =============================================================================

/** Player in a room */
export interface RoomPlayer {
	/** User ID (from Supabase auth) */
	id: string;
	/** Display name */
	displayName: string;
	/** Avatar seed for DiceBear */
	avatarSeed: string;
	/** Whether player is currently connected */
	isConnected: boolean;
	/** Whether player is the room host */
	isHost: boolean;
	/** When player joined the room */
	joinedAt: string;
}

// =============================================================================
// Command Types (Client → Server)
// =============================================================================

/** Base command interface */
interface BaseCommand {
	type: string;
}

/** Create a new room */
export interface CreateRoomCommand extends BaseCommand {
	type: 'room.create';
	config?: Partial<RoomConfig>;
}

/** Join an existing room */
export interface JoinRoomCommand extends BaseCommand {
	type: 'room.join';
	roomCode: RoomCode;
}

/** Leave the current room */
export interface LeaveRoomCommand extends BaseCommand {
	type: 'room.leave';
}

/** Start the game (host only) */
export interface StartGameCommand extends BaseCommand {
	type: 'game.start';
}

/** Roll dice */
export interface RollDiceCommand extends BaseCommand {
	type: 'dice.roll';
	/** Which dice to keep (true = keep, false = reroll) */
	kept: [boolean, boolean, boolean, boolean, boolean];
}

/** Keep specific dice */
export interface KeepDiceCommand extends BaseCommand {
	type: 'dice.keep';
	/** Indices of dice to keep (0-4) */
	indices: number[];
}

/** Score a category */
export interface ScoreCategoryCommand extends BaseCommand {
	type: 'category.score';
	/** Category to score */
	category: string;
}

/** Request rematch (host only, from game_over) */
export interface RematchCommand extends BaseCommand {
	type: 'game.rematch';
}

/** All command types */
export type Command =
	| CreateRoomCommand
	| JoinRoomCommand
	| LeaveRoomCommand
	| StartGameCommand
	| RollDiceCommand
	| KeepDiceCommand
	| ScoreCategoryCommand
	| RematchCommand;

// =============================================================================
// Server Event Types (Server → Client)
// =============================================================================

/** Base server event interface */
interface BaseServerEvent {
	type: string;
	/** Event timestamp */
	timestamp: string;
}

/** Room created successfully */
export interface RoomCreatedEvent extends BaseServerEvent {
	type: 'room.created';
	roomCode: RoomCode;
}

/** Full room state sync */
export interface RoomStateEvent extends BaseServerEvent {
	type: 'room.state';
	room: GameRoom;
}

/** Player joined the room */
export interface PlayerJoinedEvent extends BaseServerEvent {
	type: 'player.joined';
	player: RoomPlayer;
}

/** Player left the room */
export interface PlayerLeftEvent extends BaseServerEvent {
	type: 'player.left';
	playerId: string;
	reason: 'left' | 'disconnected' | 'kicked';
}

/** Player connection status changed */
export interface PlayerConnectionEvent extends BaseServerEvent {
	type: 'player.connection';
	playerId: string;
	isConnected: boolean;
}

/** Game is starting */
export interface GameStartingEvent extends BaseServerEvent {
	type: 'game.starting';
	/** Countdown seconds */
	countdown: number;
}

/** Game started */
export interface GameStartedEvent extends BaseServerEvent {
	type: 'game.started';
	/** Player order for turns */
	playerOrder: string[];
	/** First player to roll */
	currentPlayerId: string;
	/** Turn number (1 for first turn) */
	turnNumber: number;
}

/** Turn started */
export interface TurnStartedEvent extends BaseServerEvent {
	type: 'turn.started';
	playerId: string;
	turnNumber: number;
	roundNumber: number;
}

/** Dice rolled */
export interface DiceRolledEvent extends BaseServerEvent {
	type: 'dice.rolled';
	playerId: string;
	dice: [number, number, number, number, number];
	rollNumber: number;
	rollsRemaining: number;
}

/** Dice kept */
export interface DiceKeptEvent extends BaseServerEvent {
	type: 'dice.kept';
	playerId: string;
	kept: [boolean, boolean, boolean, boolean, boolean];
}

/** Category scored */
export interface CategoryScoredEvent extends BaseServerEvent {
	type: 'category.scored';
	playerId: string;
	category: string;
	score: number;
	totalScore: number;
	isYahtzeeBonus: boolean;
}

/** Turn ended */
export interface TurnEndedEvent extends BaseServerEvent {
	type: 'turn.ended';
	playerId: string;
}

/** Turn skipped (AFK) */
export interface TurnSkippedEvent extends BaseServerEvent {
	type: 'turn.skipped';
	playerId: string;
	reason: 'timeout' | 'disconnect';
	categoryScored: string;
	score: number;
}

/** AFK warning */
export interface AfkWarningEvent extends BaseServerEvent {
	type: 'player.afk_warning';
	playerId: string;
	secondsRemaining: number;
}

/** Game completed */
export interface GameCompletedEvent extends BaseServerEvent {
	type: 'game.completed';
	rankings: Array<{
		playerId: string;
		displayName: string;
		rank: number;
		score: number;
		yahtzeeCount: number;
	}>;
	duration: number;
}

/** Full game state sync */
export interface GameStateSyncEvent extends BaseServerEvent {
	type: 'state.sync';
	state: GameState;
}

/** Game error */
export interface GameErrorEvent extends BaseServerEvent {
	type: 'game.error';
	message: string;
	code: string;
}

/** Error event */
export interface ErrorEvent extends BaseServerEvent {
	type: 'error';
	message: string;
	code: string;
}

/** All server event types */
export type ServerEvent =
	| RoomCreatedEvent
	| RoomStateEvent
	| PlayerJoinedEvent
	| PlayerLeftEvent
	| PlayerConnectionEvent
	| GameStartingEvent
	| GameStartedEvent
	| TurnStartedEvent
	| DiceRolledEvent
	| DiceKeptEvent
	| CategoryScoredEvent
	| TurnEndedEvent
	| TurnSkippedEvent
	| AfkWarningEvent
	| GameCompletedEvent
	| GameStateSyncEvent
	| GameErrorEvent
	| ErrorEvent;

// =============================================================================
// Chat Types
// =============================================================================

/** Reaction emoji type */
export type ReactionEmoji = '👍' | '🎲' | '😱' | '💀' | '🎉';

/** All available reaction emojis */
export const REACTION_EMOJIS: ReactionEmoji[] = ['👍', '🎲', '😱', '💀', '🎉'];

/** Quick chat preset keys */
export type QuickChatKey =
	| 'nice_roll'
	| 'good_game'
	| 'your_turn'
	| 'yahtzee'
	| 'ouch'
	| 'thinking';

/** Quick chat presets with emoji and text */
export const QUICK_CHAT_MESSAGES: Record<QuickChatKey, { emoji: string; text: string }> = {
	nice_roll: { emoji: '🎲', text: 'Nice roll!' },
	good_game: { emoji: '👏', text: 'Good game!' },
	your_turn: { emoji: '⏰', text: 'Your turn!' },
	yahtzee: { emoji: '🎉', text: 'YAHTZEE!' },
	ouch: { emoji: '💀', text: 'Ouch...' },
	thinking: { emoji: '🤔', text: 'Hmm, let me think...' },
};

/** All quick chat keys */
export const QUICK_CHAT_KEYS = Object.keys(QUICK_CHAT_MESSAGES) as QuickChatKey[];

/** Reactions on a message, keyed by emoji */
export interface MessageReactions {
	'👍': string[];
	'🎲': string[];
	'😱': string[];
	'💀': string[];
	'🎉': string[];
}

/** Create empty reactions object */
export function createEmptyReactions(): MessageReactions {
	return {
		'👍': [],
		'🎲': [],
		'😱': [],
		'💀': [],
		'🎉': [],
	};
}

/** Chat message from server */
export interface ChatMessage {
	/** Unique message ID */
	id: string;
	/** Message type: text, quick preset, or system announcement */
	type: 'text' | 'quick' | 'system';
	/** User ID who sent the message */
	userId: string;
	/** Display name at time of message */
	displayName: string;
	/** Message content (text or formatted quick chat) */
	content: string;
	/** Unix timestamp in milliseconds */
	timestamp: number;
	/** Aggregated reactions from all users */
	reactions: MessageReactions;
}

/** Typing state for a user */
export interface TypingState {
	userId: string;
	displayName: string;
	startedAt: number;
}

/** Chat rate limits (for client-side UX hints) */
export const CHAT_RATE_LIMITS = {
	/** Minimum interval between messages (ms) */
	MESSAGE_INTERVAL_MS: 1000,
	/** Maximum message length */
	MAX_MESSAGE_LENGTH: 500,
	/** Auto-clear typing indicator after (ms) */
	TYPING_TIMEOUT_MS: 3000,
} as const;

/** Chat error codes */
export type ChatErrorCode =
	| 'INVALID_MESSAGE'
	| 'RATE_LIMITED'
	| 'MESSAGE_TOO_LONG'
	| 'REACTION_FAILED'
	| 'MESSAGE_NOT_FOUND';

// =============================================================================
// Chat Commands (Client → Server)
// =============================================================================

/** Send a text chat message */
export interface ChatCommand extends BaseCommand {
	type: 'CHAT';
	payload: { content: string };
}

/** Send a quick chat message */
export interface QuickChatCommand extends BaseCommand {
	type: 'QUICK_CHAT';
	payload: { key: QuickChatKey };
}

/** Add or remove a reaction */
export interface ReactionCommand extends BaseCommand {
	type: 'REACTION';
	payload: {
		messageId: string;
		emoji: ReactionEmoji;
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
// Chat Server Events (Server → Client)
// =============================================================================

/** Chat message received */
export interface ChatMessageEvent extends BaseServerEvent {
	type: 'CHAT_MESSAGE';
	payload: ChatMessage;
}

/** Chat history (sent on connect) */
export interface ChatHistoryEvent extends BaseServerEvent {
	type: 'CHAT_HISTORY';
	payload: ChatMessage[];
}

/** Reaction updated on a message */
export interface ReactionUpdateEvent extends BaseServerEvent {
	type: 'REACTION_UPDATE';
	payload: {
		messageId: string;
		reactions: MessageReactions;
	};
}

/** Typing indicator update */
export interface TypingUpdateEvent extends BaseServerEvent {
	type: 'TYPING_UPDATE';
	payload: {
		typing: TypingState[];
	};
}

/** Chat error */
export interface ChatErrorEvent extends BaseServerEvent {
	type: 'CHAT_ERROR';
	payload: {
		code: ChatErrorCode;
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
