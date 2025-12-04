<script lang="ts">
/**
 * GameHistory - Recent games list component
 *
 * Displays a list of completed games with date, result, score, and rank.
 * Supports loading, empty, and error states.
 *
 * Design: Neo-Brutalist with hard borders, tabular numbers
 */

import type { GameHistoryEntry } from '$lib/supabase/stats';

interface Props {
	/** Game history entries */
	games: GameHistoryEntry[] | null;
	/** Whether data is currently loading */
	loading?: boolean;
	/** Error message if fetch failed */
	error?: string | null;
	/** Maximum games to display (for "show more" functionality) */
	maxDisplay?: number;
	/** Callback when "Load More" is clicked */
	onLoadMore?: () => void;
	/** Whether more games are available to load */
	hasMore?: boolean;
	/** Additional CSS classes */
	class?: string;
}

let {
	games,
	loading = false,
	error = null,
	maxDisplay = 10,
	onLoadMore,
	hasMore = false,
	class: className = '',
}: Props = $props();

// Limit displayed games
const displayedGames = $derived(games?.slice(0, maxDisplay) ?? []);

/**
 * Format date for display
 * Shows relative time for recent games, date for older ones
 */
function formatDate(dateString: string | null): string {
	if (!dateString) return 'Unknown';

	const date = new Date(dateString);
	const now = new Date();
	const diffMs = now.getTime() - date.getTime();
	const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

	if (diffDays === 0) {
		const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
		if (diffHours === 0) {
			const diffMins = Math.floor(diffMs / (1000 * 60));
			return diffMins <= 1 ? 'Just now' : `${diffMins}m ago`;
		}
		return diffHours === 1 ? '1 hour ago' : `${diffHours}h ago`;
	}

	if (diffDays === 1) return 'Yesterday';
	if (diffDays < 7) return `${diffDays} days ago`;

	return date.toLocaleDateString('en-US', {
		month: 'short',
		day: 'numeric',
		year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
	});
}

/**
 * Format game mode for display
 */
function formatGameMode(mode: string): string {
	const modeMap: Record<string, string> = {
		solo: 'Solo',
		multiplayer: 'Multiplayer',
		practice: 'Practice',
		ranked: 'Ranked',
	};
	return modeMap[mode] ?? mode;
}

/**
 * Get rank suffix (1st, 2nd, 3rd, etc.)
 */
function formatRank(rank: number | null): string {
	if (rank === null) return '-';
	if (rank === 1) return '1st';
	if (rank === 2) return '2nd';
	if (rank === 3) return '3rd';
	return `${rank}th`;
}
</script>

