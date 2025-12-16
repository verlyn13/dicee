/**
 * RoomDirectory Tests
 *
 * Tests for the storage-first room directory abstraction.
 * Verifies hibernation safety, lazy loading, and persistence semantics.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoomDirectory, type RoomDirectory, type RoomInfo } from '../room-directory';

// =============================================================================
// Test Fixtures
// =============================================================================

const NOW = 1700000000000; // Fixed timestamp for deterministic tests

function createTestRoom(code: string, overrides: Partial<RoomInfo> = {}): RoomInfo {
	return {
		code,
		game: 'dicee',
		hostId: 'host-123',
		hostName: 'TestHost',
		playerCount: 1,
		spectatorCount: 0,
		maxPlayers: 2,
		isPublic: true,
		allowSpectators: false,
		status: 'waiting',
		roundNumber: 0,
		totalRounds: 13,
		players: [],
		createdAt: NOW,
		updatedAt: NOW,
		...overrides,
	};
}

// =============================================================================
// Mock Storage
// =============================================================================

interface MockStorage {
	data: Map<string, unknown>;
	get: ReturnType<typeof vi.fn>;
	put: ReturnType<typeof vi.fn>;
}

function createMockStorage(): MockStorage {
	const data = new Map<string, unknown>();
	return {
		data,
		get: vi.fn((key: string) => Promise.resolve(data.get(key))),
		put: vi.fn((key: string, value: unknown) => {
			data.set(key, value);
			return Promise.resolve();
		}),
	};
}

// =============================================================================
// Tests
// =============================================================================

describe('RoomDirectory', () => {
	let mockStorage: MockStorage;
	let directory: RoomDirectory;

	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(NOW);
		mockStorage = createMockStorage();
		directory = createRoomDirectory(mockStorage as unknown as DurableObjectStorage);
	});

	// ---------------------------------------------------------------------------
	// Initialization
	// ---------------------------------------------------------------------------

	describe('initialization', () => {
		it('should start with empty rooms when storage is empty', async () => {
			const rooms = await directory.getAll();
			expect(rooms).toEqual([]);
			expect(await directory.size()).toBe(0);
		});

		it('should load existing rooms from storage', async () => {
			mockStorage.data.set('lobby:activeRooms', [
				['ABC123', createTestRoom('ABC123')],
				['DEF456', createTestRoom('DEF456')],
			]);

			const rooms = await directory.getAll();
			expect(rooms).toHaveLength(2);
			expect(rooms.map((r) => r.code)).toContain('ABC123');
			expect(rooms.map((r) => r.code)).toContain('DEF456');
		});

		it('should lazy load - not call storage until first access', async () => {
			// No access yet
			expect(mockStorage.get).not.toHaveBeenCalled();

			// First access triggers load
			await directory.getAll();
			expect(mockStorage.get).toHaveBeenCalledWith('lobby:activeRooms');
		});
	});

	// ---------------------------------------------------------------------------
	// Storage-First Semantics (Critical for Hibernation Safety)
	// ---------------------------------------------------------------------------

	describe('storage-first semantics', () => {
		it('should persist room on upsert BEFORE returning', async () => {
			const room = createTestRoom('ABC123');
			const result = await directory.upsert(room);

			expect(result.success).toBe(true);
			expect(mockStorage.put).toHaveBeenCalledWith('lobby:activeRooms', expect.any(Array));

			// Verify the data was actually persisted
			const stored = mockStorage.data.get('lobby:activeRooms') as [string, RoomInfo][];
			expect(stored).toBeDefined();
			expect(stored.find(([code]) => code === 'ABC123')).toBeDefined();
		});

		it('should persist on remove', async () => {
			// First add a room
			await directory.upsert(createTestRoom('ABC123'));
			mockStorage.put.mockClear();

			// Then remove it
			await directory.remove('ABC123');

			expect(mockStorage.put).toHaveBeenCalled();
			const stored = mockStorage.data.get('lobby:activeRooms') as [string, RoomInfo][];
			expect(stored.find(([code]) => code === 'ABC123')).toBeUndefined();
		});

		it('should not persist on remove if room does not exist', async () => {
			await directory.remove('NONEXISTENT');
			// Only the initial load, no put
			expect(mockStorage.put).not.toHaveBeenCalled();
		});
	});

	// ---------------------------------------------------------------------------
	// CRUD Operations
	// ---------------------------------------------------------------------------

	describe('upsert', () => {
		it('should add a new room', async () => {
			const result = await directory.upsert(createTestRoom('ABC123'));

			expect(result.success).toBe(true);
			const room = await directory.get('ABC123');
			expect(room).toBeDefined();
			expect(room?.code).toBe('ABC123');
		});

		it('should update an existing room', async () => {
			await directory.upsert(createTestRoom('ABC123', { playerCount: 1 }));
			await directory.upsert(createTestRoom('ABC123', { playerCount: 2 }));

			const room = await directory.get('ABC123');
			expect(room?.playerCount).toBe(2);
		});

		it('should preserve createdAt on update', async () => {
			const originalCreatedAt = NOW - 10000;
			await directory.upsert(createTestRoom('ABC123', { createdAt: originalCreatedAt }));

			vi.setSystemTime(NOW + 5000);
			await directory.upsert(createTestRoom('ABC123', { playerCount: 2 }));

			const room = await directory.get('ABC123');
			expect(room?.createdAt).toBe(originalCreatedAt);
		});

		it('should update updatedAt on each upsert', async () => {
			await directory.upsert(createTestRoom('ABC123'));

			vi.setSystemTime(NOW + 5000);
			await directory.upsert(createTestRoom('ABC123', { playerCount: 2 }));

			const room = await directory.get('ABC123');
			expect(room?.updatedAt).toBe(NOW + 5000);
		});

		it('should reject room without code', async () => {
			const result = await directory.upsert({
				...createTestRoom('ABC123'),
				code: '',
			});

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error).toContain('code');
			}
		});
	});

	describe('get', () => {
		it('should return room when exists', async () => {
			await directory.upsert(createTestRoom('ABC123'));

			const room = await directory.get('ABC123');
			expect(room).toBeDefined();
			expect(room?.code).toBe('ABC123');
		});

		it('should return null when room does not exist', async () => {
			const room = await directory.get('NONEXISTENT');
			expect(room).toBeNull();
		});
	});

	describe('getAll', () => {
		it('should return all rooms', async () => {
			await directory.upsert(createTestRoom('ABC123'));
			await directory.upsert(createTestRoom('DEF456'));
			await directory.upsert(createTestRoom('GHI789'));

			const rooms = await directory.getAll();
			expect(rooms).toHaveLength(3);
		});
	});

	describe('getPublic', () => {
		it('should filter to only public rooms', async () => {
			await directory.upsert(createTestRoom('PUBLIC1', { isPublic: true }));
			await directory.upsert(createTestRoom('PRIVATE', { isPublic: false }));
			await directory.upsert(createTestRoom('PUBLIC2', { isPublic: true }));

			const publicRooms = await directory.getPublic();
			expect(publicRooms).toHaveLength(2);
			expect(publicRooms.every((r) => r.isPublic)).toBe(true);
		});

		it('should return empty array when no public rooms', async () => {
			await directory.upsert(createTestRoom('PRIVATE1', { isPublic: false }));
			await directory.upsert(createTestRoom('PRIVATE2', { isPublic: false }));

			const publicRooms = await directory.getPublic();
			expect(publicRooms).toHaveLength(0);
		});
	});

	describe('remove', () => {
		it('should remove an existing room', async () => {
			await directory.upsert(createTestRoom('ABC123'));
			await directory.remove('ABC123');

			const room = await directory.get('ABC123');
			expect(room).toBeNull();
		});

		it('should handle removing non-existent room gracefully', async () => {
			// Should not throw
			await expect(directory.remove('NONEXISTENT')).resolves.toBeUndefined();
		});
	});

	// ---------------------------------------------------------------------------
	// Cache Invalidation (Hibernation Recovery)
	// ---------------------------------------------------------------------------

	describe('cache invalidation', () => {
		it('should reload from storage after invalidateCache', async () => {
			// Add a room to cache
			await directory.upsert(createTestRoom('ABC123'));

			// Simulate external change (like another DO instance or admin tool)
			mockStorage.data.set('lobby:activeRooms', [['XYZ789', createTestRoom('XYZ789')]]);

			// Without invalidation, cache still has ABC123
			let rooms = await directory.getAll();
			expect(rooms[0].code).toBe('ABC123');

			// After invalidation, reloads from storage
			directory.invalidateCache();
			rooms = await directory.getAll();
			expect(rooms[0].code).toBe('XYZ789');
		});

		it('should trigger fresh load after invalidation', async () => {
			await directory.getAll();
			mockStorage.get.mockClear();

			// Cache is warm, no new load
			await directory.getAll();
			expect(mockStorage.get).not.toHaveBeenCalled();

			// Invalidate forces new load
			directory.invalidateCache();
			await directory.getAll();
			expect(mockStorage.get).toHaveBeenCalledWith('lobby:activeRooms');
		});
	});

	// ---------------------------------------------------------------------------
	// Size
	// ---------------------------------------------------------------------------

	describe('size', () => {
		it('should return 0 for empty directory', async () => {
			expect(await directory.size()).toBe(0);
		});

		it('should return correct count', async () => {
			await directory.upsert(createTestRoom('ABC123'));
			await directory.upsert(createTestRoom('DEF456'));

			expect(await directory.size()).toBe(2);
		});

		it('should update after remove', async () => {
			await directory.upsert(createTestRoom('ABC123'));
			await directory.upsert(createTestRoom('DEF456'));
			await directory.remove('ABC123');

			expect(await directory.size()).toBe(1);
		});
	});

	// ---------------------------------------------------------------------------
	// Edge Cases
	// ---------------------------------------------------------------------------

	describe('edge cases', () => {
		it('should handle room with all fields populated', async () => {
			const fullRoom: RoomInfo = {
				code: 'FULL01',
				game: 'dicee',
				hostId: 'host-full',
				hostName: 'Full Host',
				playerCount: 3,
				spectatorCount: 2,
				maxPlayers: 4,
				isPublic: true,
				allowSpectators: true,
				status: 'playing',
				roundNumber: 7,
				totalRounds: 13,
				players: [
					{ userId: 'p1', displayName: 'Player 1', avatarSeed: 's1', score: 150, isHost: true },
					{ userId: 'p2', displayName: 'Player 2', avatarSeed: 's2', score: 120, isHost: false },
					{ userId: 'p3', displayName: 'Player 3', avatarSeed: 's3', score: 90, isHost: false },
				],
				createdAt: NOW - 3600000,
				updatedAt: NOW,
			};

			const result = await directory.upsert(fullRoom);
			expect(result.success).toBe(true);

			const retrieved = await directory.get('FULL01');
			expect(retrieved).toEqual(
				expect.objectContaining({
					code: 'FULL01',
					playerCount: 3,
					spectatorCount: 2,
					status: 'playing',
					roundNumber: 7,
				}),
			);
			expect(retrieved?.players).toHaveLength(3);
		});

		it('should handle rapid sequential updates', async () => {
			// Simulate rapid updates (like many players joining quickly)
			await directory.upsert(createTestRoom('ABC123', { playerCount: 1 }));
			await directory.upsert(createTestRoom('ABC123', { playerCount: 2 }));
			await directory.upsert(createTestRoom('ABC123', { playerCount: 3 }));
			await directory.upsert(createTestRoom('ABC123', { playerCount: 4 }));

			const room = await directory.get('ABC123');
			expect(room?.playerCount).toBe(4);
			expect(await directory.size()).toBe(1);
		});
	});
});
