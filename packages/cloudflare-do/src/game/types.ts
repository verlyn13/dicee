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
// Category types
// Scorecard types
// Player types
// Game types
// Room types
export type {
	AIRoomPlayer,
	Category,
	ConnectionStatus,
	DiceArray,
	DiceIndex,
	DiceValue,
	GameConfig,
	GamePhase,
	GameRoom,
	GameState,
	KeptMask,
	PlayerGameState,
	PlayerRanking,
	PlayerType,
	RollNumber,
	RollsRemaining,
	RoomCode,
	RoomConfig,
	RoomPlayer,
	RoomState,
	Scorecard,
} from '@dicee/shared';
export {
	AFK_TIMEOUT_SECONDS,
	AFK_WARNING_SECONDS,
	ALL_CATEGORIES,
	CATEGORY_COUNT,
	calculateTotalScore,
	calculateUpperSum,
	createEmptyScorecard,
	createPlayerGameState,
	DEFAULT_ROOM_CONFIG,
	DICE_COUNT,
	DICEE_BONUS_VALUE,
	FIXED_SCORES,
	getCurrentPlayer,
	getCurrentPlayerId,
	getRemainingCategories,
	getScoredCategoryCount,
	isCategoryScored,
	isLowerCategory,
	isPlayerTurn,
	isPlayingPhase,
	isScorecardComplete,
	isUpperCategory,
	isValidCategory,
	isValidTransition,
	LOWER_CATEGORIES,
	MAX_PLAYERS,
	MAX_ROLLS_PER_TURN,
	MAX_TURNS,
	MIN_PLAYERS,
	ROOM_CLEANUP_MS,
	ROOM_CODE_CHARS,
	ROOM_CODE_LENGTH,
	STARTING_COUNTDOWN_SECONDS,
	UPPER_BONUS_THRESHOLD,
	UPPER_BONUS_VALUE,
	UPPER_CATEGORIES,
} from '@dicee/shared';

// =============================================================================
// Backward Compatibility Aliases
// =============================================================================

import type { GameConfig, GameState } from '@dicee/shared';

/**
 * @deprecated Use GameState from @dicee/shared instead
 */
export type MultiplayerGameState = GameState;

/**
 * @deprecated Use GameConfig from @dicee/shared instead
 */
export type MultiplayerGameConfig = GameConfig;
