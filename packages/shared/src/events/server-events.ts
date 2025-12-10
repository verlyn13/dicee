/**
 * WebSocket Server Events (Server → Client)
 *
 * UPPERCASE_SNAKE_CASE format for all wire protocol events.
 * These are the canonical event types - both client and server use these.
 */

import type {
	DiceArray,
	KeptMask,
	Category,
	GameState,
	GameRoom,
	RoomPlayer,
	PlayerRanking,
	ChatMessage,
	MessageReactions,
	TypingState,
	ChatErrorCode,
} from '../types/index.js';

// =============================================================================
// Base Event Interface
// =============================================================================

/** Base server event interface */
interface BaseServerEvent {
	type: string;
	timestamp: string; // ISO timestamp
}

// =============================================================================
// Room Events
// =============================================================================

/** Room created successfully */
export interface RoomCreatedEvent extends BaseServerEvent {
	type: 'ROOM_CREATED';
	payload: {
		roomCode: string;
	};
}

/** Full room state sync */
export interface RoomStateEvent extends BaseServerEvent {
	type: 'ROOM_STATE';
	payload: {
		room: GameRoom;
	};
}

/** Player joined the room */
export interface PlayerJoinedEvent extends BaseServerEvent {
	type: 'PLAYER_JOINED';
	payload: {
		player: RoomPlayer;
	};
}

/** Player left the room */
export interface PlayerLeftEvent extends BaseServerEvent {
	type: 'PLAYER_LEFT';
	payload: {
		playerId: string;
		reason: 'left' | 'disconnected' | 'kicked';
	};
}

/** AI player joined the room */
export interface AIPlayerJoinedEvent extends BaseServerEvent {
	type: 'AI_JOINED';
	payload: {
		player: RoomPlayer & { isAI: true; profileId: string };
	};
}

/** Player connection status changed */
export interface PlayerConnectionEvent extends BaseServerEvent {
	type: 'PLAYER_CONNECTION';
	payload: {
		playerId: string;
		isConnected: boolean;
	};
}

// =============================================================================
// Game Flow Events
// =============================================================================

/** Game is starting */
export interface GameStartingEvent extends BaseServerEvent {
	type: 'GAME_STARTING';
	payload: {
		countdown: number;
	};
}

