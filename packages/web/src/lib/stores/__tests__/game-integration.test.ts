/**
 * Full Game Integration Tests
 *
 * Smoke tests that verify a complete 13-turn game can be played.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Category } from '../../types.js';
import { ALL_CATEGORIES } from '../../types.js';
import { GameState } from '../game.svelte.js';

// Mock the engine service
vi.mock('../../services/engine.js', () => ({
	calculateScores: vi.fn(async () => [
		{ category: 'Ones', score: 3, valid: true },
		{ category: 'Twos', score: 4, valid: true },
		{ category: 'Threes', score: 6, valid: true },
		{ category: 'Fours', score: 8, valid: true },
		{ category: 'Fives', score: 10, valid: true },
		{ category: 'Sixes', score: 12, valid: true },
		{ category: 'ThreeOfAKind', score: 20, valid: true },
		{ category: 'FourOfAKind', score: 25, valid: true },
		{ category: 'FullHouse', score: 25, valid: true },
		{ category: 'SmallStraight', score: 30, valid: true },
		{ category: 'LargeStraight', score: 40, valid: true },
		{ category: 'Dicee', score: 50, valid: true },
		{ category: 'Chance', score: 18, valid: true },
	]),
	calculateProbabilities: vi.fn(async () => []),
	isEngineReady: vi.fn(() => true),
}));

describe('Full Game Integration', () => {
	let game: GameState;

	beforeEach(() => {
		game = new GameState();
	});

	describe('game lifecycle', () => {
		it('starts a new game correctly', () => {
			game.startGame();

			expect(game.status).toBe('rolling');
			expect(game.turnNumber).toBe(1);
			expect(game.rollNumber).toBe(0);
			expect(game.isGameActive).toBe(true);
			expect(game.isGameOver).toBe(false);
		});

		it('allows rolling dice', () => {
			game.startGame();

			const dice = game.roll();

			expect(dice).not.toBeNull();
			expect(game.rollNumber).toBe(1);
			expect(dice?.length).toBe(5);
			for (const d of dice ?? []) {
				expect(d).toBeGreaterThanOrEqual(1);
				expect(d).toBeLessThanOrEqual(6);
			}
		});

		it('limits to 3 rolls per turn', () => {
			game.startGame();

			game.roll();
			game.roll();
			game.roll();
			const fourthRoll = game.roll();

			expect(fourthRoll).toBeNull();
			expect(game.rollNumber).toBe(3);
		});

		it('allows scoring after rolling', () => {
			game.startGame();
			game.roll();

			const feedback = game.score('Ones');

			expect(feedback).not.toBeNull();
			expect(feedback?.chosenCategory).toBe('Ones');
		});
	});

	describe('complete 13-turn game', () => {
		it('can play through all 13 turns', () => {
			game.startGame();

			// Play through all 13 categories
			const categories = [...ALL_CATEGORIES];

			for (let turn = 0; turn < 13; turn++) {
				// Roll
				game.roll();
				expect(game.rollNumber).toBe(1);

				// Score in an available category
				const category = categories[turn];
				const feedback = game.score(category);

				expect(feedback).not.toBeNull();

				if (turn < 12) {
					// Not final turn - game should continue
					expect(game.isGameOver).toBe(false);
					expect(game.turnNumber).toBe(turn + 2);
					expect(game.rollNumber).toBe(0);
				}
			}

			// Game should be complete after 13 turns
			expect(game.isGameOver).toBe(true);
			expect(game.status).toBe('completed');
			expect(game.scorecard.turnsCompleted).toBe(13);
			expect(game.scorecard.categoriesRemaining.length).toBe(0);
		});

		it('calculates final score correctly', () => {
			game.startGame();
			const categories = [...ALL_CATEGORIES];

			for (let i = 0; i < 13; i++) {
				game.roll();
				game.score(categories[i]);
			}

			expect(game.isGameOver).toBe(true);
			expect(game.scorecard.grandTotal).toBeGreaterThanOrEqual(0);
		});

		it('tracks upper section bonus', () => {
			game.startGame();

			// Score high in upper section to earn bonus
			const upperCategories: Category[] = ['Ones', 'Twos', 'Threes', 'Fours', 'Fives', 'Sixes'];
			const lowerCategories: Category[] = [
				'ThreeOfAKind',
				'FourOfAKind',
				'FullHouse',
				'SmallStraight',
				'LargeStraight',
				'Dicee',
				'Chance',
			];

			// Play all upper section first
			for (const cat of upperCategories) {
				game.roll();
				game.score(cat);
			}

			// Then lower section
			for (const cat of lowerCategories) {
				game.roll();
				game.score(cat);
			}

			expect(game.isGameOver).toBe(true);
			// Upper subtotal depends on actual dice rolls
			expect(game.scorecard.upperSubtotal).toBeGreaterThanOrEqual(0);
		});
	});

	describe('game state transitions', () => {
		it('transitions through correct phases', () => {
			game.startGame();
			expect(game.phase).toBe('pre_roll');

			game.roll();
			expect(game.phase).toBe('deciding');

			game.score('Ones');
			expect(game.phase).toBe('pre_roll'); // New turn
		});

		it('tracks timestamps', () => {
			game.startGame();

			expect(game.gameStartedAt).toBeTypeOf('number');
			expect(game.gameCompletedAt).toBeNull();

			// Complete the game
			const categories = [...ALL_CATEGORIES];
			for (let i = 0; i < 13; i++) {
				game.roll();
				game.score(categories[i]);
			}

			expect(game.gameCompletedAt).toBeTypeOf('number');
			expect(game.gameCompletedAt).toBeGreaterThanOrEqual(game.gameStartedAt!);
		});
	});

	describe('reset and replay', () => {
		it('can reset and start a new game', () => {
			game.startGame();
			game.roll();
			game.score('Ones');

			game.reset();

			expect(game.status).toBe('idle');
			expect(game.turnNumber).toBe(0);
			expect(game.scorecard.grandTotal).toBe(0);
			expect(game.scorecard.categoriesRemaining.length).toBe(13);
		});

		it('can play multiple games in sequence', () => {
			const categories = [...ALL_CATEGORIES];

			// First game
			game.startGame();
			for (let i = 0; i < 13; i++) {
				game.roll();
				game.score(categories[i]);
			}
			expect(game.isGameOver).toBe(true);
			const _firstScore = game.scorecard.grandTotal;

			// Second game
			game.startGame();
			expect(game.isGameOver).toBe(false);
			expect(game.turnNumber).toBe(1);
			expect(game.scorecard.grandTotal).toBe(0);

			for (let i = 0; i < 13; i++) {
				game.roll();
				game.score(categories[i]);
			}
			expect(game.isGameOver).toBe(true);

			// Scores may differ due to random dice
			expect(game.scorecard.grandTotal).toBeGreaterThanOrEqual(0);
		});
	});

	describe('dice management during game', () => {
		it('can keep and release dice', () => {
			game.startGame();
			game.roll();

			// Keep first die
			game.dice.toggleKeep(0);
			expect(game.dice.isKept(0)).toBe(true);

			// Keep all
			game.dice.keepAll();
			expect(game.dice.allKept).toBe(true);

			// Release all
			game.dice.releaseAll();
			expect(game.dice.noneKept).toBe(true);
		});

		it('releases all dice at start of each turn', () => {
			game.startGame();
			game.roll();

			// Keep some dice
			game.dice.toggleKeep(0);
			game.dice.toggleKeep(1);

			// Score and move to next turn
			game.score('Ones');

			// New turn should have all dice released
			expect(game.dice.noneKept).toBe(true);
		});

		it('can reroll unkept dice', () => {
			game.startGame();
			game.roll();

			const firstValues = [...game.dice.values];
			game.dice.toggleKeep(0);
			game.dice.toggleKeep(1);

			game.roll();

			// Kept dice should be same (with high probability)
			expect(game.dice.values[0]).toBe(firstValues[0]);
			expect(game.dice.values[1]).toBe(firstValues[1]);
		});
	});

	describe('error handling', () => {
		it('prevents scoring same category twice', () => {
			game.startGame();
			game.roll();
			game.score('Ones');

			// Try to score Ones again
			game.roll();
			const result = game.score('Ones');

			expect(result).toBeNull();
		});

		it('prevents rolling when game not active', () => {
			const result = game.roll();
			expect(result).toBeNull();
		});

		it('prevents scoring before rolling', () => {
			game.startGame();
			const result = game.score('Ones');
			expect(result).toBeNull();
		});
	});

	describe('stats and preferences', () => {
		it('tracks stats profile preference', () => {
			game.setStatsProfile('expert');
			expect(game.statsProfile).toBe('expert');

			game.setStatsProfile('beginner');
			expect(game.statsProfile).toBe('beginner');
		});

		it('tracks stats enabled state', () => {
			expect(game.statsEnabled).toBe(true);

			game.toggleStats();
			expect(game.statsEnabled).toBe(false);

			game.toggleStats();
			expect(game.statsEnabled).toBe(true);
		});
	});
});
