/**
 * Game State Manager (Durable Objects Version)
 *
 * Manages game state transitions and persistence using DurableObjectState.
 * Server-authoritative - all state changes go through here.
 *
 * Adapted from packages/partykit - replaces Party.Room with DurableObjectState.
 */

import type {
	Category,
	DiceArray,
	GamePhase,
	KeptMask,
	MultiplayerGameState,
	PlayerGameState,
	PlayerRanking,
} from './types';
import {
	AFK_TIMEOUT_SECONDS,
	AFK_WARNING_SECONDS,
	MAX_ROLLS_PER_TURN,
	ROOM_CLEANUP_MS,
	STARTING_COUNTDOWN_SECONDS,
	createEmptyScorecard,
	createPlayerGameState,
} from './types';
import { applyScore, calculateTotal, rollWithKept } from './scoring';
import {
	getAutoScoreCategory,
	getNextPhaseAfterScore,
	getNextPlayerIndex,
	getNextRoundNumber,
	getNextTurnNumber,
} from './machine';

// =============================================================================
// Storage Keys
// =============================================================================

const GAME_STATE_KEY = 'game_state';
const ALARM_DATA_KEY = 'alarm_data';

// =============================================================================
// Alarm Types
// =============================================================================

export type AlarmType = 'afk_warning' | 'afk_timeout' | 'room_cleanup' | 'game_start';

export interface AlarmData {
	type: AlarmType;
	playerId?: string;
	scheduledAt: string;
}

// =============================================================================
// Game State Manager
// =============================================================================

/**
 * Manages game state with Durable Object storage.
 *
 * Key differences from PartyKit version:
 * - Uses DurableObjectState instead of Party.Room
 * - ctx.storage.get/put instead of room.storage.get/put
 * - ctx.storage.setAlarm instead of room.storage.setAlarm
 */
export class GameStateManager {
	private state: MultiplayerGameState | null = null;
	private alarmData: AlarmData | null = null;

	constructor(
		private ctx: DurableObjectState,
		private roomCode: string,
	) {}

	// =========================================================================
	// State Access
	// =========================================================================

	/**
	 * Get current game state, loading from storage if needed
	 */
	async getState(): Promise<MultiplayerGameState | null> {
		if (this.state) {
			return this.state;
		}

		const stored = await this.ctx.storage.get<MultiplayerGameState>(GAME_STATE_KEY);
		if (stored) {
			this.state = stored;
		}
		return this.state;
	}

	/**
	 * Save game state to durable storage
	 */
	async saveState(): Promise<void> {
		if (this.state) {
			await this.ctx.storage.put(GAME_STATE_KEY, this.state);
		}
	}

	/**
	 * Check if game state exists
	 */
	async hasState(): Promise<boolean> {
		const state = await this.getState();
		return state !== null;
	}

	// =========================================================================
	// Initialization
	// =========================================================================

	/**
	 * Initialize game state from room data
	 */
	async initializeFromRoom(
		players: Array<{
			id: string;
			displayName: string;
			avatarSeed: string;
			isHost: boolean;
			connectionId: string;
		}>,
		config: MultiplayerGameState['config'],
	): Promise<MultiplayerGameState> {
		const playerRecords: Record<string, PlayerGameState> = {};
		for (const p of players) {
			playerRecords[p.id] = createPlayerGameState(p.id, p.displayName, p.avatarSeed, p.isHost, p.connectionId);
		}

		this.state = {
			roomCode: this.roomCode,
			phase: 'waiting',
			playerOrder: [],
			currentPlayerIndex: 0,
			turnNumber: 0,
			roundNumber: 0,
			players: playerRecords,
			turnStartedAt: null,
			gameStartedAt: null,
			gameCompletedAt: null,
			rankings: null,
			config,
		};

		await this.saveState();
		return this.state;
	}

	// =========================================================================
	// Game Flow
	// =========================================================================

	/**
	 * Start the game (after countdown)
	 */
	async startGame(): Promise<{
		playerOrder: string[];
		currentPlayerId: string;
		turnNumber: number;
	}> {
		const state = await this.getState();
		if (!state) throw new Error('No game state');
		if (state.phase !== 'waiting' && state.phase !== 'starting') {
			throw new Error('Game already in progress');
		}

		// Randomize player order using crypto
		const playerIds = Object.keys(state.players);
		const randomized = this.shuffleArray(playerIds);

		state.phase = 'turn_roll';
		state.playerOrder = randomized;
		state.currentPlayerIndex = 0;
		state.turnNumber = 1;
		state.roundNumber = 1;
		state.gameStartedAt = new Date().toISOString();
		state.turnStartedAt = new Date().toISOString();

		// Initialize current player's turn state
		const currentPlayerId = randomized[0];
		const currentPlayer = state.players[currentPlayerId];
		if (currentPlayer) {
			currentPlayer.rollsRemaining = MAX_ROLLS_PER_TURN;
			currentPlayer.currentDice = null;
			currentPlayer.keptDice = null;
		}

		await this.saveState();

		return {
			playerOrder: randomized,
			currentPlayerId,
			turnNumber: 1,
		};
	}

