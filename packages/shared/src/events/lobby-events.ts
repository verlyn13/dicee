/**
 * GlobalLobby WebSocket Events (Server → Client)
 *
 * UPPERCASE_SNAKE_CASE format matching GameRoom protocol.
 * These events are sent from GlobalLobby DO to connected clients.
 */

import type {
	LobbyUser,
	LobbyRoomInfo,
	LobbyChatMessage,
	GameInvite,
} from '../types/lobby.js';

// =============================================================================
// Base Event Interface
// =============================================================================

/** Base interface for all lobby server events */
interface BaseLobbyEvent {
	type: string;
	timestamp: string; // ISO timestamp
}

// =============================================================================
// Presence Events
// =============================================================================

/** Initial presence state sent on connection */
export interface PresenceInitEvent extends BaseLobbyEvent {
	type: 'PRESENCE_INIT';
	payload: {
		/** Current unique online user count */
		onlineCount: number;
	};
}

/** User joined the lobby */
export interface PresenceJoinEvent extends BaseLobbyEvent {
	type: 'PRESENCE_JOIN';
	payload: {
		userId: string;
		displayName: string;
		avatarSeed: string;
		/** Updated online count after join */
		onlineCount: number;
	};
}

/** User left the lobby */
export interface PresenceLeaveEvent extends BaseLobbyEvent {
	type: 'PRESENCE_LEAVE';
	payload: {
		userId: string;
		displayName: string;
		/** Updated online count after leave */
		onlineCount: number;
	};
}

// =============================================================================
// Room Browser Events
// =============================================================================

/** Full list of public rooms (sent on connection) */
export interface LobbyRoomsListEvent extends BaseLobbyEvent {
	type: 'LOBBY_ROOMS_LIST';
	payload: {
		rooms: LobbyRoomInfo[];
	};
}

/** Room created, updated, or closed */
export interface LobbyRoomUpdateEvent extends BaseLobbyEvent {
	type: 'LOBBY_ROOM_UPDATE';
	payload: {
		action: 'created' | 'updated' | 'closed';
		/** Room info (present for created/updated) */
		room?: LobbyRoomInfo;
		/** Room code (present for closed) */
		code?: string;
	};
}

// =============================================================================
// Lobby Chat Events
// =============================================================================

/** New chat message in lobby */
export interface LobbyChatMessageEvent extends BaseLobbyEvent {
	type: 'LOBBY_CHAT_MESSAGE';
	payload: LobbyChatMessage;
}

/** Chat history (sent on connection) */
export interface LobbyChatHistoryEvent extends BaseLobbyEvent {
	type: 'LOBBY_CHAT_HISTORY';
	payload: {
		messages: LobbyChatMessage[];
	};
}

// =============================================================================
// Online Users Events
// =============================================================================

/** Full list of online users (on request) */
export interface LobbyOnlineUsersEvent extends BaseLobbyEvent {
	type: 'LOBBY_ONLINE_USERS';
	payload: {
		users: LobbyUser[];
	};
}

// =============================================================================
// Invite Events
// =============================================================================

/** Invite received from another user */
export interface InviteReceivedEvent extends BaseLobbyEvent {
	type: 'INVITE_RECEIVED';
	payload: {
		invite: GameInvite;
	};
}

/** Invite was cancelled by sender */
export interface InviteCancelledEvent extends BaseLobbyEvent {
	type: 'INVITE_CANCELLED';
	payload: {
		inviteId: string;
	};
}

// =============================================================================
// Join Request Events
// =============================================================================

/** Join request sent successfully */
export interface JoinRequestSentEvent extends BaseLobbyEvent {
	type: 'JOIN_REQUEST_SENT';
	payload: {
		requestId: string;
		roomCode: string;
	};
}

/** Join request was cancelled */
export interface JoinRequestCancelledEvent extends BaseLobbyEvent {
	type: 'JOIN_REQUEST_CANCELLED';
	payload: {
		requestId: string;
		roomCode: string;
	};
}

/** Join request error */
export interface JoinRequestErrorEvent extends BaseLobbyEvent {
	type: 'JOIN_REQUEST_ERROR';
	payload: {
		message: string;
		roomCode?: string;
	};
}

