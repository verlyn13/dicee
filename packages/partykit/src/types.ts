/**
 * PartyKit Server Types
 *
 * Server-side type extensions for the game room.
 */

// =============================================================================
// Connection State
// =============================================================================

/**
 * State stored in each WebSocket connection
 */
export interface ConnectionState {
	/** User ID from verified JWT */
	userId: string;
	/** User email (if available) */
	email?: string;
	/** Display name */
	displayName: string;
	/** Avatar seed for DiceBear */
	avatarSeed: string;
	/** Timestamp when connected */
	connectedAt: string;
}

// =============================================================================
// Room State
// =============================================================================

/**
 * Room status
 */
export type RoomStatus = 'waiting' | 'starting' | 'playing' | 'completed' | 'abandoned';

/**
 * Player in a room
 */
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
	/** Connection ID (for sending messages) */
	connectionId?: string;
	/** When player joined the room */
	joinedAt: string;
}

/**
 * Room configuration
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
 * Full room state stored in PartyKit durable storage
 */
export interface RoomState {
	/** Room code (also the room ID) */
	code: string;
	/** Room configuration */
	config: RoomConfig;
	/** Current room status */
	status: RoomStatus;
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
// Default Values
// =============================================================================

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
 * Create initial room state
 */
export function createInitialRoomState(code: string, hostId: string, config?: Partial<RoomConfig>): RoomState {
	return {
		code,
		config: { ...DEFAULT_ROOM_CONFIG, ...config },
		status: 'waiting',
		players: [],
		hostId,
		createdAt: new Date().toISOString(),
		startedAt: null,
	};
}
