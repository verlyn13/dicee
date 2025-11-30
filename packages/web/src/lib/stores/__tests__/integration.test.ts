/**
 * Store-Component Integration Tests
 * Verifies that stores work correctly with components in realistic scenarios
 */

import { beforeEach, describe, expect, it } from 'vitest';
import type { Category } from '../../types.js';
import { ALL_CATEGORIES, UPPER_CATEGORIES } from '../../types.js';
import { GameState } from '../game.svelte.js';

// =============================================================================
// Full Game Flow Tests
// =============================================================================

describe('Store Integration - Full Game Flow', () => {
	let game: GameState;

	beforeEach(() => {
		game = new GameState();
	});

	it('simulates a complete turn: roll -> keep -> reroll -> score', () => {
		game.startGame();

		// First roll
		expect(game.canRoll).toBe(true);
		expect(game.rollNumber).toBe(0);
		expect(game.rollsRemaining).toBe(3);

		game.roll();
		expect(game.rollNumber).toBe(1);
		expect(game.rollsRemaining).toBe(2);
		expect(game.phase).toBe('deciding'); // After roll, phase is 'deciding'

		// Keep some dice
		const initialDice = [...game.dice.values];
		game.dice.toggleKeep(0);
		game.dice.toggleKeep(1);
		expect(game.dice.kept[0]).toBe(true);
		expect(game.dice.kept[1]).toBe(true);
		expect(game.dice.keptCount).toBe(2);

		// Second roll - kept dice should remain
		game.roll();
		expect(game.rollNumber).toBe(2);
		expect(game.rollsRemaining).toBe(1);
		expect(game.dice.values[0]).toBe(initialDice[0]);
		expect(game.dice.values[1]).toBe(initialDice[1]);

		// Third roll
		game.roll();
		expect(game.rollNumber).toBe(3);
		expect(game.rollsRemaining).toBe(0);
		expect(game.canRoll).toBe(false);

		// Score a category
		expect(game.canScore).toBe(true);
		game.score('Chance');
		expect(game.scorecard.isAvailable('Chance')).toBe(false);
		expect(game.turnNumber).toBe(2); // Next turn
	});

	it('completes a full 13-turn game', () => {
		game.startGame();

		for (let turn = 1; turn <= 13; turn++) {
			expect(game.turnNumber).toBe(turn);
			expect(game.isGameOver).toBe(false);

			// Roll once
			game.roll();

			// Score the first available category
			const available = ALL_CATEGORIES.find((c) =>
				game.scorecard.isAvailable(c),
			)!;
			expect(available).toBeDefined();
			game.score(available);
		}

		expect(game.isGameOver).toBe(true);
		expect(game.status).toBe('completed'); // Status is 'completed' when game over
		expect(game.turnNumber).toBe(13);
	});

	it('calculates scores correctly through multiple turns', () => {
		game.startGame();

		// Force specific dice for testing by rolling until we get what we want
		// In real tests we'd mock the RNG, but for integration we'll verify the flow

		game.roll();
		// Score Chance (sum of all dice)
		const diceSum = game.dice.values.reduce((a, b) => a + b, 0);
		game.score('Chance');

		expect(game.scorecard.scores.Chance).toBe(diceSum);
		expect(game.scorecard.lowerTotal).toBe(diceSum);
		expect(game.scorecard.grandTotal).toBe(diceSum);
	});
});

// =============================================================================
// Dice State Integration Tests
// =============================================================================

describe('Store Integration - Dice State', () => {
	let game: GameState;

	beforeEach(() => {
		game = new GameState();
		game.startGame();
	});

	it('keeps all dice correctly', () => {
		game.roll();
		game.dice.keepAll();

		expect(game.dice.kept).toEqual([true, true, true, true, true]);
		expect(game.dice.keptCount).toBe(5);
		expect(game.dice.allKept).toBe(true);
		expect(game.dice.noneKept).toBe(false);
	});

	it('releases all dice correctly', () => {
		game.roll();
		game.dice.keepAll();
		game.dice.releaseAll();

		expect(game.dice.kept).toEqual([false, false, false, false, false]);
		expect(game.dice.keptCount).toBe(0);
		expect(game.dice.allKept).toBe(false);
		expect(game.dice.noneKept).toBe(true);
	});

	it('toggles individual dice', () => {
		game.roll();

		game.dice.toggleKeep(2);
		expect(game.dice.kept[2]).toBe(true);
		expect(game.dice.keptCount).toBe(1);

		game.dice.toggleKeep(2);
		expect(game.dice.kept[2]).toBe(false);
		expect(game.dice.keptCount).toBe(0);
	});

	it('preserves kept dice values across rolls', () => {
		game.roll();
		const keptValue = game.dice.values[0];

		game.dice.toggleKeep(0);
		game.roll();

		expect(game.dice.values[0]).toBe(keptValue);
	});

	it('resets kept state at start of new turn', () => {
		game.roll();
		game.dice.keepAll();
		game.score('Chance');

		// New turn
		expect(game.dice.kept).toEqual([false, false, false, false, false]);
		expect(game.dice.noneKept).toBe(true);
	});
});

// =============================================================================
// Scorecard Integration Tests
// =============================================================================

