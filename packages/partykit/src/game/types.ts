/**
 * Multiplayer Game Types
 *
 * Server-authoritative type definitions for the multiplayer game.
 * This is the source of truth - client imports these types.
 */

// =============================================================================
// Dice Types
// =============================================================================

/** Array of 5 dice values (1-6) */
export type DiceArray = [number, number, number, number, number];

/** Mask indicating which dice are kept (true = kept) */
export type KeptMask = [boolean, boolean, boolean, boolean, boolean];

// =============================================================================
// Scoring Categories
// =============================================================================

/** All scoring categories in Yahtzee */
export type Category =
	// Upper section
	| 'ones'
	| 'twos'
	| 'threes'
	| 'fours'
	| 'fives'
	| 'sixes'
	// Lower section
	| 'threeOfAKind'
	| 'fourOfAKind'
	| 'fullHouse'
	| 'smallStraight'
	| 'largeStraight'
	| 'yahtzee'
	| 'chance';

/** Upper section categories */
export const UPPER_CATEGORIES: Category[] = ['ones', 'twos', 'threes', 'fours', 'fives', 'sixes'];

/** Lower section categories */
export const LOWER_CATEGORIES: Category[] = [
	'threeOfAKind',
	'fourOfAKind',
	'fullHouse',
	'smallStraight',
	'largeStraight',
	'yahtzee',
	'chance',
];

/** All categories */
export const ALL_CATEGORIES: Category[] = [...UPPER_CATEGORIES, ...LOWER_CATEGORIES];

/** Upper bonus threshold */
export const UPPER_BONUS_THRESHOLD = 63;
export const UPPER_BONUS_VALUE = 35;

/** Yahtzee bonus value */
export const YAHTZEE_BONUS_VALUE = 100;

// =============================================================================
// Game Phase State Machine
// =============================================================================

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

// =============================================================================
// Player Connection Status
// =============================================================================

/** Player connection status */
export type ConnectionStatus = 'online' | 'away' | 'disconnected';

/** AFK warning threshold in seconds */
export const AFK_WARNING_SECONDS = 45;

/** AFK timeout in seconds */
export const AFK_TIMEOUT_SECONDS = 60;

/** Room cleanup timeout in milliseconds (5 minutes) */
export const ROOM_CLEANUP_MS = 5 * 60 * 1000;

// =============================================================================
// Scorecard
// =============================================================================

/**
 * Player scorecard - all 13 categories plus bonuses
 * null = not yet scored
 */
export interface Scorecard {
	// Upper section (value = sum of matching dice)
	ones: number | null;
	twos: number | null;
	threes: number | null;
	fours: number | null;
	fives: number | null;
	sixes: number | null;

	// Lower section
	threeOfAKind: number | null; // Sum of all dice
	fourOfAKind: number | null; // Sum of all dice
	fullHouse: number | null; // 25 points
	smallStraight: number | null; // 30 points
	largeStraight: number | null; // 40 points
	yahtzee: number | null; // 50 points
	chance: number | null; // Sum of all dice

	// Bonuses (calculated, not set by player)
	yahtzeeBonus: number; // 0, 100, 200, 300... (100 per additional Yahtzee)
	upperBonus: number; // 0 or 35 (if upper section >= 63)
}

/**
 * Create an empty scorecard
 */
export function createEmptyScorecard(): Scorecard {
	return {
		ones: null,
		twos: null,
		threes: null,
		fours: null,
		fives: null,
		sixes: null,
		threeOfAKind: null,
		fourOfAKind: null,
		fullHouse: null,
		smallStraight: null,
		largeStraight: null,
		yahtzee: null,
		chance: null,
		yahtzeeBonus: 0,
		upperBonus: 0,
	};
}

/**
 * Calculate upper section sum
 */
export function calculateUpperSum(scorecard: Scorecard): number {
	return (
		(scorecard.ones ?? 0) +
		(scorecard.twos ?? 0) +
		(scorecard.threes ?? 0) +
		(scorecard.fours ?? 0) +
		(scorecard.fives ?? 0) +
		(scorecard.sixes ?? 0)
	);
}

/**
 * Calculate total score including bonuses
 */
export function calculateTotalScore(scorecard: Scorecard): number {
	const upper = calculateUpperSum(scorecard);
	const upperBonus = upper >= UPPER_BONUS_THRESHOLD ? UPPER_BONUS_VALUE : 0;

	const lower =
		(scorecard.threeOfAKind ?? 0) +
		(scorecard.fourOfAKind ?? 0) +
		(scorecard.fullHouse ?? 0) +
		(scorecard.smallStraight ?? 0) +
		(scorecard.largeStraight ?? 0) +
		(scorecard.yahtzee ?? 0) +
		(scorecard.chance ?? 0);

	return upper + upperBonus + lower + scorecard.yahtzeeBonus;
}

/**
 * Get remaining (unscored) categories
 */
export function getRemainingCategories(scorecard: Scorecard): Category[] {
	return ALL_CATEGORIES.filter((cat) => scorecard[cat] === null);
}

/**
 * Check if scorecard is complete
 */
export function isScorecardComplete(scorecard: Scorecard): boolean {
	return getRemainingCategories(scorecard).length === 0;
}

// =============================================================================
// Player Game State
// =============================================================================

/**
 * Player state within a game
 */
export interface PlayerGameState {
	// Identity
	id: string;
	displayName: string;
	avatarSeed: string;

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
): PlayerGameState {
	const now = new Date().toISOString();
	return {
		id,
		displayName,
		avatarSeed,
		isConnected: true,
		connectionId,
		lastActive: now,
		connectionStatus: 'online',
		isHost,
		joinedAt: now,
		scorecard: createEmptyScorecard(),
		totalScore: 0,
		currentDice: null,
		keptDice: null,
		rollsRemaining: 3,
	};
}

// =============================================================================
// Game Rankings
// =============================================================================

/**
 * Final player ranking
 */
export interface PlayerRanking {
	playerId: string;
	displayName: string;
	rank: number; // 1 = winner
	score: number;
	yahtzeeCount: number;
}

// =============================================================================
// Multiplayer Game State (Full)
// =============================================================================

/**
 * Complete multiplayer game state
 * Server-authoritative - this is the single source of truth
 */
export interface MultiplayerGameState {
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

	// Room config (from Phase 4)
	config: {
		maxPlayers: 2 | 3 | 4;
		turnTimeoutSeconds: number;
		isPublic: boolean;
	};
}

/**
 * Get current player ID
 */
export function getCurrentPlayerId(state: MultiplayerGameState): string | null {
	if (state.phase === 'waiting' || state.phase === 'game_over') {
		return null;
	}
	return state.playerOrder[state.currentPlayerIndex] ?? null;
}

/**
 * Get current player state
 */
export function getCurrentPlayer(state: MultiplayerGameState): PlayerGameState | null {
	const playerId = getCurrentPlayerId(state);
	if (!playerId) return null;
	return state.players[playerId] ?? null;
}

/**
 * Check if it's a specific player's turn
 */
export function isPlayerTurn(state: MultiplayerGameState, playerId: string): boolean {
	return getCurrentPlayerId(state) === playerId;
}

// =============================================================================
// Game Constants
// =============================================================================

export const MAX_ROLLS_PER_TURN = 3;
export const MAX_TURNS = 13;
export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 4;
export const STARTING_COUNTDOWN_SECONDS = 3;
