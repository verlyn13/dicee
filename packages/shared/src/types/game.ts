/**
 * Game State Types
 *
 * Game phase state machine and full game state.
 */

import type { PlayerGameState, PlayerRanking } from './player.js';

/**
 * Game phases - explicit state machine states
 *
 * Valid transitions:
 * - waiting → starting (host starts game, 2+ players)
 * - starting → turn_roll (countdown complete)
 * - turn_roll → turn_decide (dice rolled)
 * - turn_decide → turn_roll (reroll, if rollsRemaining > 0)
 * - turn_decide → turn_score (category selected)
 * - turn_score → turn_roll (next player's turn, turnNumber < 13)
 * - turn_score → game_over (turnNumber === 13, all players scored)
 * - turn_roll/turn_decide → turn_score (AFK timeout, auto-score)
 */
export type GamePhase =
	| 'waiting' // In lobby, waiting for host to start
	| 'starting' // Countdown before game begins
	| 'turn_roll' // Active player must roll (or first roll of turn)
	| 'turn_decide' // After roll, can keep/reroll/score
	| 'turn_score' // Scoring in progress (transitional)
	| 'game_over'; // Game completed, showing results

/**
 * Check if a phase transition is valid
 */
export function isValidTransition(from: GamePhase, to: GamePhase): boolean {
	const validTransitions: Record<GamePhase, GamePhase[]> = {
		waiting: ['starting'],
		starting: ['turn_roll'],
		turn_roll: ['turn_decide', 'turn_score'], // turn_score for AFK
		turn_decide: ['turn_roll', 'turn_score'],
		turn_score: ['turn_roll', 'game_over'],
		game_over: ['waiting'], // For rematch
	};

	return validTransitions[from]?.includes(to) ?? false;
}

/**
 * Check if game is in an active playing phase
 */
export function isPlayingPhase(phase: GamePhase): boolean {
	return ['turn_roll', 'turn_decide', 'turn_score'].includes(phase);
}

/**
 * Game configuration
 */
export interface GameConfig {
	maxPlayers: 2 | 3 | 4;
	turnTimeoutSeconds: number;
	isPublic: boolean;
}

/**
 * Complete multiplayer game state
 * Server-authoritative - this is the single source of truth
 */
export interface GameState {
	// Room identification
	roomCode: string;

	// Game phase (state machine)
	phase: GamePhase;

	// Turn management
	playerOrder: string[]; // Fixed at game start, randomized
	currentPlayerIndex: number; // Index into playerOrder
	turnNumber: number; // 1-13 (each player gets 13 turns)
	roundNumber: number; // 1-13 (each round = all players take one turn)

	// Players (keyed by player ID)
	players: Record<string, PlayerGameState>;

	// Timing
	turnStartedAt: string | null;
	gameStartedAt: string | null;
	gameCompletedAt: string | null;

	// Results (populated when game_over)
	rankings: PlayerRanking[] | null;

	// Room config
	config: GameConfig;
}

/**
 * Get current player ID
 */
export function getCurrentPlayerId(state: GameState): string | null {
	if (state.phase === 'waiting' || state.phase === 'game_over') {
		return null;
	}
	return state.playerOrder[state.currentPlayerIndex] ?? null;
}

/**
 * Get current player state
 */
export function getCurrentPlayer(state: GameState): PlayerGameState | null {
	const playerId = getCurrentPlayerId(state);
	if (!playerId) return null;
	return state.players[playerId] ?? null;
}

/**
 * Check if it's a specific player's turn
 */
export function isPlayerTurn(state: GameState, playerId: string): boolean {
	return getCurrentPlayerId(state) === playerId;
}

// =============================================================================
// Game Constants
// =============================================================================

export const MAX_TURNS = 13 as const;
export const MIN_PLAYERS = 2 as const;
export const MAX_PLAYERS = 4 as const;
export const STARTING_COUNTDOWN_SECONDS = 3 as const;

/** AFK warning threshold in seconds */
export const AFK_WARNING_SECONDS = 45 as const;

/** AFK timeout in seconds */
export const AFK_TIMEOUT_SECONDS = 60 as const;
