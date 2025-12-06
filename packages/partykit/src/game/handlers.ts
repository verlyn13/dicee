/**
 * Game Command Handlers
 *
 * Processes validated game commands and returns events to broadcast.
 * All game logic validation happens here before state changes.
 */

import type * as Party from 'partykit/server';
import type { Category, GamePhase, KeptMask, MultiplayerGameState, PlayerRanking } from './types';
import { AFK_TIMEOUT_SECONDS, AFK_WARNING_SECONDS } from './types';
import {
	canKeepDice,
	canRematch,
	canRollDice,
	canScoreCategory,
	canStartGame,
	type TransitionError,
} from './machine';
import type { GameStateManager } from './state';

// =============================================================================
// Event Types
// =============================================================================

export interface GameStartedEvent {
	type: 'game.started';
	timestamp: string;
	playerOrder: string[];
	currentPlayerId: string;
	turnNumber: number;
}

export interface TurnStartedEvent {
	type: 'turn.started';
	timestamp: string;
	playerId: string;
	turnNumber: number;
	roundNumber: number;
}

export interface DiceRolledEvent {
	type: 'dice.rolled';
	timestamp: string;
	playerId: string;
	dice: [number, number, number, number, number];
	rollNumber: number;
	rollsRemaining: number;
}

export interface DiceKeptEvent {
	type: 'dice.kept';
	timestamp: string;
	playerId: string;
	kept: KeptMask;
}

export interface CategoryScoredEvent {
	type: 'category.scored';
	timestamp: string;
	playerId: string;
	category: Category;
	score: number;
	totalScore: number;
	isYahtzeeBonus: boolean;
}

export interface TurnEndedEvent {
	type: 'turn.ended';
	timestamp: string;
	playerId: string;
}

export interface TurnSkippedEvent {
	type: 'turn.skipped';
	timestamp: string;
	playerId: string;
	reason: 'timeout' | 'disconnect';
	categoryScored: Category;
	score: number;
}

export interface AfkWarningEvent {
	type: 'player.afk_warning';
	timestamp: string;
	playerId: string;
	secondsRemaining: number;
}

export interface GameCompletedEvent {
	type: 'game.completed';
	timestamp: string;
	rankings: PlayerRanking[];
	duration: number;
}

export interface StateSyncEvent {
	type: 'state.sync';
	timestamp: string;
	state: MultiplayerGameState;
}

export interface GameErrorEvent {
	type: 'game.error';
	timestamp: string;
	message: string;
	code: TransitionError;
}

export type GameEvent =
	| GameStartedEvent
	| TurnStartedEvent
	| DiceRolledEvent
	| DiceKeptEvent
	| CategoryScoredEvent
	| TurnEndedEvent
	| TurnSkippedEvent
	| AfkWarningEvent
	| GameCompletedEvent
	| StateSyncEvent
	| GameErrorEvent;

// =============================================================================
// Handler Results
// =============================================================================

export interface HandlerResult {
	/** Events to broadcast to all connections */
	broadcast?: GameEvent[];
	/** Events to send only to the sender */
	reply?: GameEvent[];
	/** Whether to schedule AFK alarm for next turn */
	scheduleAfkAlarm?: boolean;
	/** Whether to cancel existing alarm */
	cancelAlarm?: boolean;
}

// =============================================================================
// Helper Functions
// =============================================================================

function timestamp(): string {
	return new Date().toISOString();
}

function errorEvent(code: TransitionError, message: string): GameErrorEvent {
	return {
		type: 'game.error',
		timestamp: timestamp(),
		code,
		message,
	};
}

// =============================================================================
// Command Handlers
// =============================================================================

/**
 * Handle game.start command
 */
