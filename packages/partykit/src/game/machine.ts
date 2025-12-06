/**
 * Game State Machine
 *
 * Enforces valid state transitions and provides action validators.
 * Server-authoritative - all transitions validated here before execution.
 */

import type { Category, GamePhase, MultiplayerGameState, PlayerGameState } from './types';
import { MAX_ROLLS_PER_TURN, getRemainingCategories, isValidTransition } from './types';

// =============================================================================
// Transition Validators
// =============================================================================

/**
 * Error codes for invalid transitions
 */
export type TransitionError =
	| 'NOT_YOUR_TURN'
	| 'INVALID_PHASE'
	| 'INVALID_CATEGORY'
	| 'CATEGORY_ALREADY_SCORED'
	| 'NO_ROLLS_REMAINING'
	| 'NOT_HOST'
	| 'NOT_ENOUGH_PLAYERS'
	| 'GAME_IN_PROGRESS'
	| 'GAME_NOT_STARTED';

/**
 * Result of a transition validation
 */
export type TransitionResult<T = void> =
	| { success: true; data: T }
	| { success: false; error: TransitionError; message: string };

/**
 * Create a successful transition result
 */
function success<T>(data: T): TransitionResult<T> {
	return { success: true, data };
}

/**
 * Create a failed transition result
 */
function failure(error: TransitionError, message: string): TransitionResult<never> {
	return { success: false, error, message };
}

// =============================================================================
// Command Validators
// =============================================================================

/**
 * Validate game.start command
 */
export function canStartGame(state: MultiplayerGameState, playerId: string): TransitionResult {
	// Must be in waiting phase
	if (state.phase !== 'waiting') {
		return failure('GAME_IN_PROGRESS', 'Game has already started');
	}

	// Must be host
	const player = state.players[playerId];
	if (!player?.isHost) {
		return failure('NOT_HOST', 'Only the host can start the game');
	}

	// Must have at least 2 players
	const connectedPlayers = Object.values(state.players).filter((p) => p.isConnected);
	if (connectedPlayers.length < 2) {
		return failure('NOT_ENOUGH_PLAYERS', 'Need at least 2 players to start');
	}

	return success(undefined);
}

/**
 * Validate dice.roll command
 */
export function canRollDice(state: MultiplayerGameState, playerId: string): TransitionResult {
	// Must be in turn_roll or turn_decide phase
	if (state.phase !== 'turn_roll' && state.phase !== 'turn_decide') {
		return failure('INVALID_PHASE', 'Cannot roll dice in current phase');
	}

	// Must be current player's turn
	const currentPlayerId = state.playerOrder[state.currentPlayerIndex];
	if (playerId !== currentPlayerId) {
		return failure('NOT_YOUR_TURN', 'It is not your turn');
	}

	// Must have rolls remaining
	const player = state.players[playerId];
	if (!player || player.rollsRemaining <= 0) {
		return failure('NO_ROLLS_REMAINING', 'No rolls remaining this turn');
	}

	return success(undefined);
}

/**
 * Validate dice.keep command
 */
export function canKeepDice(state: MultiplayerGameState, playerId: string): TransitionResult {
	// Must be in turn_decide phase (after first roll)
	if (state.phase !== 'turn_decide') {
		return failure('INVALID_PHASE', 'Cannot keep dice until after rolling');
	}

	// Must be current player's turn
	const currentPlayerId = state.playerOrder[state.currentPlayerIndex];
	if (playerId !== currentPlayerId) {
		return failure('NOT_YOUR_TURN', 'It is not your turn');
	}

	return success(undefined);
}

/**
 * Validate category.score command
 */
export function canScoreCategory(
	state: MultiplayerGameState,
	playerId: string,
	category: Category,
): TransitionResult {
	// Must be in turn_decide phase
	if (state.phase !== 'turn_decide') {
		return failure('INVALID_PHASE', 'Cannot score until after rolling');
	}

	// Must be current player's turn
	const currentPlayerId = state.playerOrder[state.currentPlayerIndex];
	if (playerId !== currentPlayerId) {
		return failure('NOT_YOUR_TURN', 'It is not your turn');
	}

	// Category must be available
	const player = state.players[playerId];
	if (!player) {
		return failure('NOT_YOUR_TURN', 'Player not found');
	}

	if (player.scorecard[category] !== null) {
		return failure('CATEGORY_ALREADY_SCORED', `${category} has already been scored`);
	}

	return success(undefined);
}

