/**
 * State Machine Unit Tests
 *
 * Tests transition validators and state machine helpers.
 * Server-authoritative - validates all game actions.
 */

import { describe, it, expect } from 'vitest';
import {
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
} from '../machine';
import {
	createEmptyScorecard,
	createPlayerGameState,
	type MultiplayerGameState,
	type PlayerGameState,
	type GamePhase,
} from '../types';

// =============================================================================
// Test Fixtures
// =============================================================================

function createTestPlayer(
	id: string,
	options: {
		isHost?: boolean;
		isConnected?: boolean;
		rollsRemaining?: number;
		currentDice?: [number, number, number, number, number] | null;
	} = {},
): PlayerGameState {
	const player = createPlayerGameState(id, `Player ${id}`, `seed-${id}`, options.isHost ?? false, `conn-${id}`);
	player.isConnected = options.isConnected ?? true;
	player.rollsRemaining = options.rollsRemaining ?? 3;
	player.currentDice = options.currentDice ?? null;
	return player;
}

function createTestGameState(
	phase: GamePhase,
	players: Record<string, PlayerGameState>,
	options: {
		currentPlayerIndex?: number;
		playerOrder?: string[];
		roundNumber?: number;
		turnNumber?: number;
	} = {},
): MultiplayerGameState {
	const playerIds = Object.keys(players);
	return {
		roomCode: 'TEST01',
		phase,
		playerOrder: options.playerOrder ?? playerIds,
		currentPlayerIndex: options.currentPlayerIndex ?? 0,
		turnNumber: options.turnNumber ?? 1,
		roundNumber: options.roundNumber ?? 1,
		players,
		turnStartedAt: new Date().toISOString(),
		gameStartedAt: phase !== 'waiting' ? new Date().toISOString() : null,
		gameCompletedAt: phase === 'game_over' ? new Date().toISOString() : null,
		rankings: null,
		config: {
			maxPlayers: 4,
			turnTimeoutSeconds: 60,
			isPublic: false,
		},
	};
}

// =============================================================================
// canStartGame Tests
// =============================================================================

describe('canStartGame', () => {
	it('should allow host to start with 2+ connected players', () => {
		const players = {
			host: createTestPlayer('host', { isHost: true }),
			p2: createTestPlayer('p2'),
		};
		const state = createTestGameState('waiting', players);

		const result = canStartGame(state, 'host');
		expect(result.success).toBe(true);
	});

	it('should reject non-host starting game', () => {
		const players = {
			host: createTestPlayer('host', { isHost: true }),
			p2: createTestPlayer('p2'),
		};
		const state = createTestGameState('waiting', players);

		const result = canStartGame(state, 'p2');
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error).toBe('NOT_HOST');
		}
	});

	it('should reject if game already started', () => {
		const players = {
			host: createTestPlayer('host', { isHost: true }),
			p2: createTestPlayer('p2'),
		};
		const state = createTestGameState('turn_roll', players);

		const result = canStartGame(state, 'host');
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error).toBe('GAME_IN_PROGRESS');
		}
	});

	it('should reject if not enough players', () => {
		const players = {
			host: createTestPlayer('host', { isHost: true }),
		};
		const state = createTestGameState('waiting', players);

		const result = canStartGame(state, 'host');
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error).toBe('NOT_ENOUGH_PLAYERS');
		}
	});

	it('should reject if other players are disconnected', () => {
		const players = {
			host: createTestPlayer('host', { isHost: true }),
			p2: createTestPlayer('p2', { isConnected: false }),
		};
		const state = createTestGameState('waiting', players);

		const result = canStartGame(state, 'host');
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error).toBe('NOT_ENOUGH_PLAYERS');
		}
	});

	it('should allow start with 3+ players', () => {
		const players = {
			host: createTestPlayer('host', { isHost: true }),
			p2: createTestPlayer('p2'),
			p3: createTestPlayer('p3'),
		};
		const state = createTestGameState('waiting', players);

		const result = canStartGame(state, 'host');
		expect(result.success).toBe(true);
	});
});

// =============================================================================
// canRollDice Tests
// =============================================================================

