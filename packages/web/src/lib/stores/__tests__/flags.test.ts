/**
 * Feature Flags Store Unit Tests
 *
 * Tests for flags.svelte.ts - Feature flag evaluation logic
 */

import { beforeEach, describe, expect, it } from 'vitest';
import type { FeatureFlag } from '$lib/supabase/flags';
import { type FlagId, flags } from '../flags.svelte';

// =============================================================================
// Mock Data
// =============================================================================

function createMockFlag(overrides: Partial<FeatureFlag> = {}): FeatureFlag {
	return {
		id: 'test_flag',
		enabled: true,
		rollout_percent: 100,
		user_ids: [],
		min_games_played: 0,
		premium_only: false,
		description: 'Test flag',
		created_at: '2024-01-01T00:00:00Z',
		updated_at: '2024-01-01T00:00:00Z',
		...overrides,
	};
}

const mockFlags: FeatureFlag[] = [
	createMockFlag({ id: 'ev_display', enabled: true, rollout_percent: 100 }),
	createMockFlag({
		id: 'audio_system',
		enabled: true,
		rollout_percent: 50,
		user_ids: ['beta-user'],
	}),
	createMockFlag({ id: 'skill_rating', enabled: true, rollout_percent: 100, min_games_played: 5 }),
	createMockFlag({ id: 'advanced_stats', enabled: true, rollout_percent: 100, premium_only: true }),
	createMockFlag({ id: 'spectator_mode', enabled: false, rollout_percent: 0 }),
	createMockFlag({ id: 'coach_mode', enabled: true, rollout_percent: 100 }),
];

// =============================================================================
// Test Setup
// =============================================================================

