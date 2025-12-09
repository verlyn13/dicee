/**
 * Aggregate Game Stats Edge Function
 *
 * Called when a game completes to aggregate statistics for all players.
 * Updates player_stats with decision quality metrics and game outcomes.
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';

// CORS headers for cross-origin requests
const corsHeaders = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GamePlayer {
	user_id: string;
	final_score: number | null;
	final_rank: number | null;
	scorecard: Record<string, number | null> | null;
}

interface DomainEvent {
	event_type: string;
	player_id: string;
	turn_number: number | null;
	roll_number: number | null;
	payload: {
		category?: string;
		score?: number;
		optimal_category?: string;
		optimal_score?: number;
		ev_difference?: number;
		was_optimal?: boolean;
		dice?: number[];
		kept?: boolean[];
		was_optimal_hold?: boolean;
	};
}

interface PlayerStats {
	user_id: string;
	games_played: number;
	games_completed: number;
	games_won: number;
	total_score: number;
	best_score: number;
	avg_score: number;
	optimal_decisions: number;
	total_decisions: number;
	avg_ev_loss: number;
	yahtzees_rolled: number;
	bonus_yahtzees: number;
	upper_bonuses: number;
	category_stats: Record<string, { times_scored: number; total_score: number; avg_score: number }>;
}

Deno.serve(async (req) => {
	// Handle CORS preflight
	if (req.method === 'OPTIONS') {
		return new Response('ok', { headers: corsHeaders });
	}

	try {
		const { gameId } = await req.json();

		if (!gameId) {
			return new Response(JSON.stringify({ error: 'gameId is required' }), {
				status: 400,
				headers: { ...corsHeaders, 'Content-Type': 'application/json' },
			});
		}

		// Create Supabase client with service role for admin access
		const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
		const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
		const supabase = createClient(supabaseUrl, supabaseServiceKey);

		// Fetch game players
		const { data: players, error: playersError } = await supabase
			.from('game_players')
			.select('user_id, final_score, final_rank, scorecard')
			.eq('game_id', gameId);

		if (playersError) {
			throw new Error(`Failed to fetch game players: ${playersError.message}`);
		}

		if (!players || players.length === 0) {
			return new Response(JSON.stringify({ error: 'No players found for game' }), {
				status: 404,
				headers: { ...corsHeaders, 'Content-Type': 'application/json' },
			});
		}

		// Fetch domain events for decision analysis
		const { data: events, error: eventsError } = await supabase
			.from('domain_events')
			.select('event_type, player_id, turn_number, roll_number, payload')
			.eq('game_id', gameId)
			.in('event_type', ['TurnScored', 'DiceRolled', 'DiceKept']);

		if (eventsError) {
			throw new Error(`Failed to fetch domain events: ${eventsError.message}`);
		}

		// Process each player
		const updates: Promise<void>[] = [];

		for (const player of players as GamePlayer[]) {
			const update = processPlayerStats(supabase, player, events as DomainEvent[], players.length);
			updates.push(update);
		}

		await Promise.all(updates);

		return new Response(
			JSON.stringify({
				success: true,
				playersProcessed: players.length,
			}),
			{
				headers: { ...corsHeaders, 'Content-Type': 'application/json' },
			},
		);
	} catch (error) {
		console.error('Error aggregating game stats:', error);
		return new Response(
			JSON.stringify({
				error: error instanceof Error ? error.message : 'Unknown error',
			}),
			{
				status: 500,
				headers: { ...corsHeaders, 'Content-Type': 'application/json' },
			},
		);
	}
});

async function processPlayerStats(
	supabase: ReturnType<typeof createClient>,
	player: GamePlayer,
	allEvents: DomainEvent[],
	totalPlayers: number,
): Promise<void> {
	const playerEvents = allEvents.filter((e) => e.player_id === player.user_id);

	// Analyze scoring decisions
	const scoringEvents = playerEvents.filter((e) => e.event_type === 'TurnScored');
	let optimalDecisions = 0;
	let totalDecisions = 0;
	let totalEvLoss = 0;

	for (const event of scoringEvents) {
		totalDecisions++;
		if (event.payload.was_optimal) {
			optimalDecisions++;
		}
		if (event.payload.ev_difference !== undefined) {
			totalEvLoss += Math.max(0, event.payload.ev_difference);
		}
	}

	// Calculate category stats from scorecard
	const categoryStats: Record<string, { times_scored: number; total_score: number; avg_score: number }> = {};

	if (player.scorecard) {
		for (const [category, score] of Object.entries(player.scorecard)) {
			if (score !== null) {
				categoryStats[category] = {
					times_scored: 1,
					total_score: score,
					avg_score: score,
				};
			}
		}
	}

	// Count achievements
	let yahtzees = 0;
	let bonusYahtzees = 0;
	let upperBonus = 0;

	if (player.scorecard) {
		const scorecard = player.scorecard as Record<string, number | null>;

		// Check for Yahtzee
		if (scorecard.Yahtzee && scorecard.Yahtzee >= 50) {
			yahtzees = 1;
		}

		// Count bonus Yahtzees (from bonus_yahtzees field if present)
		if ('bonus_yahtzees' in scorecard && typeof scorecard.bonus_yahtzees === 'number') {
			bonusYahtzees = scorecard.bonus_yahtzees;
		}

		// Check upper section bonus
		const upperCategories = ['Ones', 'Twos', 'Threes', 'Fours', 'Fives', 'Sixes'];
		const upperTotal = upperCategories.reduce((sum, cat) => sum + (scorecard[cat] || 0), 0);
		if (upperTotal >= 63) {
			upperBonus = 1;
		}
	}

	const finalScore = player.final_score ?? 0;
	const won = player.final_rank === 1 && totalPlayers > 1 ? 1 : 0;

	// Fetch existing stats
	const { data: existingStats } = await supabase
		.from('player_stats')
		.select('*')
		.eq('user_id', player.user_id)
		.single();

	// Calculate new aggregates
	const gamesPlayed = (existingStats?.games_played ?? 0) + 1;
	const gamesCompleted = (existingStats?.games_completed ?? 0) + 1;
	const gamesWon = (existingStats?.games_won ?? 0) + won;
	const totalScoreSum = (existingStats?.total_score ?? 0) + finalScore;
	const bestScore = Math.max(existingStats?.best_score ?? 0, finalScore);
	const avgScore = totalScoreSum / gamesCompleted;

	const newOptimalDecisions = (existingStats?.optimal_decisions ?? 0) + optimalDecisions;
	const newTotalDecisions = (existingStats?.total_decisions ?? 0) + totalDecisions;
	const avgEvLoss =
		newTotalDecisions > 0 ? ((existingStats?.avg_ev_loss ?? 0) * (existingStats?.total_decisions ?? 0) + totalEvLoss) / newTotalDecisions : 0;

	const newYahtzees = (existingStats?.yahtzees_rolled ?? 0) + yahtzees;
	const newBonusYahtzees = (existingStats?.bonus_yahtzees ?? 0) + bonusYahtzees;
	const newUpperBonuses = (existingStats?.upper_bonuses ?? 0) + upperBonus;

	// Merge category stats
	const existingCategoryStats = (existingStats?.category_stats as typeof categoryStats) ?? {};
	const mergedCategoryStats: typeof categoryStats = { ...existingCategoryStats };

	for (const [category, stats] of Object.entries(categoryStats)) {
		if (mergedCategoryStats[category]) {
			const existing = mergedCategoryStats[category];
			const newTimesScored = existing.times_scored + stats.times_scored;
			const newTotalScore = existing.total_score + stats.total_score;
			mergedCategoryStats[category] = {
				times_scored: newTimesScored,
				total_score: newTotalScore,
				avg_score: newTotalScore / newTimesScored,
			};
		} else {
			mergedCategoryStats[category] = stats;
		}
	}

	// Upsert player stats
	const { error: upsertError } = await supabase.from('player_stats').upsert(
		{
			user_id: player.user_id,
			games_played: gamesPlayed,
			games_completed: gamesCompleted,
			games_won: gamesWon,
			total_score: totalScoreSum,
			best_score: bestScore,
			avg_score: avgScore,
			optimal_decisions: newOptimalDecisions,
			total_decisions: newTotalDecisions,
			avg_ev_loss: avgEvLoss,
			yahtzees_rolled: newYahtzees,
			bonus_yahtzees: newBonusYahtzees,
			upper_bonuses: newUpperBonuses,
			category_stats: mergedCategoryStats,
			updated_at: new Date().toISOString(),
		},
		{ onConflict: 'user_id' },
	);

	if (upsertError) {
		console.error(`Failed to upsert stats for ${player.user_id}:`, upsertError);
		throw upsertError;
	}
}