describe('canRollDice', () => {
	it('should allow current player to roll in turn_roll phase', () => {
		const players = {
			p1: createTestPlayer('p1', { rollsRemaining: 3 }),
			p2: createTestPlayer('p2'),
		};
		const state = createTestGameState('turn_roll', players, { playerOrder: ['p1', 'p2'] });

		const result = canRollDice(state, 'p1');
		expect(result.success).toBe(true);
	});

	it('should allow current player to roll in turn_decide phase', () => {
		const players = {
			p1: createTestPlayer('p1', { rollsRemaining: 2 }),
			p2: createTestPlayer('p2'),
		};
		const state = createTestGameState('turn_decide', players, { playerOrder: ['p1', 'p2'] });

		const result = canRollDice(state, 'p1');
		expect(result.success).toBe(true);
	});

	it('should reject if not current player', () => {
		const players = {
			p1: createTestPlayer('p1'),
			p2: createTestPlayer('p2'),
		};
		const state = createTestGameState('turn_roll', players, { playerOrder: ['p1', 'p2'] });

		const result = canRollDice(state, 'p2');
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error).toBe('NOT_YOUR_TURN');
		}
	});

	it('should reject if no rolls remaining', () => {
		const players = {
			p1: createTestPlayer('p1', { rollsRemaining: 0 }),
			p2: createTestPlayer('p2'),
		};
		const state = createTestGameState('turn_decide', players, { playerOrder: ['p1', 'p2'] });

		const result = canRollDice(state, 'p1');
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error).toBe('NO_ROLLS_REMAINING');
		}
	});

	it('should reject in waiting phase', () => {
		const players = {
			p1: createTestPlayer('p1'),
			p2: createTestPlayer('p2'),
		};
		const state = createTestGameState('waiting', players);

		const result = canRollDice(state, 'p1');
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error).toBe('INVALID_PHASE');
		}
	});

	it('should reject in game_over phase', () => {
		const players = {
			p1: createTestPlayer('p1'),
			p2: createTestPlayer('p2'),
		};
		const state = createTestGameState('game_over', players);

		const result = canRollDice(state, 'p1');
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error).toBe('INVALID_PHASE');
		}
	});
});

// =============================================================================
// canKeepDice Tests
// =============================================================================

describe('canKeepDice', () => {
	it('should allow current player to keep dice in turn_decide', () => {
		const players = {
			p1: createTestPlayer('p1'),
			p2: createTestPlayer('p2'),
		};
		const state = createTestGameState('turn_decide', players, { playerOrder: ['p1', 'p2'] });

		const result = canKeepDice(state, 'p1');
		expect(result.success).toBe(true);
	});

	it('should reject if not current player', () => {
		const players = {
			p1: createTestPlayer('p1'),
			p2: createTestPlayer('p2'),
		};
		const state = createTestGameState('turn_decide', players, { playerOrder: ['p1', 'p2'] });

		const result = canKeepDice(state, 'p2');
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error).toBe('NOT_YOUR_TURN');
		}
	});

	it('should reject in turn_roll phase (before first roll)', () => {
		const players = {
			p1: createTestPlayer('p1'),
			p2: createTestPlayer('p2'),
		};
		const state = createTestGameState('turn_roll', players, { playerOrder: ['p1', 'p2'] });

		const result = canKeepDice(state, 'p1');
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error).toBe('INVALID_PHASE');
		}
	});
});

// =============================================================================
// canScoreCategory Tests
// =============================================================================

