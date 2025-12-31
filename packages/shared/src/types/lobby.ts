/**
 * Lobby Types
 *
 * Types specific to the GlobalLobby - presence, room browser, and lobby chat.
 * These are distinct from GameRoom types which handle in-game state.
 */

import type { RoomIdentity } from './room-identity.js';

// =============================================================================
// Player Presence Types (for reconnection UX)
// =============================================================================

/**
 * Player presence state in a room:
 * - connected: Actively connected via WebSocket
 * - disconnected: Socket closed but seat reserved (within grace period)
 * - abandoned: Grace period expired, slot can be reclaimed
 */
export type PlayerPresenceState = 'connected' | 'disconnected' | 'abandoned';

/**
 * Player summary for lobby display.
 * Includes presence state for reconnection UX.
 */
export interface PlayerSummary {
	/** User ID (Supabase auth.users.id) */
	userId: string;
	/** Display name */
	displayName: string;
	/** Avatar seed for DiceBear */
	avatarSeed: string;
	/** Current score (0 if game not started) */
	score: number;
	/** Whether this player is the room host */
	isHost: boolean;
	/** Current presence state */
	presenceState: PlayerPresenceState;
	/** When reconnection window expires (null if connected or abandoned) */
	reconnectDeadline: number | null;
	/** When player disconnected (null if connected) */
	lastSeenAt: number | null;
}

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
 * Room status for lobby display.
 * Includes 'paused' state for all-players-disconnected scenario.
 */
export type LobbyRoomStatus = 'waiting' | 'playing' | 'paused' | 'finished';

/**
 * Room information displayed in the lobby browser (simple version)
 * Used for basic room listing
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
	/** Current player count (excludes abandoned players) */
	playerCount: number;
	/** Maximum players allowed */
	maxPlayers: number;
	/** Current room status */
	status: LobbyRoomStatus;
	/** Creation timestamp (ms since epoch) */
	createdAt: number;
}

/**
 * Full room information for lobby browser with player details.
 * This is the primary type used by the room browser UI.
 */
export interface RoomInfo {
	/** 6-character room code */
	code: string;
	/** Game type (e.g., 'dicee') */
	game: string;
	/** Host display name */
	hostName: string;
	/** Host user ID */
	hostId: string;
	/** Number of active players (excludes abandoned) */
	playerCount: number;
	/** Number of spectators watching */
	spectatorCount: number;
	/** Maximum players allowed (2-4) */
	maxPlayers: number;
	/** Whether room is publicly listed */
	isPublic: boolean;
	/** Whether spectators can watch */
	allowSpectators: boolean;
	/** Current room status */
	status: LobbyRoomStatus;
	/** Current round (0 if not started, 1-13 during game) */
	roundNumber: number;
	/** Total rounds in game */
	totalRounds: number;
	/** Players with presence information */
	players: PlayerSummary[];
	/** Creation timestamp (ms since epoch) */
	createdAt: number;
	/** Last update timestamp (ms since epoch) */
	updatedAt: number;
	/** When room entered PAUSED state (null if not paused) */
	pausedAt?: number | null;
	/** Visual identity for lobby display */
	identity?: RoomIdentity;
}

/**
 * Room status update sent from GameRoom to GlobalLobby.
 * Used for room browser updates and live game status.
 */
export interface RoomStatusUpdate {
	/** Room code (6 uppercase alphanumeric) */
	roomCode: string;
	/** Current room status for lobby display */
	status: LobbyRoomStatus;
	/** Number of active players (excludes abandoned) */
	playerCount: number;
	/** Number of spectators watching */
	spectatorCount: number;
	/** Maximum players allowed */
	maxPlayers: number;
	/** Current round (0 if not started, 1-13 during game) */
	roundNumber: number;
	/** Total rounds in game */
	totalRounds: number;
	/** Whether room is listed publicly */
	isPublic: boolean;
	/** Allow spectators to watch */
	allowSpectators: boolean;
	/** Player summaries with presence state */
	players: PlayerSummary[];
	/** Host user ID */
	hostId: string;
	/** Host display name */
	hostName: string;
	/** Game name (e.g., 'dicee') */
	game: string;
	/** Timestamp of this update */
	updatedAt: number;
	/** When room entered PAUSED state (null if not paused) */
	pausedAt?: number | null;
	/** Visual identity for lobby display */
	identity?: RoomIdentity;
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
