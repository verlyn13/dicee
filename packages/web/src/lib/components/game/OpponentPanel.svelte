<script lang="ts">
/**
 * OpponentPanel Component
 *
 * Shows opponent players with their scores and connection status.
 * Highlights the current player's turn.
 */
import type { PlayerGameState } from '$lib/types/multiplayer';

interface Props {
	/** List of opponent players */
	opponents: PlayerGameState[];
	/** ID of the current player (whose turn it is) */
	currentPlayerId: string | null;
}

let { opponents, currentPlayerId }: Props = $props();

function getAvatarUrl(seed: string): string {
	return `https://api.dicebear.com/7.x/bottts-neutral/svg?seed=${seed}`;
}

function getConnectionIcon(status: string): string {
	switch (status) {
		case 'online':
			return '●';
		case 'away':
			return '◐';
		case 'disconnected':
			return '○';
		default:
			return '○';
	}
}
</script>

<div class="opponent-panel">
	<header class="panel-header">
		<h3 class="panel-title">Opponents</h3>
	</header>

	<div class="opponents-list">
		{#each opponents as opponent (opponent.id)}
			{@const isCurrentTurn = opponent.id === currentPlayerId}
			<div class="opponent-card" class:current-turn={isCurrentTurn}>
				<!-- Avatar -->
				<div class="opponent-avatar">
					<img
						src={getAvatarUrl(opponent.avatarSeed)}
						alt="{opponent.displayName}'s avatar"
						class="avatar-img"
					/>
					<span
						class="connection-status"
						class:online={opponent.connectionStatus === 'online'}
						class:away={opponent.connectionStatus === 'away'}
						class:disconnected={opponent.connectionStatus === 'disconnected'}
						title={opponent.connectionStatus}
					>
						{getConnectionIcon(opponent.connectionStatus)}
					</span>
				</div>

				<!-- Info -->
				<div class="opponent-info">
					<span class="opponent-name">{opponent.displayName}</span>
					{#if isCurrentTurn}
						<span class="turn-badge">PLAYING</span>
					{/if}
				</div>

				<!-- Score -->
				<div class="opponent-score">
					<span class="score-value">{opponent.totalScore}</span>
					<span class="score-label">pts</span>
				</div>
			</div>
		{:else}
			<div class="no-opponents">
				<p>No opponents yet</p>
			</div>
		{/each}
	</div>
</div>

<style>
	.opponent-panel {
		background: var(--color-surface);
		border: var(--border-thick);
		display: flex;
		flex-direction: column;
	}

	.panel-header {
		padding: var(--space-1) var(--space-2);
		border-bottom: var(--border-medium);
		background: var(--color-background);
	}

	.panel-title {
		margin: 0;
		font-size: var(--text-small);
		font-weight: var(--weight-bold);
		text-transform: uppercase;
		letter-spacing: var(--tracking-wider);
	}

	.opponents-list {
		display: flex;
		flex-direction: column;
	}

	.opponent-card {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-2);
		border-bottom: var(--border-thin);
		transition: background var(--transition-fast);
	}

	.opponent-card:last-child {
		border-bottom: none;
	}

	.opponent-card.current-turn {
		background: var(--color-accent-light);
	}

	.opponent-avatar {
		position: relative;
		flex-shrink: 0;
	}

	.avatar-img {
		width: 36px;
		height: 36px;
		border: var(--border-thin);
		background: var(--color-background);
	}

	.connection-status {
		position: absolute;
		bottom: -2px;
		right: -2px;
		font-size: 10px;
		line-height: 1;
	}

	.connection-status.online {
		color: var(--color-success);
	}

	.connection-status.away {
		color: var(--color-warning);
	}

	.connection-status.disconnected {
		color: var(--color-text-muted);
	}

	.opponent-info {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.opponent-name {
		font-size: var(--text-small);
		font-weight: var(--weight-semibold);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.turn-badge {
		display: inline-block;
		padding: 1px 4px;
		font-size: var(--text-tiny);
		font-weight: var(--weight-bold);
		text-transform: uppercase;
		letter-spacing: var(--tracking-wide);
		background: var(--color-accent);
		border: 1px solid var(--color-border);
	}

	.opponent-score {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		flex-shrink: 0;
	}

	.score-value {
		font-size: var(--text-body);
		font-weight: var(--weight-black);
		font-family: var(--font-mono);
		font-variant-numeric: tabular-nums;
	}

	.score-label {
		font-size: var(--text-tiny);
		color: var(--color-text-muted);
		text-transform: uppercase;
	}

	.no-opponents {
		padding: var(--space-3);
		text-align: center;
		color: var(--color-text-muted);
	}

	.no-opponents p {
		margin: 0;
		font-size: var(--text-small);
	}
</style>