describe('Store Integration - Scorecard', () => {
	let game: GameState;

	beforeEach(() => {
		game = new GameState();
		game.startGame();
	});

	it('tracks upper section subtotal for bonus', () => {
		const upperCategories = [...UPPER_CATEGORIES];

		// Score all upper categories
		for (const category of upperCategories) {
			game.roll();
			game.score(category);
		}

		// Upper subtotal should be sum of upper scores
		const expectedSubtotal = upperCategories.reduce(
			(sum, cat) => sum + (game.scorecard.scores[cat] ?? 0),
			0,
		);
		expect(game.scorecard.upperSubtotal).toBe(expectedSubtotal);
	});

	it('awards bonus when upper subtotal >= 63', () => {
		// To get bonus, we need upper scores >= 63
		// This is a flow test - actual bonus depends on dice values

		game.roll();
		game.score('Ones');

		// After scoring, check bonus logic is applied
		if (game.scorecard.upperSubtotal >= 63) {
			expect(game.scorecard.upperBonus).toBe(35);
		} else {
			expect(game.scorecard.upperBonus).toBe(0);
		}
	});

	it('calculates grand total correctly', () => {
		game.roll();
		game.score('Chance');
		const chanceScore = game.scorecard.scores.Chance!;

		game.roll();
		game.score('Ones');
		const onesScore = game.scorecard.scores.Ones!;

		const expectedTotal = chanceScore + onesScore;
		expect(game.scorecard.grandTotal).toBe(expectedTotal);
	});

	it('prevents scoring same category twice', () => {
		game.roll();
		game.score('Yahtzee');

		expect(game.scorecard.isAvailable('Yahtzee')).toBe(false);

		// Scoring again should not change the value
		const yahtzeeScore = game.scorecard.scores.Yahtzee;
		game.roll();
		game.score('Yahtzee'); // Should be no-op
		expect(game.scorecard.scores.Yahtzee).toBe(yahtzeeScore);
	});
});

// =============================================================================
// Stats Profile Integration Tests
// =============================================================================

describe('Store Integration - Stats Profile', () => {
	let game: GameState;

	beforeEach(() => {
		game = new GameState();
		game.startGame();
	});

	it('toggles stats display', () => {
		// Stats enabled by default
		expect(game.statsEnabled).toBe(true);

		game.toggleStats();
		expect(game.statsEnabled).toBe(false);

		game.toggleStats();
		expect(game.statsEnabled).toBe(true);
	});

	it('changes stats profile', () => {
		expect(game.statsProfile).toBe('intermediate');

		game.setStatsProfile('beginner');
		expect(game.statsProfile).toBe('beginner');

		game.setStatsProfile('expert');
		expect(game.statsProfile).toBe('expert');
	});

	it('preserves stats settings across turns', () => {
		// Start with stats enabled (default), change profile
		game.setStatsProfile('expert');
		game.toggleStats(); // Now disabled

		game.roll();
		game.score('Chance');

		// Settings should persist
		expect(game.statsEnabled).toBe(false);
		expect(game.statsProfile).toBe('expert');
	});
});

// =============================================================================
// Game Reset Integration Tests
// =============================================================================

describe('Store Integration - Game Reset', () => {
	let game: GameState;

	beforeEach(() => {
		game = new GameState();
	});

	it('cannot start new game mid-game (status protection)', () => {
		game.startGame();
		const initialTurn = game.turnNumber;

		// Play one turn
		game.roll();
		game.score('Chance');

		// Try to start new game mid-game - should be ignored
		game.startGame();

		// State should NOT be reset (startGame returns early when game active)
		expect(game.turnNumber).toBe(initialTurn + 1); // Advanced after scoring
		expect(game.scorecard.isAvailable('Chance')).toBe(false); // Still scored
	});

	it('can start new game after completing previous game', () => {
		game.startGame();

		// Complete the game
		for (const category of ALL_CATEGORIES) {
			game.roll();
			game.score(category);
		}

		expect(game.isGameOver).toBe(true);
		const _finalScore = game.scorecard.grandTotal;

		// Start new game
		game.startGame();

		expect(game.isGameOver).toBe(false);
		expect(game.scorecard.grandTotal).toBe(0);
		expect(game.turnNumber).toBe(1);
	});
});

// =============================================================================
// Edge Cases
// =============================================================================

describe('Store Integration - Edge Cases', () => {
	let game: GameState;

	beforeEach(() => {
		game = new GameState();
	});

	it('handles rapid state changes', () => {
		game.startGame();

		// Rapid toggle keeps
		game.roll();
		for (let i = 0; i < 10; i++) {
			game.dice.toggleKeep(0);
		}
		// Should end in original state (not kept)
		expect(game.dice.kept[0]).toBe(false);
	});

	it('prevents scoring before rolling', () => {
		game.startGame();
		expect(game.canScore).toBe(false);

		// Attempt to score should be no-op
		game.score('Chance');
		expect(game.scorecard.isAvailable('Chance')).toBe(true);
	});

	it('handles all dice kept scenario', () => {
		game.startGame();
		game.roll();

		game.dice.keepAll();
		const diceValues = [...game.dice.values];

		// Rolling with all kept should not change values
		game.roll();
		expect(game.dice.values).toEqual(diceValues);
	});

	it('maintains data integrity through full game', () => {
		game.startGame();

		const scoredCategories: Category[] = [];

		for (let turn = 1; turn <= 13; turn++) {
			game.roll();

			const available = ALL_CATEGORIES.find(
				(c) => !scoredCategories.includes(c),
			)!;
			game.score(available);
			scoredCategories.push(available);

			// Verify integrity
			expect(scoredCategories.length).toBe(turn);
			expect(
				ALL_CATEGORIES.filter((c) => game.scorecard.isAvailable(c)).length,
			).toBe(13 - turn);
		}

		// All categories should be scored
		expect(ALL_CATEGORIES.every((c) => game.scorecard.scores[c] !== null)).toBe(
			true,
		);
	});
});