describe('canScoreCategory', () => {
	it('should allow current player to score available category', () => {
		const players = {
			p1: createTestPlayer('p1'),
			p2: createTestPlayer('p2'),
		};
		players.p1.currentDice = [1, 2, 3, 4, 5];
		const state = createTestGameState('turn_decide', players, { playerOrder: ['p1', 'p2'] });

		const result = canScoreCategory(state, 'p1', 'ones');
		expect(result.success).toBe(true);
	});

	it('should reject if not current player', () => {
		const players = {
			p1: createTestPlayer('p1'),
			p2: createTestPlayer('p2'),
		};
		const state = createTestGameState('turn_decide', players, { playerOrder: ['p1', 'p2'] });

		const result = canScoreCategory(state, 'p2', 'ones');
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error).toBe('NOT_YOUR_TURN');
		}
	});

	it('should reject if category already scored', () => {
		const players = {
			p1: createTestPlayer('p1'),
			p2: createTestPlayer('p2'),
		};
		players.p1.scorecard.ones = 3;
		players.p1.currentDice = [1, 2, 3, 4, 5];
		const state = createTestGameState('turn_decide', players, { playerOrder: ['p1', 'p2'] });

		const result = canScoreCategory(state, 'p1', 'ones');
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error).toBe('CATEGORY_ALREADY_SCORED');
		}
	});

	it('should reject in turn_roll phase (before rolling)', () => {
		const players = {
			p1: createTestPlayer('p1'),
			p2: createTestPlayer('p2'),
		};
		const state = createTestGameState('turn_roll', players, { playerOrder: ['p1', 'p2'] });

		const result = canScoreCategory(state, 'p1', 'ones');
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error).toBe('INVALID_PHASE');
		}
	});

	it('should reject if player not found', () => {
		const players = {
			p1: createTestPlayer('p1'),
			p2: createTestPlayer('p2'),
		};
		const state = createTestGameState('turn_decide', players, { playerOrder: ['p1', 'p2'] });

		const result = canScoreCategory(state, 'unknown', 'ones');
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error).toBe('NOT_YOUR_TURN');
		}
	});
});

// =============================================================================
// canRematch Tests
// =============================================================================

describe('canRematch', () => {
	it('should allow host to start rematch in game_over', () => {
		const players = {
			host: createTestPlayer('host', { isHost: true }),
			p2: createTestPlayer('p2'),
		};
		const state = createTestGameState('game_over', players);

		const result = canRematch(state, 'host');
		expect(result.success).toBe(true);
	});

	it('should reject non-host starting rematch', () => {
		const players = {
			host: createTestPlayer('host', { isHost: true }),
			p2: createTestPlayer('p2'),
		};
		const state = createTestGameState('game_over', players);

		const result = canRematch(state, 'p2');
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error).toBe('NOT_HOST');
		}
	});

	it('should reject if game not over', () => {
		const players = {
			host: createTestPlayer('host', { isHost: true }),
			p2: createTestPlayer('p2'),
		};
		const state = createTestGameState('turn_decide', players);

		const result = canRematch(state, 'host');
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error).toBe('INVALID_PHASE');
		}
	});
});

// =============================================================================
// getNextPhaseAfterScore Tests
// =============================================================================

describe('getNextPhaseAfterScore', () => {
	it('should return turn_roll when game continues', () => {
		const players = {
			p1: createTestPlayer('p1'),
			p2: createTestPlayer('p2'),
		};
		// Only ones is scored - 12 categories remain
		players.p1.scorecard.ones = 3;
		const state = createTestGameState('turn_decide', players, { playerOrder: ['p1', 'p2'] });

		const result = getNextPhaseAfterScore(state);
		expect(result).toBe('turn_roll');
	});

	it('should return game_over when all players completed all categories', () => {
		const players = {
			p1: createTestPlayer('p1'),
			p2: createTestPlayer('p2'),
		};

		// Fill all categories for both players
		const categories = [
			'ones',
			'twos',
			'threes',
			'fours',
			'fives',
			'sixes',
			'threeOfAKind',
			'fourOfAKind',
			'fullHouse',
			'smallStraight',
			'largeStraight',
			'yahtzee',
			'chance',
		] as const;

		for (const cat of categories) {
			players.p1.scorecard[cat] = 10;
			players.p2.scorecard[cat] = 10;
		}

		const state = createTestGameState('turn_decide', players, { playerOrder: ['p1', 'p2'] });

		const result = getNextPhaseAfterScore(state);
		expect(result).toBe('game_over');
	});

	it('should return turn_roll if any player has remaining categories', () => {
		const players = {
			p1: createTestPlayer('p1'),
			p2: createTestPlayer('p2'),
		};

		// Fill all categories for p1
		const categories = [
			'ones',
			'twos',
			'threes',
			'fours',
			'fives',
			'sixes',
			'threeOfAKind',
			'fourOfAKind',
			'fullHouse',
			'smallStraight',
			'largeStraight',
			'yahtzee',
			'chance',
		] as const;

		for (const cat of categories) {
			players.p1.scorecard[cat] = 10;
		}
		// p2 still has ones available
		players.p2.scorecard.ones = null;

		const state = createTestGameState('turn_decide', players, { playerOrder: ['p1', 'p2'] });

		const result = getNextPhaseAfterScore(state);
		expect(result).toBe('turn_roll');
	});
});

