/**
 * WebSocket Commands (Client → Server)
 *
 * UPPERCASE_SNAKE_CASE format for all wire protocol commands.
 * These are the canonical command types - both client and server use these.
 */

import type { KeptMask, Category, RoomConfig, QuickChatKey, ReactionEmoji } from '../types/index.js';

// =============================================================================
// Room Commands
// =============================================================================

/** Create a new room */
export interface CreateRoomCommand {
	type: 'CREATE_ROOM';
	payload: {
		config?: Partial<RoomConfig>;
	};
}

/** Join an existing room */
export interface JoinRoomCommand {
	type: 'JOIN_ROOM';
	payload: {
		roomCode: string;
	};
}

/** Leave the current room */
export interface LeaveRoomCommand {
	type: 'LEAVE_ROOM';
}

/** Add AI player to room (host only, during waiting) */
export interface AddAIPlayerCommand {
	type: 'ADD_AI';
	payload: {
		profileId: string;
	};
}

/** Remove AI player from room (host only, during waiting) */
export interface RemoveAIPlayerCommand {
	type: 'REMOVE_AI';
	payload: {
		aiPlayerId: string;
	};
}

// =============================================================================
// Game Commands
// =============================================================================

/** Start the game (host only) */
export interface StartGameCommand {
	type: 'START_GAME';
}

/** Request rematch (host only, from game_over) */
export interface RematchCommand {
	type: 'REMATCH';
}

// =============================================================================
// Dice Commands
// =============================================================================

/** Roll dice */
export interface RollDiceCommand {
	type: 'DICE_ROLL';
	payload?: {
		/** Which dice to keep (true = keep, false = reroll) */
		kept?: KeptMask;
	};
}

/** Keep specific dice */
export interface KeepDiceCommand {
	type: 'DICE_KEEP';
	payload: {
		/** Indices of dice to keep (0-4) */
		indices: number[];
	};
}

// =============================================================================
// Scoring Commands
// =============================================================================

/** Score a category */
export interface ScoreCategoryCommand {
	type: 'CATEGORY_SCORE';
	payload: {
		category: Category;
	};
}

// =============================================================================
// Chat Commands
// =============================================================================

/** Send a text chat message */
export interface ChatCommand {
	type: 'CHAT';
	payload: {
		content: string;
	};
}

/** Send a quick chat message */
export interface QuickChatCommand {
	type: 'QUICK_CHAT';
	payload: {
		key: QuickChatKey;
	};
}

/** Add or remove a reaction */
export interface ReactionCommand {
	type: 'REACTION';
	payload: {
		messageId: string;
		emoji: ReactionEmoji;
		action: 'add' | 'remove';
	};
}

/** Start typing indicator */
export interface TypingStartCommand {
	type: 'TYPING_START';
}

/** Stop typing indicator */
export interface TypingStopCommand {
	type: 'TYPING_STOP';
}

// =============================================================================
// Union Types
// =============================================================================

/** All room command types */
export type RoomCommand =
	| CreateRoomCommand
	| JoinRoomCommand
	| LeaveRoomCommand
	| AddAIPlayerCommand
	| RemoveAIPlayerCommand;

/** All game command types */
export type GameCommand =
	| StartGameCommand
	| RematchCommand
	| RollDiceCommand
	| KeepDiceCommand
	| ScoreCategoryCommand;

/** All chat command types */
export type ChatCommandType =
	| ChatCommand
	| QuickChatCommand
	| ReactionCommand
	| TypingStartCommand
	| TypingStopCommand;

/** All command types */
export type Command =
	| RoomCommand
	| GameCommand
	| ChatCommandType;

/** Extract command type string */
export type CommandType = Command['type'];

/** Get specific command by type */
export type GetCommand<T extends CommandType> = Extract<Command, { type: T }>;

// =============================================================================
// Type Guards
// =============================================================================

/** Check if a message is a valid command */
export function isCommand(message: unknown): message is Command {
	if (typeof message !== 'object' || message === null) return false;
	const obj = message as Record<string, unknown>;
	return typeof obj.type === 'string';
}

/** All valid command type strings */
export const COMMAND_TYPES: readonly CommandType[] = [
	'CREATE_ROOM',
	'JOIN_ROOM',
	'LEAVE_ROOM',
	'ADD_AI',
	'REMOVE_AI',
	'START_GAME',
	'REMATCH',
	'DICE_ROLL',
	'DICE_KEEP',
	'CATEGORY_SCORE',
	'CHAT',
	'QUICK_CHAT',
	'REACTION',
	'TYPING_START',
	'TYPING_STOP',
] as const;

/** Check if a type string is a valid command type */
export function isValidCommandType(type: unknown): type is CommandType {
	return typeof type === 'string' && COMMAND_TYPES.includes(type as CommandType);
}