	/**
	 * Roll dice for current player
	 */
	async rollDice(
		playerId: string,
		kept: KeptMask,
	): Promise<{
		dice: DiceArray;
		rollNumber: number;
		rollsRemaining: number;
		newPhase: GamePhase;
	}> {
		const state = await this.getState();
		if (!state) throw new Error('No game state');

		const player = state.players[playerId];
		if (!player) throw new Error('Player not found');

		// Generate new dice
		const newDice = rollWithKept(player.currentDice, kept);
		const newRollsRemaining = player.rollsRemaining - 1;
		const rollNumber = MAX_ROLLS_PER_TURN - newRollsRemaining;

		// Update player state
		player.currentDice = newDice;
		player.keptDice = [false, false, false, false, false];
		player.rollsRemaining = newRollsRemaining;
		player.lastActive = new Date().toISOString();

		// Transition to turn_decide after rolling
		state.phase = 'turn_decide';
		state.turnStartedAt = new Date().toISOString();

		await this.saveState();

		return {
			dice: newDice,
			rollNumber,
			rollsRemaining: newRollsRemaining,
			newPhase: 'turn_decide',
		};
	}

	/**
	 * Update kept dice
	 */
	async keepDice(playerId: string, indices: number[]): Promise<KeptMask> {
		const state = await this.getState();
		if (!state) throw new Error('No game state');

		const player = state.players[playerId];
		if (!player) throw new Error('Player not found');

		// Create new kept mask
		const newKept: KeptMask = [false, false, false, false, false];
		for (const idx of indices) {
			if (idx >= 0 && idx < 5) {
				newKept[idx] = true;
			}
		}

		player.keptDice = newKept;
		player.lastActive = new Date().toISOString();

		await this.saveState();

		return newKept;
	}

	/**
	 * Score a category
	 */
	async scoreCategory(
		playerId: string,
		category: Category,
	): Promise<{
		score: number;
		totalScore: number;
		isYahtzeeBonus: boolean;
		nextPhase: GamePhase;
		nextPlayerId: string | null;
		nextTurnNumber: number;
		nextRoundNumber: number;
		gameCompleted: boolean;
		rankings: PlayerRanking[] | null;
	}> {
		const state = await this.getState();
		if (!state) throw new Error('No game state');

		const player = state.players[playerId];
		if (!player || !player.currentDice) {
			throw new Error('Invalid player state');
		}

		// Apply score
		const result = applyScore(player.scorecard, category, player.currentDice);
		player.scorecard = result.scorecard;
		player.totalScore = calculateTotal(result.scorecard);
		player.lastActive = new Date().toISOString();

		// Determine next phase
		const nextPhase = getNextPhaseAfterScore(state);

		let nextPlayerId: string | null = null;
		let nextTurnNumber = state.turnNumber;
		let nextRoundNumber = state.roundNumber;
		let rankings: PlayerRanking[] | null = null;
		let gameCompleted = false;

		if (nextPhase === 'game_over') {
			// Game completed
			gameCompleted = true;
			state.phase = 'game_over';
			state.gameCompletedAt = new Date().toISOString();
			rankings = this.calculateRankings(state);
			state.rankings = rankings;
		} else {
			// Move to next player
			const nextPlayerIndex = getNextPlayerIndex(state);
			nextTurnNumber = getNextTurnNumber(state);
			nextRoundNumber = getNextRoundNumber(state);

			state.currentPlayerIndex = nextPlayerIndex;
			state.turnNumber = nextTurnNumber;
			state.roundNumber = nextRoundNumber;
			state.phase = 'turn_roll';
			state.turnStartedAt = new Date().toISOString();

			nextPlayerId = state.playerOrder[nextPlayerIndex];

			// Reset next player's turn state
			const nextPlayer = state.players[nextPlayerId];
			if (nextPlayer) {
				nextPlayer.rollsRemaining = MAX_ROLLS_PER_TURN;
				nextPlayer.currentDice = null;
				nextPlayer.keptDice = null;
			}
		}

		// Reset current player's turn state
		player.currentDice = null;
		player.keptDice = null;
		player.rollsRemaining = 0;

		await this.saveState();

		return {
			score: result.score,
			totalScore: player.totalScore,
			isYahtzeeBonus: result.isYahtzeeBonus,
			nextPhase,
			nextPlayerId,
			nextTurnNumber,
			nextRoundNumber,
			gameCompleted,
			rankings,
		};
	}

