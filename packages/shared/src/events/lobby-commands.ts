/**
 * GlobalLobby Client Commands (Client → Server)
 *
 * UPPERCASE_SNAKE_CASE format matching GameRoom protocol.
 * These commands are sent from clients to the GlobalLobby DO.
 */

import type { LobbyRoomInfo } from '../types/lobby.js';

// =============================================================================
// Chat Commands
// =============================================================================

/** Send a chat message to the lobby */
export interface LobbyChatCommand {
	type: 'LOBBY_CHAT';
	payload: {
		content: string;
	};
}

// =============================================================================
// Room Browser Commands
// =============================================================================

/** Request current list of public rooms */
export interface GetRoomsCommand {
	type: 'GET_ROOMS';
}

/** Notify lobby that a room was created (sent by GameRoom) */
export interface RoomCreatedCommand {
	type: 'ROOM_CREATED';
	payload: {
		room: LobbyRoomInfo;
	};
}

/** Notify lobby that a room was updated (sent by GameRoom) */
export interface RoomUpdatedCommand {
	type: 'ROOM_UPDATED';
	payload: {
		room: LobbyRoomInfo;
	};
}

/** Notify lobby that a room was closed (sent by GameRoom) */
export interface RoomClosedCommand {
	type: 'ROOM_CLOSED';
	payload: {
		code: string;
	};
}

// =============================================================================
// Online Users Commands
// =============================================================================

/** Request list of online users */
export interface GetOnlineUsersCommand {
	type: 'GET_ONLINE_USERS';
}

// =============================================================================
// Join Request Commands
// =============================================================================

/** Request to join a room */
export interface RequestJoinCommand {
	type: 'REQUEST_JOIN';
	payload: {
		roomCode: string;
	};
}

/** Cancel a pending join request */
export interface CancelJoinRequestCommand {
	type: 'CANCEL_JOIN_REQUEST';
	payload: {
		requestId: string;
		roomCode: string;
	};
}

// =============================================================================
// Invite Commands
// =============================================================================

/** Send an invite to another user */
export interface SendInviteCommand {
	type: 'SEND_INVITE';
	payload: {
		toUserId: string;
		roomCode: string;
	};
}

/** Cancel a pending invite */
export interface CancelInviteCommand {
	type: 'CANCEL_INVITE';
	payload: {
		inviteId: string;
	};
}

// =============================================================================
// Union Types
// =============================================================================

/** All lobby commands */
export type LobbyCommand =
	| LobbyChatCommand
	| GetRoomsCommand
	| RoomCreatedCommand
	| RoomUpdatedCommand
	| RoomClosedCommand
	| GetOnlineUsersCommand
	| RequestJoinCommand
	| CancelJoinRequestCommand
	| SendInviteCommand
	| CancelInviteCommand;

/** Extract command type string */
export type LobbyCommandType = LobbyCommand['type'];

/** Get specific command by type */
export type GetLobbyCommand<T extends LobbyCommandType> = Extract<LobbyCommand, { type: T }>;

// =============================================================================
// Type Guards
// =============================================================================

/** All valid lobby command type strings */
export const LOBBY_COMMAND_TYPES: readonly LobbyCommandType[] = [
	'LOBBY_CHAT',
	'GET_ROOMS',
	'ROOM_CREATED',
	'ROOM_UPDATED',
	'ROOM_CLOSED',
	'GET_ONLINE_USERS',
	'REQUEST_JOIN',
	'CANCEL_JOIN_REQUEST',
	'SEND_INVITE',
	'CANCEL_INVITE',
] as const;

/** Check if a type string is a valid lobby command type */
export function isValidLobbyCommandType(type: unknown): type is LobbyCommandType {
	return typeof type === 'string' && LOBBY_COMMAND_TYPES.includes(type as LobbyCommandType);
}