export async function handleStartGame(
	playerId: string,
	stateManager: GameStateManager,
): Promise<HandlerResult> {
	const state = await stateManager.getState();
	if (!state) {
		return { reply: [errorEvent('GAME_NOT_STARTED', 'Game state not initialized')] };
	}

	const validation = canStartGame(state, playerId);
	if (!validation.success) {
		return { reply: [errorEvent(validation.error, validation.message)] };
	}

	// Schedule countdown and start
	await stateManager.scheduleGameStart();

	// Update phase to starting
	state.phase = 'starting';
	await stateManager.saveState();

	// The actual start will happen in onAlarm after countdown
	// For now, return a starting event
	return {
		broadcast: [
			{
				type: 'game.started',
				timestamp: timestamp(),
				playerOrder: [], // Will be set after countdown
				currentPlayerId: '', // Will be set after countdown
				turnNumber: 0,
			} as GameStartedEvent,
		],
	};
}

/**
 * Handle the actual game start (called from alarm after countdown)
 */
export async function executeGameStart(stateManager: GameStateManager): Promise<HandlerResult> {
	const result = await stateManager.startGame();

	const events: GameEvent[] = [
		{
			type: 'game.started',
			timestamp: timestamp(),
			playerOrder: result.playerOrder,
			currentPlayerId: result.currentPlayerId,
			turnNumber: result.turnNumber,
		},
		{
			type: 'turn.started',
			timestamp: timestamp(),
			playerId: result.currentPlayerId,
			turnNumber: result.turnNumber,
			roundNumber: 1,
		},
	];

	return {
		broadcast: events,
		scheduleAfkAlarm: true,
	};
}

/**
 * Handle dice.roll command
 */
export async function handleRollDice(
	playerId: string,
	kept: KeptMask,
	stateManager: GameStateManager,
): Promise<HandlerResult> {
	const state = await stateManager.getState();
	if (!state) {
		return { reply: [errorEvent('GAME_NOT_STARTED', 'Game not started')] };
	}

	const validation = canRollDice(state, playerId);
	if (!validation.success) {
		return { reply: [errorEvent(validation.error, validation.message)] };
	}

	// Execute roll
	const result = await stateManager.rollDice(playerId, kept);

	return {
		broadcast: [
			{
				type: 'dice.rolled',
				timestamp: timestamp(),
				playerId,
				dice: result.dice,
				rollNumber: result.rollNumber,
				rollsRemaining: result.rollsRemaining,
			},
		],
		// Reset AFK timer on activity
		scheduleAfkAlarm: true,
		cancelAlarm: true,
	};
}

/**
 * Handle dice.keep command
 */
export async function handleKeepDice(
	playerId: string,
	indices: number[],
	stateManager: GameStateManager,
): Promise<HandlerResult> {
	const state = await stateManager.getState();
	if (!state) {
		return { reply: [errorEvent('GAME_NOT_STARTED', 'Game not started')] };
	}

	const validation = canKeepDice(state, playerId);
	if (!validation.success) {
		return { reply: [errorEvent(validation.error, validation.message)] };
	}

	// Execute keep
	const kept = await stateManager.keepDice(playerId, indices);

	return {
		broadcast: [
			{
				type: 'dice.kept',
				timestamp: timestamp(),
				playerId,
				kept,
			},
		],
		// Reset AFK timer on activity
		scheduleAfkAlarm: true,
		cancelAlarm: true,
	};
}

/**
 * Handle category.score command
 */
export async function handleScoreCategory(
	playerId: string,
	category: Category,
	stateManager: GameStateManager,
): Promise<HandlerResult> {
	const state = await stateManager.getState();
	if (!state) {
		return { reply: [errorEvent('GAME_NOT_STARTED', 'Game not started')] };
	}

	const validation = canScoreCategory(state, playerId, category);
	if (!validation.success) {
		return { reply: [errorEvent(validation.error, validation.message)] };
	}

	// Execute scoring
	const result = await stateManager.scoreCategory(playerId, category);

	const events: GameEvent[] = [
		{
			type: 'category.scored',
			timestamp: timestamp(),
			playerId,
			category,
			score: result.score,
			totalScore: result.totalScore,
			isYahtzeeBonus: result.isYahtzeeBonus,
		},
		{
			type: 'turn.ended',
			timestamp: timestamp(),
			playerId,
		},
	];

	if (result.gameCompleted && result.rankings) {
		// Calculate game duration
		const updatedState = await stateManager.getState();
		const startTime = updatedState?.gameStartedAt ? new Date(updatedState.gameStartedAt).getTime() : Date.now();
		const duration = Math.floor((Date.now() - startTime) / 1000);

		events.push({
			type: 'game.completed',
			timestamp: timestamp(),
			rankings: result.rankings,
			duration,
		});

		return {
			broadcast: events,
			cancelAlarm: true,
		};
	}

	// Game continues - start next turn
	if (result.nextPlayerId) {
		events.push({
			type: 'turn.started',
			timestamp: timestamp(),
			playerId: result.nextPlayerId,
			turnNumber: result.nextTurnNumber,
			roundNumber: result.nextRoundNumber,
		});
	}

	return {
		broadcast: events,
		scheduleAfkAlarm: true,
		cancelAlarm: true,
	};
}

