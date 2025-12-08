/**
 * Cloudflare Durable Objects Type Definitions
 *
 * Environment bindings, connection state, and room configuration
 * for the GameRoom Durable Object.
 */

// =============================================================================
// Environment Bindings
// =============================================================================

/**
 * Cloudflare Worker environment bindings.
 * Defined in wrangler.toml, populated at runtime.
 */
export interface Env {
	/** GameRoom Durable Object namespace binding (per-room instances) */
	GAME_ROOM: DurableObjectNamespace;

	/** GlobalLobby Durable Object namespace binding (singleton) */
	GLOBAL_LOBBY: DurableObjectNamespace;

	/** Supabase project URL for JWT verification */
	SUPABASE_URL: string;

	/** Supabase anonymous key (for JWKS endpoint access) */
	SUPABASE_ANON_KEY: string;

	/** Current environment (development, staging, production) */
	ENVIRONMENT: 'development' | 'staging' | 'production';
}

// =============================================================================
// Connection State (survives hibernation)
// =============================================================================

/**
 * State stored in each WebSocket connection via serializeAttachment.
 * This data survives hibernation - when the DO wakes up, it can
 * recover this state via ws.deserializeAttachment().
 *
 * Keep this under ~2KB to stay within Cloudflare's attachment limits.
 */
export interface ConnectionState {
	/** User ID from verified JWT (Supabase auth.users.id) */
	userId: string;

	/** User's display name from profile */
	displayName: string;

	/** Avatar seed for DiceBear generation */
	avatarSeed: string;

	/** Timestamp when connected (epoch ms) */
	connectedAt: number;

	/** Whether this connection is the room host */
	isHost: boolean;
}

// =============================================================================
// Room State (persisted to storage)
// =============================================================================

/**
 * Room status progression:
 * waiting → starting → playing → completed
 *                  ↘ abandoned (if all players disconnect)
 */
export type RoomStatus = 'waiting' | 'starting' | 'playing' | 'completed' | 'abandoned';

/**
 * Room configuration options
 */
export interface RoomSettings {
	/** Maximum players (2-4) */
	maxPlayers: 2 | 3 | 4;

	/** Turn timeout in seconds (0 = unlimited) */
	turnTimeoutSeconds: number;

	/** Whether room is listed in public lobby */
	isPublic: boolean;

	/** Allow spectators to watch */
	allowSpectators: boolean;
}

/**
 * Default room configuration
 */
export const DEFAULT_ROOM_SETTINGS: RoomSettings = {
	maxPlayers: 2,
	turnTimeoutSeconds: 60,
	isPublic: false,
	allowSpectators: false,
};

/**
 * Room state persisted to Durable Object storage.
 * Retrieved via ctx.storage.get<RoomState>('room')
 */
export interface RoomState {
	/** Room code (6 uppercase alphanumeric) */
	roomCode: string;

	/** User ID of the room host */
	hostUserId: string;

	/** Creation timestamp (epoch ms) */
	createdAt: number;

	/** Room settings */
	settings: RoomSettings;

	/** Player user IDs in turn order (shuffled at game start) */
	playerOrder: string[];

	/** Current room status */
	status: RoomStatus;

	/** When game started (epoch ms, null if not started) */
	startedAt: number | null;
}

/**
 * Create initial room state for a new room
 */
export function createInitialRoomState(roomCode: string, hostUserId: string, settings?: Partial<RoomSettings>): RoomState {
	return {
		roomCode,
		hostUserId,
		createdAt: Date.now(),
		settings: { ...DEFAULT_ROOM_SETTINGS, ...settings },
		playerOrder: [hostUserId],
		status: 'waiting',
		startedAt: null,
	};
}

// =============================================================================
// Player Info (for broadcast messages)
// =============================================================================

/**
 * Player information sent to clients
 */
export interface PlayerInfo {
	userId: string;
	displayName: string;
	avatarSeed: string;
	isHost: boolean;
	isConnected: boolean;
}

// =============================================================================
// Alarm Data (for scheduled events)
// =============================================================================

/**
 * Types of alarms that can be scheduled
 */
export type AlarmType = 'TURN_TIMEOUT' | 'AFK_CHECK' | 'ROOM_CLEANUP';

/**
 * Data stored with scheduled alarms
 */
export interface AlarmData {
	type: AlarmType;
	userId?: string;
	metadata?: Record<string, unknown>;
}

// =============================================================================
// Re-export game types (will be populated in do-4)
// =============================================================================

// Game types will be added in Phase 4 (do-4.1)
// export * from './game/types';
