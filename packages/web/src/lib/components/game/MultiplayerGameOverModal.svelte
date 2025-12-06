<script lang="ts">
/**
 * Multiplayer Game Over Modal Component
 *
 * Displays final rankings and scores for multiplayer games.
 */
import type { PlayerRanking } from '$lib/types/multiplayer';

interface Props {
	/** Final player rankings */
	rankings: PlayerRanking[];
	/** Current player's ID */
	myPlayerId: string;
	/** Callback when modal is closed */
	onClose: () => void;
}

let { rankings, myPlayerId, onClose }: Props = $props();

const myRanking = $derived(rankings.find((r) => r.playerId === myPlayerId));
const isWinner = $derived(myRanking?.rank === 1);

function getAvatarUrl(playerId: string): string {
	const ranking = rankings.find((r) => r.playerId === playerId);
	// Use playerId as seed for consistent avatars
	return `https://api.dicebear.com/7.x/bottts-neutral/svg?seed=${playerId}`;
}

function getRankLabel(rank: number): string {
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

<div class="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="game-over-title">
	<div class="modal-content">
		<header class="modal-header">
			<h2 id="game-over-title">
				{#if isWinner}
					YOU WIN!
				{:else}
					GAME OVER
				{/if}
			</h2>
			{#if myRanking}
				<p class="your-result">
					You placed {getRankLabel(myRanking.rank)} with {myRanking.score} points
				</p>
			{/if}
		</header>

		<div class="rankings-list">
			{#each rankings as ranking (ranking.playerId)}
				{@const isMe = ranking.playerId === myPlayerId}
				<div class="ranking-row" class:is-me={isMe} class:winner={ranking.rank === 1}>
					<span class="rank">{getRankLabel(ranking.rank)}</span>
					<img
						src={getAvatarUrl(ranking.playerId)}
						alt=""
						class="avatar"
					/>
					<span class="player-name">
						{ranking.displayName}
						{#if isMe}
							<span class="you-badge">(You)</span>
						{/if}
					</span>
					<span class="score">{ranking.score}</span>
					{#if ranking.yahtzeeCount > 0}
						<span class="yahtzee-badge" title="{ranking.yahtzeeCount} Yahtzee(s)">
							🎲×{ranking.yahtzeeCount}
						</span>
					{/if}
				</div>
			{/each}
		</div>

		<div class="modal-actions">
			<button class="close-btn" onclick={onClose} type="button">
				Leave Game
			</button>
		</div>
	</div>
</div>

<style>
	.modal-overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.8);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 100;
		padding: var(--space-2);
	}

	.modal-content {
		background: var(--color-surface);
		border: var(--border-thick);
		max-width: 400px;
		width: 100%;
		animation: modal-enter 0.3s ease-out;
	}

	@keyframes modal-enter {
		from {
			opacity: 0;
			transform: scale(0.95) translateY(10px);
		}
		to {
			opacity: 1;
			transform: scale(1) translateY(0);
		}
	}

	.modal-header {
		text-align: center;
		padding: var(--space-3);
		background: var(--color-accent);
		border-bottom: var(--border-thick);
	}

	.modal-header h2 {
		margin: 0;
		font-size: var(--text-h1);
		font-weight: var(--weight-black);
		text-transform: uppercase;
		letter-spacing: var(--tracking-widest);
	}

	.your-result {
		margin: var(--space-1) 0 0;
		font-size: var(--text-body);
	}

	.rankings-list {
		padding: var(--space-2);
	}

	.ranking-row {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-2);
		border-bottom: var(--border-thin);
	}

	.ranking-row:last-child {
		border-bottom: none;
	}

	.ranking-row.is-me {
		background: var(--color-accent-light);
	}

	.ranking-row.winner {
		background: var(--color-accent);
	}

	.rank {
		font-size: var(--text-h3);
		min-width: 32px;
		text-align: center;
	}

	.avatar {
		width: 32px;
		height: 32px;
		border: var(--border-thin);
		background: var(--color-background);
	}

	.player-name {
		flex: 1;
		font-weight: var(--weight-semibold);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.you-badge {
		font-size: var(--text-tiny);
		color: var(--color-text-muted);
		font-weight: var(--weight-normal);
	}

	.score {
		font-family: var(--font-mono);
		font-size: var(--text-body);
		font-weight: var(--weight-black);
		font-variant-numeric: tabular-nums;
	}

	.yahtzee-badge {
		font-size: var(--text-small);
		padding: 2px 6px;
		background: var(--color-success);
		color: white;
		border: 1px solid var(--color-border);
	}

	.modal-actions {
		padding: var(--space-2);
		border-top: var(--border-medium);
		display: flex;
		justify-content: center;
	}

	.close-btn {
		padding: var(--space-2) var(--space-4);
		font-size: var(--text-body);
		font-weight: var(--weight-bold);
		text-transform: uppercase;
		letter-spacing: var(--tracking-wide);
		background: var(--color-background);
		border: var(--border-thick);
		cursor: pointer;
		transition:
			transform var(--transition-fast),
			background var(--transition-fast);
	}

	.close-btn:hover {
		background: var(--color-surface);
		transform: translateY(-2px);
	}

	.close-btn:active {
		transform: translateY(0);
	}
</style>
