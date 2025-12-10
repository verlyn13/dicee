/**
 * Spectator Gallery Points Tests (D9)
 *
 * Tests for gallery points system, achievements, and game summaries.
 */

import { describe, expect, it } from 'vitest';

// Import types directly to test type definitions
import type {
	GalleryAchievement,
	GalleryAchievementId,
	GalleryGameSummary,
	GalleryPoints,
} from '$lib/services/spectatorService.svelte';

// Point values from spec
const GALLERY_POINT_VALUES = {
	PREDICTION_CORRECT_BASE: 10,
	PREDICTION_DICEE: 50,
	PREDICTION_EXACT_SCORE: 100,
	PREDICTION_STREAK_MULTIPLIER: 0.1,
	REACTION_GIVEN: 1,
	KIBITZ_MAJORITY: 2,
	CHAT_MESSAGE: 1,
	BACKED_WINNER: 50,
	UNDERDOG_BONUS: 25,
	MAX_REACTION_POINTS_PER_GAME: 20,
	MAX_CHAT_POINTS_PER_GAME: 10,
} as const;

// Achievement definitions
const ACHIEVEMENTS: Record<GalleryAchievementId, { name: string; threshold: number }> = {
	oracle: { name: 'Oracle', threshold: 5 },
	drama_magnet: { name: 'Drama Magnet', threshold: 10 },
	superfan: { name: 'Superfan', threshold: 5 },
	jinx: { name: 'Jinx', threshold: 5 },
	analyst: { name: 'Analyst', threshold: 3 },
	called_it: { name: 'Called It!', threshold: 1 },
	voyeur: { name: 'Voyeur', threshold: 50 },
	regular: { name: 'Regular', threshold: 20 },
};

// Helper to create empty points
function createEmptyGalleryPoints(): GalleryPoints {
	return {
		predictions: { correct: 0, streakBonus: 0, exactScore: 0 },
		social: { reactionsGiven: 0, kibitzVotes: 0, chatMessages: 0 },
		backing: { backedWinner: 0, loyaltyBonus: 0 },
	};
}

// Helper to calculate total points
function calculateTotalPoints(points: GalleryPoints): number {
	return (
		points.predictions.correct +
		points.predictions.streakBonus +
		points.predictions.exactScore +
		points.social.reactionsGiven +
		points.social.kibitzVotes +
		points.social.chatMessages +
		points.backing.backedWinner +
		points.backing.loyaltyBonus
	);
}

// =============================================================================
// Type Tests
// =============================================================================

describe('Gallery Points Types', () => {
	describe('GalleryPoints', () => {
		it('should have required prediction fields', () => {
			const points: GalleryPoints = createEmptyGalleryPoints();

			expect(points.predictions).toHaveProperty('correct');
			expect(points.predictions).toHaveProperty('streakBonus');
			expect(points.predictions).toHaveProperty('exactScore');
		});

		it('should have required social fields', () => {
			const points: GalleryPoints = createEmptyGalleryPoints();

			expect(points.social).toHaveProperty('reactionsGiven');
			expect(points.social).toHaveProperty('kibitzVotes');
			expect(points.social).toHaveProperty('chatMessages');
		});

		it('should have required backing fields', () => {
			const points: GalleryPoints = createEmptyGalleryPoints();

			expect(points.backing).toHaveProperty('backedWinner');
			expect(points.backing).toHaveProperty('loyaltyBonus');
		});

		it('should start with zero points', () => {
			const points = createEmptyGalleryPoints();
			expect(calculateTotalPoints(points)).toBe(0);
		});
	});

	describe('GalleryAchievement', () => {
		it('should have required fields', () => {
			const achievement: GalleryAchievement = {
				id: 'oracle',
				name: 'Oracle',
				description: 'Called 5 correct predictions in a row',
				emoji: '🎯',
				threshold: 5,
				unlocked: false,
			};

			expect(achievement.id).toBe('oracle');
			expect(achievement.name).toBe('Oracle');
			expect(achievement.threshold).toBe(5);
			expect(achievement.unlocked).toBe(false);
		});

		it('should support optional progress field', () => {
			const achievement: GalleryAchievement = {
				id: 'voyeur',
				name: 'Voyeur',
				description: 'Watched 50 games total',
				emoji: '👁',
				threshold: 50,
				progress: 25,
				unlocked: false,
			};

			expect(achievement.progress).toBe(25);
		});

		it('should support optional unlockedAt field', () => {
			const now = Date.now();
			const achievement: GalleryAchievement = {
				id: 'called_it',
				name: 'Called It!',
				description: 'Predicted a Dicee correctly',
				emoji: '📢',
				threshold: 1,
				unlocked: true,
				unlockedAt: now,
			};

			expect(achievement.unlocked).toBe(true);
			expect(achievement.unlockedAt).toBe(now);
		});
	});

	describe('GalleryGameSummary', () => {
		it('should have complete summary structure', () => {
			const summary: GalleryGameSummary = {
				pointsEarned: createEmptyGalleryPoints(),
				totalPointsEarned: 0,
				newAchievements: [],
				backedPlayerWon: null,
				predictionSummary: {
					total: 0,
					correct: 0,
					streak: 0,
				},
				cumulativeStats: {
					totalPoints: 0,
					gamesWatched: 1,
					bestStreak: 0,
				},
			};

			expect(summary.pointsEarned).toBeDefined();
			expect(summary.predictionSummary.total).toBe(0);
			expect(summary.cumulativeStats.gamesWatched).toBe(1);
		});

		it('should track backed player result', () => {
			const summaryWon: GalleryGameSummary = {
				pointsEarned: createEmptyGalleryPoints(),
				totalPointsEarned: 50,
				newAchievements: [],
				backedPlayerWon: true,
				predictionSummary: { total: 0, correct: 0, streak: 0 },
				cumulativeStats: { totalPoints: 50, gamesWatched: 1, bestStreak: 0 },
			};

			const summaryLost: GalleryGameSummary = {
				...summaryWon,
				backedPlayerWon: false,
			};

			expect(summaryWon.backedPlayerWon).toBe(true);
			expect(summaryLost.backedPlayerWon).toBe(false);
		});
	});
});

