/**
 * Game Module Exports
 *
 * Server-authoritative game logic for multiplayer Yahtzee.
 * Client imports types from this module.
 */

// Types (source of truth)
export type {
	Category,
	ConnectionStatus,
	DiceArray,
	GamePhase,
	KeptMask,
	MultiplayerGameState,
	PlayerGameState,
	PlayerRanking,
	Scorecard,
} from './types';

export {
	// Constants
	AFK_TIMEOUT_SECONDS,
	AFK_WARNING_SECONDS,
	ALL_CATEGORIES,
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
	YAHTZEE_BONUS_VALUE,
	// Helper functions
	calculateTotalScore,
	calculateUpperSum,
	createEmptyScorecard,
	createPlayerGameState,
	getCurrentPlayer,
	getCurrentPlayerId,
	getRemainingCategories,
	isScorecardComplete,
	isValidTransition,
	isPlayerTurn as isPlayersTurn,
} from './types';

// Scoring functions
export {
	applyScore,
	calculateAllPotentialScores,
	calculateCategoryScore,
	calculateTotal,
	generateDice,
	rollWithKept,
} from './scoring';

// Schemas (Zod validation)
export type { GameCommand, GameEvent } from './schemas';

export {
	// Primitive schemas
	CategorySchema,
	ConnectionStatusSchema,
	DiceArraySchema,
	DiceValueSchema,
	GamePhaseSchema,
	KeptMaskSchema,
	// Command schemas
	GameCommandSchema,
	KeepDiceCommandSchema,
	RematchCommandSchema,
	RollDiceCommandSchema,
	ScoreCategoryCommandSchema,
	StartGameCommandSchema,
	// Event schemas
	AfkWarningEventSchema,
	CategoryScoredEventSchema,
	DiceKeptEventSchema,
	DiceRolledEventSchema,
	GameCompletedEventSchema,
	GameErrorEventSchema,
	GameEventSchema,
	GameStartedEventSchema,
	StateSyncEventSchema,
	TurnEndedEventSchema,
	TurnSkippedEventSchema,
	TurnStartedEventSchema,
	// Validation helpers
	isCategoryAvailable,
	parseGameCommand,
	parseGameEvent,
} from './schemas';

// State machine
export type { TransitionError, TransitionResult } from './machine';

export {
	// Command validators
	canKeepDice,
	canRematch,
	canRollDice,
	canScoreCategory,
	canStartGame,
	// State helpers
	canStillRoll,
	getAutoScoreCategory,
	getNextPhaseAfterScore,
	getNextPlayerIndex,
	getNextRoundNumber,
	getNextTurnNumber,
	hasDice,
	// Predicates
	isGameActive,
	isGameOver,
	isNewRound,
	isPlayerTurn,
	isWaiting,
	resetTurnState,
	validateTransition,
} from './machine';
