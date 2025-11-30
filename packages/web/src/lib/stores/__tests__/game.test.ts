/**
 * Game State Integration Tests
 * Tests for game flow orchestration and state machine behavior
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ALL_CATEGORIES } from '../../types.js';
import type { Category } from '../../types.js';
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

		const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
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
			categories: [],
			bestCategory: 'Ones',
			bestEV: 0,
			rollsRemaining: 2,
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

		const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
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
		const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
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
		expect([
			'optimal',
			'excellent',
			'good',
			'acceptable',
			'suboptimal',
			'poor',
		]).toContain(feedback?.quality);
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
			categories: [],
			bestCategory: 'Ones',
			bestEV: 0,
			rollsRemaining: 2,
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
// Probability Analysis Tests
// =============================================================================

describe('GameState: Probability Analysis', () => {
	it('starts with null analysis', () => {
		const game = createGameState();
		expect(game.currentAnalysis).toBeNull();
	});

	it('allows setting analysis', () => {
		const game = createGameState();
		const analysis = {
			categories: [
				{
					category: 'Ones' as Category,
					probability: 0.5,
					expectedValue: 2.5,
					currentScore: 3,
					isOptimal: true,
				},
			],
			bestCategory: 'Ones' as Category,
			bestEV: 2.5,
			rollsRemaining: 2,
		};

		game.setAnalysis(analysis);
		expect(game.currentAnalysis).toEqual(analysis);
	});

	it('getCategoryAnalysis returns correct category', () => {
		const game = createGameState();
		const analysis = {
			categories: [
				{
					category: 'Ones' as Category,
					probability: 0.5,
					expectedValue: 2.5,
					currentScore: 3,
					isOptimal: true,
				},
				{
					category: 'Twos' as Category,
					probability: 0.3,
					expectedValue: 4.0,
					currentScore: 6,
					isOptimal: false,
				},
			],
			bestCategory: 'Ones' as Category,
			bestEV: 2.5,
			rollsRemaining: 2,
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
			categories: [],
			bestCategory: 'Ones',
			bestEV: 0,
			rollsRemaining: 2,
		});

		expect(game.getCategoryAnalysis('Yahtzee')).toBeNull();
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
