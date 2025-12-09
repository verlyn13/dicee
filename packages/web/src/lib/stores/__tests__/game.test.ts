/**
 * Game State Integration Tests
 * Tests for game flow orchestration and state machine behavior
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Category } from '../../types.js';
import { ALL_CATEGORIES } from '../../types.js';
import { GameState } from '../game.svelte.js';

// =============================================================================
// Test Setup
// =============================================================================

function createGameState(): GameState {
	return new GameState();
}

// =============================================================================
// Initial State Tests
// =============================================================================

describe('GameState: Initial State', () => {
	it('starts in idle status', () => {
		const game = createGameState();
		expect(game.status).toBe('idle');
	});

	it('has turn number 0 before starting', () => {
		const game = createGameState();
		expect(game.turnNumber).toBe(0);
	});

	it('has roll number 0 before starting', () => {
		const game = createGameState();
		expect(game.rollNumber).toBe(0);
	});

	it('has pre_roll phase before starting', () => {
		const game = createGameState();
		expect(game.phase).toBe('pre_roll');
	});

	it('is not game active before starting', () => {
		const game = createGameState();
		expect(game.isGameActive).toBe(false);
	});

	it('is not game over before starting', () => {
		const game = createGameState();
		expect(game.isGameOver).toBe(false);
	});

	it('cannot roll before starting', () => {
		const game = createGameState();
		expect(game.canRoll).toBe(false);
	});

	it('cannot score before starting', () => {
		const game = createGameState();
		expect(game.canScore).toBe(false);
	});
});

// =============================================================================
// Game Start Tests
// =============================================================================

describe('GameState: startGame', () => {
	it('sets status to rolling', () => {
		const game = createGameState();
		game.startGame();
		expect(game.status).toBe('rolling');
	});

	it('sets turn number to 1', () => {
		const game = createGameState();
		game.startGame();
		expect(game.turnNumber).toBe(1);
	});

	it('sets roll number to 0 (pre-first-roll)', () => {
		const game = createGameState();
		game.startGame();
		expect(game.rollNumber).toBe(0);
	});

	it('sets phase to pre_roll', () => {
		const game = createGameState();
		game.startGame();
		expect(game.phase).toBe('pre_roll');
	});

	it('makes game active', () => {
		const game = createGameState();
		game.startGame();
		expect(game.isGameActive).toBe(true);
	});

	it('allows rolling', () => {
		const game = createGameState();
		game.startGame();
		expect(game.canRoll).toBe(true);
	});

	it('sets game started timestamp', () => {
		const game = createGameState();
		const before = Date.now();
		game.startGame();
		const after = Date.now();

		expect(game.gameStartedAt).toBeGreaterThanOrEqual(before);
		expect(game.gameStartedAt).toBeLessThanOrEqual(after);
	});

	it('resets scorecard', () => {
		const game = createGameState();
		game.startGame();
		expect(game.scorecard.grandTotal).toBe(0);
		expect(game.scorecard.categoriesRemaining).toHaveLength(13);
	});

	it('does not allow starting mid-game', () => {
		const game = createGameState();
		game.startGame();
		game.roll();

		const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {
			/* Suppress console output in tests */
		});
		game.startGame();
		expect(consoleSpy).toHaveBeenCalled();
		consoleSpy.mockRestore();
	});
});

// =============================================================================
// Rolling Tests
// =============================================================================