// =============================================================================
// getNextPlayerIndex Tests
// =============================================================================

describe('getNextPlayerIndex', () => {
	it('should return next player index', () => {
		const players = {
			p1: createTestPlayer('p1'),
			p2: createTestPlayer('p2'),
			p3: createTestPlayer('p3'),
		};
		const state = createTestGameState('turn_roll', players, {
			playerOrder: ['p1', 'p2', 'p3'],
			currentPlayerIndex: 0,
		});

		expect(getNextPlayerIndex(state)).toBe(1);
	});

	it('should wrap around to first player', () => {
		const players = {
			p1: createTestPlayer('p1'),
			p2: createTestPlayer('p2'),
			p3: createTestPlayer('p3'),
		};
		const state = createTestGameState('turn_roll', players, {
			playerOrder: ['p1', 'p2', 'p3'],
			currentPlayerIndex: 2,
		});

		expect(getNextPlayerIndex(state)).toBe(0);
	});
});

// =============================================================================
// isNewRound Tests
// =============================================================================

describe('isNewRound', () => {
	it('should return true when wrapping to first player', () => {
		const players = {
			p1: createTestPlayer('p1'),
			p2: createTestPlayer('p2'),
		};
		const state = createTestGameState('turn_roll', players, {
			playerOrder: ['p1', 'p2'],
			currentPlayerIndex: 1,
		});

		expect(isNewRound(state)).toBe(true);
	});

	it('should return false when not wrapping', () => {
		const players = {
			p1: createTestPlayer('p1'),
			p2: createTestPlayer('p2'),
			p3: createTestPlayer('p3'),
		};
		const state = createTestGameState('turn_roll', players, {
			playerOrder: ['p1', 'p2', 'p3'],
			currentPlayerIndex: 0,
		});

		expect(isNewRound(state)).toBe(false);
	});
});

// =============================================================================
// getAutoScoreCategory Tests
// =============================================================================

describe('getAutoScoreCategory', () => {
	it('should return first available category', () => {
		const player = createTestPlayer('p1');
		// Default scorecard has all categories null

		expect(getAutoScoreCategory(player)).toBe('ones');
	});

	it('should skip already scored categories', () => {
		const player = createTestPlayer('p1');
		player.scorecard.ones = 3;
		player.scorecard.twos = 6;

		expect(getAutoScoreCategory(player)).toBe('threes');
	});

	it('should return null when all categories scored', () => {
		const player = createTestPlayer('p1');
		const categories = [
			'ones',
			'twos',
			'threes',
			'fours',
			'fives',
			'sixes',
			'threeOfAKind',
			'fourOfAKind',
			'fullHouse',
			'smallStraight',
			'largeStraight',
			'yahtzee',
			'chance',
		] as const;

		for (const cat of categories) {
			player.scorecard[cat] = 10;
		}

		expect(getAutoScoreCategory(player)).toBe(null);
	});
});

// =============================================================================
// validateTransition Tests
// =============================================================================

