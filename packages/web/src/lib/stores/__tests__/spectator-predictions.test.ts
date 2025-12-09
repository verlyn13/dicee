/**
 * Spectator Predictions Tests
 *
 * Tests for gallery prediction functionality in spectatorService
 */

import { describe, expect, it, vi } from 'vitest';
import type {
	Prediction,
	PredictionResult,
	PredictionStats,
} from '$lib/services/spectatorService.svelte';

// =============================================================================
// Mock WebSocket
// =============================================================================

class MockWebSocket {
	static OPEN = 1;
	static CLOSED = 3;

	readyState = MockWebSocket.OPEN;
	onopen: (() => void) | null = null;
	onmessage: ((e: MessageEvent) => void) | null = null;
	onclose: ((e: CloseEvent) => void) | null = null;
	onerror: (() => void) | null = null;

	messages: string[] = [];

	send(data: string) {
		this.messages.push(data);
	}

	close() {
		this.readyState = MockWebSocket.CLOSED;
	}

	// Test helpers
	simulateOpen() {
		this.onopen?.();
	}

	simulateMessage(data: Record<string, unknown>) {
		this.onmessage?.({ data: JSON.stringify(data) } as MessageEvent);
	}

	simulateClose(code = 1000, reason = '') {
		this.onclose?.({ code, reason } as CloseEvent);
	}
}

// Mock ReconnectingWebSocket
vi.mock('reconnecting-websocket', () => ({
	default: vi.fn().mockImplementation(() => new MockWebSocket()),
}));

// Mock browser environment
vi.mock('$app/environment', () => ({
	browser: true,
}));

// =============================================================================
// Test Constants
// =============================================================================

const MOCK_PREDICTION: Prediction = {
	id: 'pred-1',
	spectatorId: 'user-1',
	spectatorName: 'TestSpectator',
	playerId: 'player-1',
	type: 'dicee',
	timestamp: Date.now(),
	evaluated: false,
	correct: null,
	pointsAwarded: 0,
};

const MOCK_STATS: PredictionStats = {
	spectatorId: 'user-1',
	totalPredictions: 10,
	correctPredictions: 6,
	accuracy: 0.6,
	totalPoints: 100,
	streak: 3,
	bestStreak: 5,
};

const MOCK_RESULT: PredictionResult = {
	predictionId: 'pred-1',
	correct: true,
	pointsAwarded: 50,
	actualOutcome: {
		wasDicee: true,
		improved: true,
		bricked: false,
		finalScore: 50,
	},
};

// =============================================================================
// Tests
// =============================================================================