	/**
	 * Skip turn due to AFK timeout
	 */
	async skipTurn(
		playerId: string,
		reason: 'timeout' | 'disconnect',
	): Promise<{
		categoryScored: Category;
		score: number;
		nextPlayerId: string | null;
		nextPhase: GamePhase;
		gameCompleted: boolean;
		rankings: PlayerRanking[] | null;
	}> {
		const state = await this.getState();
		if (!state) throw new Error('No game state');

		const player = state.players[playerId];
		if (!player) throw new Error('Player not found');

		// Auto-score lowest available category with 0 (no dice = 0 score)
		const category = getAutoScoreCategory(player);
		if (!category) {
			throw new Error('No categories available to score');
		}

		// If player never rolled, give them empty dice
		if (!player.currentDice) {
			player.currentDice = [1, 1, 1, 1, 1]; // Doesn't matter, score will be 0
		}

		// Apply 0 score to the category
		player.scorecard[category] = 0;
		player.totalScore = calculateTotal(player.scorecard);

		// Determine next phase
		const nextPhase = getNextPhaseAfterScore(state);

		let nextPlayerId: string | null = null;
		let rankings: PlayerRanking[] | null = null;
		let gameCompleted = false;

		if (nextPhase === 'game_over') {
			gameCompleted = true;
			state.phase = 'game_over';
			state.gameCompletedAt = new Date().toISOString();
			rankings = this.calculateRankings(state);
			state.rankings = rankings;
		} else {
			// Move to next player
			const nextPlayerIndex = getNextPlayerIndex(state);
			state.currentPlayerIndex = nextPlayerIndex;
			state.turnNumber = getNextTurnNumber(state);
			state.roundNumber = getNextRoundNumber(state);
			state.phase = 'turn_roll';
			state.turnStartedAt = new Date().toISOString();

			nextPlayerId = state.playerOrder[nextPlayerIndex];

			// Reset next player's turn state
			const nextPlayer = state.players[nextPlayerId];
			if (nextPlayer) {
				nextPlayer.rollsRemaining = MAX_ROLLS_PER_TURN;
				nextPlayer.currentDice = null;
				nextPlayer.keptDice = null;
			}
		}

		// Reset current player's turn state
		player.currentDice = null;
		player.keptDice = null;
		player.rollsRemaining = 0;

		await this.saveState();

		return {
			categoryScored: category,
			score: 0,
			nextPlayerId,
			nextPhase,
			gameCompleted,
			rankings,
		};
	}

	/**
	 * Reset game for rematch
	 */
	async resetForRematch(): Promise<MultiplayerGameState> {
		const state = await this.getState();
		if (!state) throw new Error('No game state');

		// Reset all player scorecards
		for (const player of Object.values(state.players)) {
			player.scorecard = createEmptyScorecard();
			player.totalScore = 0;
			player.currentDice = null;
			player.keptDice = null;
			player.rollsRemaining = MAX_ROLLS_PER_TURN;
		}

		state.phase = 'waiting';
		state.playerOrder = [];
		state.currentPlayerIndex = 0;
		state.turnNumber = 0;
		state.roundNumber = 0;
		state.turnStartedAt = null;
		state.gameStartedAt = null;
		state.gameCompletedAt = null;
		state.rankings = null;

		await this.saveState();
		return state;
	}

	// =========================================================================
	// Player Management
	// =========================================================================

	/**
	 * Update player connection status
	 */
	async updatePlayerConnection(
		playerId: string,
		isConnected: boolean,
		connectionId?: string,
	): Promise<void> {
		const state = await this.getState();
		if (!state) return;

		const player = state.players[playerId];
		if (!player) return;

		player.isConnected = isConnected;
		player.connectionId = isConnected ? (connectionId ?? null) : null;
		player.lastActive = new Date().toISOString();
		player.connectionStatus = isConnected ? 'online' : 'disconnected';

		await this.saveState();
	}

	/**
	 * Add a player to the game
	 */
	async addPlayer(
		id: string,
		displayName: string,
		avatarSeed: string,
		isHost: boolean,
		connectionId: string,
	): Promise<PlayerGameState> {
		const state = await this.getState();
		if (!state) throw new Error('No game state');

		const player = createPlayerGameState(id, displayName, avatarSeed, isHost, connectionId);
		state.players[id] = player;

		await this.saveState();
		return player;
	}