describe('validateTransition', () => {
	const validTransitions: Array<[GamePhase, GamePhase]> = [
		['waiting', 'starting'],
		['starting', 'turn_roll'],
		['turn_roll', 'turn_decide'],
		['turn_roll', 'turn_score'],
		['turn_decide', 'turn_roll'],
		['turn_decide', 'turn_score'],
		['turn_score', 'turn_roll'],
		['turn_score', 'game_over'],
		['game_over', 'waiting'],
	];

	const invalidTransitions: Array<[GamePhase, GamePhase]> = [
		['waiting', 'turn_roll'],
		['waiting', 'game_over'],
		['starting', 'waiting'],
		['turn_roll', 'waiting'],
		['turn_decide', 'game_over'],
		['game_over', 'turn_roll'],
	];

	describe('valid transitions', () => {
		it.each(validTransitions)('should allow %s → %s', (from, to) => {
			const result = validateTransition(from, to);
			expect(result.success).toBe(true);
		});
	});

	describe('invalid transitions', () => {
		it.each(invalidTransitions)('should reject %s → %s', (from, to) => {
			const result = validateTransition(from, to);
			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error).toBe('INVALID_PHASE');
			}
		});
	});
});

// =============================================================================
// getNextRoundNumber Tests
// =============================================================================

describe('getNextRoundNumber', () => {
	it('should increment when starting new round', () => {
		const players = {
			p1: createTestPlayer('p1'),
			p2: createTestPlayer('p2'),
		};
		const state = createTestGameState('turn_roll', players, {
			playerOrder: ['p1', 'p2'],
			currentPlayerIndex: 1, // Last player
			roundNumber: 3,
		});

		expect(getNextRoundNumber(state)).toBe(4);
	});

	it('should stay same when not new round', () => {
		const players = {
			p1: createTestPlayer('p1'),
			p2: createTestPlayer('p2'),
		};
		const state = createTestGameState('turn_roll', players, {
			playerOrder: ['p1', 'p2'],
			currentPlayerIndex: 0, // First player
			roundNumber: 3,
		});

		expect(getNextRoundNumber(state)).toBe(3);
	});

	it('should cap at 13', () => {
		const players = {
			p1: createTestPlayer('p1'),
			p2: createTestPlayer('p2'),
		};
		const state = createTestGameState('turn_roll', players, {
			playerOrder: ['p1', 'p2'],
			currentPlayerIndex: 1,
			roundNumber: 13,
		});

		expect(getNextRoundNumber(state)).toBe(13);
	});
});

// =============================================================================
// getNextTurnNumber Tests
// =============================================================================

describe('getNextTurnNumber', () => {
	it('should increment when starting new round', () => {
		const players = {
			p1: createTestPlayer('p1'),
			p2: createTestPlayer('p2'),
		};
		const state = createTestGameState('turn_roll', players, {
			playerOrder: ['p1', 'p2'],
			currentPlayerIndex: 1, // Last player
			turnNumber: 5,
		});

		expect(getNextTurnNumber(state)).toBe(6);
	});

	it('should stay same when not new round', () => {
		const players = {
			p1: createTestPlayer('p1'),
			p2: createTestPlayer('p2'),
		};
		const state = createTestGameState('turn_roll', players, {
			playerOrder: ['p1', 'p2'],
			currentPlayerIndex: 0, // First player
			turnNumber: 5,
		});

		expect(getNextTurnNumber(state)).toBe(5);
	});

	it('should cap at 13', () => {
		const players = {
			p1: createTestPlayer('p1'),
			p2: createTestPlayer('p2'),
		};
		const state = createTestGameState('turn_roll', players, {
			playerOrder: ['p1', 'p2'],
			currentPlayerIndex: 1,
			turnNumber: 13,
		});

		expect(getNextTurnNumber(state)).toBe(13);
	});
});

// =============================================================================
// resetTurnState Tests
// =============================================================================

describe('resetTurnState', () => {
	it('should reset all turn-related state', () => {
		const player = createTestPlayer('p1', {
			currentDice: [1, 2, 3, 4, 5],
			rollsRemaining: 0,
		});
		player.keptDice = [true, true, false, false, false];

		const reset = resetTurnState(player);

		expect(reset.currentDice).toBe(null);
		expect(reset.keptDice).toBe(null);
		expect(reset.rollsRemaining).toBe(3);
	});
});

// =============================================================================
// hasDice Tests
// =============================================================================

