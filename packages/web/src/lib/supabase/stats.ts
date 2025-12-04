import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Tables, TablesUpdate } from '$lib/types/database';

export type PlayerStats = Tables<'player_stats'>;
export type PlayerStatsUpdate = TablesUpdate<'player_stats'>;
export type GamePlayer = Tables<'game_players'>;
export type Game = Tables<'games'>;

/**
 * Game history entry with denormalized data for easy display
 */
export interface GameHistoryEntry {
	game_id: string;
	game_mode: string;
	completed_at: string | null;
	final_score: number | null;
	final_rank: number | null;
	player_count: number;
	won: boolean;
}

/**
 * Get a player's aggregate statistics
 */
export async function getPlayerStats(
	supabase: SupabaseClient<Database>,
	userId: string,
): Promise<{ data: PlayerStats | null; error: Error | null }> {
	const { data, error } = await supabase
		.from('player_stats')
		.select('*')
		.eq('user_id', userId)
		.single();

	if (error) {
		// If stats don't exist yet, return null instead of error
		if (error.code === 'PGRST116') {
			return { data: null, error: null };
		}
		return { data: null, error: new Error(error.message) };
	}

	return { data, error: null };
}

/**
 * Create or initialize player stats for a user
 */
export async function createPlayerStats(
	supabase: SupabaseClient<Database>,
	userId: string,
): Promise<{ data: PlayerStats | null; error: Error | null }> {
	const { data, error } = await supabase
		.from('player_stats')
		.insert({ user_id: userId })
		.select()
		.single();

	if (error) {
		return { data: null, error: new Error(error.message) };
	}

	return { data, error: null };
}

/**
 * Update player statistics
 * Typically called after a game completes to aggregate new results
 */
export async function updatePlayerStats(
	supabase: SupabaseClient<Database>,
	userId: string,
	updates: PlayerStatsUpdate,
): Promise<{ data: PlayerStats | null; error: Error | null }> {
	const { data, error } = await supabase
		.from('player_stats')
		.update(updates)
		.eq('user_id', userId)
		.select()
		.single();

	if (error) {
		return { data: null, error: new Error(error.message) };
	}

	return { data, error: null };
}

/**
 * Get or create player stats (ensures stats record exists)
 */
export async function ensurePlayerStats(
	supabase: SupabaseClient<Database>,
	userId: string,
): Promise<{ data: PlayerStats | null; error: Error | null }> {
	// Try to get existing stats
	const getResult = await getPlayerStats(supabase, userId);

	// If stats exist, return them
	if (getResult.data) {
		return getResult;
	}

	// If there was an error other than "not found", return it
	if (getResult.error) {
		return getResult;
	}

	// Stats don't exist, create them
	return createPlayerStats(supabase, userId);
}

/**
 * Get a player's game history
 * Returns games in reverse chronological order (most recent first)
 */
export async function getGameHistory(
	supabase: SupabaseClient<Database>,
	userId: string,
	limit = 20,
): Promise<{ data: GameHistoryEntry[] | null; error: Error | null }> {
	// Query game_players joined with games to get full history
	const { data, error } = await supabase
		.from('game_players')
		.select(
			`
			game_id,
			final_score,
			final_rank,
			games (
				game_mode,
				completed_at,
				winner_id
			)
		`,
		)
		.eq('user_id', userId)
		.not('games.completed_at', 'is', null)
		.order('games(completed_at)', { ascending: false })
		.limit(limit);

	if (error) {
		return { data: null, error: new Error(error.message) };
	}

	if (!data) {
		return { data: [], error: null };
	}

	// Transform the data into GameHistoryEntry format
	const history: GameHistoryEntry[] = data
		.filter((entry) => entry.games !== null)
		.map((entry) => {
			const game = entry.games as unknown as Game;
			return {
				game_id: entry.game_id,
				game_mode: game.game_mode,
				completed_at: game.completed_at,
				final_score: entry.final_score,
				final_rank: entry.final_rank,
				player_count: 1, // TODO: Could query game_players count if needed
				won: game.winner_id === userId,
			};
		});

	return { data: history, error: null };
}

/**
 * Get detailed game information including all players
 * Useful for showing a game summary with all participants
 */
export async function getGameDetails(
	supabase: SupabaseClient<Database>,
	gameId: string,
): Promise<{
	data: { game: Game; players: (GamePlayer & { profiles: Tables<'profiles'> })[] } | null;
	error: Error | null;
}> {
	// Get game details
	const { data: game, error: gameError } = await supabase
		.from('games')
		.select('*')
		.eq('id', gameId)
		.single();

	if (gameError) {
		return { data: null, error: new Error(gameError.message) };
	}

	// Get all players with their profiles
	const { data: players, error: playersError } = await supabase
		.from('game_players')
		.select(
			`
			*,
			profiles (*)
		`,
		)
		.eq('game_id', gameId)
		.order('final_rank', { ascending: true });

	if (playersError) {
		return { data: null, error: new Error(playersError.message) };
	}

	return {
		data: {
			game,
			players: players as (GamePlayer & { profiles: Tables<'profiles'> })[],
		},
		error: null,
	};
}

/**
 * Calculate win rate from player stats
 */
export function calculateWinRate(stats: PlayerStats): number {
	if (stats.games_completed === 0) {
		return 0;
	}
	return (stats.games_won / stats.games_completed) * 100;
}

/**
 * Calculate decision quality percentage
 */
export function calculateDecisionQuality(stats: PlayerStats): number {
	if (stats.total_decisions === 0) {
		return 0;
	}
	return (stats.optimal_decisions / stats.total_decisions) * 100;
}