<div class="game-history {className}" class:loading>
	<h3 class="section-title">Recent Games</h3>

	{#if loading && (!games || games.length === 0)}
		<!-- Loading State -->
		<div class="loading-state">
			<div class="loading-spinner" aria-hidden="true"></div>
			<p class="loading-text">Loading game history...</p>
		</div>
	{:else if error}
		<!-- Error State -->
		<div class="error-state" role="alert">
			<span class="error-icon" aria-hidden="true">⚠</span>
			<p class="error-text">{error}</p>
		</div>
	{:else if !games || games.length === 0}
		<!-- Empty State -->
		<div class="empty-state">
			<span class="empty-icon" aria-hidden="true">🎲</span>
			<p class="empty-title">No Games Yet</p>
			<p class="empty-text">Your completed games will appear here.</p>
		</div>
	{:else}
		<!-- Games List -->
		<ul class="games-list" role="list">
			{#each displayedGames as game (game.game_id)}
				<li class="game-item" class:won={game.won}>
					<div class="game-result">
						{#if game.won}
							<span class="result-badge result-badge--win">WIN</span>
						{:else}
							<span class="result-badge result-badge--loss">LOSS</span>
						{/if}
					</div>

					<div class="game-details">
						<div class="game-mode">{formatGameMode(game.game_mode)}</div>
						<div class="game-date">{formatDate(game.completed_at)}</div>
					</div>

					<div class="game-stats">
						<div class="stat-item">
							<span class="stat-label">Score</span>
							<span class="stat-value">{game.final_score ?? '-'}</span>
						</div>
						{#if game.player_count > 1}
							<div class="stat-item">
								<span class="stat-label">Rank</span>
								<span class="stat-value">{formatRank(game.final_rank)}</span>
							</div>
						{/if}
					</div>
				</li>
			{/each}
		</ul>

		<!-- Load More Button -->
		{#if hasMore && onLoadMore}
			<button
				type="button"
				class="load-more-button"
				onclick={onLoadMore}
				disabled={loading}
			>
				{#if loading}
					Loading...
				{:else}
					Load More
				{/if}
			</button>
		{/if}

		<!-- Games Count -->
		<p class="games-count">
			Showing {displayedGames.length} of {games.length} games
		</p>
	{/if}
</div>

<style>
	.game-history {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		width: 100%;
	}

	.section-title {
		font-size: var(--text-body);
		font-weight: var(--weight-semibold);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--color-text);
		margin: 0;
		padding-bottom: var(--space-1);
		border-bottom: var(--border-medium);
	}

	/* Loading State */
	.loading-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: var(--space-2);
		padding: var(--space-4);
		border: var(--border-medium);
		background: var(--color-surface);
	}

	.loading-spinner {
		width: 24px;
		height: 24px;
		border: 3px solid var(--color-border);
		border-top-color: var(--color-accent);
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.loading-text {
		font-size: var(--text-small);
		color: var(--color-text-muted);
		margin: 0;
	}

	/* Error State */
	.error-state {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-2);
		border: var(--border-medium);
		background: var(--color-danger);
		color: var(--color-surface);
	}

	.error-icon {
		font-size: var(--text-h3);
	}

	.error-text {
		font-size: var(--text-body);
		margin: 0;
	}

	/* Empty State */
	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: var(--space-1);
		padding: var(--space-4);
		border: var(--border-medium);
		background: var(--color-surface);
		text-align: center;
	}

	.empty-icon {
		font-size: 36px;
	}

	.empty-title {
		font-size: var(--text-body);
		font-weight: var(--weight-semibold);
		color: var(--color-text);
		margin: 0;
	}

	.empty-text {
		font-size: var(--text-small);
		color: var(--color-text-muted);
		margin: 0;
	}

	/* Games List */
	.games-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
	}

	/* Game Item */
	.game-item {
		display: grid;
		grid-template-columns: auto 1fr auto;
		gap: var(--space-2);
		align-items: center;
		padding: var(--space-2);
		border: var(--border-medium);
		background: var(--color-surface);
		transition: transform var(--transition-fast), box-shadow var(--transition-fast);
	}

	.game-item:hover {
		transform: translate(-1px, -1px);
		box-shadow: 2px 2px 0 var(--color-border);
	}

	.game-item.won {
		border-left: 4px solid var(--color-success);
	}

	/* Result Badge */
	.game-result {
		display: flex;
		align-items: center;
	}

	.result-badge {
		padding: 2px 8px;
		font-size: var(--text-tiny);
		font-weight: var(--weight-bold);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		border: var(--border-thin);
	}

	.result-badge--win {
		background: var(--color-success);
		color: var(--color-surface);
		border-color: var(--color-success);
	}

	.result-badge--loss {
		background: var(--color-surface);
		color: var(--color-text-muted);
		border-color: var(--color-text-muted);
	}

	/* Game Details */
	.game-details {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	}

	.game-mode {
		font-size: var(--text-body);
		font-weight: var(--weight-medium);
		color: var(--color-text);
	}

	.game-date {
		font-size: var(--text-small);
		color: var(--color-text-muted);
	}

	/* Game Stats */
	.game-stats {
		display: flex;
		gap: var(--space-3);
	}

	.stat-item {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 2px;
	}

	.stat-label {
		font-size: var(--text-tiny);
		color: var(--color-text-muted);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.stat-value {
		font-size: var(--text-body);
		font-weight: var(--weight-semibold);
		font-variant-numeric: tabular-nums;
		color: var(--color-text);
	}

	/* Load More Button */
	.load-more-button {
		width: 100%;
		padding: var(--space-2);
		background: var(--color-surface);
		color: var(--color-text);
		border: var(--border-medium);
		font-family: var(--font-sans);
		font-size: var(--text-body);
		font-weight: var(--weight-medium);
		cursor: pointer;
		transition: background var(--transition-fast);
	}

	.load-more-button:hover:not(:disabled) {
		background: var(--color-background);
	}

	.load-more-button:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.load-more-button:focus-visible {
		outline: 3px solid var(--color-accent);
		outline-offset: 2px;
	}

	/* Games Count */
	.games-count {
		font-size: var(--text-small);
		color: var(--color-text-muted);
		text-align: center;
		margin: 0;
	}

	/* Loading overlay effect */
	.game-history.loading {
		opacity: 0.7;
		pointer-events: none;
	}

	/* Mobile adjustments */
	@media (max-width: 480px) {
		.game-item {
			grid-template-columns: 1fr;
			gap: var(--space-1);
		}

		.game-result {
			order: -1;
		}

		.game-stats {
			justify-content: flex-start;
		}

		.stat-item {
			align-items: flex-start;
		}
	}
</style>