describe('GameState: roll', () => {
	let game: GameState;

	beforeEach(() => {
		game = createGameState();
		game.startGame();
	});

	it('returns dice array on successful roll', () => {
		const result = game.roll();
		expect(result).not.toBeNull();
		expect(result).toHaveLength(5);
	});

	it('increments roll number', () => {
		expect(game.rollNumber).toBe(0);
		game.roll();
		expect(game.rollNumber).toBe(1);
		game.roll();
		expect(game.rollNumber).toBe(2);
	});

	it('sets phase to deciding', () => {
		game.roll();
		expect(game.phase).toBe('deciding');
	});

	it('sets status to keeping', () => {
		game.roll();
		expect(game.status).toBe('keeping');
	});

	it('enables scoring after first roll', () => {
		expect(game.canScore).toBe(false);
		game.roll();
		expect(game.canScore).toBe(true);
	});

	it('limits to 3 rolls per turn', () => {
		game.roll(); // 1
		game.roll(); // 2
		game.roll(); // 3

		expect(game.canRoll).toBe(false);
		const result = game.roll();
		expect(result).toBeNull();
	});

	it('decrements rolls remaining', () => {
		expect(game.rollsRemaining).toBe(3);
		game.roll();
		expect(game.rollsRemaining).toBe(2);
		game.roll();
		expect(game.rollsRemaining).toBe(1);
		game.roll();
		expect(game.rollsRemaining).toBe(0);
	});

	it('clears current analysis on roll', () => {
		game.setAnalysis({
			action: 'score',
			recommendedCategory: 'Ones',
			categoryScore: 3,
			expectedValue: 3,
			categories: [],
		});
		expect(game.currentAnalysis).not.toBeNull();

		game.roll();
		expect(game.currentAnalysis).toBeNull();
	});
});

// =============================================================================
// Scoring Tests
// =============================================================================

describe('GameState: score', () => {
	let game: GameState;

	beforeEach(() => {
		game = createGameState();
		game.startGame();
		game.roll();
	});

	it('returns decision feedback on successful score', () => {
		const feedback = game.score('Chance');
		expect(feedback).not.toBeNull();
		expect(feedback?.chosenCategory).toBe('Chance');
	});

	it('returns null when scoring unavailable category', () => {
		game.score('Chance');

		// Start new turn
		game.roll();

		const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {
			/* Suppress console output in tests */
		});
		const result = game.score('Chance');
		expect(result).toBeNull();
		consoleSpy.mockRestore();
	});

	it('updates scorecard', () => {
		expect(game.scorecard.isAvailable('Chance')).toBe(true);
		game.score('Chance');
		expect(game.scorecard.isAvailable('Chance')).toBe(false);
	});

	it('sets last decision feedback', () => {
		expect(game.lastDecision).toBeNull();
		game.score('Chance');
		expect(game.lastDecision).not.toBeNull();
	});

	it('advances to next turn after scoring', () => {
		expect(game.turnNumber).toBe(1);
		game.score('Chance');
		expect(game.turnNumber).toBe(2);
	});

	it('resets roll number for new turn', () => {
		game.roll();
		expect(game.rollNumber).toBe(2);
		game.score('Chance');
		expect(game.rollNumber).toBe(0);
	});

	it('cannot score without rolling first', () => {
		const newGame = createGameState();
		newGame.startGame();

		expect(newGame.canScore).toBe(false);
		const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {
			/* Suppress console output in tests */
		});
		const result = newGame.score('Chance');
		expect(result).toBeNull();
		consoleSpy.mockRestore();
	});
});

// =============================================================================
// Decision Quality Tests
// =============================================================================

describe('GameState: Decision Quality', () => {
	let game: GameState;

	beforeEach(() => {
		game = createGameState();
		game.startGame();
		game.roll();
	});

	it('feedback includes quality assessment', () => {
		const feedback = game.score('Chance');
		expect(feedback?.quality).toBeDefined();
		expect(['optimal', 'excellent', 'good', 'acceptable', 'suboptimal', 'poor']).toContain(
			feedback?.quality,
		);
	});

	it('feedback includes EV difference', () => {
		const feedback = game.score('Chance');
		expect(feedback?.evDifference).toBeDefined();
		expect(typeof feedback?.evDifference).toBe('number');
	});

	it('feedback includes optimal category', () => {
		const feedback = game.score('Chance');
		expect(feedback?.optimalCategory).toBeDefined();
		expect(ALL_CATEGORIES).toContain(feedback?.optimalCategory);
	});
});

// =============================================================================
// Game Completion Tests
// =============================================================================

