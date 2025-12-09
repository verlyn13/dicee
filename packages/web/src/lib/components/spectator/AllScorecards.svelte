<script lang="ts">
/**
 * AllScorecards Component
 *
 * Displays compact scorecards for all players in a game.
 * Used by spectators to see everyone's progress.
 */
import type { RoomPlayer } from '$lib/types/multiplayer';

interface Props {
	/** List of players in the game */
	players: RoomPlayer[];
	/** ID of the player whose turn it is */
	currentPlayerId: string | null;
}

let { players, currentPlayerId }: Props = $props();

// Category short labels
const UPPER_CATEGORIES = [
	{ key: 'ones', label: '1s' },
	{ key: 'twos', label: '2s' },
	{ key: 'threes', label: '3s' },
	{ key: 'fours', label: '4s' },
	{ key: 'fives', label: '5s' },
	{ key: 'sixes', label: '6s' },
] as const;

const LOWER_CATEGORIES = [
	{ key: 'threeOfAKind', label: '3K' },
	{ key: 'fourOfAKind', label: '4K' },
	{ key: 'fullHouse', label: 'FH' },
	{ key: 'smallStraight', label: 'SM' },
	{ key: 'largeStraight', label: 'LG' },
	{ key: 'dicee', label: 'D!' },
	{ key: 'chance', label: 'CH' },
] as const;

// Player scorecards (will be populated from events)
// For now, use placeholder data
interface PlayerScoreData {
	playerId: string;
	scores: Record<string, number | null>;
	upperBonus: number;
	diceeBonus: number;
	total: number;
}

// Placeholder - in real implementation, this would be populated from game state
const playerScores = $derived<PlayerScoreData[]>(
	players.map((p) => ({
		playerId: p.id,
		scores: {},
		upperBonus: 0,
		diceeBonus: 0,
		total: 0,
	})),
);

function getScore(data: PlayerScoreData, key: string): number | null {
	return data.scores[key] ?? null;
}
</script>