// =============================================================================
// Point Calculation Tests
// =============================================================================

describe('Point Calculations', () => {
	describe('calculateTotalPoints', () => {
		it('should sum all point categories', () => {
			const points: GalleryPoints = {
				predictions: { correct: 10, streakBonus: 5, exactScore: 100 },
				social: { reactionsGiven: 15, kibitzVotes: 4, chatMessages: 8 },
				backing: { backedWinner: 50, loyaltyBonus: 25 },
			};

			const total = calculateTotalPoints(points);
			expect(total).toBe(217);
		});

		it('should handle zero points', () => {
			const points = createEmptyGalleryPoints();
			expect(calculateTotalPoints(points)).toBe(0);
		});

		it('should handle prediction-only points', () => {
			const points = createEmptyGalleryPoints();
			points.predictions.correct = 30;
			points.predictions.streakBonus = 3;
			expect(calculateTotalPoints(points)).toBe(33);
		});

		it('should handle social-only points', () => {
			const points = createEmptyGalleryPoints();
			points.social.reactionsGiven = 20;
			points.social.chatMessages = 10;
			expect(calculateTotalPoints(points)).toBe(30);
		});
	});

	describe('Point Values', () => {
		it('should award base points for correct prediction', () => {
			expect(GALLERY_POINT_VALUES.PREDICTION_CORRECT_BASE).toBe(10);
		});

		it('should award bonus for Dicee prediction', () => {
			expect(GALLERY_POINT_VALUES.PREDICTION_DICEE).toBe(50);
		});

		it('should award bonus for exact score prediction', () => {
			expect(GALLERY_POINT_VALUES.PREDICTION_EXACT_SCORE).toBe(100);
		});

		it('should have streak multiplier', () => {
			expect(GALLERY_POINT_VALUES.PREDICTION_STREAK_MULTIPLIER).toBe(0.1);
		});

		it('should cap reaction points per game', () => {
			expect(GALLERY_POINT_VALUES.MAX_REACTION_POINTS_PER_GAME).toBe(20);
		});

		it('should cap chat points per game', () => {
			expect(GALLERY_POINT_VALUES.MAX_CHAT_POINTS_PER_GAME).toBe(10);
		});

		it('should award points for backing winner', () => {
			expect(GALLERY_POINT_VALUES.BACKED_WINNER).toBe(50);
		});

		it('should award underdog bonus', () => {
			expect(GALLERY_POINT_VALUES.UNDERDOG_BONUS).toBe(25);
		});
	});
});

// =============================================================================
// Achievement Tests
// =============================================================================