describe('GameState: Game Completion', () => {
	it('completes after 13 turns', () => {
		const game = createGameState();
		game.startGame();

		// Play all 13 turns
		for (const category of ALL_CATEGORIES) {
			game.roll();
			game.score(category);
		}

		expect(game.isGameOver).toBe(true);
		expect(game.status).toBe('completed');
	});

	it('sets completion timestamp', () => {
		const game = createGameState();
		game.startGame();

		for (const category of ALL_CATEGORIES) {
			game.roll();
			game.score(category);
		}

		expect(game.gameCompletedAt).not.toBeNull();
		expect(game.gameCompletedAt!).toBeGreaterThan(game.gameStartedAt!);
	});

	it('scorecard is complete after game', () => {
		const game = createGameState();
		game.startGame();

		for (const category of ALL_CATEGORIES) {
			game.roll();
			game.score(category);
		}

		expect(game.scorecard.isComplete).toBe(true);
		expect(game.scorecard.categoriesRemaining).toHaveLength(0);
	});

	it('turns remaining is 0 after game', () => {
		const game = createGameState();
		game.startGame();

		for (const category of ALL_CATEGORIES) {
			game.roll();
			game.score(category);
		}

		expect(game.turnsRemaining).toBe(0);
	});
});

// =============================================================================
// Reset Tests
// =============================================================================

describe('GameState: reset', () => {
	it('returns to idle state', () => {
		const game = createGameState();
		game.startGame();
		game.roll();
		game.reset();

		expect(game.status).toBe('idle');
	});

	it('clears turn tracking', () => {
		const game = createGameState();
		game.startGame();
		game.roll();
		game.reset();

		expect(game.turnNumber).toBe(0);
		expect(game.rollNumber).toBe(0);
	});

	it('clears timestamps', () => {
		const game = createGameState();
		game.startGame();
		game.roll();
		game.reset();

		expect(game.gameStartedAt).toBeNull();
		expect(game.gameCompletedAt).toBeNull();
	});

	it('clears analysis', () => {
		const game = createGameState();
		game.startGame();
		game.roll();
		game.setAnalysis({
			action: 'score',
			recommendedCategory: 'Ones',
			categoryScore: 3,
			expectedValue: 3,
			categories: [],
		});
		game.reset();

		expect(game.currentAnalysis).toBeNull();
	});

	it('clears last decision', () => {
		const game = createGameState();
		game.startGame();
		game.roll();
		game.score('Chance');
		game.reset();

		expect(game.lastDecision).toBeNull();
	});

	it('allows starting new game after reset', () => {
		const game = createGameState();
		game.startGame();
		game.roll();
		game.reset();

		game.startGame();
		expect(game.status).toBe('rolling');
		expect(game.turnNumber).toBe(1);
	});
});

// =============================================================================
// Stats Profile Tests
// =============================================================================

describe('GameState: Stats Profile', () => {
	it('defaults to intermediate profile', () => {
		const game = createGameState();
		expect(game.statsProfile).toBe('intermediate');
	});

	it('allows setting profile', () => {
		const game = createGameState();
		game.setStatsProfile('expert');
		expect(game.statsProfile).toBe('expert');

		game.setStatsProfile('beginner');
		expect(game.statsProfile).toBe('beginner');
	});

	it('defaults stats enabled to true', () => {
		const game = createGameState();
		expect(game.statsEnabled).toBe(true);
	});

	it('allows toggling stats', () => {
		const game = createGameState();
		expect(game.statsEnabled).toBe(true);

		game.toggleStats();
		expect(game.statsEnabled).toBe(false);

		game.toggleStats();
		expect(game.statsEnabled).toBe(true);
	});

	it('allows setting stats enabled directly', () => {
		const game = createGameState();
		game.setStatsEnabled(false);
		expect(game.statsEnabled).toBe(false);
	});
});

// =============================================================================
// Turn Analysis Tests
// =============================================================================

