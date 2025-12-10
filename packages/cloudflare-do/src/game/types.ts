/**
 * Multiplayer Game Types
 *
 * Re-exports canonical type definitions from @dicee/shared.
 * This is the source of truth - client and server import from shared.
 *
 * For backward compatibility, MultiplayerGameState is aliased to GameState.
 */

// =============================================================================
// Re-export all types from @dicee/shared
// =============================================================================

// Dice types
export type { DiceArray, KeptMask, DiceValue, DiceIndex, RollNumber, RollsRemaining } from '@dicee/shared';
export { DICE_COUNT, MAX_ROLLS_PER_TURN } from '@dicee/shared';

// Category types
export type { Category } from '@dicee/shared';
export {
	UPPER_CATEGORIES,
	LOWER_CATEGORIES,
	ALL_CATEGORIES,
	CATEGORY_COUNT,
	UPPER_BONUS_THRESHOLD,
	UPPER_BONUS_VALUE,
	DICEE_BONUS_VALUE,
	FIXED_SCORES,
	isValidCategory,
	isUpperCategory,
	isLowerCategory,
} from '@dicee/shared';

// Scorecard types
export type { Scorecard } from '@dicee/shared';
export {
	createEmptyScorecard,
	calculateUpperSum,
	calculateTotalScore,
	getRemainingCategories,
	isScorecardComplete,
	isCategoryScored,
	getScoredCategoryCount,
} from '@dicee/shared';

// Player types
export type { ConnectionStatus, PlayerType, PlayerGameState, PlayerRanking, RoomPlayer, AIRoomPlayer } from '@dicee/shared';
export { createPlayerGameState } from '@dicee/shared';

// Game types
export type { GamePhase, GameConfig, GameState } from '@dicee/shared';
export {
	isValidTransition,
	isPlayingPhase,
	getCurrentPlayerId,
	getCurrentPlayer,
	isPlayerTurn,
	MAX_TURNS,
	MIN_PLAYERS,
	MAX_PLAYERS,
	STARTING_COUNTDOWN_SECONDS,
	AFK_WARNING_SECONDS,
	AFK_TIMEOUT_SECONDS,
} from '@dicee/shared';

// Room types
export type { RoomCode, RoomState, RoomConfig, GameRoom } from '@dicee/shared';
export { DEFAULT_ROOM_CONFIG, ROOM_CLEANUP_MS, ROOM_CODE_CHARS, ROOM_CODE_LENGTH } from '@dicee/shared';

// =============================================================================
// Backward Compatibility Aliases
// =============================================================================

import type { GameState, GameConfig } from '@dicee/shared';

/**
 * @deprecated Use GameState from @dicee/shared instead
 */
export type MultiplayerGameState = GameState;

/**
 * @deprecated Use GameConfig from @dicee/shared instead
 */
export type MultiplayerGameConfig = GameConfig;