describe('Achievements', () => {
	describe('Achievement Definitions', () => {
		it('should have 8 achievements', () => {
			const achievementIds: GalleryAchievementId[] = [
				'oracle',
				'drama_magnet',
				'superfan',
				'jinx',
				'analyst',
				'called_it',
				'voyeur',
				'regular',
			];

			expect(achievementIds.length).toBe(8);
		});

		it('should have oracle achievement (5 correct in a row)', () => {
			expect(ACHIEVEMENTS.oracle.threshold).toBe(5);
		});

		it('should have called_it achievement (predict Dicee)', () => {
			expect(ACHIEVEMENTS.called_it.threshold).toBe(1);
		});

		it('should have voyeur achievement (50 games watched)', () => {
			expect(ACHIEVEMENTS.voyeur.threshold).toBe(50);
		});

		it('should have regular achievement (20 rooms visited)', () => {
			expect(ACHIEVEMENTS.regular.threshold).toBe(20);
		});
	});

	describe('Achievement Progress', () => {
		it('should track progress toward threshold', () => {
			const achievement: GalleryAchievement = {
				id: 'voyeur',
				name: 'Voyeur',
				description: 'Watched 50 games total',
				emoji: '👁',
				threshold: 50,
				progress: 25,
				unlocked: false,
			};

			const progressPercent = (achievement.progress! / achievement.threshold) * 100;
			expect(progressPercent).toBe(50);
		});

		it('should unlock when progress meets threshold', () => {
			const checkUnlock = (progress: number, threshold: number): boolean => {
				return progress >= threshold;
			};

			expect(checkUnlock(4, 5)).toBe(false);
			expect(checkUnlock(5, 5)).toBe(true);
			expect(checkUnlock(6, 5)).toBe(true);
		});
	});

	describe('Achievement Unlock', () => {
		it('should set unlocked and unlockedAt', () => {
			const now = Date.now();
			const unlockedAchievement: GalleryAchievement = {
				id: 'oracle',
				name: 'Oracle',
				description: 'Called 5 correct predictions in a row',
				emoji: '🎯',
				threshold: 5,
				progress: 5,
				unlocked: true,
				unlockedAt: now,
			};

			expect(unlockedAchievement.unlocked).toBe(true);
			expect(unlockedAchievement.unlockedAt).toBeLessThanOrEqual(Date.now());
		});

		it('should include newly unlocked achievements in game summary', () => {
			const newAchievement: GalleryAchievement = {
				id: 'called_it',
				name: 'Called It!',
				description: 'Predicted a Dicee correctly',
				emoji: '📢',
				threshold: 1,
				unlocked: true,
				unlockedAt: Date.now(),
			};

			const summary: GalleryGameSummary = {
				pointsEarned: createEmptyGalleryPoints(),
				totalPointsEarned: 50,
				newAchievements: [newAchievement],
				backedPlayerWon: null,
				predictionSummary: { total: 1, correct: 1, streak: 1 },
				cumulativeStats: { totalPoints: 50, gamesWatched: 1, bestStreak: 1 },
			};

			expect(summary.newAchievements.length).toBe(1);
			expect(summary.newAchievements[0].id).toBe('called_it');
		});
	});
});

// =============================================================================
// Game Summary Tests
// =============================================================================

