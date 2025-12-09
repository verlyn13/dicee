<script lang="ts">
/**
 * EndGameSummary Component
 *
 * Displays the final game results including:
 * - Player rankings with scores
 * - Score breakdown by category
 * - Decision review table (placeholder for EV tracking)
 * - Navigation to play again or return to hub
 */

import { goto } from '$app/navigation';
import type { Category, PlayerRanking, Scorecard } from '$lib/types/multiplayer';
import { haptic } from '$lib/utils/haptics';

interface Props {
	/** Player rankings from the completed game */
	rankings: PlayerRanking[];
	/** Current player's ID */
	myPlayerId: string;
	/** Current player's final scorecard */
	myScorecard: Scorecard | null;
	/** Room code for rematch */
	roomCode?: string;
	/** Callback for play again action */
	onPlayAgain?: () => void;
	/** Callback for return to hub action */
	onReturnToHub?: () => void;
}

let { rankings, myPlayerId, myScorecard, roomCode, onPlayAgain, onReturnToHub }: Props = $props();

// Find my ranking
const myRanking = $derived(rankings.find((r) => r.playerId === myPlayerId));
const isWinner = $derived(myRanking?.rank === 1);

// Category display names
const categoryNames: Record<Category, string> = {
	ones: 'Ones',
	twos: 'Twos',
	threes: 'Threes',
	fours: 'Fours',
	fives: 'Fives',
	sixes: 'Sixes',
	threeOfAKind: 'Three of a Kind',
	fourOfAKind: 'Four of a Kind',
	fullHouse: 'Full House',
	smallStraight: 'Small Straight',
	largeStraight: 'Large Straight',
	dicee: 'Dicee',
	chance: 'Chance',
};

// Upper section categories
const upperCategories: Category[] = ['ones', 'twos', 'threes', 'fours', 'fives', 'sixes'];
const lowerCategories: Category[] = [
	'threeOfAKind',
	'fourOfAKind',
	'fullHouse',
	'smallStraight',
	'largeStraight',
	'dicee',
	'chance',
];

// Calculate upper subtotal
const upperSubtotal = $derived(
	myScorecard ? upperCategories.reduce((sum, cat) => sum + (myScorecard[cat] ?? 0), 0) : 0,
);

// Calculate lower subtotal
const lowerSubtotal = $derived(
	myScorecard ? lowerCategories.reduce((sum, cat) => sum + (myScorecard[cat] ?? 0), 0) : 0,
);

// Upper bonus threshold
const upperBonusThreshold = 63;
const hasUpperBonus = $derived(upperSubtotal >= upperBonusThreshold);

function handlePlayAgain() {
	haptic('medium');
	if (onPlayAgain) {
		onPlayAgain();
	} else {
		goto('/dicee');
	}
}

function handleReturnToHub() {
	haptic('light');
	if (onReturnToHub) {
		onReturnToHub();
	} else {
		goto('/');
	}
}

function getRankEmoji(rank: number): string {
	switch (rank) {
		case 1:
			return '🥇';
		case 2:
			return '🥈';
		case 3:
			return '🥉';
		default:
			return `#${rank}`;
	}
}
</script>