/**
 * Handle game.rematch command
 */
export async function handleRematch(
	playerId: string,
	stateManager: GameStateManager,
): Promise<HandlerResult> {
	const state = await stateManager.getState();
	if (!state) {
		return { reply: [errorEvent('GAME_NOT_STARTED', 'Game not started')] };
	}

	const validation = canRematch(state, playerId);
	if (!validation.success) {
		return { reply: [errorEvent(validation.error, validation.message)] };
	}

	// Reset game state
	const newState = await stateManager.resetForRematch();

	return {
		broadcast: [
			{
				type: 'state.sync',
				timestamp: timestamp(),
				state: newState,
			},
		],
	};
}

/**
 * Handle AFK warning alarm
 */
export async function handleAfkWarning(
	playerId: string,
	stateManager: GameStateManager,
): Promise<HandlerResult> {
	const state = await stateManager.getState();
	if (!state) return {};

	// Check if it's still this player's turn
	const currentPlayerId = state.playerOrder[state.currentPlayerIndex];
	if (currentPlayerId !== playerId) return {};

	// Check if game is still in playing state
	if (state.phase !== 'turn_roll' && state.phase !== 'turn_decide') return {};

	const secondsRemaining = AFK_TIMEOUT_SECONDS - AFK_WARNING_SECONDS;

	return {
		broadcast: [
			{
				type: 'player.afk_warning',
				timestamp: timestamp(),
				playerId,
				secondsRemaining,
			},
		],
	};
}

/**
 * Handle AFK timeout alarm
 */
export async function handleAfkTimeout(
	playerId: string,
	stateManager: GameStateManager,
): Promise<HandlerResult> {
	const state = await stateManager.getState();
	if (!state) return {};

	// Check if it's still this player's turn
	const currentPlayerId = state.playerOrder[state.currentPlayerIndex];
	if (currentPlayerId !== playerId) return {};

	// Check if game is still in playing state
	if (state.phase !== 'turn_roll' && state.phase !== 'turn_decide') return {};

	// Skip turn
	const result = await stateManager.skipTurn(playerId, 'timeout');

	const events: GameEvent[] = [
		{
			type: 'turn.skipped',
			timestamp: timestamp(),
			playerId,
			reason: 'timeout',
			categoryScored: result.categoryScored,
			score: result.score,
		},
	];

	if (result.gameCompleted && result.rankings) {
		const updatedState = await stateManager.getState();
		const startTime = updatedState?.gameStartedAt ? new Date(updatedState.gameStartedAt).getTime() : Date.now();
		const duration = Math.floor((Date.now() - startTime) / 1000);

		events.push({
			type: 'game.completed',
			timestamp: timestamp(),
			rankings: result.rankings,
			duration,
		});

		return { broadcast: events };
	}

	// Game continues
	if (result.nextPlayerId) {
		events.push({
			type: 'turn.started',
			timestamp: timestamp(),
			playerId: result.nextPlayerId,
			turnNumber: 0, // Will be filled from state
			roundNumber: 0,
		});
	}

	return {
		broadcast: events,
		scheduleAfkAlarm: true,
	};
}

/**
 * Generate full state sync event
 */
export async function generateStateSync(stateManager: GameStateManager): Promise<StateSyncEvent | null> {
	const state = await stateManager.getStateForSync();
	if (!state) return null;

	return {
		type: 'state.sync',
		timestamp: timestamp(),
		state,
	};
}
