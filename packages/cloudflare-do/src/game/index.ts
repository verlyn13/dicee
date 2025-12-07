/**
 * Game Module Exports
 *
 * All game-related types, state management, and logic for multiplayer Yahtzee.
 */

// Types
export type {
	DiceArray,
	KeptMask,
	Category,
	GamePhase,
	ConnectionStatus,
	Scorecard,
	PlayerGameState,
	PlayerRanking,
	MultiplayerGameState,
} from './types';

export {
	UPPER_CATEGORIES,
	LOWER_CATEGORIES,
	ALL_CATEGORIES,
	UPPER_BONUS_THRESHOLD,
	UPPER_BONUS_VALUE,
	YAHTZEE_BONUS_VALUE,
	AFK_WARNING_SECONDS,
	AFK_TIMEOUT_SECONDS,
	ROOM_CLEANUP_MS,
	MAX_ROLLS_PER_TURN,
	MAX_TURNS,
	MIN_PLAYERS,
	MAX_PLAYERS,
	STARTING_COUNTDOWN_SECONDS,
	isValidTransition,
	createEmptyScorecard,
	calculateUpperSum,
	calculateTotalScore,
	getRemainingCategories,
	isScorecardComplete,
	createPlayerGameState,
	getCurrentPlayerId,
	getCurrentPlayer,
	isPlayerTurn,
} from './types';

// State Machine
export type { TransitionError, TransitionResult } from './machine';
export {
	canStartGame,
	canRollDice,
	canKeepDice,
	canScoreCategory,
	canRematch,
	getNextPhaseAfterScore,
	getNextPlayerIndex,
	isNewRound,
	getAutoScoreCategory,
	validateTransition,
	getNextRoundNumber,
	getNextTurnNumber,
	resetTurnState,
	hasDice,
	canStillRoll,
	isGameActive,
	isWaiting,
	isGameOver,
	isPlayerTurnInMachine,
} from './machine';

// Scoring
export {
	generateDice,
	rollWithKept,
	calculateCategoryScore,
	calculateAllPotentialScores,
	applyScore,
	calculateTotal,
} from './scoring';

// State Manager
export type { AlarmType, AlarmData } from './state';
export { GameStateManager } from './state';
