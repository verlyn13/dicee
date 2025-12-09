/**
 * Leaderboard Service
 *
 * Query functions for solo leaderboards with time-based filtering.
 *
 * NOTE: Requires `supabase gen types` after applying solo_leaderboard migration.
 * Until then, uses type assertions for RPC calls and table access.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '$lib/types/database';

// Type for leaderboard row from RPC result
interface LeaderboardRow {
	rank: number;
	user_id: string;
	display_name: string | null;
	avatar_seed: string | null;
	score: number;
	efficiency: number | null;
	created_at: string;
}

// Type for user best scores from RPC result
interface UserBestRow {
	score: number;
	efficiency: number | null;
	dicee_count: number | null;
	upper_bonus: boolean | null;
	created_at: string;
}

/**
 * Leaderboard entry with user info
 */
export interface LeaderboardEntry {
	rank: number;
	userId: string;
	displayName: string;
	avatarSeed: string;
	score: number;
	efficiency: number;
	createdAt: string;
}

/**
 * Time period filter for leaderboards
 */
export type LeaderboardPeriod = 'daily' | 'weekly' | 'alltime';

/**
 * User's personal best score
 */
export interface PersonalBest {
	score: number;
	efficiency: number;
	diceeCount: number;
	upperBonus: boolean;
	createdAt: string;
}

/**
 * Get leaderboard for a specific time period
 */
export async function getLeaderboard(
	supabase: SupabaseClient<Database>,
	period: LeaderboardPeriod,
	limit = 100,
): Promise<{ data: LeaderboardEntry[] | null; error: Error | null }> {
	const functionName = `get_${period}_leaderboard`;

	// Use type assertion for RPC call (types will be generated after migration)
	const { data, error } = await (supabase.rpc as CallableFunction)(functionName, {
		limit_count: limit,
	});

	if (error) {
		return { data: null, error: new Error(error.message) };
	}

	if (!data) {
		return { data: [], error: null };
	}

	// Transform to camelCase
	const entries: LeaderboardEntry[] = (data as LeaderboardRow[]).map((row) => ({
		rank: Number(row.rank),
		userId: row.user_id,
		displayName: row.display_name ?? 'Unknown',
		avatarSeed: row.avatar_seed ?? '',
		score: row.score,
		efficiency: row.efficiency ?? 0,
		createdAt: row.created_at,
	}));

	return { data: entries, error: null };
}

/**
 * Get user's best scores
 */
export async function getUserBestScores(
	supabase: SupabaseClient<Database>,
	userId: string,
	limit = 10,
): Promise<{ data: PersonalBest[] | null; error: Error | null }> {
	// Use type assertion for RPC call (types will be generated after migration)
	const { data, error } = await (supabase.rpc as CallableFunction)('get_user_best_scores', {
		target_user_id: userId,
		limit_count: limit,
	});

	if (error) {
		return { data: null, error: new Error(error.message) };
	}

	if (!data) {
		return { data: [], error: null };
	}

	const scores: PersonalBest[] = (data as UserBestRow[]).map((row) => ({
		score: row.score,
		efficiency: row.efficiency ?? 0,
		diceeCount: row.dicee_count ?? 0,
		upperBonus: row.upper_bonus ?? false,
		createdAt: row.created_at,
	}));

	return { data: scores, error: null };
}

/**
 * Get user's rank on a specific leaderboard
 */
export async function getUserRank(
	supabase: SupabaseClient<Database>,
	userId: string,
	period: LeaderboardPeriod,
): Promise<{ data: { rank: number; score: number } | null; error: Error | null }> {
	// Get the full leaderboard and find user's position
	const { data: leaderboard, error } = await getLeaderboard(supabase, period, 1000);

	if (error) {
		return { data: null, error };
	}

	if (!leaderboard) {
		return { data: null, error: null };
	}

	const userEntry = leaderboard.find((entry) => entry.userId === userId);

	if (!userEntry) {
		return { data: null, error: null };
	}

	return {
		data: {
			rank: userEntry.rank,
			score: userEntry.score,
		},
		error: null,
	};
}

/**
 * Submit a score to the leaderboard
 * Called when a solo game completes
 */
export async function submitScore(
	supabase: SupabaseClient<Database>,
	entry: {
		userId: string;
		score: number;
		efficiency?: number;
		diceeCount?: number;
		upperBonus?: boolean;
		gameId?: string;
	},
): Promise<{ success: boolean; error: Error | null }> {
	const { error } = await supabase.from('solo_leaderboard').insert({
		user_id: entry.userId,
		score: entry.score,
		efficiency: entry.efficiency ?? 0,
		dicee_count: entry.diceeCount ?? 0,
		upper_bonus: entry.upperBonus ?? false,
		game_id: entry.gameId ?? null,
	});

	if (error) {
		return { success: false, error: new Error(error.message) };
	}

	return { success: true, error: null };
}

/**
 * Check if a score qualifies for the leaderboard (top 100)
 */
export async function isHighScore(
	supabase: SupabaseClient<Database>,
	score: number,
	period: LeaderboardPeriod,
): Promise<{ isHighScore: boolean; wouldRank: number | null; error: Error | null }> {
	const { data: leaderboard, error } = await getLeaderboard(supabase, period, 100);

	if (error) {
		return { isHighScore: false, wouldRank: null, error };
	}

	if (!leaderboard || leaderboard.length === 0) {
		return { isHighScore: true, wouldRank: 1, error: null };
	}

	// Find where this score would rank
	const wouldRank = leaderboard.findIndex((entry) => score > entry.score) + 1;

	if (wouldRank === 0) {
		// Score is lower than all entries
		if (leaderboard.length < 100) {
			return { isHighScore: true, wouldRank: leaderboard.length + 1, error: null };
		}
		return { isHighScore: false, wouldRank: null, error: null };
	}

	return { isHighScore: true, wouldRank, error: null };
}
