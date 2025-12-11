/**
 * Game Module Exports
 *
 * All game-related types, state management, and logic for multiplayer Dicee.
 */

// State Machine
export type { TransitionError, TransitionResult } from './machine';
export {
	canKeepDice,
	canRematch,
	canRollDice,
	canScoreCategory,
	canStartGame,
	canStillRoll,
	getAutoScoreCategory,
	getNextPhaseAfterScore,
	getNextPlayerIndex,
	getNextRoundNumber,
	getNextTurnNumber,
	hasDice,
	isGameActive,
	isGameOver,
	isNewRound,
	isPlayerTurnInMachine,
	isWaiting,
	resetTurnState,
	validateTransition,
} from './machine';
// Scoring
export {
	applyScore,
	calculateAllPotentialScores,
	calculateCategoryScore,
	calculateTotal,
	generateDice,
	rollWithKept,
} from './scoring';
// State Manager
export type { AlarmData, AlarmType } from './state';
export { GameStateManager } from './state';
// Types
export type {
	Category,
	ConnectionStatus,
	DiceArray,
	GamePhase,
	KeptMask,
	MultiplayerGameState,
	PlayerGameState,
	PlayerRanking,
	PlayerType,
	Scorecard,
} from './types';
export {
	AFK_TIMEOUT_SECONDS,
	AFK_WARNING_SECONDS,
	ALL_CATEGORIES,
	calculateTotalScore,
	calculateUpperSum,
	createEmptyScorecard,
	createPlayerGameState,
	DICEE_BONUS_VALUE,
	getCurrentPlayer,
	getCurrentPlayerId,
	getRemainingCategories,
	isPlayerTurn,
	isScorecardComplete,
	isValidTransition,
	LOWER_CATEGORIES,
	MAX_PLAYERS,
	MAX_ROLLS_PER_TURN,
	MAX_TURNS,
	MIN_PLAYERS,
	ROOM_CLEANUP_MS,
	STARTING_COUNTDOWN_SECONDS,
	UPPER_BONUS_THRESHOLD,
	UPPER_BONUS_VALUE,
	UPPER_CATEGORIES,
} from './types';
