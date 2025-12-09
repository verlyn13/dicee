<script lang="ts">
/**
 * Game Summary Page
 *
 * Displays the end-of-game summary for a completed game.
 * The [id] parameter is the game/room ID.
 */

import { goto } from '$app/navigation';
import { page } from '$app/stores';
import EndGameSummary from '$lib/components/game/EndGameSummary.svelte';
import type { PlayerRanking, Scorecard } from '$lib/types/multiplayer';

// Get game ID from route params
const gameId = $derived($page.params.id);

// TODO: In production, fetch game data from Supabase using gameId
// For now, we'll use placeholder data or data passed via navigation state

// Placeholder rankings - in production these come from the game state or database
let rankings = $state<PlayerRanking[]>([
	{ playerId: 'player1', displayName: 'You', rank: 1, score: 285, diceeCount: 1 },
	{ playerId: 'player2', displayName: 'Opponent', rank: 2, score: 220, diceeCount: 0 },
]);

// Placeholder scorecard
let myScorecard = $state<Scorecard>({
	ones: 3,
	twos: 6,
	threes: 9,
	fours: 12,
	fives: 20,
	sixes: 18,
	threeOfAKind: 22,
	fourOfAKind: 25,
	fullHouse: 25,
	smallStraight: 30,
	largeStraight: 40,
	dicee: 50,
	chance: 25,
	diceeBonus: 0,
	upperBonus: 35,
});

const myPlayerId = 'player1';

function handlePlayAgain() {
	goto('/dicee');
}

function handleReturnToHub() {
	goto('/');
}
</script>

<svelte:head>
	<title>Game Summary | DICEE</title>
</svelte:head>

<main class="summary-page">
	<EndGameSummary
		{rankings}
		{myPlayerId}
		{myScorecard}
		roomCode={gameId}
		onPlayAgain={handlePlayAgain}
		onReturnToHub={handleReturnToHub}
	/>
</main>

<style>
	.summary-page {
		min-height: 100vh;
		padding: var(--space-4);
		background: var(--color-background);
	}
</style>
