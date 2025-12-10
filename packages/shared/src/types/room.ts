/**
 * Room Types
 *
 * Room configuration and state types.
 */

import type { RoomPlayer, AIRoomPlayer } from './player.js';

/** 6-character alphanumeric room code (no ambiguous chars: 0,O,1,I,L) */
export type RoomCode = string;

/** Room status progression */
export type RoomState = 'waiting' | 'starting' | 'playing' | 'completed' | 'abandoned';

/**
 * Room configuration options
 */
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

/**
 * Default room configuration
 */
export const DEFAULT_ROOM_CONFIG: RoomConfig = {
	isPublic: false,
	allowSpectators: false,
	turnTimeoutSeconds: 60,
	maxPlayers: 2,
};

/**
 * Game room
 */
export interface GameRoom {
	/** Room code (6-char alphanumeric) */
	code: RoomCode;
	/** Room configuration */
	config: RoomConfig;
	/** Current room state */
	state: RoomState;
	/** Connected players */
	players: RoomPlayer[];
	/** AI players in the room */
	aiPlayers?: AIRoomPlayer[];
	/** Host player ID */
	hostId: string;
	/** When the room was created */
	createdAt: string;
	/** When the game started (if playing) */
	startedAt: string | null;
}

// =============================================================================
// Room Constants
// =============================================================================

/** Room cleanup timeout in milliseconds (5 minutes) */
export const ROOM_CLEANUP_MS = 5 * 60 * 1000;

/** Characters allowed in room codes (no ambiguous: 0,O,1,I,L) */
export const ROOM_CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/** Room code length */
export const ROOM_CODE_LENGTH = 6;