describe('hasDice', () => {
	it('should return true when player has dice', () => {
		const player = createTestPlayer('p1', { currentDice: [1, 2, 3, 4, 5] });
		expect(hasDice(player)).toBe(true);
	});

	it('should return false when player has no dice', () => {
		const player = createTestPlayer('p1', { currentDice: null });
		expect(hasDice(player)).toBe(false);
	});
});

// =============================================================================
// canStillRoll Tests
// =============================================================================

describe('canStillRoll', () => {
	it('should return true with rolls remaining', () => {
		const player = createTestPlayer('p1', { rollsRemaining: 2 });
		expect(canStillRoll(player)).toBe(true);
	});

	it('should return true with 1 roll remaining', () => {
		const player = createTestPlayer('p1', { rollsRemaining: 1 });
		expect(canStillRoll(player)).toBe(true);
	});

	it('should return false with 0 rolls remaining', () => {
		const player = createTestPlayer('p1', { rollsRemaining: 0 });
		expect(canStillRoll(player)).toBe(false);
	});
});

// =============================================================================
// Phase Predicates Tests
// =============================================================================

describe('isGameActive', () => {
	it('should return true for turn_roll', () => {
		expect(isGameActive('turn_roll')).toBe(true);
	});

	it('should return true for turn_decide', () => {
		expect(isGameActive('turn_decide')).toBe(true);
	});

	it('should return true for turn_score', () => {
		expect(isGameActive('turn_score')).toBe(true);
	});

	it('should return false for waiting', () => {
		expect(isGameActive('waiting')).toBe(false);
	});

	it('should return false for starting', () => {
		expect(isGameActive('starting')).toBe(false);
	});

	it('should return false for game_over', () => {
		expect(isGameActive('game_over')).toBe(false);
	});
});

describe('isWaiting', () => {
	it('should return true for waiting', () => {
		expect(isWaiting('waiting')).toBe(true);
	});

	it('should return true for starting', () => {
		expect(isWaiting('starting')).toBe(true);
	});

	it('should return false for turn_roll', () => {
		expect(isWaiting('turn_roll')).toBe(false);
	});

	it('should return false for game_over', () => {
		expect(isWaiting('game_over')).toBe(false);
	});
});

describe('isGameOver', () => {
	it('should return true for game_over', () => {
		expect(isGameOver('game_over')).toBe(true);
	});

	it('should return false for waiting', () => {
		expect(isGameOver('waiting')).toBe(false);
	});

	it('should return false for turn_roll', () => {
		expect(isGameOver('turn_roll')).toBe(false);
	});
});

// =============================================================================
// isPlayerTurnInMachine Tests
// =============================================================================

describe('isPlayerTurnInMachine', () => {
	it('should return true for current player in active phase', () => {
		const players = {
			p1: createTestPlayer('p1'),
			p2: createTestPlayer('p2'),
		};
		const state = createTestGameState('turn_roll', players, {
			playerOrder: ['p1', 'p2'],
			currentPlayerIndex: 0,
		});

		expect(isPlayerTurnInMachine(state, 'p1')).toBe(true);
	});

	it('should return false for non-current player', () => {
		const players = {
			p1: createTestPlayer('p1'),
			p2: createTestPlayer('p2'),
		};
		const state = createTestGameState('turn_roll', players, {
			playerOrder: ['p1', 'p2'],
			currentPlayerIndex: 0,
		});

		expect(isPlayerTurnInMachine(state, 'p2')).toBe(false);
	});

	it('should return false in waiting phase', () => {
		const players = {
			p1: createTestPlayer('p1'),
			p2: createTestPlayer('p2'),
		};
		const state = createTestGameState('waiting', players, {
			playerOrder: ['p1', 'p2'],
			currentPlayerIndex: 0,
		});

		expect(isPlayerTurnInMachine(state, 'p1')).toBe(false);
	});

	it('should return false in game_over phase', () => {
		const players = {
			p1: createTestPlayer('p1'),
			p2: createTestPlayer('p2'),
		};
		const state = createTestGameState('game_over', players, {
			playerOrder: ['p1', 'p2'],
			currentPlayerIndex: 0,
		});

		expect(isPlayerTurnInMachine(state, 'p1')).toBe(false);
	});
});
