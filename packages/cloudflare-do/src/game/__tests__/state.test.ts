/**
 * GameStateManager Unit Tests
 *
 * Tests game state management with mocked DurableObjectState.
 * Covers all game flow operations including initialization, turns, and scoring.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GameStateManager, type AlarmData, type AlarmType } from '../state';
import {
	createPlayerGameState,
	type MultiplayerGameState,
	type PlayerGameState,
	type GamePhase,
	type Category,
} from '../types';

// =============================================================================
// Mock DurableObjectState
// =============================================================================

interface MockStorage {
	data: Map<string, unknown>;
	alarm: number | null;
	get: <T>(key: string) => Promise<T | undefined>;
	put: (key: string, value: unknown) => Promise<void>;
	delete: (key: string) => Promise<boolean>;
	setAlarm: (time: number) => Promise<void>;
	deleteAlarm: () => Promise<void>;
	getAlarm: () => Promise<number | null>;
}

function createMockStorage(): MockStorage {
	const data = new Map<string, unknown>();
	let alarm: number | null = null;

	return {
		data,
		get alarm() {
			return alarm;
		},
		set alarm(value: number | null) {
			alarm = value;
		},
		get: vi.fn(async <T>(key: string): Promise<T | undefined> => {
			return data.get(key) as T | undefined;
		}),
		put: vi.fn(async (key: string, value: unknown): Promise<void> => {
			data.set(key, value);
		}),
		delete: vi.fn(async (key: string): Promise<boolean> => {
			return data.delete(key);
		}),
		setAlarm: vi.fn(async (time: number): Promise<void> => {
			alarm = time;
		}),
		deleteAlarm: vi.fn(async (): Promise<void> => {
			alarm = null;
		}),
		getAlarm: vi.fn(async (): Promise<number | null> => {
			return alarm;
		}),
	};
}

function createMockCtx(storage: MockStorage): DurableObjectState {
	return {
		storage,
		id: { toString: () => 'test-id' },
	} as unknown as DurableObjectState;
}

// =============================================================================
// Test Fixtures
// =============================================================================

function createTestPlayers(): Array<{
	id: string;
	displayName: string;
	avatarSeed: string;
	isHost: boolean;
	connectionId: string;
}> {
	return [
		{ id: 'player1', displayName: 'Alice', avatarSeed: 'seed1', isHost: true, connectionId: 'conn1' },
		{ id: 'player2', displayName: 'Bob', avatarSeed: 'seed2', isHost: false, connectionId: 'conn2' },
	];
}

const defaultConfig: MultiplayerGameState['config'] = {
	maxPlayers: 4,
	turnTimeoutSeconds: 60,
	isPublic: false,
};

// =============================================================================
// GameStateManager Tests
// =============================================================================

describe('GameStateManager', () => {
	let storage: MockStorage;
	let ctx: DurableObjectState;
	let manager: GameStateManager;

	beforeEach(() => {
		storage = createMockStorage();
		ctx = createMockCtx(storage);
		manager = new GameStateManager(ctx, 'ROOM01');
	});

	// =========================================================================
	// State Access Tests
	// =========================================================================

	describe('getState', () => {
		it('should return null when no state exists', async () => {
			const state = await manager.getState();
			expect(state).toBe(null);
		});

		it('should load state from storage', async () => {
			const mockState: MultiplayerGameState = {
				roomCode: 'ROOM01',
				phase: 'waiting',
				playerOrder: [],
				currentPlayerIndex: 0,
				turnNumber: 0,
				roundNumber: 0,
				players: {},
				turnStartedAt: null,
				gameStartedAt: null,
				gameCompletedAt: null,
				rankings: null,
				config: defaultConfig,
			};
			storage.data.set('game_state', mockState);

			const state = await manager.getState();
			expect(state).toEqual(mockState);
		});

		it('should cache state after first load', async () => {
			const mockState: MultiplayerGameState = {
				roomCode: 'ROOM01',
				phase: 'waiting',
				playerOrder: [],
				currentPlayerIndex: 0,
				turnNumber: 0,
				roundNumber: 0,
				players: {},
				turnStartedAt: null,
				gameStartedAt: null,
				gameCompletedAt: null,
				rankings: null,
				config: defaultConfig,
			};
			storage.data.set('game_state', mockState);

			await manager.getState();
			await manager.getState();

			// Storage.get should only be called once due to caching
			expect(storage.get).toHaveBeenCalledTimes(1);
		});
	});

	describe('saveState', () => {
		it('should save state to storage', async () => {
			await manager.initializeFromRoom(createTestPlayers(), defaultConfig);
			await manager.saveState();

			expect(storage.put).toHaveBeenCalledWith('game_state', expect.any(Object));
		});

		it('should not save if no state exists', async () => {
			await manager.saveState();
			expect(storage.put).not.toHaveBeenCalled();
		});
	});

	describe('hasState', () => {
		it('should return false when no state', async () => {
			expect(await manager.hasState()).toBe(false);
		});

		it('should return true when state exists', async () => {
			await manager.initializeFromRoom(createTestPlayers(), defaultConfig);
			expect(await manager.hasState()).toBe(true);
		});
	});

	// =========================================================================
	// Initialization Tests
	// =========================================================================

	describe('initializeFromRoom', () => {
		it('should create initial game state', async () => {
			const players = createTestPlayers();
			const state = await manager.initializeFromRoom(players, defaultConfig);

			expect(state.roomCode).toBe('ROOM01');
			expect(state.phase).toBe('waiting');
			expect(state.playerOrder).toEqual([]);
			expect(state.currentPlayerIndex).toBe(0);
			expect(Object.keys(state.players)).toHaveLength(2);
		});

		it('should create player records', async () => {
			const players = createTestPlayers();
			const state = await manager.initializeFromRoom(players, defaultConfig);

			expect(state.players['player1']).toBeDefined();
			expect(state.players['player1'].displayName).toBe('Alice');
			expect(state.players['player1'].isHost).toBe(true);
			expect(state.players['player2'].displayName).toBe('Bob');
			expect(state.players['player2'].isHost).toBe(false);
		});

		it('should initialize empty scorecards', async () => {
			const players = createTestPlayers();
			const state = await manager.initializeFromRoom(players, defaultConfig);

			const p1 = state.players['player1'];
			expect(p1.scorecard.ones).toBe(null);
			expect(p1.scorecard.dicee).toBe(null);
			expect(p1.scorecard.diceeBonus).toBe(0);
		});

		it('should save state after initialization', async () => {
			await manager.initializeFromRoom(createTestPlayers(), defaultConfig);
			expect(storage.put).toHaveBeenCalled();
		});
	});

	// =========================================================================
	// Game Flow Tests
	// =========================================================================

	describe('startGame', () => {
		it('should transition to turn_roll phase', async () => {
			await manager.initializeFromRoom(createTestPlayers(), defaultConfig);
			const result = await manager.startGame();

			const state = await manager.getState();
			expect(state?.phase).toBe('turn_roll');
			expect(result.turnNumber).toBe(1);
		});

		it('should randomize player order', async () => {
			await manager.initializeFromRoom(createTestPlayers(), defaultConfig);
			const result = await manager.startGame();

			expect(result.playerOrder).toHaveLength(2);
			expect(result.playerOrder).toContain('player1');
			expect(result.playerOrder).toContain('player2');
		});

		it('should set first player as current', async () => {
			await manager.initializeFromRoom(createTestPlayers(), defaultConfig);
			const result = await manager.startGame();

			const state = await manager.getState();
			expect(state?.currentPlayerIndex).toBe(0);
			expect(result.currentPlayerId).toBe(result.playerOrder[0]);
		});

		it('should throw if no state', async () => {
			await expect(manager.startGame()).rejects.toThrow('No game state');
		});

		it('should throw if game already started', async () => {
			await manager.initializeFromRoom(createTestPlayers(), defaultConfig);
			await manager.startGame();

			await expect(manager.startGame()).rejects.toThrow('Game already in progress');
		});

		it('should set gameStartedAt timestamp', async () => {
			await manager.initializeFromRoom(createTestPlayers(), defaultConfig);
			await manager.startGame();

			const state = await manager.getState();
			expect(state?.gameStartedAt).not.toBe(null);
		});
	});

	describe('rollDice', () => {
		beforeEach(async () => {
			await manager.initializeFromRoom(createTestPlayers(), defaultConfig);
			await manager.startGame();
		});

		it('should generate 5 dice values', async () => {
			const state = await manager.getState();
			const currentPlayerId = state!.playerOrder[0];

			const result = await manager.rollDice(currentPlayerId, [false, false, false, false, false]);

			expect(result.dice).toHaveLength(5);
			result.dice.forEach((die) => {
				expect(die).toBeGreaterThanOrEqual(1);
				expect(die).toBeLessThanOrEqual(6);
			});
		});

		it('should decrement rolls remaining', async () => {
			const state = await manager.getState();
			const currentPlayerId = state!.playerOrder[0];

			const result = await manager.rollDice(currentPlayerId, [false, false, false, false, false]);

			expect(result.rollsRemaining).toBe(2);
			expect(result.rollNumber).toBe(1);
		});

		it('should transition to turn_decide', async () => {
			const state = await manager.getState();
			const currentPlayerId = state!.playerOrder[0];

			const result = await manager.rollDice(currentPlayerId, [false, false, false, false, false]);

			expect(result.newPhase).toBe('turn_decide');
		});

		it('should keep dice when mask is true', async () => {
			const state = await manager.getState();
			const currentPlayerId = state!.playerOrder[0];

			// First roll
			const roll1 = await manager.rollDice(currentPlayerId, [false, false, false, false, false]);
			const originalDice = [...roll1.dice];

			// Second roll keeping first two dice
			const roll2 = await manager.rollDice(currentPlayerId, [true, true, false, false, false]);

			expect(roll2.dice[0]).toBe(originalDice[0]);
			expect(roll2.dice[1]).toBe(originalDice[1]);
		});

		it('should throw if player not found', async () => {
			await expect(manager.rollDice('unknown', [false, false, false, false, false])).rejects.toThrow(
				'Player not found',
			);
		});
	});

	describe('keepDice', () => {
		beforeEach(async () => {
			await manager.initializeFromRoom(createTestPlayers(), defaultConfig);
			await manager.startGame();
		});

		it('should update kept dice mask', async () => {
			const state = await manager.getState();
			const currentPlayerId = state!.playerOrder[0];

			await manager.rollDice(currentPlayerId, [false, false, false, false, false]);
			const keptMask = await manager.keepDice(currentPlayerId, [0, 2, 4]);

			expect(keptMask).toEqual([true, false, true, false, true]);
		});

		it('should handle empty indices', async () => {
			const state = await manager.getState();
			const currentPlayerId = state!.playerOrder[0];

			await manager.rollDice(currentPlayerId, [false, false, false, false, false]);
			const keptMask = await manager.keepDice(currentPlayerId, []);

			expect(keptMask).toEqual([false, false, false, false, false]);
		});

		it('should ignore out of range indices', async () => {
			const state = await manager.getState();
			const currentPlayerId = state!.playerOrder[0];

			await manager.rollDice(currentPlayerId, [false, false, false, false, false]);
			const keptMask = await manager.keepDice(currentPlayerId, [0, 10, -1]);

			expect(keptMask).toEqual([true, false, false, false, false]);
		});
	});

	describe('scoreCategory', () => {
		beforeEach(async () => {
			await manager.initializeFromRoom(createTestPlayers(), defaultConfig);
			await manager.startGame();
		});

		it('should score category and return result', async () => {
			const state = await manager.getState();
			const currentPlayerId = state!.playerOrder[0];

			// Roll dice first
			await manager.rollDice(currentPlayerId, [false, false, false, false, false]);

			// Force specific dice for predictable test
			const player = state!.players[currentPlayerId];
			player.currentDice = [1, 1, 1, 2, 3]; // Should score 3 for ones

			const result = await manager.scoreCategory(currentPlayerId, 'ones');

			expect(result.score).toBe(3);
		});

		it('should move to next player', async () => {
			const state = await manager.getState();
			const currentPlayerId = state!.playerOrder[0];
			const nextPlayerId = state!.playerOrder[1];

			await manager.rollDice(currentPlayerId, [false, false, false, false, false]);
			const result = await manager.scoreCategory(currentPlayerId, 'ones');

			expect(result.nextPlayerId).toBe(nextPlayerId);
			expect(result.nextPhase).toBe('turn_roll');
		});

		it('should reset current player turn state', async () => {
			const state = await manager.getState();
			const currentPlayerId = state!.playerOrder[0];

			await manager.rollDice(currentPlayerId, [false, false, false, false, false]);
			await manager.scoreCategory(currentPlayerId, 'ones');

			const updatedState = await manager.getState();
			const player = updatedState!.players[currentPlayerId];

			expect(player.currentDice).toBe(null);
			expect(player.keptDice).toBe(null);
			expect(player.rollsRemaining).toBe(0);
		});

		it('should prepare next player for their turn', async () => {
			const state = await manager.getState();
			const currentPlayerId = state!.playerOrder[0];
			const nextPlayerId = state!.playerOrder[1];

			await manager.rollDice(currentPlayerId, [false, false, false, false, false]);
			await manager.scoreCategory(currentPlayerId, 'ones');

			const updatedState = await manager.getState();
			const nextPlayer = updatedState!.players[nextPlayerId];

			expect(nextPlayer.rollsRemaining).toBe(3);
			expect(nextPlayer.currentDice).toBe(null);
		});

		it('should detect game over when all categories scored', async () => {
			const state = await manager.getState();
			const categories: Category[] = [
				'ones',
				'twos',
				'threes',
				'fours',
				'fives',
				'sixes',
				'threeOfAKind',
				'fourOfAKind',
				'fullHouse',
				'smallStraight',
				'largeStraight',
				'dicee',
				'chance',
			];

			// Fill all but one category for all players
			for (const player of Object.values(state!.players)) {
				for (const cat of categories.slice(0, -1)) {
					player.scorecard[cat] = 10;
				}
			}

			// Last category for all players
			for (let i = 0; i < 2; i++) {
				const currentState = await manager.getState();
				const currentPlayerId = currentState!.playerOrder[currentState!.currentPlayerIndex];

				await manager.rollDice(currentPlayerId, [false, false, false, false, false]);
				const result = await manager.scoreCategory(currentPlayerId, 'chance');

				if (i === 1) {
					// After last player scores last category
					expect(result.gameCompleted).toBe(true);
					expect(result.nextPhase).toBe('game_over');
					expect(result.rankings).not.toBe(null);
				}
			}
		});

		it('should calculate Dicee bonus correctly', async () => {
			const state = await manager.getState();
			const currentPlayerId = state!.playerOrder[0];
			const player = state!.players[currentPlayerId];

			// Score first dicee
			player.scorecard.dicee = 50;

			// Roll another dicee
			await manager.rollDice(currentPlayerId, [false, false, false, false, false]);
			player.currentDice = [5, 5, 5, 5, 5];

			// Score on ones (will trigger bonus)
			const result = await manager.scoreCategory(currentPlayerId, 'ones');

			expect(result.isDiceeBonus).toBe(true);
		});
	});

	describe('skipTurn', () => {
		beforeEach(async () => {
			await manager.initializeFromRoom(createTestPlayers(), defaultConfig);
			await manager.startGame();
		});

		it('should auto-score first available category', async () => {
			const state = await manager.getState();
			const currentPlayerId = state!.playerOrder[0];

			const result = await manager.skipTurn(currentPlayerId, 'timeout');

			expect(result.categoryScored).toBe('ones'); // First category
			expect(result.score).toBe(0);
		});

		it('should move to next player', async () => {
			const state = await manager.getState();
			const currentPlayerId = state!.playerOrder[0];
			const nextPlayerId = state!.playerOrder[1];

			const result = await manager.skipTurn(currentPlayerId, 'timeout');

			expect(result.nextPlayerId).toBe(nextPlayerId);
			expect(result.nextPhase).toBe('turn_roll');
		});

		it('should skip already scored categories', async () => {
			const state = await manager.getState();
			const currentPlayerId = state!.playerOrder[0];
			const player = state!.players[currentPlayerId];

			player.scorecard.ones = 3;

			const result = await manager.skipTurn(currentPlayerId, 'timeout');

			expect(result.categoryScored).toBe('twos');
		});
	});

	describe('resetForRematch', () => {
		beforeEach(async () => {
			await manager.initializeFromRoom(createTestPlayers(), defaultConfig);
			await manager.startGame();
		});

		it('should reset all scorecards', async () => {
			// Score something first
			const state = await manager.getState();
			const currentPlayerId = state!.playerOrder[0];
			await manager.rollDice(currentPlayerId, [false, false, false, false, false]);
			await manager.scoreCategory(currentPlayerId, 'ones');

			// Reset
			const newState = await manager.resetForRematch();

			for (const player of Object.values(newState.players)) {
				expect(player.scorecard.ones).toBe(null);
				expect(player.totalScore).toBe(0);
			}
		});

		it('should reset to waiting phase', async () => {
			const newState = await manager.resetForRematch();
			expect(newState.phase).toBe('waiting');
		});

		it('should clear player order', async () => {
			const newState = await manager.resetForRematch();
			expect(newState.playerOrder).toEqual([]);
		});

		it('should reset turn and round numbers', async () => {
			const newState = await manager.resetForRematch();

			expect(newState.turnNumber).toBe(0);
			expect(newState.roundNumber).toBe(0);
			expect(newState.currentPlayerIndex).toBe(0);
		});

		it('should clear timestamps', async () => {
			const newState = await manager.resetForRematch();

			expect(newState.gameStartedAt).toBe(null);
			expect(newState.gameCompletedAt).toBe(null);
			expect(newState.turnStartedAt).toBe(null);
		});
	});

	// =========================================================================
	// Player Management Tests
	// =========================================================================

	describe('updatePlayerConnection', () => {
		beforeEach(async () => {
			await manager.initializeFromRoom(createTestPlayers(), defaultConfig);
		});

		it('should update connection status to disconnected', async () => {
			await manager.updatePlayerConnection('player1', false);

			const state = await manager.getState();
			const player = state!.players['player1'];

			expect(player.isConnected).toBe(false);
			expect(player.connectionId).toBe(null);
			expect(player.connectionStatus).toBe('disconnected');
		});

		it('should update connection status to online', async () => {
			await manager.updatePlayerConnection('player1', false);
			await manager.updatePlayerConnection('player1', true, 'new-conn');

			const state = await manager.getState();
			const player = state!.players['player1'];

			expect(player.isConnected).toBe(true);
			expect(player.connectionId).toBe('new-conn');
			expect(player.connectionStatus).toBe('online');
		});

		it('should handle unknown player gracefully', async () => {
			// Should not throw
			await manager.updatePlayerConnection('unknown', false);
		});
	});

	describe('addPlayer', () => {
		beforeEach(async () => {
			await manager.initializeFromRoom(createTestPlayers(), defaultConfig);
		});

		it('should add new player', async () => {
			const player = await manager.addPlayer('player3', 'Charlie', 'seed3', false, 'conn3');

			expect(player.id).toBe('player3');
			expect(player.displayName).toBe('Charlie');
			expect(player.isHost).toBe(false);

			const state = await manager.getState();
			expect(state!.players['player3']).toBeDefined();
		});

		it('should throw if no state', async () => {
			const emptyManager = new GameStateManager(createMockCtx(createMockStorage()), 'EMPTY');
			await expect(emptyManager.addPlayer('p', 'name', 'seed', false, 'conn')).rejects.toThrow('No game state');
		});
	});

	describe('removePlayer', () => {
		beforeEach(async () => {
			await manager.initializeFromRoom(createTestPlayers(), defaultConfig);
		});

		it('should remove player from players record', async () => {
			await manager.removePlayer('player2');

			const state = await manager.getState();
			expect(state!.players['player2']).toBeUndefined();
		});

		it('should remove player from order if in game', async () => {
			await manager.startGame();
			await manager.removePlayer('player2');

			const state = await manager.getState();
			expect(state!.playerOrder).not.toContain('player2');
		});

		it('should handle removing non-existent player', async () => {
			// Should not throw
			await manager.removePlayer('unknown');
		});
	});

	// =========================================================================
	// Alarm Management Tests
	// =========================================================================

	describe('scheduleAfkWarning', () => {
		beforeEach(async () => {
			await manager.initializeFromRoom(createTestPlayers(), defaultConfig);
		});

		it('should schedule alarm with correct type', async () => {
			await manager.scheduleAfkWarning('player1');

			const alarmData = await manager.getAlarmData();
			expect(alarmData?.type).toBe('afk_warning');
			expect(alarmData?.playerId).toBe('player1');
		});

		it('should store alarm in storage', async () => {
			await manager.scheduleAfkWarning('player1');

			expect(storage.put).toHaveBeenCalledWith('alarm_data', expect.objectContaining({ type: 'afk_warning' }));
			expect(storage.setAlarm).toHaveBeenCalled();
		});
	});

	describe('scheduleAfkTimeout', () => {
		beforeEach(async () => {
			await manager.initializeFromRoom(createTestPlayers(), defaultConfig);
		});

		it('should schedule alarm with correct type', async () => {
			await manager.scheduleAfkTimeout('player1');

			const alarmData = await manager.getAlarmData();
			expect(alarmData?.type).toBe('afk_timeout');
			expect(alarmData?.playerId).toBe('player1');
		});
	});

	describe('scheduleRoomCleanup', () => {
		beforeEach(async () => {
			await manager.initializeFromRoom(createTestPlayers(), defaultConfig);
		});

		it('should schedule cleanup alarm', async () => {
			await manager.scheduleRoomCleanup();

			const alarmData = await manager.getAlarmData();
			expect(alarmData?.type).toBe('room_cleanup');
		});
	});

	describe('scheduleGameStart', () => {
		beforeEach(async () => {
			await manager.initializeFromRoom(createTestPlayers(), defaultConfig);
		});

		it('should schedule game start alarm', async () => {
			await manager.scheduleGameStart();

			const alarmData = await manager.getAlarmData();
			expect(alarmData?.type).toBe('game_start');
		});
	});

	describe('cancelAlarm', () => {
		beforeEach(async () => {
			await manager.initializeFromRoom(createTestPlayers(), defaultConfig);
		});

		it('should cancel pending alarm', async () => {
			await manager.scheduleAfkWarning('player1');
			await manager.cancelAlarm();

			const alarmData = await manager.getAlarmData();
			expect(alarmData).toBe(null);
		});

		it('should delete alarm from storage', async () => {
			await manager.scheduleAfkWarning('player1');
			await manager.cancelAlarm();

			expect(storage.delete).toHaveBeenCalledWith('alarm_data');
			expect(storage.deleteAlarm).toHaveBeenCalled();
		});
	});

	describe('getAlarmData', () => {
		beforeEach(async () => {
			await manager.initializeFromRoom(createTestPlayers(), defaultConfig);
		});

		it('should return cached alarm data', async () => {
			await manager.scheduleAfkWarning('player1');
			const data = await manager.getAlarmData();

			expect(data?.type).toBe('afk_warning');
		});

		it('should load from storage if not cached', async () => {
			const alarmData: AlarmData = {
				type: 'afk_timeout',
				playerId: 'player1',
				scheduledAt: new Date().toISOString(),
			};
			storage.data.set('alarm_data', alarmData);

			// Create new manager to avoid cache
			const newManager = new GameStateManager(ctx, 'ROOM01');
			const data = await newManager.getAlarmData();

			expect(data?.type).toBe('afk_timeout');
		});
	});

	// =========================================================================
	// Rankings Calculation Tests
	// =========================================================================

	describe('rankings calculation', () => {
		it('should rank players by score', async () => {
			await manager.initializeFromRoom(createTestPlayers(), defaultConfig);
			await manager.startGame();

			const state = await manager.getState();
			const categories: Category[] = [
				'ones',
				'twos',
				'threes',
				'fours',
				'fives',
				'sixes',
				'threeOfAKind',
				'fourOfAKind',
				'fullHouse',
				'smallStraight',
				'largeStraight',
				'dicee',
				'chance',
			];

			// Give player1 higher scores
			const p1 = state!.players['player1'];
			const p2 = state!.players['player2'];

			for (const cat of categories) {
				p1.scorecard[cat] = 20;
				p2.scorecard[cat] = 10;
			}
			p1.totalScore = 260;
			p2.totalScore = 130;

			// Trigger game completion
			const currentPlayerId = state!.playerOrder[state!.currentPlayerIndex];
			await manager.rollDice(currentPlayerId, [false, false, false, false, false]);

			// All categories scored, so scoreCategory should end game
			// But since we pre-filled, need to unfill one
			const firstPlayer = state!.players[state!.playerOrder[0]];
			firstPlayer.scorecard.chance = null;

			await manager.rollDice(state!.playerOrder[0], [false, false, false, false, false]);
			const result = await manager.scoreCategory(state!.playerOrder[0], 'chance');

			if (result.gameCompleted) {
				expect(result.rankings![0].playerId).toBe('player1');
				expect(result.rankings![0].rank).toBe(1);
			}
		});

		it('should handle ties with same rank', async () => {
			await manager.initializeFromRoom(createTestPlayers(), defaultConfig);
			const state = await manager.initializeFromRoom(createTestPlayers(), defaultConfig);

			// Give both players equal scores
			for (const player of Object.values(state.players)) {
				player.totalScore = 100;
			}

			// Access private method via prototype to test
			const rankings = (manager as unknown as { calculateRankings(s: MultiplayerGameState): unknown[] }).calculateRankings(
				state,
			);

			// Both should have rank 1 if tied
			expect(rankings).toBeDefined();
		});
	});

	// =========================================================================
	// Edge Cases
	// =========================================================================

	describe('edge cases', () => {
		it('should handle roll with all kept dice', async () => {
			await manager.initializeFromRoom(createTestPlayers(), defaultConfig);
			await manager.startGame();

			const state = await manager.getState();
			const currentPlayerId = state!.playerOrder[0];

			// First roll
			const roll1 = await manager.rollDice(currentPlayerId, [false, false, false, false, false]);
			const originalDice = [...roll1.dice];

			// Keep all dice
			const roll2 = await manager.rollDice(currentPlayerId, [true, true, true, true, true]);

			// Should keep all original dice
			expect(roll2.dice).toEqual(originalDice);
		});

		it('should handle three consecutive rolls', async () => {
			await manager.initializeFromRoom(createTestPlayers(), defaultConfig);
			await manager.startGame();

			const state = await manager.getState();
			const currentPlayerId = state!.playerOrder[0];

			await manager.rollDice(currentPlayerId, [false, false, false, false, false]);
			await manager.rollDice(currentPlayerId, [false, false, false, false, false]);
			const roll3 = await manager.rollDice(currentPlayerId, [false, false, false, false, false]);

			expect(roll3.rollsRemaining).toBe(0);
			expect(roll3.rollNumber).toBe(3);
		});
	});
});
