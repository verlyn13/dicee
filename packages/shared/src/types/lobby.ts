/**
 * Lobby Types
 *
 * Types specific to the GlobalLobby - presence, room browser, and lobby chat.
 * These are distinct from GameRoom types which handle in-game state.
 */

import type { RoomState } from './room.js';

// =============================================================================
// Lobby User Types
// =============================================================================

/**
 * User presence in the lobby (visible to other users)
 */
export interface LobbyUser {
	/** User's unique ID */
	userId: string;
	/** Display name */
	displayName: string;
	/** Avatar seed for deterministic generation */
	avatarSeed: string;
	/** Room code if user is currently in a game (null if just browsing lobby) */
	currentRoomCode: string | null;
}

/**
 * Full user presence data (stored in WebSocket attachment)
 * Extends LobbyUser with connection tracking
 */
export interface LobbyUserPresence extends LobbyUser {
	/** When the user connected to the lobby */
	connectedAt: number;
	/** Last activity timestamp */
	lastSeen: number;
}

// =============================================================================
// Lobby Room Types
// =============================================================================

/**
 * Room information displayed in the lobby browser
 * Subset of full GameRoom - only what's needed for discovery
 */
export interface LobbyRoomInfo {
	/** 6-character room code */
	code: string;
	/** Host user ID */
	hostId: string;
	/** Host display name (for showing in UI) */
	hostName: string;
	/** Whether room is publicly listed */
	isPublic: boolean;
	/** Current player count */
	playerCount: number;
	/** Maximum players allowed */
	maxPlayers: number;
	/** Current room state */
	status: RoomState;
	/** Creation timestamp (ms since epoch) */
	createdAt: number;
}

// =============================================================================
// Lobby Chat Types
// =============================================================================

/**
 * Chat message in the lobby (different from in-game ChatMessage)
 * Lobby chat is simpler - no reactions, no quick chat
 */
export interface LobbyChatMessage {
	/** Unique message ID */
	id: string;
	/** User ID who sent the message */
	userId: string;
	/** Display name at time of message */
	displayName: string;
	/** Message content */
	content: string;
	/** Unix timestamp in milliseconds */
	timestamp: number;
}

// =============================================================================
// Invite Types
// =============================================================================

/**
 * Game invite sent through the lobby
 */
export interface GameInvite {
	/** Unique invite ID */
	id: string;
	/** Room code being invited to */
	roomCode: string;
	/** User ID of the person sending the invite */
	fromUserId: string;
	/** Display name of the sender */
	fromDisplayName: string;
	/** User ID of the person being invited */
	toUserId: string;
	/** When the invite was created */
	createdAt: number;
	/** When the invite expires (ms since epoch) */
	expiresAt: number;
}

/**
 * Join request sent through the lobby
 */
export interface JoinRequest {
	/** Unique request ID */
	id: string;
	/** Room code requesting to join */
	roomCode: string;
	/** User ID of the requester */
	userId: string;
	/** Display name of the requester */
	displayName: string;
	/** Avatar seed for UI display */
	avatarSeed: string;
	/** When the request was created */
	createdAt: number;
}

// =============================================================================
// Lobby Constants
// =============================================================================

/** Maximum lobby chat message length */
export const LOBBY_CHAT_MAX_LENGTH = 500;

/** Maximum number of chat messages kept in history */
export const LOBBY_CHAT_HISTORY_SIZE = 50;

/** Rate limit: messages per minute */
export const LOBBY_CHAT_RATE_LIMIT = 30;

/** Invite expiration time in milliseconds (5 minutes) */
export const INVITE_EXPIRATION_MS = 5 * 60 * 1000;