// =============================================================================
// Game Highlight Events
// =============================================================================

/** Game highlight broadcast to lobby (e.g., someone scored Dicee!) */
export interface LobbyHighlightEvent extends BaseLobbyEvent {
	type: 'LOBBY_HIGHLIGHT';
	payload: {
		type: 'dicee' | 'game_won' | 'streak';
		playerName: string;
		roomCode: string;
		details?: Record<string, unknown>;
	};
}

// =============================================================================
// Error Events
// =============================================================================

/** Generic lobby error */
export interface LobbyErrorEvent extends BaseLobbyEvent {
	type: 'LOBBY_ERROR';
	payload: {
		message: string;
		code?: string;
	};
}

// =============================================================================
// Union Types
// =============================================================================

/** All presence event types */
export type LobbyPresenceEvent =
	| PresenceInitEvent
	| PresenceJoinEvent
	| PresenceLeaveEvent;

/** All room browser event types */
export type LobbyRoomEvent =
	| LobbyRoomsListEvent
	| LobbyRoomUpdateEvent;

/** All lobby chat event types */
export type LobbyChatEvent =
	| LobbyChatMessageEvent
	| LobbyChatHistoryEvent;

/** All invite event types */
export type LobbyInviteEvent =
	| InviteReceivedEvent
	| InviteCancelledEvent;

/** All join request event types */
export type LobbyJoinRequestEvent =
	| JoinRequestSentEvent
	| JoinRequestCancelledEvent
	| JoinRequestErrorEvent;

/** All lobby server events */
export type LobbyServerEvent =
	| LobbyPresenceEvent
	| LobbyRoomEvent
	| LobbyChatEvent
	| LobbyOnlineUsersEvent
	| LobbyInviteEvent
	| LobbyJoinRequestEvent
	| LobbyHighlightEvent
	| LobbyErrorEvent;

/** Extract event type string */
export type LobbyServerEventType = LobbyServerEvent['type'];

/** Get specific event by type */
export type GetLobbyEvent<T extends LobbyServerEventType> = Extract<LobbyServerEvent, { type: T }>;

// =============================================================================
// Type Guards
// =============================================================================

/** All valid lobby event type strings */
export const LOBBY_SERVER_EVENT_TYPES: readonly LobbyServerEventType[] = [
	// Presence
	'PRESENCE_INIT',
	'PRESENCE_JOIN',
	'PRESENCE_LEAVE',
	// Rooms
	'LOBBY_ROOMS_LIST',
	'LOBBY_ROOM_UPDATE',
	// Chat
	'LOBBY_CHAT_MESSAGE',
	'LOBBY_CHAT_HISTORY',
	// Users
	'LOBBY_ONLINE_USERS',
	// Invites
	'INVITE_RECEIVED',
	'INVITE_CANCELLED',
	// Join requests
	'JOIN_REQUEST_SENT',
	'JOIN_REQUEST_CANCELLED',
	'JOIN_REQUEST_ERROR',
	// Highlights
	'LOBBY_HIGHLIGHT',
	// Errors
	'LOBBY_ERROR',
] as const;

/** Check if a type string is a valid lobby server event type */
export function isValidLobbyServerEventType(type: unknown): type is LobbyServerEventType {
	return typeof type === 'string' && LOBBY_SERVER_EVENT_TYPES.includes(type as LobbyServerEventType);
}

/** Check if an event is a presence event */
export function isPresenceEvent(event: { type: string }): event is LobbyPresenceEvent {
	return ['PRESENCE_INIT', 'PRESENCE_JOIN', 'PRESENCE_LEAVE'].includes(event.type);
}

/** Check if an event is a room event */
export function isLobbyRoomEvent(event: { type: string }): event is LobbyRoomEvent {
	return ['LOBBY_ROOMS_LIST', 'LOBBY_ROOM_UPDATE'].includes(event.type);
}

/** Check if an event is a chat event */
export function isLobbyChatEvent(event: { type: string }): event is LobbyChatEvent {
	return ['LOBBY_CHAT_MESSAGE', 'LOBBY_CHAT_HISTORY'].includes(event.type);
}
