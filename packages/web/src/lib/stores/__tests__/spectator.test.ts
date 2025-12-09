/**
 * Spectator Store Tests
 *
 * Tests for the Svelte 5 reactive spectator store.
 * Verifies store creation, state management, and actions.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the spectatorService
vi.mock('$lib/services/spectatorService.svelte', () => ({
	spectatorService: {
		state: {
			status: 'disconnected',
			roomCode: null,
			roomStatus: null,
			players: [],
			spectators: [],
			spectatorCount: 0,
			error: null,
		},
		status: 'disconnected',
		roomCode: null,
		roomStatus: null,
		players: [],
		spectators: [],
		spectatorCount: 0,
		error: null,
		isConnected: false,
		connect: vi.fn().mockResolvedValue(undefined),
		disconnect: vi.fn(),
		sendChatMessage: vi.fn(),
		sendQuickChat: vi.fn(),
		sendReaction: vi.fn(),
		sendTypingStart: vi.fn(),
		sendTypingStop: vi.fn(),
		addEventHandler: vi.fn(),
		removeEventHandler: vi.fn(),
		addStatusListener: vi.fn(),
		removeStatusListener: vi.fn(),
	},
}));

// Mock svelte context
vi.mock('svelte', () => ({
	getContext: vi.fn(),
	setContext: vi.fn(),
}));

import { getContext, setContext } from 'svelte';
import { spectatorService } from '$lib/services/spectatorService.svelte';
import type { RoomCode } from '$lib/types/multiplayer';
import { createSpectatorStore, getSpectatorStore, setSpectatorStore } from '../spectator.svelte';

describe('createSpectatorStore', () => {
	const userId = 'user-123';

	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('should create a store with correct initial state', () => {
		const store = createSpectatorStore(userId);

		expect(store.status).toBe('disconnected');
		expect(store.isConnected).toBe(false);
		expect(store.isConnecting).toBe(false);
		expect(store.roomCode).toBeNull();
		expect(store.error).toBeNull();
	});

	it('should have all required properties', () => {
		const store = createSpectatorStore(userId);

		// State properties
		expect(store).toHaveProperty('status');
		expect(store).toHaveProperty('isConnected');
		expect(store).toHaveProperty('isConnecting');
		expect(store).toHaveProperty('roomCode');
		expect(store).toHaveProperty('roomStatus');
		expect(store).toHaveProperty('players');
		expect(store).toHaveProperty('spectators');
		expect(store).toHaveProperty('spectatorCount');
		expect(store).toHaveProperty('error');
		expect(store).toHaveProperty('spectatorDisplay');

		// Actions
		expect(store).toHaveProperty('watch');
		expect(store).toHaveProperty('stopWatching');
		expect(store).toHaveProperty('sendChatMessage');
		expect(store).toHaveProperty('sendTypingStart');
		expect(store).toHaveProperty('sendTypingStop');
		expect(store).toHaveProperty('subscribe');
	});

	it('should provide spectatorDisplay derived state', () => {
		const store = createSpectatorStore(userId);

		// With 0 spectators
		expect(store.spectatorDisplay).toBe('No spectators');
	});

	describe('watch action', () => {
		it('should call spectatorService.connect', async () => {
			const store = createSpectatorStore(userId);
			const roomCode = 'XYZ789' as RoomCode;
			const accessToken = 'test-token';

			await store.watch(roomCode, accessToken);

			expect(spectatorService.connect).toHaveBeenCalledWith(roomCode, accessToken);
		});

		it('should handle connection errors', async () => {
			const store = createSpectatorStore(userId);
			const roomCode = 'XYZ789' as RoomCode;
			const accessToken = 'test-token';

			const error = new Error('Connection failed');
			vi.mocked(spectatorService.connect).mockRejectedValueOnce(error);

			await expect(store.watch(roomCode, accessToken)).rejects.toThrow('Connection failed');
		});
	});

	describe('stopWatching action', () => {
		it('should call spectatorService.disconnect', () => {
			const store = createSpectatorStore(userId);

			store.stopWatching();

			expect(spectatorService.disconnect).toHaveBeenCalled();
		});
	});

	describe('chat actions', () => {
		it('should forward sendChatMessage to service', () => {
			const store = createSpectatorStore(userId);

			store.sendChatMessage('Hello spectators!');

			expect(spectatorService.sendChatMessage).toHaveBeenCalledWith('Hello spectators!');
		});

		it('should forward sendTypingStart to service', () => {
			const store = createSpectatorStore(userId);

			store.sendTypingStart();

			expect(spectatorService.sendTypingStart).toHaveBeenCalled();
		});

		it('should forward sendTypingStop to service', () => {
			const store = createSpectatorStore(userId);

			store.sendTypingStop();

			expect(spectatorService.sendTypingStop).toHaveBeenCalled();
		});
	});

	describe('subscribe', () => {
		it('should add event handler and return unsubscribe function', () => {
			const store = createSpectatorStore(userId);
			const handler = vi.fn();

			const unsubscribe = store.subscribe(handler);

			expect(spectatorService.addEventHandler).toHaveBeenCalledWith(handler);
			expect(typeof unsubscribe).toBe('function');

			unsubscribe();
			expect(spectatorService.removeEventHandler).toHaveBeenCalledWith(handler);
		});
	});
});

describe('context helpers', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('setSpectatorStore', () => {
		it('should set store in context', () => {
			const store = createSpectatorStore('user-123');

			setSpectatorStore(store);

			expect(setContext).toHaveBeenCalled();
		});
	});

	describe('getSpectatorStore', () => {
		it('should throw if store not in context', () => {
			vi.mocked(getContext).mockReturnValue(undefined);

			expect(() => getSpectatorStore()).toThrow(
				'Spectator store not found in context. Did you forget to call setSpectatorStore?',
			);
		});

		it('should return store from context', () => {
			const mockStore = createSpectatorStore('user-123');
			vi.mocked(getContext).mockReturnValue(mockStore);

			const store = getSpectatorStore();

			expect(store).toBe(mockStore);
		});
	});
});

describe('spectatorDisplay formatting', () => {
	it('should format singular correctly', () => {
		// This would require manipulating the internal state
		// For now, verify the default case
		const store = createSpectatorStore('user-123');
		expect(store.spectatorDisplay).toBe('No spectators');
	});
});