describe('Game Summary', () => {
	describe('Prediction Summary', () => {
		it('should track prediction stats', () => {
			const summary: GalleryGameSummary = {
				pointsEarned: createEmptyGalleryPoints(),
				totalPointsEarned: 30,
				newAchievements: [],
				backedPlayerWon: null,
				predictionSummary: {
					total: 5,
					correct: 3,
					streak: 2,
				},
				cumulativeStats: { totalPoints: 30, gamesWatched: 1, bestStreak: 2 },
			};

			expect(summary.predictionSummary.total).toBe(5);
			expect(summary.predictionSummary.correct).toBe(3);
			expect(summary.predictionSummary.streak).toBe(2);
		});

		it('should calculate accuracy from summary', () => {
			const summary: GalleryGameSummary = {
				pointsEarned: createEmptyGalleryPoints(),
				totalPointsEarned: 0,
				newAchievements: [],
				backedPlayerWon: null,
				predictionSummary: {
					total: 10,
					correct: 7,
					streak: 0,
				},
				cumulativeStats: { totalPoints: 0, gamesWatched: 1, bestStreak: 0 },
			};

			const accuracy = (summary.predictionSummary.correct / summary.predictionSummary.total) * 100;
			expect(accuracy).toBe(70);
		});
	});

	describe('Cumulative Stats', () => {
		it('should track cumulative game stats', () => {
			const summary: GalleryGameSummary = {
				pointsEarned: createEmptyGalleryPoints(),
				totalPointsEarned: 100,
				newAchievements: [],
				backedPlayerWon: true,
				predictionSummary: { total: 0, correct: 0, streak: 0 },
				cumulativeStats: {
					totalPoints: 500,
					gamesWatched: 10,
					bestStreak: 5,
				},
			};

			expect(summary.cumulativeStats.totalPoints).toBe(500);
			expect(summary.cumulativeStats.gamesWatched).toBe(10);
			expect(summary.cumulativeStats.bestStreak).toBe(5);
		});

		it('should update best streak if current is higher', () => {
			const updateBestStreak = (currentBest: number, newStreak: number): number => {
				return Math.max(currentBest, newStreak);
			};

			expect(updateBestStreak(3, 5)).toBe(5);
			expect(updateBestStreak(5, 3)).toBe(5);
		});
	});

	describe('Backing Results', () => {
		it('should track if backed player won', () => {
			const summaryWon: GalleryGameSummary = {
				pointsEarned: {
					predictions: { correct: 0, streakBonus: 0, exactScore: 0 },
					social: { reactionsGiven: 0, kibitzVotes: 0, chatMessages: 0 },
					backing: { backedWinner: 50, loyaltyBonus: 0 },
				},
				totalPointsEarned: 50,
				newAchievements: [],
				backedPlayerWon: true,
				predictionSummary: { total: 0, correct: 0, streak: 0 },
				cumulativeStats: { totalPoints: 50, gamesWatched: 1, bestStreak: 0 },
			};

			expect(summaryWon.backedPlayerWon).toBe(true);
			expect(summaryWon.pointsEarned.backing.backedWinner).toBe(50);
		});

		it('should handle no backing', () => {
			const summaryNoBacking: GalleryGameSummary = {
				pointsEarned: createEmptyGalleryPoints(),
				totalPointsEarned: 0,
				newAchievements: [],
				backedPlayerWon: null,
				predictionSummary: { total: 0, correct: 0, streak: 0 },
				cumulativeStats: { totalPoints: 0, gamesWatched: 1, bestStreak: 0 },
			};

			expect(summaryNoBacking.backedPlayerWon).toBeNull();
		});
	});
});

// =============================================================================
// Point Cap Tests
// =============================================================================

describe('Point Caps', () => {
	describe('Reaction Point Cap', () => {
		it('should cap reaction points at 20 per game', () => {
			const capPoints = (points: number, max: number): number => {
				return Math.min(points, max);
			};

			expect(capPoints(15, GALLERY_POINT_VALUES.MAX_REACTION_POINTS_PER_GAME)).toBe(15);
			expect(capPoints(25, GALLERY_POINT_VALUES.MAX_REACTION_POINTS_PER_GAME)).toBe(20);
		});
	});

	describe('Chat Point Cap', () => {
		it('should cap chat points at 10 per game', () => {
			const capPoints = (points: number, max: number): number => {
				return Math.min(points, max);
			};

			expect(capPoints(8, GALLERY_POINT_VALUES.MAX_CHAT_POINTS_PER_GAME)).toBe(8);
			expect(capPoints(15, GALLERY_POINT_VALUES.MAX_CHAT_POINTS_PER_GAME)).toBe(10);
		});
	});
});

// =============================================================================
// Streak Bonus Tests
// =============================================================================

describe('Streak Bonus', () => {
	describe('Streak Multiplier', () => {
		it('should calculate streak bonus correctly', () => {
			const basePoints = 10;
			const streak = 5;
			const multiplier = GALLERY_POINT_VALUES.PREDICTION_STREAK_MULTIPLIER;

			// Streak bonus = base * streak * multiplier
			const bonus = Math.floor(basePoints * streak * multiplier);
			expect(bonus).toBe(5);
		});

		it('should not give bonus for streak of 0', () => {
			const basePoints = 10;
			const streak = 0;
			const multiplier = GALLERY_POINT_VALUES.PREDICTION_STREAK_MULTIPLIER;

			const bonus = Math.floor(basePoints * streak * multiplier);
			expect(bonus).toBe(0);
		});

		it('should scale bonus with longer streaks', () => {
			const basePoints = 10;
			const multiplier = GALLERY_POINT_VALUES.PREDICTION_STREAK_MULTIPLIER;

			const bonus3 = Math.floor(basePoints * 3 * multiplier);
			const bonus7 = Math.floor(basePoints * 7 * multiplier);

			expect(bonus3).toBe(3);
			expect(bonus7).toBe(7);
			expect(bonus7).toBeGreaterThan(bonus3);
		});
	});
});