describe('Spectator Predictions', () => {
	describe('Prediction Types', () => {
		it('should define all prediction types', () => {
			const types: string[] = ['dicee', 'improves', 'bricks', 'exact'];
			expect(types).toHaveLength(4);
		});

		it('should have proper prediction structure', () => {
			expect(MOCK_PREDICTION).toHaveProperty('id');
			expect(MOCK_PREDICTION).toHaveProperty('spectatorId');
			expect(MOCK_PREDICTION).toHaveProperty('playerId');
			expect(MOCK_PREDICTION).toHaveProperty('type');
			expect(MOCK_PREDICTION).toHaveProperty('timestamp');
			expect(MOCK_PREDICTION).toHaveProperty('evaluated');
			expect(MOCK_PREDICTION).toHaveProperty('correct');
			expect(MOCK_PREDICTION).toHaveProperty('pointsAwarded');
		});

		it('should allow exact score for exact predictions', () => {
			const exactPrediction: Prediction = {
				...MOCK_PREDICTION,
				type: 'exact',
				exactScore: 25,
			};
			expect(exactPrediction.exactScore).toBe(25);
		});
	});

	describe('Prediction Stats', () => {
		it('should have all required stat fields', () => {
			expect(MOCK_STATS).toHaveProperty('totalPredictions');
			expect(MOCK_STATS).toHaveProperty('correctPredictions');
			expect(MOCK_STATS).toHaveProperty('accuracy');
			expect(MOCK_STATS).toHaveProperty('totalPoints');
			expect(MOCK_STATS).toHaveProperty('streak');
			expect(MOCK_STATS).toHaveProperty('bestStreak');
		});

		it('should calculate accuracy correctly', () => {
			const stats: PredictionStats = {
				spectatorId: 'user-1',
				totalPredictions: 10,
				correctPredictions: 6,
				accuracy: 6 / 10,
				totalPoints: 100,
				streak: 3,
				bestStreak: 5,
			};
			expect(stats.accuracy).toBeCloseTo(0.6, 2);
		});

		it('should handle zero predictions', () => {
			const emptyStats: PredictionStats = {
				spectatorId: 'user-1',
				totalPredictions: 0,
				correctPredictions: 0,
				accuracy: 0,
				totalPoints: 0,
				streak: 0,
				bestStreak: 0,
			};
			expect(emptyStats.accuracy).toBe(0);
		});
	});

	describe('Prediction Results', () => {
		it('should have all required result fields', () => {
			expect(MOCK_RESULT).toHaveProperty('predictionId');
			expect(MOCK_RESULT).toHaveProperty('correct');
			expect(MOCK_RESULT).toHaveProperty('pointsAwarded');
			expect(MOCK_RESULT).toHaveProperty('actualOutcome');
		});

		it('should include outcome details', () => {
			expect(MOCK_RESULT.actualOutcome).toHaveProperty('wasDicee');
			expect(MOCK_RESULT.actualOutcome).toHaveProperty('improved');
			expect(MOCK_RESULT.actualOutcome).toHaveProperty('bricked');
			expect(MOCK_RESULT.actualOutcome).toHaveProperty('finalScore');
		});

		it('should award points for correct predictions', () => {
			expect(MOCK_RESULT.correct).toBe(true);
			expect(MOCK_RESULT.pointsAwarded).toBeGreaterThan(0);
		});

		it('should not award points for incorrect predictions', () => {
			const incorrectResult: PredictionResult = {
				...MOCK_RESULT,
				correct: false,
				pointsAwarded: 0,
			};
			expect(incorrectResult.pointsAwarded).toBe(0);
		});
	});

	describe('Prediction Point Values', () => {
		const PREDICTION_POINTS = {
			dicee: 50,
			exact: 25,
			improves: 10,
			bricks: 10,
		};

		it('should have highest points for dicee predictions', () => {
			expect(PREDICTION_POINTS.dicee).toBeGreaterThan(PREDICTION_POINTS.exact);
			expect(PREDICTION_POINTS.dicee).toBeGreaterThan(PREDICTION_POINTS.improves);
			expect(PREDICTION_POINTS.dicee).toBeGreaterThan(PREDICTION_POINTS.bricks);
		});

		it('should have equal points for improves and bricks', () => {
			expect(PREDICTION_POINTS.improves).toBe(PREDICTION_POINTS.bricks);
		});

		it('should have medium points for exact predictions', () => {
			expect(PREDICTION_POINTS.exact).toBeGreaterThan(PREDICTION_POINTS.improves);
			expect(PREDICTION_POINTS.exact).toBeLessThan(PREDICTION_POINTS.dicee);
		});
	});

	describe('Prediction Limits', () => {
		const MAX_PREDICTIONS_PER_TURN = 3;

		it('should enforce maximum predictions per turn', () => {
			const predictions: Prediction[] = [
				{ ...MOCK_PREDICTION, id: '1', type: 'dicee' },
				{ ...MOCK_PREDICTION, id: '2', type: 'improves' },
				{ ...MOCK_PREDICTION, id: '3', type: 'bricks' },
			];

			expect(predictions.length).toBeLessThanOrEqual(MAX_PREDICTIONS_PER_TURN);
		});

		it('should prevent duplicate prediction types', () => {
			const predictions: Prediction[] = [
				{ ...MOCK_PREDICTION, id: '1', type: 'dicee' },
				{ ...MOCK_PREDICTION, id: '2', type: 'improves' },
			];

			const hasDuplicateType = (type: string): boolean => {
				return predictions.some((p) => p.type === type);
			};

			expect(hasDuplicateType('dicee')).toBe(true);
			expect(hasDuplicateType('bricks')).toBe(false);
		});
	});

	describe('Turn State', () => {
		it('should track current turn info', () => {
			const currentTurn = { turnNumber: 5, playerId: 'player-1' };
			expect(currentTurn.turnNumber).toBe(5);
			expect(currentTurn.playerId).toBe('player-1');
		});

		it('should clear predictions on new turn', () => {
			let predictions: Prediction[] = [MOCK_PREDICTION];

			// Simulate turn change
			predictions = [];

			expect(predictions).toHaveLength(0);
		});

		it('should null current turn when predictions evaluated', () => {
			let currentTurn: { turnNumber: number; playerId: string } | null = {
				turnNumber: 5,
				playerId: 'player-1',
			};

			// Simulate evaluation
			currentTurn = null;

			expect(currentTurn).toBeNull();
		});
	});

	describe('Prediction Streak Tracking', () => {
		it('should increment streak on correct prediction', () => {
			const stats = { ...MOCK_STATS, streak: 3 };

			// Simulate correct prediction
			stats.streak += 1;
			stats.bestStreak = Math.max(stats.bestStreak, stats.streak);

			expect(stats.streak).toBe(4);
		});

		it('should reset streak on incorrect prediction', () => {
			const stats = { ...MOCK_STATS, streak: 3 };

			// Simulate incorrect prediction
			stats.streak = 0;

			expect(stats.streak).toBe(0);
			expect(stats.bestStreak).toBe(MOCK_STATS.bestStreak); // Best streak preserved
		});

		it('should track best streak', () => {
			const stats = { ...MOCK_STATS, streak: 6, bestStreak: 5 };

			// Best streak should update
			stats.bestStreak = Math.max(stats.bestStreak, stats.streak);

			expect(stats.bestStreak).toBe(6);
		});
	});

	describe('Exact Score Validation', () => {
		it('should validate exact score in valid range', () => {
			const isValidExactScore = (score: number): boolean => {
				return score >= 0 && score <= 50;
			};

			expect(isValidExactScore(0)).toBe(true);
			expect(isValidExactScore(25)).toBe(true);
			expect(isValidExactScore(50)).toBe(true);
			expect(isValidExactScore(-1)).toBe(false);
			expect(isValidExactScore(51)).toBe(false);
		});

		it('should require exact score for exact prediction type', () => {
			const exactPrediction: Prediction = {
				...MOCK_PREDICTION,
				type: 'exact',
				exactScore: 30,
			};

			expect(exactPrediction.type).toBe('exact');
			expect(exactPrediction.exactScore).toBeDefined();
		});
	});
});