/** Game started */
export interface GameStartedEvent extends BaseServerEvent {
	type: 'GAME_STARTED';
	payload: {
		playerOrder: string[];
		currentPlayerId: string;
		turnNumber: number;
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

/** Turn ended */
export interface TurnEndedEvent extends BaseServerEvent {
	type: 'TURN_ENDED';
	payload: {
		playerId: string;
	};
}

/** Turn skipped (AFK) */
export interface TurnSkippedEvent extends BaseServerEvent {
	type: 'TURN_SKIPPED';
	payload: {
		playerId: string;
		reason: 'timeout' | 'disconnect';
		categoryScored: Category;
		score: number;
	};
}

/** AFK warning */
export interface AfkWarningEvent extends BaseServerEvent {
	type: 'AFK_WARNING';
	payload: {
		playerId: string;
		secondsRemaining: number;
	};
}

/** Game completed */
export interface GameCompletedEvent extends BaseServerEvent {
	type: 'GAME_COMPLETED';
	payload: {
		rankings: PlayerRanking[];
		duration: number;
	};
}

// =============================================================================
// Dice Events
// =============================================================================

/** Dice rolled */
export interface DiceRolledEvent extends BaseServerEvent {
	type: 'DICE_ROLLED';
	payload: {
		playerId: string;
		dice: DiceArray;
		rollNumber: 1 | 2 | 3;
		rollsRemaining: 0 | 1 | 2;
	};
}

/** Dice kept */
export interface DiceKeptEvent extends BaseServerEvent {
	type: 'DICE_KEPT';
	payload: {
		playerId: string;
		kept: KeptMask;
	};
}

// =============================================================================
// Scoring Events
// =============================================================================

/** Category scored */
export interface CategoryScoredEvent extends BaseServerEvent {
	type: 'CATEGORY_SCORED';
	payload: {
		playerId: string;
		category: Category;
		score: number;
		totalScore: number;
		isDiceeBonus: boolean;
	};
}

// =============================================================================
// State Sync Events
// =============================================================================

/** Full game state sync */
export interface GameStateSyncEvent extends BaseServerEvent {
	type: 'STATE_SYNC';
	payload: {
		state: GameState;
	};
}

// =============================================================================
// Error Events
// =============================================================================

/** Game error */
export interface GameErrorEvent extends BaseServerEvent {
	type: 'GAME_ERROR';
	payload: {
		message: string;
		code: string;
	};
}

/** Generic error */
export interface ErrorEvent extends BaseServerEvent {
	type: 'ERROR';
	payload: {
		message: string;
		code: string;
	};
}

// =============================================================================
// Chat Events
// =============================================================================

/** Chat message received */
export interface ChatMessageEvent extends BaseServerEvent {
	type: 'CHAT_MESSAGE';
	payload: ChatMessage;
}

/** Chat history (sent on connect) */
export interface ChatHistoryEvent extends BaseServerEvent {
	type: 'CHAT_HISTORY';
	payload: {
		messages: ChatMessage[];
	};
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

// =============================================================================
// Union Types
// =============================================================================

/** All room event types */
export type RoomEvent =
	| RoomCreatedEvent
	| RoomStateEvent
	| PlayerJoinedEvent
	| PlayerLeftEvent
	| AIPlayerJoinedEvent
	| PlayerConnectionEvent;

/** All game flow event types */
export type GameFlowEvent =
	| GameStartingEvent
	| GameStartedEvent
	| TurnStartedEvent
	| TurnEndedEvent
	| TurnSkippedEvent
	| AfkWarningEvent
	| GameCompletedEvent;

/** All dice event types */
export type DiceEvent =
	| DiceRolledEvent
	| DiceKeptEvent;

/** All scoring event types */
export type ScoringEvent =
	| CategoryScoredEvent;

/** All state sync event types */
export type SyncEvent =
	| GameStateSyncEvent;

/** All error event types */
export type ErrorEventType =
	| GameErrorEvent
	| ErrorEvent;

/** All chat event types */
export type ChatEvent =
	| ChatMessageEvent
	| ChatHistoryEvent
	| ReactionUpdateEvent
	| TypingUpdateEvent
	| ChatErrorEvent;

/** All server event types */
export type ServerEvent =
	| RoomEvent
	| GameFlowEvent
	| DiceEvent
	| ScoringEvent
	| SyncEvent
	| ErrorEventType
	| ChatEvent;

/** Extract event type string */
export type ServerEventType = ServerEvent['type'];

/** Get specific event by type */
export type GetServerEvent<T extends ServerEventType> = Extract<ServerEvent, { type: T }>;

// =============================================================================
// Type Guards
// =============================================================================

/** All valid event type strings */
export const SERVER_EVENT_TYPES: readonly ServerEventType[] = [
	// Room
	'ROOM_CREATED',
	'ROOM_STATE',
	'PLAYER_JOINED',
	'PLAYER_LEFT',
	'AI_JOINED',
	'PLAYER_CONNECTION',
	// Game flow
	'GAME_STARTING',
	'GAME_STARTED',
	'TURN_STARTED',
	'TURN_ENDED',
	'TURN_SKIPPED',
	'AFK_WARNING',
	'GAME_COMPLETED',
	// Dice
	'DICE_ROLLED',
	'DICE_KEPT',
	// Scoring
	'CATEGORY_SCORED',
	// Sync
	'STATE_SYNC',
	// Errors
	'GAME_ERROR',
	'ERROR',
	// Chat
	'CHAT_MESSAGE',
	'CHAT_HISTORY',
	'REACTION_UPDATE',
	'TYPING_UPDATE',
	'CHAT_ERROR',
] as const;

/** Check if a type string is a valid server event type */
export function isValidServerEventType(type: unknown): type is ServerEventType {
	return typeof type === 'string' && SERVER_EVENT_TYPES.includes(type as ServerEventType);
}

/** Check if an event is a chat event */
export function isChatEvent(event: { type: string }): event is ChatEvent {
	return [
		'CHAT_MESSAGE',
		'CHAT_HISTORY',
		'REACTION_UPDATE',
		'TYPING_UPDATE',
		'CHAT_ERROR',
	].includes(event.type);
}

/** Check if an event is a game flow event */
export function isGameFlowEvent(event: { type: string }): event is GameFlowEvent {
	return [
		'GAME_STARTING',
		'GAME_STARTED',
		'TURN_STARTED',
		'TURN_ENDED',
		'TURN_SKIPPED',
		'AFK_WARNING',
		'GAME_COMPLETED',
	].includes(event.type);
}

/** Check if an event is a dice event */
export function isDiceEvent(event: { type: string }): event is DiceEvent {
	return ['DICE_ROLLED', 'DICE_KEPT'].includes(event.type);
}

/** Check if an event is a room event */
export function isRoomEvent(event: { type: string }): event is RoomEvent {
	return [
		'ROOM_CREATED',
		'ROOM_STATE',
		'PLAYER_JOINED',
		'PLAYER_LEFT',
		'AI_JOINED',
		'PLAYER_CONNECTION',
	].includes(event.type);
}