/**
 * Validate game.rematch command
 */
export function canRematch(state: MultiplayerGameState, playerId: string): TransitionResult {
	// Must be in game_over phase
	if (state.phase !== 'game_over') {
		return failure('INVALID_PHASE', 'Game is not over');
	}

	// Must be host
	const player = state.players[playerId];
	if (!player?.isHost) {
		return failure('NOT_HOST', 'Only the host can start a rematch');
	}

	return success(undefined);
}

// =============================================================================
// State Machine Helpers
// =============================================================================

/**
 * Get the next phase after scoring
 */
export function getNextPhaseAfterScore(state: MultiplayerGameState): GamePhase {
	// Check if this was the last turn of the game
	const allPlayersScored = Object.values(state.players).every(
		(p) => getRemainingCategories(p.scorecard).length === 0,
	);

	if (allPlayersScored) {
		return 'game_over';
	}

	// Move to next player's turn
	return 'turn_roll';
}

/**
 * Get the next player index (wraps around)
 */
export function getNextPlayerIndex(state: MultiplayerGameState): number {
	return (state.currentPlayerIndex + 1) % state.playerOrder.length;
}

/**
 * Check if moving to next player starts a new round
 */
export function isNewRound(state: MultiplayerGameState): boolean {
	return getNextPlayerIndex(state) === 0;
}

/**
 * Get the category to auto-score for AFK timeout
 * Returns the first available category (lowest scoring opportunity)
 */
export function getAutoScoreCategory(player: PlayerGameState): Category | null {
	const remaining = getRemainingCategories(player.scorecard);
	return remaining[0] ?? null;
}

/**
 * Check if a phase transition is allowed
 */
export function validateTransition(from: GamePhase, to: GamePhase): TransitionResult {
	if (!isValidTransition(from, to)) {
		return failure('INVALID_PHASE', `Cannot transition from ${from} to ${to}`);
	}
	return success(undefined);
}

/**
 * Calculate the next round number
 */
export function getNextRoundNumber(state: MultiplayerGameState): number {
	if (isNewRound(state)) {
		return Math.min(state.roundNumber + 1, 13);
	}
	return state.roundNumber;
}

/**
 * Calculate the next turn number for a specific player
 */
export function getNextTurnNumber(state: MultiplayerGameState): number {
	// Turn number is global (1-13 per player, but we track current player's turn)
	// When moving to next player, if we wrap to player 0, increment round
	if (isNewRound(state)) {
		return Math.min(state.turnNumber + 1, 13);
	}
	return state.turnNumber;
}

// =============================================================================
// Turn State Helpers
// =============================================================================

/**
 * Reset player's turn state for a new turn
 */
export function resetTurnState(player: PlayerGameState): Partial<PlayerGameState> {
	return {
		currentDice: null,
		keptDice: null,
		rollsRemaining: MAX_ROLLS_PER_TURN,
	};
}

/**
 * Check if player has dice to work with
 */
export function hasDice(player: PlayerGameState): boolean {
	return player.currentDice !== null;
}

/**
 * Check if player can still roll
 */
export function canStillRoll(player: PlayerGameState): boolean {
	return player.rollsRemaining > 0;
}

// =============================================================================
// Game Flow Predicates
// =============================================================================

/**
 * Check if game is in an active playing state
 */
export function isGameActive(phase: GamePhase): boolean {
	return phase === 'turn_roll' || phase === 'turn_decide' || phase === 'turn_score';
}

/**
 * Check if game is waiting to start
 */
export function isWaiting(phase: GamePhase): boolean {
	return phase === 'waiting' || phase === 'starting';
}

/**
 * Check if game has ended
 */
export function isGameOver(phase: GamePhase): boolean {
	return phase === 'game_over';
}

/**
 * Check if it's a specific player's turn
 */
export function isPlayerTurn(state: MultiplayerGameState, playerId: string): boolean {
	if (!isGameActive(state.phase)) return false;
	return state.playerOrder[state.currentPlayerIndex] === playerId;
}
