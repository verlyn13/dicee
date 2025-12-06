/**
 * Multiplayer Game Store Tests
 *
 * Tests for the multiplayer game state management.
 * Focuses on store initialization, derived states, and reset functionality.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMultiplayerGameStore } from '../multiplayerGame.svelte';

// Mock roomService
vi.mock('$lib/services/roomService.svelte', () => ({
	roomService: {
		send: vi.fn(),
		addEventHandler: vi.fn(),
		removeEventHandler: vi.fn(),
	},
}));

describe('MultiplayerGameStore', () => {
	let store: ReturnType<typeof createMultiplayerGameStore>;
	const myPlayerId = 'player1';

	beforeEach(() => {
		vi.clearAllMocks();
		store = createMultiplayerGameStore(myPlayerId);
	});

	describe('initial state', () => {
		it('starts with null game state', () => {
			expect(store.gameState).toBeNull();
		});

		it('starts with IDLE ui phase', () => {
			expect(store.uiPhase).toBe('IDLE');
		});

		it('starts with no error', () => {
			expect(store.error).toBeNull();
		});

		it('starts with no AFK warning', () => {
			expect(store.afkWarning).toBeNull();
		});

		it('starts with pending false', () => {
			expect(store.pending).toBe(false);
		});
	});

	describe('derived states without game', () => {
		it('isMyTurn is false without game state', () => {
			expect(store.isMyTurn).toBe(false);
		});

		it('canRoll is false without game state', () => {
			expect(store.canRoll).toBe(false);
		});

		it('canKeep is false without game state', () => {
			expect(store.canKeep).toBe(false);
		});

		it('canScore is false without game state', () => {
			expect(store.canScore).toBe(false);
		});

		it('currentDice is null without game state', () => {
			expect(store.currentDice).toBeNull();
		});

		it('myPlayer is null without game state', () => {
			expect(store.myPlayer).toBeNull();
		});

		it('opponents is empty without game state', () => {
			expect(store.opponents).toEqual([]);
		});

		it('isGameOver is false without game state', () => {
			expect(store.isGameOver).toBe(false);
		});

		it('rankings is null without game state', () => {
			expect(store.rankings).toBeNull();
		});

		it('phase is waiting without game state', () => {
			expect(store.phase).toBe('waiting');
		});
	});

	describe('subscription', () => {
		it('subscribe returns an unsubscribe function', () => {
			const unsubscribe = store.subscribe();
			expect(typeof unsubscribe).toBe('function');
			unsubscribe();
		});

		it('subscribe registers event handler with roomService', async () => {
			const { roomService } = await import('$lib/services/roomService.svelte');

			store.subscribe();

			expect(roomService.addEventHandler).toHaveBeenCalledTimes(1);
			expect(roomService.addEventHandler).toHaveBeenCalledWith(expect.any(Function));
		});

		it('unsubscribe removes event handler from roomService', async () => {
			const { roomService } = await import('$lib/services/roomService.svelte');

			const unsubscribe = store.subscribe();
			unsubscribe();

			expect(roomService.removeEventHandler).toHaveBeenCalledTimes(1);
		});
	});

	describe('commands without valid state', () => {
		it('rollDice does not send when canRoll is false', async () => {
			const { roomService } = await import('$lib/services/roomService.svelte');

			store.rollDice();

			expect(roomService.send).not.toHaveBeenCalled();
		});

		it('toggleKeep does not send when canKeep is false', async () => {
			const { roomService } = await import('$lib/services/roomService.svelte');

			store.toggleKeep(0);

			expect(roomService.send).not.toHaveBeenCalled();
		});

		it('scoreCategory does not send when canScore is false', async () => {
			const { roomService } = await import('$lib/services/roomService.svelte');

			store.scoreCategory('ones');

			expect(roomService.send).not.toHaveBeenCalled();
		});
	});

	describe('reset', () => {
		it('reset clears game state', () => {
			store.reset();
			expect(store.gameState).toBeNull();
		});

		it('reset sets uiPhase to IDLE', () => {
			store.reset();
			expect(store.uiPhase).toBe('IDLE');
		});

		it('reset clears error', () => {
			store.reset();
			expect(store.error).toBeNull();
		});

		it('reset clears afkWarning', () => {
			store.reset();
			expect(store.afkWarning).toBeNull();
		});

		it('reset sets pending to false', () => {
			store.reset();
			expect(store.pending).toBe(false);
		});
	});
});

describe('MultiplayerGameStore with multiple players', () => {
	it('creates stores with different player IDs', () => {
		const store1 = createMultiplayerGameStore('player1');
		const store2 = createMultiplayerGameStore('player2');

		// Both should start with same initial state
		expect(store1.gameState).toBeNull();
		expect(store2.gameState).toBeNull();
		expect(store1.uiPhase).toBe('IDLE');
		expect(store2.uiPhase).toBe('IDLE');
	});
});