	/**
	 * Remove a player from the game
	 */
	async removePlayer(playerId: string): Promise<void> {
		const state = await this.getState();
		if (!state) return;

		delete state.players[playerId];

		// Remove from player order if game in progress
		const orderIndex = state.playerOrder.indexOf(playerId);
		if (orderIndex !== -1) {
			state.playerOrder.splice(orderIndex, 1);
		}

		await this.saveState();
	}

	// =========================================================================
	// Alarm Management (Durable Object Version)
	// =========================================================================

	/**
	 * Schedule AFK warning alarm
	 */
	async scheduleAfkWarning(playerId: string): Promise<void> {
		const warningTime = Date.now() + AFK_WARNING_SECONDS * 1000;
		this.alarmData = {
			type: 'afk_warning',
			playerId,
			scheduledAt: new Date().toISOString(),
		};
		await this.ctx.storage.put(ALARM_DATA_KEY, this.alarmData);
		await this.ctx.storage.setAlarm(warningTime);
	}

	/**
	 * Schedule AFK timeout alarm
	 */
	async scheduleAfkTimeout(playerId: string): Promise<void> {
		const timeoutTime = Date.now() + AFK_TIMEOUT_SECONDS * 1000;
		this.alarmData = {
			type: 'afk_timeout',
			playerId,
			scheduledAt: new Date().toISOString(),
		};
		await this.ctx.storage.put(ALARM_DATA_KEY, this.alarmData);
		await this.ctx.storage.setAlarm(timeoutTime);
	}

	/**
	 * Schedule room cleanup alarm
	 */
	async scheduleRoomCleanup(): Promise<void> {
		const cleanupTime = Date.now() + ROOM_CLEANUP_MS;
		this.alarmData = {
			type: 'room_cleanup',
			scheduledAt: new Date().toISOString(),
		};
		await this.ctx.storage.put(ALARM_DATA_KEY, this.alarmData);
		await this.ctx.storage.setAlarm(cleanupTime);
	}

	/**
	 * Schedule game start countdown alarm
	 */
	async scheduleGameStart(): Promise<void> {
		const startTime = Date.now() + STARTING_COUNTDOWN_SECONDS * 1000;
		this.alarmData = {
			type: 'game_start',
			scheduledAt: new Date().toISOString(),
		};
		await this.ctx.storage.put(ALARM_DATA_KEY, this.alarmData);
		await this.ctx.storage.setAlarm(startTime);
	}

	/**
	 * Cancel pending alarm
	 */
	async cancelAlarm(): Promise<void> {
		this.alarmData = null;
		await this.ctx.storage.delete(ALARM_DATA_KEY);
		await this.ctx.storage.deleteAlarm();
	}

	/**
	 * Get current alarm data
	 */
	async getAlarmData(): Promise<AlarmData | null> {
		if (this.alarmData) return this.alarmData;

		const stored = await this.ctx.storage.get<AlarmData>(ALARM_DATA_KEY);
		if (stored) {
			this.alarmData = stored;
		}
		return this.alarmData;
	}

	// =========================================================================
	// Helpers
	// =========================================================================

	/**
	 * Shuffle array using crypto
	 */
	private shuffleArray<T>(array: T[]): T[] {
		const result = [...array];
		const buffer = new Uint32Array(result.length);
		crypto.getRandomValues(buffer);

		for (let i = result.length - 1; i > 0; i--) {
			const j = buffer[i] % (i + 1);
			[result[i], result[j]] = [result[j], result[i]];
		}

		return result;
	}

	/**
	 * Calculate final rankings
	 */
	private calculateRankings(state: MultiplayerGameState): PlayerRanking[] {
		const players = Object.values(state.players);

		// Count Yahtzees
		const countYahtzees = (p: PlayerGameState): number => {
			let count = 0;
			if (p.scorecard.yahtzee !== null && p.scorecard.yahtzee > 0) count = 1;
			count += Math.floor(p.scorecard.yahtzeeBonus / 100);
			return count;
		};

		// Sort by score (descending)
		const sorted = [...players].sort((a, b) => b.totalScore - a.totalScore);

		// Assign ranks (handle ties)
		const rankings: PlayerRanking[] = [];
		let currentRank = 1;
		let previousScore = -1;

		for (let i = 0; i < sorted.length; i++) {
			const player = sorted[i];
			const rank = player.totalScore === previousScore ? currentRank : i + 1;
			currentRank = rank;
			previousScore = player.totalScore;

			rankings.push({
				playerId: player.id,
				displayName: player.displayName,
				rank,
				score: player.totalScore,
				yahtzeeCount: countYahtzees(player),
			});
		}

		return rankings;
	}

	/**
	 * Get state for sync (client-safe view)
	 */
	async getStateForSync(): Promise<MultiplayerGameState | null> {
		return this.getState();
	}
}
