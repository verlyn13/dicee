/**
 * RoomDirectory - Hibernation-Safe Room Management
 *
 * Storage-first pattern: persist BEFORE broadcast.
 * Lazy loading: load from storage on first access.
 *
 * This module provides a RoomDirectory abstraction that survives Durable Object
 * hibernation by persisting room data to storage before any broadcasts.
 *
 * @example
 * ```typescript
 * const roomDirectory = createRoomDirectory(ctx.storage);
 *
 * // Upsert persists THEN you can safely broadcast
 * await roomDirectory.upsert(roomInfo);
 * this.broadcast({ type: 'room_update', room: roomInfo });
 *
 * // After hibernation wake, rooms are restored from storage
 * const rooms = await roomDirectory.getAll();
 * ```
 */

import { Loggers } from './logger';

const STORAGE_KEY = 'lobby:activeRooms';

/**
 * Room information displayed in the lobby browser.
 * Matches the existing RoomInfo interface from GlobalLobby.ts:76-92
 */
export interface RoomInfo {
	code: string;
	game: string;
	hostName: string;
	hostId: string;
	playerCount: number;
	spectatorCount: number;
	maxPlayers: number;
	isPublic: boolean;
	allowSpectators: boolean;
	status: 'waiting' | 'playing' | 'finished';
	roundNumber: number;
	totalRounds: number;
	players: Array<{
		userId: string;
		displayName: string;
		avatarSeed: string;
		score: number;
		isHost: boolean;
	}>;
	createdAt: number;
	updatedAt: number;
}

/**
 * RoomDirectory interface - storage-first room management
 */
export interface RoomDirectory {
	/** Get all rooms (loads from storage if needed) */
	getAll(): Promise<RoomInfo[]>;

	/** Get public rooms only (filtered) */
	getPublic(): Promise<RoomInfo[]>;

	/** Get a specific room by code */
	get(code: string): Promise<RoomInfo | null>;

	/** Upsert a room - persists to storage BEFORE returning */
	upsert(room: RoomInfo): Promise<{ success: true } | { success: false; error: string }>;

	/** Remove a room by code */
	remove(code: string): Promise<void>;

	/** Invalidate cache (forces reload from storage on next access) */
	invalidateCache(): void;

	/** Get the number of rooms (loads from storage if needed) */
	size(): Promise<number>;
}

/**
 * Create a RoomDirectory instance with storage-first semantics.
 *
 * The directory maintains an in-memory cache that is lazy-loaded from storage.
 * All mutations (upsert, remove) persist to storage BEFORE returning.
 *
 * @param storage - Durable Object storage instance
 * @returns RoomDirectory instance
 */
export function createRoomDirectory(storage: DurableObjectStorage): RoomDirectory {
	const logger = Loggers.GlobalLobby();

	// In-memory cache (null = not loaded yet)
	let rooms: Map<string, RoomInfo> | null = null;

	/**
	 * Load rooms from storage (lazy, called on first access)
	 */
	async function load(): Promise<Map<string, RoomInfo>> {
		if (rooms === null) {
			const stored = await storage.get<[string, RoomInfo][]>(STORAGE_KEY);
			rooms = new Map(stored ?? []);

			logger.info('Loaded rooms from storage', {
				operation: 'room_directory_load',
				roomCount: rooms.size,
			});
		}
		return rooms;
	}

	/**
	 * Persist rooms to storage
	 */
	async function persist(): Promise<void> {
		if (rooms === null) return;
		await storage.put(STORAGE_KEY, [...rooms.entries()]);
	}

	return {
		async getAll(): Promise<RoomInfo[]> {
			const map = await load();
			return Array.from(map.values());
		},

		async getPublic(): Promise<RoomInfo[]> {
			const all = await this.getAll();
			return all.filter((r) => r.isPublic);
		},

		async get(code: string): Promise<RoomInfo | null> {
			const map = await load();
			return map.get(code) ?? null;
		},

		async upsert(room: RoomInfo): Promise<{ success: true } | { success: false; error: string }> {
			// Validate required fields
			if (!room.code || typeof room.code !== 'string') {
				logger.warn('Invalid room data: missing code', {
					operation: 'room_directory_upsert',
				});
				return { success: false, error: 'Room code is required' };
			}

			const map = await load();
			const existing = map.get(room.code);

			// Preserve createdAt from existing room, set updatedAt to now
			const roomWithTimestamps: RoomInfo = {
				...room,
				createdAt: existing?.createdAt ?? room.createdAt ?? Date.now(),
				updatedAt: Date.now(),
			};

			map.set(room.code, roomWithTimestamps);

			// STORAGE-FIRST: Persist before returning
			await persist();

			logger.info('Upserted room', {
				operation: 'room_directory_upsert',
				roomCode: room.code,
				status: room.status,
				playerCount: room.playerCount,
			});

			return { success: true };
		},

		async remove(code: string): Promise<void> {
			const map = await load();
			const existed = map.delete(code);

			if (existed) {
				// STORAGE-FIRST: Persist before returning
				await persist();

				logger.info('Removed room', {
					operation: 'room_directory_remove',
					roomCode: code,
				});
			}
		},

		invalidateCache(): void {
			rooms = null;
			logger.debug('Cache invalidated', {
				operation: 'room_directory_invalidate',
			});
		},

		async size(): Promise<number> {
			const map = await load();
			return map.size;
		},
	};
}