describe('FlagStore', () => {
	beforeEach(() => {
		// Reset store state before each test
		flags.__testing.reset();
		flags.__testing.setFlags(mockFlags);
		flags.__testing.setInitialized(true);
	});

	// ===========================================================================
	// Basic Flag Checks
	// ===========================================================================

	describe('isEnabled - basic checks', () => {
		it('should return true for enabled flag with 100% rollout', () => {
			flags.__testing.setUserContext({
				userId: 'test-user',
				gamesPlayed: 0,
				isPremium: false,
			});

			expect(flags.isEnabled('ev_display')).toBe(true);
		});

		it('should return false for disabled flag', () => {
			flags.__testing.setUserContext({
				userId: 'test-user',
				gamesPlayed: 0,
				isPremium: false,
			});

			expect(flags.isEnabled('spectator_mode')).toBe(false);
		});

		it('should return false for non-existent flag', () => {
			flags.__testing.setUserContext({
				userId: 'test-user',
				gamesPlayed: 0,
				isPremium: false,
			});

			// Cast to FlagId to test non-existent flag behavior
			expect(flags.isEnabled('nonexistent' as FlagId)).toBe(false);
		});
	});

	// ===========================================================================
	// User Allowlist
	// ===========================================================================

	describe('isEnabled - user allowlist', () => {
		it('should return true for user in allowlist regardless of rollout', () => {
			flags.__testing.setUserContext({
				userId: 'beta-user',
				gamesPlayed: 0,
				isPremium: false,
			});

			// audio_system has 50% rollout but beta-user is in allowlist
			expect(flags.isEnabled('audio_system')).toBe(true);
		});

		it('should not bypass allowlist check for user not in list', () => {
			// User not in allowlist, depends on percentage rollout
			flags.__testing.setUserContext({
				userId: 'regular-user',
				gamesPlayed: 0,
				isPremium: false,
			});

			// This will depend on hash - test that it's deterministic
			const result1 = flags.isEnabled('audio_system');
			const result2 = flags.isEnabled('audio_system');
			expect(result1).toBe(result2); // Deterministic
		});
	});

	// ===========================================================================
	// Premium Gate
	// ===========================================================================

	describe('isEnabled - premium gate', () => {
		it('should return false for premium flag when user is not premium', () => {
			flags.__testing.setUserContext({
				userId: 'test-user',
				gamesPlayed: 10,
				isPremium: false,
			});

			expect(flags.isEnabled('advanced_stats')).toBe(false);
		});

		it('should return true for premium flag when user is premium', () => {
			flags.__testing.setUserContext({
				userId: 'test-user',
				gamesPlayed: 10,
				isPremium: true,
			});

			expect(flags.isEnabled('advanced_stats')).toBe(true);
		});
	});

	// ===========================================================================
	// Games Played Gate
	// ===========================================================================

	describe('isEnabled - games played gate', () => {
		it('should return false when user has not played enough games', () => {
			flags.__testing.setUserContext({
				userId: 'test-user',
				gamesPlayed: 3,
				isPremium: false,
			});

			// skill_rating requires 5 games
			expect(flags.isEnabled('skill_rating')).toBe(false);
		});

		it('should return true when user has played enough games', () => {
			flags.__testing.setUserContext({
				userId: 'test-user',
				gamesPlayed: 5,
				isPremium: false,
			});

			expect(flags.isEnabled('skill_rating')).toBe(true);
		});

		it('should return true when user has played more than required games', () => {
			flags.__testing.setUserContext({
				userId: 'test-user',
				gamesPlayed: 100,
				isPremium: false,
			});

			expect(flags.isEnabled('skill_rating')).toBe(true);
		});
	});

	// ===========================================================================
	// Percentage Rollout
	// ===========================================================================

	describe('isEnabled - percentage rollout', () => {
		it('should be deterministic for the same user and flag', () => {
			flags.__testing.setUserContext({
				userId: 'consistent-user',
				gamesPlayed: 0,
				isPremium: false,
			});

			const results: boolean[] = [];
			for (let i = 0; i < 10; i++) {
				results.push(flags.isEnabled('audio_system'));
			}

			// All results should be the same
			expect(results.every((r) => r === results[0])).toBe(true);
		});

		it('should return false for percentage rollout when no userId', () => {
			flags.__testing.setUserContext({
				userId: null,
				gamesPlayed: 0,
				isPremium: false,
			});

			// 50% rollout, but no user = can't do percentage check
			expect(flags.isEnabled('audio_system')).toBe(false);
		});

		it('should return true for 100% rollout with any user', () => {
			flags.__testing.setUserContext({
				userId: 'any-user',
				gamesPlayed: 0,
				isPremium: false,
			});

			expect(flags.isEnabled('ev_display')).toBe(true);
		});
	});

	// ===========================================================================
	// Combined Gates
	// ===========================================================================

	describe('isEnabled - combined gates', () => {
		it('should check all gates in order', () => {
			// Create a flag with multiple gates
			const multiGateFlag = createMockFlag({
				id: 'coach_mode',
				enabled: true,
				rollout_percent: 50,
				min_games_played: 3,
				premium_only: false,
			});

			flags.__testing.setFlags([multiGateFlag]);

			// User without enough games
			flags.__testing.setUserContext({
				userId: 'test-user',
				gamesPlayed: 1,
				isPremium: false,
			});

			expect(flags.isEnabled('coach_mode')).toBe(false);

			// User with enough games (still subject to rollout)
			flags.__testing.setUserContext({
				userId: 'test-user',
				gamesPlayed: 5,
				isPremium: false,
			});

			// Result depends on hash, but should be deterministic
			const result = flags.isEnabled('coach_mode');
			expect(typeof result).toBe('boolean');
		});
	});

	// ===========================================================================
	// getFlag and getAllFlags
	// ===========================================================================

	describe('getFlag', () => {
		it('should return flag metadata', () => {
			const flag = flags.getFlag('ev_display');

			expect(flag).toBeDefined();
			expect(flag?.id).toBe('ev_display');
			expect(flag?.enabled).toBe(true);
		});

		it('should return undefined for non-existent flag', () => {
			const flag = flags.getFlag('nonexistent' as FlagId);

			expect(flag).toBeUndefined();
		});
	});

	describe('getAllFlags', () => {
		it('should return all flags', () => {
			const allFlags = flags.getAllFlags();

			expect(allFlags).toHaveLength(mockFlags.length);
			expect(allFlags.map((f) => f.id)).toContain('ev_display');
			expect(allFlags.map((f) => f.id)).toContain('audio_system');
		});
	});

	// ===========================================================================
	// setUserContext
	// ===========================================================================

	describe('setUserContext', () => {
		it('should update user context partially', () => {
			flags.__testing.setUserContext({
				userId: 'user-1',
				gamesPlayed: 0,
				isPremium: false,
			});

			// Not premium, advanced_stats should be false
			expect(flags.isEnabled('advanced_stats')).toBe(false);

			// Update to premium
			flags.setUserContext({ isPremium: true });

			// Now should be true
			expect(flags.isEnabled('advanced_stats')).toBe(true);
		});
	});
});