<div class="all-scorecards">
	<header class="scorecards-header">
		<h3 class="header-title">Scorecards</h3>
		<span class="player-count">{players.length} players</span>
	</header>

	{#if players.length === 0}
		<div class="empty-state">
			<p>No players in game</p>
		</div>
	{:else}
		<div class="scorecards-grid">
			{#each players as player, idx (player.id)}
				{@const scoreData = playerScores[idx]}
				{@const isCurrentTurn = player.id === currentPlayerId}
				<div class="player-card" class:current-turn={isCurrentTurn}>
					<!-- Player Header -->
					<div class="player-header">
						<span class="player-name" title={player.displayName}>
							{player.displayName}
						</span>
						{#if isCurrentTurn}
							<span class="turn-indicator">▶</span>
						{/if}
						{#if player.isHost}
							<span class="host-badge">HOST</span>
						{/if}
					</div>

					<!-- Score Grid -->
					<div class="score-grid">
						<!-- Upper Section -->
						<div class="section upper">
							{#each UPPER_CATEGORIES as cat (cat.key)}
								{@const score = getScore(scoreData, cat.key)}
								<div class="score-cell" class:filled={score !== null} title={cat.key}>
									<span class="cell-label">{cat.label}</span>
									<span class="cell-value">{score ?? '—'}</span>
								</div>
							{/each}
						</div>

						<!-- Upper Bonus Indicator -->
						{#if scoreData.upperBonus > 0}
							<div class="bonus-indicator upper-bonus">+35</div>
						{/if}

						<!-- Lower Section -->
						<div class="section lower">
							{#each LOWER_CATEGORIES as cat (cat.key)}
								{@const score = getScore(scoreData, cat.key)}
								<div
									class="score-cell"
									class:filled={score !== null}
									class:dicee={cat.key === 'dicee' && score === 50}
									title={cat.key}
								>
									<span class="cell-label">{cat.label}</span>
									<span class="cell-value">{score ?? '—'}</span>
								</div>
							{/each}
						</div>

						<!-- Dicee Bonus -->
						{#if scoreData.diceeBonus > 0}
							<div class="bonus-indicator dicee-bonus">+{scoreData.diceeBonus}</div>
						{/if}
					</div>

					<!-- Total -->
					<div class="player-total">
						<span class="total-value">{scoreData.total}</span>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>

<style>
	.all-scorecards {
		background: var(--color-surface);
		border: var(--border-thick);
		display: flex;
		flex-direction: column;
		max-height: 100%;
		overflow: hidden;
	}

	.scorecards-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: var(--space-1) var(--space-2);
		border-bottom: var(--border-medium);
		background: var(--color-background);
	}

	.header-title {
		margin: 0;
		font-size: var(--text-small);
		font-weight: var(--weight-bold);
		text-transform: uppercase;
		letter-spacing: var(--tracking-wider);
	}

	.player-count {
		font-size: var(--text-tiny);
		color: var(--color-text-muted);
	}

	.empty-state {
		padding: var(--space-4);
		text-align: center;
		color: var(--color-text-muted);
	}

	.scorecards-grid {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		padding: var(--space-1);
		overflow-y: auto;
	}

	/* Player Card */
	.player-card {
		background: var(--color-background);
		border: var(--border-thin);
		padding: var(--space-1);
		transition: border-color var(--transition-fast);
	}

	.player-card.current-turn {
		border-color: var(--color-accent);
		border-width: 2px;
	}

	.player-header {
		display: flex;
		align-items: center;
		gap: var(--space-1);
		padding-bottom: var(--space-1);
		border-bottom: 1px solid var(--color-surface);
		margin-bottom: var(--space-1);
	}

	.player-name {
		font-weight: var(--weight-semibold);
		font-size: var(--text-small);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		flex: 1;
	}

	.turn-indicator {
		color: var(--color-accent);
		font-size: var(--text-tiny);
		animation: pulse 1s ease-in-out infinite;
	}

	@keyframes pulse {
		50% {
			opacity: 0.5;
		}
	}

	.host-badge {
		font-size: var(--text-tiny);
		font-weight: var(--weight-bold);
		padding: 0 var(--space-1);
		background: var(--color-accent);
		color: var(--color-background);
	}

	/* Score Grid */
	.score-grid {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
	}

	.section {
		display: grid;
		grid-template-columns: repeat(7, 1fr);
		gap: 2px;
	}

	.section.upper {
		grid-template-columns: repeat(6, 1fr);
	}

	.score-cell {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 2px;
		background: var(--color-surface);
		font-size: var(--text-tiny);
	}

	.score-cell.filled {
		background: var(--color-surface);
	}

	.score-cell.dicee {
		background: var(--color-success);
		color: white;
	}

	.cell-label {
		font-size: 9px;
		color: var(--color-text-muted);
		text-transform: uppercase;
	}

	.score-cell.dicee .cell-label {
		color: rgba(255, 255, 255, 0.7);
	}

	.cell-value {
		font-family: var(--font-mono);
		font-weight: var(--weight-bold);
		font-size: var(--text-tiny);
	}

	/* Bonus Indicators */
	.bonus-indicator {
		text-align: center;
		font-size: var(--text-tiny);
		font-weight: var(--weight-bold);
		padding: 2px;
	}

	.upper-bonus {
		background: var(--color-success);
		color: white;
	}

	.dicee-bonus {
		background: var(--color-warning);
		color: var(--color-background);
	}

	/* Total */
	.player-total {
		display: flex;
		justify-content: flex-end;
		padding-top: var(--space-1);
		border-top: 1px solid var(--color-surface);
		margin-top: var(--space-1);
	}

	.total-value {
		font-family: var(--font-mono);
		font-size: var(--text-body);
		font-weight: var(--weight-black);
		background: var(--color-accent);
		padding: 2px var(--space-2);
	}
</style>
