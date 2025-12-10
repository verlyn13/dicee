/**
 * Player Types
 *
 * Player state and connection types for multiplayer games.
 */

import type { DiceArray, KeptMask } from './dice.js';
import type { Scorecard } from './scorecard.js';
import { createEmptyScorecard } from './scorecard.js';

/** Player connection status */
export type ConnectionStatus = 'online' | 'away' | 'disconnected';

/** Player type - human or AI */
export type PlayerType = 'human' | 'ai';

/**
 * Player state within a game
 */
export interface PlayerGameState {
	// Identity
	id: string;
	displayName: string;
	avatarSeed: string;

	// Player type (human or AI)
	type: PlayerType;
	aiProfileId?: string; // For AI players, the profile ID

	// Connection tracking
	isConnected: boolean;
	connectionId: string | null;
	lastActive: string; // ISO timestamp
	connectionStatus: ConnectionStatus;

	// Room role
	isHost: boolean;
	joinedAt: string; // ISO timestamp

	// Game state
	scorecard: Scorecard;
	totalScore: number;

	// Current turn state (only meaningful for active player)
	currentDice: DiceArray | null;
	keptDice: KeptMask | null;
	rollsRemaining: number; // 3, 2, 1, or 0
}

/**
 * Create initial player game state
 */
export function createPlayerGameState(
	id: string,
	displayName: string,
	avatarSeed: string,
	isHost: boolean,
	connectionId: string,
	type: PlayerType = 'human',
	aiProfileId?: string
): PlayerGameState {
	const now = new Date().toISOString();
	return {
		id,
		displayName,
		avatarSeed,
		type,
		aiProfileId,
		isConnected: type === 'human', // AI players don't have connections
		connectionId: type === 'human' ? connectionId : null,
		lastActive: now,
		connectionStatus: 'online', // AI is always "online"
		isHost,
		joinedAt: now,
		scorecard: createEmptyScorecard(),
		totalScore: 0,
		currentDice: null,
		keptDice: null,
		rollsRemaining: 3,
	};
}

/**
 * Final player ranking (for game over)
 */
export interface PlayerRanking {
	playerId: string;
	displayName: string;
	rank: number; // 1 = winner
	score: number;
	diceeCount: number;
}

/**
 * Player info for room display (lighter than full PlayerGameState)
 */
export interface RoomPlayer {
	id: string;
	displayName: string;
	avatarSeed: string;
	isConnected: boolean;
	isHost: boolean;
	joinedAt: string;
}

/**
 * AI player in a room
 */
export interface AIRoomPlayer {
	id: string; // Format: ai:profileId:timestamp
	profileId: string; // e.g., 'carmen', 'professor'
	displayName: string;
	avatarSeed: string;
}
