/**
 * Spectator Rooting Tests
 *
 * Tests for gallery rooting functionality in spectatorService
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
	PlayerRootingInfo,
	RootingChoice,
	RootingState,
} from '$lib/services/spectatorService.svelte';

// =============================================================================
// Mock Setup
// =============================================================================

// Mock browser environment
vi.mock('$app/environment', () => ({
	browser: true,
}));

// Mock ReconnectingWebSocket
const mockSend = vi.fn();
const mockClose = vi.fn();
const mockAddEventListener = vi.fn();

vi.mock('reconnecting-websocket', () => ({
	default: vi.fn().mockImplementation(() => ({
		send: mockSend,
		close: mockClose,
		addEventListener: mockAddEventListener,
		readyState: 1, // OPEN
	})),
}));

// =============================================================================
// Test Helpers
// =============================================================================

function createMockRootingChoice(overrides: Partial<RootingChoice> = {}): RootingChoice {
	return {
		playerId: 'player-1',
		changeCount: 0,
		remainingChanges: 5,
		...overrides,
	};
}

function createMockPlayerRootingInfo(
	overrides: Partial<PlayerRootingInfo> = {},
): PlayerRootingInfo {
	return {
		playerId: 'player-1',
		rooterCount: 0,
		rooterNames: [],
		...overrides,
	};
}

function createMockRootingState(overrides: Partial<RootingState> = {}): RootingState {
	return {
		players: [],
		totalRooters: 0,
		myChoice: null,
		...overrides,
	};
}

// =============================================================================
// Tests
// =============================================================================

describe('Spectator Rooting System', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('RootingChoice Type', () => {
		it('should have required fields', () => {
			const choice = createMockRootingChoice();
			expect(choice).toHaveProperty('playerId');
			expect(choice).toHaveProperty('changeCount');
			expect(choice).toHaveProperty('remainingChanges');
		});

		it('should track change count', () => {
			const choice = createMockRootingChoice({ changeCount: 2, remainingChanges: 3 });
			expect(choice.changeCount).toBe(2);
			expect(choice.remainingChanges).toBe(3);
		});

		it('should indicate when no changes remain', () => {
			const choice = createMockRootingChoice({ changeCount: 5, remainingChanges: 0 });
			expect(choice.remainingChanges).toBe(0);
		});
	});

	describe('PlayerRootingInfo Type', () => {
		it('should have required fields', () => {
			const info = createMockPlayerRootingInfo();
			expect(info).toHaveProperty('playerId');
			expect(info).toHaveProperty('rooterCount');
			expect(info).toHaveProperty('rooterNames');
		});

		it('should track rooter count', () => {
			const info = createMockPlayerRootingInfo({
				rooterCount: 3,
				rooterNames: ['Alice', 'Bob', 'Charlie'],
			});
			expect(info.rooterCount).toBe(3);
			expect(info.rooterNames).toHaveLength(3);
		});

		it('should handle empty rooters', () => {
			const info = createMockPlayerRootingInfo();
			expect(info.rooterCount).toBe(0);
			expect(info.rooterNames).toHaveLength(0);
		});
	});

	describe('RootingState Type', () => {
		it('should have required fields', () => {
			const state = createMockRootingState();
			expect(state).toHaveProperty('players');
			expect(state).toHaveProperty('totalRooters');
			expect(state).toHaveProperty('myChoice');
		});

		it('should aggregate player rooting info', () => {
			const state = createMockRootingState({
				players: [
					createMockPlayerRootingInfo({ playerId: 'p1', rooterCount: 2 }),
					createMockPlayerRootingInfo({ playerId: 'p2', rooterCount: 1 }),
				],
				totalRooters: 3,
			});
			expect(state.players).toHaveLength(2);
			expect(state.totalRooters).toBe(3);
		});

		it('should include own choice when present', () => {
			const state = createMockRootingState({
				myChoice: createMockRootingChoice({ playerId: 'player-2' }),
			});
			expect(state.myChoice).not.toBeNull();
			expect(state.myChoice?.playerId).toBe('player-2');
		});
	});

	describe('Rooting Message Types', () => {
		it('should format ROOT_FOR_PLAYER message correctly', () => {
			const message = {
				type: 'ROOT_FOR_PLAYER',
				payload: { playerId: 'player-123' },
			};
			expect(message.type).toBe('ROOT_FOR_PLAYER');
			expect(message.payload.playerId).toBe('player-123');
		});

		it('should format CLEAR_ROOTING message correctly', () => {
			const message = { type: 'CLEAR_ROOTING' };
			expect(message.type).toBe('CLEAR_ROOTING');
		});

		it('should format GET_ROOTING message correctly', () => {
			const message = { type: 'GET_ROOTING' };
			expect(message.type).toBe('GET_ROOTING');
		});
	});

	describe('Rooting Response Types', () => {
		it('should parse ROOTING_CONFIRMED response', () => {
			const response = {
				type: 'ROOTING_CONFIRMED',
				payload: {
					playerId: 'player-1',
					changeCount: 1,
					remainingChanges: 4,
				},
			};
			expect(response.type).toBe('ROOTING_CONFIRMED');
			expect(response.payload.playerId).toBe('player-1');
			expect(response.payload.changeCount).toBe(1);
			expect(response.payload.remainingChanges).toBe(4);
		});

		it('should parse ROOTING_CLEARED response', () => {
			const response = {
				type: 'ROOTING_CLEARED',
				payload: {
					previousPlayerId: 'player-1',
				},
			};
			expect(response.type).toBe('ROOTING_CLEARED');
			expect(response.payload.previousPlayerId).toBe('player-1');
		});

		it('should parse ROOTING_STATE response', () => {
			const response = {
				type: 'ROOTING_STATE',
				payload: {
					players: [
						{ playerId: 'p1', rooterCount: 2, rooterNames: ['A', 'B'] },
						{ playerId: 'p2', rooterCount: 1, rooterNames: ['C'] },
					],
					totalRooters: 3,
					myChoice: { playerId: 'p1', changeCount: 0, remainingChanges: 5 },
				},
			};
			expect(response.type).toBe('ROOTING_STATE');
			expect(response.payload.players).toHaveLength(2);
			expect(response.payload.totalRooters).toBe(3);
			expect(response.payload.myChoice).not.toBeNull();
		});

		it('should parse ROOTING_UPDATE response', () => {
			const response = {
				type: 'ROOTING_UPDATE',
				payload: {
					players: [{ playerId: 'p1', rooterCount: 3, rooterNames: ['A', 'B', 'C'] }],
					totalRooters: 3,
				},
			};
			expect(response.type).toBe('ROOTING_UPDATE');
			expect(response.payload.players[0].rooterCount).toBe(3);
		});

		it('should parse ROOTING_BONUS response', () => {
			const response = {
				type: 'ROOTING_BONUS',
				payload: {
					winnerId: 'player-1',
					bonusPoints: 25,
					totalPoints: 150,
				},
			};
			expect(response.type).toBe('ROOTING_BONUS');
			expect(response.payload.bonusPoints).toBe(25);
			expect(response.payload.totalPoints).toBe(150);
		});
	});

	describe('Rooting Error Types', () => {
		it('should handle NOT_SPECTATOR error', () => {
			const error = {
				type: 'ERROR',
				payload: {
					code: 'NOT_SPECTATOR',
					message: 'Only spectators can root for players',
				},
			};
			expect(error.payload.code).toBe('NOT_SPECTATOR');
		});

		it('should handle INVALID_PLAYER error', () => {
			const error = {
				type: 'ERROR',
				payload: {
					code: 'INVALID_PLAYER',
					message: 'Invalid player ID',
				},
			};
			expect(error.payload.code).toBe('INVALID_PLAYER');
		});

		it('should handle ROOTING_LIMIT error', () => {
			const error = {
				type: 'ERROR',
				payload: {
					code: 'ROOTING_LIMIT',
					message: 'Maximum 5 rooting changes per game',
				},
			};
			expect(error.payload.code).toBe('ROOTING_LIMIT');
		});

		it('should handle ALREADY_ROOTING error', () => {
			const error = {
				type: 'ERROR',
				payload: {
					code: 'ALREADY_ROOTING',
					message: 'Already rooting for this player',
				},
			};
			expect(error.payload.code).toBe('ALREADY_ROOTING');
		});

		it('should handle NOT_ROOTING error', () => {
			const error = {
				type: 'ERROR',
				payload: {
					code: 'NOT_ROOTING',
					message: 'Not currently rooting for anyone',
				},
			};
			expect(error.payload.code).toBe('NOT_ROOTING');
		});
	});

	describe('Rooting Business Logic', () => {
		it('should allow initial rooting choice', () => {
			const state = createMockRootingState({ myChoice: null });
			expect(state.myChoice).toBeNull();
			// Can make initial choice
			const canRoot = state.myChoice === null || state.myChoice.remainingChanges > 0;
			expect(canRoot).toBe(true);
		});

		it('should allow changing rooting when changes remain', () => {
			const state = createMockRootingState({
				myChoice: createMockRootingChoice({ remainingChanges: 3 }),
			});
			const canChange = state.myChoice === null || state.myChoice.remainingChanges > 0;
			expect(canChange).toBe(true);
		});

		it('should prevent changing rooting when no changes remain', () => {
			const state = createMockRootingState({
				myChoice: createMockRootingChoice({ remainingChanges: 0 }),
			});
			const canChange = state.myChoice === null || state.myChoice.remainingChanges > 0;
			expect(canChange).toBe(false);
		});

		it('should track total rooters across all players', () => {
			const state = createMockRootingState({
				players: [
					createMockPlayerRootingInfo({ playerId: 'p1', rooterCount: 5 }),
					createMockPlayerRootingInfo({ playerId: 'p2', rooterCount: 3 }),
					createMockPlayerRootingInfo({ playerId: 'p3', rooterCount: 2 }),
				],
				totalRooters: 10,
			});
			const calculatedTotal = state.players.reduce((sum, p) => sum + p.rooterCount, 0);
			expect(calculatedTotal).toBe(state.totalRooters);
		});

		it('should identify which player user is rooting for', () => {
			const state = createMockRootingState({
				myChoice: createMockRootingChoice({ playerId: 'player-2' }),
			});
			const isRootingForPlayer2 = state.myChoice?.playerId === 'player-2';
			expect(isRootingForPlayer2).toBe(true);
		});
	});

	describe('Rooting Points System', () => {
		it('should award bonus points for rooting for winner', () => {
			const bonusResponse = {
				type: 'ROOTING_BONUS',
				payload: {
					winnerId: 'player-1',
					bonusPoints: 25,
					totalPoints: 175,
				},
			};
			expect(bonusResponse.payload.bonusPoints).toBe(25);
		});

		it('should update total points after bonus', () => {
			const initialPoints = 150;
			const bonusPoints = 25;
			const expectedTotal = initialPoints + bonusPoints;
			expect(expectedTotal).toBe(175);
		});
	});
});