describe('GameState: Turn Analysis', () => {
	it('starts with null analysis', () => {
		const game = createGameState();
		expect(game.currentAnalysis).toBeNull();
	});

	it('allows setting analysis', () => {
		const game = createGameState();
		const analysis = {
			action: 'score' as const,
			recommendedCategory: 'Ones' as Category,
			categoryScore: 3,
			expectedValue: 2.5,
			categories: [
				{
					category: 'Ones' as Category,
					immediateScore: 3,
					isValid: true,
					expectedValue: 2.5,
				},
			],
		};

		game.setAnalysis(analysis);
		expect(game.currentAnalysis).toEqual(analysis);
	});

	it('getCategoryAnalysis returns correct category', () => {
		const game = createGameState();
		const analysis = {
			action: 'score' as const,
			recommendedCategory: 'Ones' as Category,
			categoryScore: 3,
			expectedValue: 2.5,
			categories: [
				{
					category: 'Ones' as Category,
					immediateScore: 3,
					isValid: true,
					expectedValue: 2.5,
				},
				{
					category: 'Twos' as Category,
					immediateScore: 6,
					isValid: true,
					expectedValue: 4.0,
				},
			],
		};

		game.setAnalysis(analysis);

		const onesAnalysis = game.getCategoryAnalysis('Ones');
		expect(onesAnalysis?.category).toBe('Ones');
		expect(onesAnalysis?.expectedValue).toBe(2.5);

		const twosAnalysis = game.getCategoryAnalysis('Twos');
		expect(twosAnalysis?.category).toBe('Twos');
		expect(twosAnalysis?.expectedValue).toBe(4.0);
	});

	it('getCategoryAnalysis returns null for missing category', () => {
		const game = createGameState();
		game.setAnalysis({
			action: 'score',
			recommendedCategory: 'Ones',
			categoryScore: 3,
			expectedValue: 0,
			categories: [],
		});

		expect(game.getCategoryAnalysis('Dicee')).toBeNull();
	});

	it('getCategoryAnalysis returns null when no analysis', () => {
		const game = createGameState();
		expect(game.getCategoryAnalysis('Ones')).toBeNull();
	});
});

// =============================================================================
// Derived Values Tests
// =============================================================================

describe('GameState: Derived Values', () => {
	it('isFirstRoll is true when rollNumber is 0', () => {
		const game = createGameState();
		game.startGame();
		expect(game.isFirstRoll).toBe(true);
	});

	it('isFirstRoll is false after rolling', () => {
		const game = createGameState();
		game.startGame();
		game.roll();
		expect(game.isFirstRoll).toBe(false);
	});

	it('isFinalRoll is true when rollNumber is 3', () => {
		const game = createGameState();
		game.startGame();
		game.roll();
		game.roll();
		game.roll();
		expect(game.isFinalRoll).toBe(true);
	});

	it('turnsRemaining decrements correctly', () => {
		const game = createGameState();
		game.startGame();
		expect(game.turnsRemaining).toBe(12); // 13 - 1

		game.roll();
		game.score('Ones');
		expect(game.turnsRemaining).toBe(11); // 13 - 2
	});
});

// =============================================================================
// Integration: Full Game Simulation
// =============================================================================

describe('GameState: Full Game Simulation', () => {
	it('simulates a complete game', () => {
		const game = createGameState();

		// Before start
		expect(game.status).toBe('idle');
		expect(game.isGameActive).toBe(false);

		// Start game
		game.startGame();
		expect(game.status).toBe('rolling');
		expect(game.turnNumber).toBe(1);

		// Play all 13 turns
		for (let turn = 0; turn < 13; turn++) {
			const category = ALL_CATEGORIES[turn];

			// First roll
			expect(game.canRoll).toBe(true);
			game.roll();
			expect(game.rollNumber).toBe(1);
			expect(game.canScore).toBe(true);

			// Score
			const feedback = game.score(category);
			expect(feedback).not.toBeNull();
			expect(feedback!.pointsEarned).toBeGreaterThanOrEqual(0);
		}

		// Game complete
		expect(game.isGameOver).toBe(true);
		expect(game.status).toBe('completed');
		expect(game.scorecard.categoriesRemaining).toHaveLength(0);

		// Grand total should match sum of scores
		// (Note: may differ due to upper bonus)
		expect(game.scorecard.grandTotal).toBeGreaterThanOrEqual(0);
	});

	it('game can be restarted after completion', () => {
		const game = createGameState();
		game.startGame();

		// Complete game
		for (const category of ALL_CATEGORIES) {
			game.roll();
			game.score(category);
		}

		expect(game.isGameOver).toBe(true);

		// Start new game
		game.startGame();
		expect(game.status).toBe('rolling');
		expect(game.turnNumber).toBe(1);
		expect(game.scorecard.categoriesRemaining).toHaveLength(13);
	});
});