<div class="end-game-summary" class:winner={isWinner}>
	<!-- Header -->
	<header class="summary-header">
		<h1 class="title">
			{#if isWinner}
				🎉 Victory! 🎉
			{:else}
				Game Over
			{/if}
		</h1>
		{#if roomCode}
			<p class="room-code">Room: {roomCode}</p>
		{/if}
	</header>

	<!-- Rankings -->
	<section class="rankings-section">
		<h2 class="section-title">Final Standings</h2>
		<div class="rankings-list">
			{#each rankings as player (player.playerId)}
				<div
					class="ranking-row"
					class:is-me={player.playerId === myPlayerId}
					class:is-winner={player.rank === 1}
				>
					<span class="rank">{getRankEmoji(player.rank)}</span>
					<span class="player-name">{player.displayName}</span>
					<span class="player-score">{player.score}</span>
					{#if player.diceeCount > 0}
						<span class="dicee-badge" title="{player.diceeCount} Dicee(s)">
							🎯 ×{player.diceeCount}
						</span>
					{/if}
				</div>
			{/each}
		</div>
	</section>

	<!-- Score Breakdown -->
	{#if myScorecard}
		<section class="breakdown-section">
			<h2 class="section-title">Your Score Breakdown</h2>
			
			<!-- Upper Section -->
			<div class="score-group">
				<h3 class="group-title">Upper Section</h3>
				<div class="score-rows">
					{#each upperCategories as category}
						<div class="score-row">
							<span class="category-name">{categoryNames[category]}</span>
							<span class="category-score">{myScorecard[category] ?? 0}</span>
						</div>
					{/each}
					<div class="score-row subtotal">
						<span class="category-name">Subtotal</span>
						<span class="category-score">{upperSubtotal}</span>
					</div>
					<div class="score-row bonus" class:earned={hasUpperBonus}>
						<span class="category-name">
							Bonus {hasUpperBonus ? '✓' : `(need ${upperBonusThreshold - upperSubtotal} more)`}
						</span>
						<span class="category-score">{hasUpperBonus ? 35 : 0}</span>
					</div>
				</div>
			</div>

			<!-- Lower Section -->
			<div class="score-group">
				<h3 class="group-title">Lower Section</h3>
				<div class="score-rows">
					{#each lowerCategories as category}
						<div class="score-row">
							<span class="category-name">{categoryNames[category]}</span>
							<span class="category-score">{myScorecard[category] ?? 0}</span>
						</div>
					{/each}
					{#if myScorecard.diceeBonus > 0}
						<div class="score-row bonus earned">
							<span class="category-name">Dicee Bonus</span>
							<span class="category-score">+{myScorecard.diceeBonus}</span>
						</div>
					{/if}
					<div class="score-row subtotal">
						<span class="category-name">Subtotal</span>
						<span class="category-score">{lowerSubtotal + (myScorecard.diceeBonus ?? 0)}</span>
					</div>
				</div>
			</div>

			<!-- Grand Total -->
			<div class="grand-total">
				<span class="total-label">Grand Total</span>
				<span class="total-score">{myRanking?.score ?? 0}</span>
			</div>
		</section>
	{/if}

	<!-- EV Tracking Placeholder -->
	<section class="ev-section">
		<h2 class="section-title">Decision Analysis</h2>
		<div class="ev-placeholder">
			<p class="placeholder-text">
				📊 Expected Value tracking coming soon!
			</p>
			<p class="placeholder-subtext">
				Review your decisions and see how they compared to optimal play.
			</p>
		</div>
	</section>

	<!-- Actions -->
	<footer class="summary-actions">
		<button class="action-btn primary" onclick={handlePlayAgain}>
			🎲 Play Again
		</button>
		<button class="action-btn secondary" onclick={handleReturnToHub}>
			← Return to Hub
		</button>
	</footer>
</div>

<style>
	.end-game-summary {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
		padding: var(--space-4);
		background: var(--color-surface);
		border: var(--border-thick);
		max-width: 600px;
		margin: 0 auto;
	}

	.end-game-summary.winner {
		background: linear-gradient(
			135deg,
			var(--color-surface) 0%,
			hsl(50, 100%, 95%) 100%
		);
	}

	/* Header */
	.summary-header {
		text-align: center;
		padding-bottom: var(--space-3);
		border-bottom: var(--border-medium);
	}

	.title {
		font-family: var(--font-mono);
		font-size: var(--text-h1);
		font-weight: var(--weight-black);
		text-transform: uppercase;
		letter-spacing: var(--tracking-tight);
		margin: 0;
	}

	.room-code {
		font-family: var(--font-mono);
		font-size: var(--text-small);
		color: var(--color-text-muted);
		margin: var(--space-1) 0 0;
	}

	/* Section styling */
	.section-title {
		font-family: var(--font-mono);
		font-size: var(--text-body);
		font-weight: var(--weight-bold);
		text-transform: uppercase;
		letter-spacing: var(--tracking-wide);
		margin: 0 0 var(--space-2);
		padding-bottom: var(--space-1);
		border-bottom: var(--border-thin);
	}

	/* Rankings */
	.rankings-list {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
	}

	.ranking-row {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-2);
		background: var(--color-background);
		border: var(--border-thin);
	}

	.ranking-row.is-me {
		border-color: var(--color-accent);
		border-width: 2px;
	}

	.ranking-row.is-winner {
		background: hsl(50, 100%, 90%);
	}

	.rank {
		font-size: var(--text-h3);
		min-width: 2rem;
		text-align: center;
	}

	.player-name {
		flex: 1;
		font-weight: var(--weight-semibold);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.player-score {
		font-family: var(--font-mono);
		font-size: var(--text-body);
		font-weight: var(--weight-bold);
	}

	.dicee-badge {
		font-size: var(--text-small);
		padding: 2px 6px;
		background: var(--color-accent);
		border: var(--border-thin);
	}

	/* Score Breakdown */
	.score-group {
		margin-bottom: var(--space-3);
	}

	.group-title {
		font-size: var(--text-small);
		font-weight: var(--weight-semibold);
		color: var(--color-text-muted);
		text-transform: uppercase;
		letter-spacing: var(--tracking-wide);
		margin: 0 0 var(--space-1);
	}

	.score-rows {
		display: flex;
		flex-direction: column;
	}

	.score-row {
		display: flex;
		justify-content: space-between;
		padding: var(--space-1) var(--space-2);
		border-bottom: 1px solid var(--color-border);
	}

	.score-row:last-child {
		border-bottom: none;
	}

	.score-row.subtotal {
		background: var(--color-background);
		font-weight: var(--weight-semibold);
	}

	.score-row.bonus {
		color: var(--color-text-muted);
		font-size: var(--text-small);
	}

	.score-row.bonus.earned {
		color: var(--color-success);
		font-weight: var(--weight-semibold);
	}

	.category-name {
		font-size: var(--text-small);
	}

	.category-score {
		font-family: var(--font-mono);
		font-size: var(--text-small);
		font-weight: var(--weight-semibold);
	}

	/* Grand Total */
	.grand-total {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: var(--space-3);
		background: var(--color-text);
		color: var(--color-surface);
		border: var(--border-thick);
	}

	.total-label {
		font-family: var(--font-mono);
		font-size: var(--text-body);
		font-weight: var(--weight-bold);
		text-transform: uppercase;
		letter-spacing: var(--tracking-wide);
	}

	.total-score {
		font-family: var(--font-mono);
		font-size: var(--text-h2);
		font-weight: var(--weight-black);
	}

	/* EV Placeholder */
	.ev-placeholder {
		padding: var(--space-4);
		background: var(--color-background);
		border: var(--border-thin);
		border-style: dashed;
		text-align: center;
	}

	.placeholder-text {
		font-size: var(--text-body);
		font-weight: var(--weight-semibold);
		margin: 0 0 var(--space-1);
	}

	.placeholder-subtext {
		font-size: var(--text-small);
		color: var(--color-text-muted);
		margin: 0;
	}

	/* Actions */
	.summary-actions {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		padding-top: var(--space-3);
		border-top: var(--border-medium);
	}

	.action-btn {
		width: 100%;
		padding: var(--space-3);
		font-family: var(--font-mono);
		font-size: var(--text-body);
		font-weight: var(--weight-bold);
		text-transform: uppercase;
		letter-spacing: var(--tracking-wide);
		border: var(--border-thick);
		cursor: pointer;
		transition:
			transform var(--transition-fast),
			background var(--transition-fast);
	}

	.action-btn.primary {
		background: var(--color-accent);
		color: var(--color-text);
	}

	.action-btn.primary:hover {
		background: var(--color-accent-dark);
		transform: translateY(-2px);
	}

	.action-btn.secondary {
		background: var(--color-surface);
		color: var(--color-text);
	}

	.action-btn.secondary:hover {
		background: var(--color-background);
	}

	.action-btn:active {
		transform: translateY(0);
	}

	/* Responsive */
	@media (min-width: 480px) {
		.summary-actions {
			flex-direction: row;
		}

		.action-btn {
			flex: 1;
		}
	}
</style>