// =============================================================================
// Decision History Tests
// =============================================================================

describe('GameState: Decision History', () => {
	describe('turn history initialization', () => {
		it('starts with empty turn history', () => {
			const game = createGameState();
			expect(game.turnHistory).toEqual([]);
		});

		it('starts with empty current turn rolls', () => {
			const game = createGameState();
			expect(game.currentTurnRolls).toEqual([]);
		});

		it('resets turn history on new game after completion', () => {
			const game = createGameState();
			game.startGame();

			// Complete full game
			for (const category of ALL_CATEGORIES) {
				game.roll();
				game.score(category);
			}

			expect(game.turnHistory.length).toBe(13);
			expect(game.isGameOver).toBe(true);

			// Start new game - should reset history
			game.startGame();
			expect(game.turnHistory).toEqual([]);
		});

		it('clears turn history on reset', () => {
			const game = createGameState();
			game.startGame();
			game.roll();
			game.score('Ones');

			game.reset();
			expect(game.turnHistory).toEqual([]);
			expect(game.currentTurnRolls).toEqual([]);
		});
	});

	describe('turn recording', () => {
		it('records turn after scoring', () => {
			const game = createGameState();
			game.startGame();
			game.roll();
			game.score('Chance');

			expect(game.turnHistory).toHaveLength(1);
			expect(game.turnHistory[0].turnNumber).toBe(1);
		});

		it('records correct category in turn decision', () => {
			const game = createGameState();
			game.startGame();
			game.roll();
			game.score('Dicee');

			expect(game.turnHistory[0].decision.category).toBe('Dicee');
		});

		it('records score in turn decision', () => {
			const game = createGameState();
			game.startGame();
			game.roll();
			game.score('Chance');

			expect(game.turnHistory[0].decision.score).toBeGreaterThanOrEqual(0);
		});

		it('records duration in turn record', () => {
			const game = createGameState();
			game.startGame();
			game.roll();
			game.score('Chance');

			expect(game.turnHistory[0].durationMs).toBeGreaterThanOrEqual(0);
		});

		it('records wasOptimal flag based on quality', () => {
			const game = createGameState();
			game.startGame();
			game.roll();
			const feedback = game.score('Chance');

			const wasOptimal = feedback?.quality === 'optimal';
			expect(game.turnHistory[0].decision.wasOptimal).toBe(wasOptimal);
		});

		it('accumulates turns through game', () => {
			const game = createGameState();
			game.startGame();

			// Play 5 turns
			for (let i = 0; i < 5; i++) {
				game.roll();
				game.score(ALL_CATEGORIES[i]);
			}

			expect(game.turnHistory).toHaveLength(5);
			expect(game.turnHistory[0].turnNumber).toBe(1);
			expect(game.turnHistory[4].turnNumber).toBe(5);
		});

		it('clears current turn rolls after scoring', () => {
			const game = createGameState();
			game.startGame();
			game.roll();
			// Current turn rolls should have entry
			game.score('Chance');
			// After scoring, should be cleared for next turn
			expect(game.currentTurnRolls).toEqual([]);
		});
	});

	describe('game summary', () => {
		it('returns null when no turns played', () => {
			const game = createGameState();
			expect(game.gameSummary).toBeNull();
		});

		it('returns null before first score', () => {
			const game = createGameState();
			game.startGame();
			game.roll();
			expect(game.gameSummary).toBeNull();
		});

		it('returns summary after first turn', () => {
			const game = createGameState();
			game.startGame();
			game.roll();
			game.score('Chance');

			const summary = game.gameSummary;
			expect(summary).not.toBeNull();
			expect(summary?.totalTurns).toBe(1);
		});

		it('includes correct final score', () => {
			const game = createGameState();
			game.startGame();

			// Complete game
			for (const category of ALL_CATEGORIES) {
				game.roll();
				game.score(category);
			}

			const summary = game.gameSummary;
			expect(summary?.finalScore).toBe(game.scorecard.grandTotal);
		});

		it('calculates total turns correctly', () => {
			const game = createGameState();
			game.startGame();

			for (const category of ALL_CATEGORIES) {
				game.roll();
				game.score(category);
			}

			expect(game.gameSummary?.totalTurns).toBe(13);
		});

		it('counts optimal decisions', () => {
			const game = createGameState();
			game.startGame();
			game.roll();
			game.score('Chance');

			const summary = game.gameSummary;
			expect(summary?.optimalDecisions).toBeDefined();
			expect(typeof summary?.optimalDecisions).toBe('number');
		});

		it('calculates efficiency (0-1 range)', () => {
			const game = createGameState();
			game.startGame();
			game.roll();
			game.score('Chance');

			const summary = game.gameSummary;
			expect(summary?.efficiency).toBeGreaterThanOrEqual(0);
			expect(summary?.efficiency).toBeLessThanOrEqual(1);
		});

		it('calculates total EV loss', () => {
			const game = createGameState();
			game.startGame();
			game.roll();
			game.score('Chance');

			const summary = game.gameSummary;
			expect(summary?.totalEVLoss).toBeGreaterThanOrEqual(0);
		});

		it('calculates average EV loss per turn', () => {
			const game = createGameState();
			game.startGame();

			// Play a few turns
			for (let i = 0; i < 3; i++) {
				game.roll();
				game.score(ALL_CATEGORIES[i]);
			}

			const summary = game.gameSummary;
			expect(summary?.avgEVLoss).toBeGreaterThanOrEqual(0);
		});

		it('tracks hold efficiency', () => {
			const game = createGameState();
			game.startGame();
			game.roll();
			game.score('Chance');

			const summary = game.gameSummary;
			expect(summary?.holdEfficiency).toBeGreaterThanOrEqual(0);
			expect(summary?.holdEfficiency).toBeLessThanOrEqual(1);
		});

		it('tracks game duration', () => {
			const game = createGameState();
			game.startGame();

			// Complete game
			for (const category of ALL_CATEGORIES) {
				game.roll();
				game.score(category);
			}

			const summary = game.gameSummary;
			expect(summary?.gameDurationMs).toBeGreaterThanOrEqual(0);
		});
	});

	describe('full game history', () => {
		it('records all 13 turns in complete game', () => {
			const game = createGameState();
			game.startGame();

			for (const category of ALL_CATEGORIES) {
				game.roll();
				game.score(category);
			}

			expect(game.turnHistory).toHaveLength(13);
		});

		it('maintains turn order', () => {
			const game = createGameState();
			game.startGame();

			for (let i = 0; i < 5; i++) {
				game.roll();
				game.score(ALL_CATEGORIES[i]);
			}

			for (let i = 0; i < 5; i++) {
				expect(game.turnHistory[i].turnNumber).toBe(i + 1);
			}
		});

		it('records correct categories for each turn', () => {
			const game = createGameState();
			game.startGame();

			for (let i = 0; i < 5; i++) {
				game.roll();
				game.score(ALL_CATEGORIES[i]);
			}

			for (let i = 0; i < 5; i++) {
				expect(game.turnHistory[i].decision.category).toBe(ALL_CATEGORIES[i]);
			}
		});
	});
});
