<script lang="ts">
/**
 * RootingPanel
 *
 * Gallery rooting interface for spectators.
 * Allows spectators to root for (support) a player during the game.
 */

import { type PlayerRootingInfo, spectatorService } from '$lib/services/spectatorService.svelte';
import type { RoomPlayer } from '$lib/types/multiplayer';

interface Props {
	/** Players in the game */
	players: RoomPlayer[];
}

let { players }: Props = $props();

// Derived state from service
const rootingState = $derived(spectatorService.rootingState);
const myChoice = $derived(spectatorService.myRootingChoice);
const canChange = $derived(spectatorService.canChangeRooting);

// Get rooting info for a player
function getRootingInfo(playerId: string): PlayerRootingInfo | undefined {
	return rootingState?.players.find((p) => p.playerId === playerId);
}

// Check if currently rooting for a player
function isRootingFor(playerId: string): boolean {
	return myChoice?.playerId === playerId;
}

// Handle rooting for a player
function handleRoot(playerId: string) {
	if (!canChange) return;
	if (isRootingFor(playerId)) {
		// Already rooting - clear it
		spectatorService.clearRooting();
	} else {
		// Root for this player
		spectatorService.rootForPlayer(playerId);
	}
}

// Get player display name
function getPlayerName(playerId: string): string {
	return players.find((p) => p.id === playerId)?.displayName ?? 'Unknown';
}
</script>

<div class="rooting-panel">
	<header class="panel-header">
		<h3 class="panel-title">
			<span class="title-icon">📣</span>
			Root for a Player
		</h3>
		{#if myChoice}
			<div class="rooting-badge">
				<span class="badge-text">Rooting for {getPlayerName(myChoice.playerId)}</span>
			</div>
		{/if}
	</header>

	<div class="panel-content">
		{#if players.length === 0}
			<div class="empty-state">
				<span class="empty-icon">👥</span>
				<span class="empty-text">No players in game</span>
			</div>
		{:else}
			<div class="player-list">
				{#each players as player (player.id)}
					{@const info = getRootingInfo(player.id)}
					{@const isRooting = isRootingFor(player.id)}
					<button
						class="player-card"
						class:rooting={isRooting}
						class:has-rooters={info && info.rooterCount > 0}
						disabled={!canChange && !isRooting}
						onclick={() => handleRoot(player.id)}
					>
						<div class="player-avatar">
							{player.displayName.charAt(0).toUpperCase()}
						</div>
						<div class="player-info">
							<span class="player-name">{player.displayName}</span>
							{#if info && info.rooterCount > 0}
								<span class="rooter-count">
									📣 {info.rooterCount} {info.rooterCount === 1 ? 'fan' : 'fans'}
								</span>
							{/if}
						</div>
						<div class="root-indicator">
							{#if isRooting}
								<span class="rooting-icon">❤️</span>
							{:else}
								<span class="root-icon">🤍</span>
							{/if}
						</div>
					</button>
				{/each}
			</div>

			<!-- Change limit indicator -->
			{#if myChoice}
				<div class="change-indicator">
					{#if myChoice.remainingChanges > 0}
						{myChoice.remainingChanges} change{myChoice.remainingChanges !== 1 ? 's' : ''} remaining
					{:else}
						No more changes allowed
					{/if}
				</div>
			{/if}
		{/if}
	</div>

	<!-- Rooter list for current choice -->
	{#if myChoice}
		{@const info = getRootingInfo(myChoice.playerId)}
		{#if info && info.rooterNames.length > 1}
			<footer class="panel-footer">
				<span class="footer-label">Also rooting:</span>
				<span class="rooter-names">
					{info.rooterNames.filter(n => n !== 'You').slice(0, 5).join(', ')}
					{#if info.rooterNames.length > 6}
						+{info.rooterNames.length - 6} more
					{/if}
				</span>
			</footer>
		{/if}
	{/if}
</div>

<style>
	.rooting-panel {
		background: var(--color-surface);
		border: var(--border-thin);
		border-radius: 8px;
		overflow: hidden;
	}

	.panel-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: var(--space-2) var(--space-3);
		border-bottom: var(--border-thin);
		background: var(--color-background);
	}

	.panel-title {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		font-size: var(--text-base);
		font-weight: var(--weight-semibold);
		margin: 0;
	}

	.title-icon {
		font-size: var(--text-h4);
	}

	.rooting-badge {
		font-size: var(--text-tiny);
		background: color-mix(in srgb, var(--color-accent) 15%, transparent);
		color: var(--color-accent);
		padding: 2px 8px;
		border-radius: 12px;
		font-weight: var(--weight-semibold);
	}

	.panel-content {
		padding: var(--space-3);
	}

	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-4);
		color: var(--color-text-muted);
	}

	.empty-icon {
		font-size: var(--text-h2);
	}

	.empty-text {
		font-style: italic;
	}

	.player-list {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.player-card {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		padding: var(--space-2) var(--space-3);
		background: var(--color-background);
		border: var(--border-thin);
		border-radius: 8px;
		cursor: pointer;
		transition: all var(--transition-fast);
		width: 100%;
		text-align: left;
	}

	.player-card:hover:not(:disabled) {
		border-color: var(--color-accent);
		transform: translateX(4px);
	}

	.player-card:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.player-card.rooting {
		background: color-mix(in srgb, var(--color-accent) 10%, var(--color-background));
		border-color: var(--color-accent);
	}

	.player-card.has-rooters {
		border-left: 3px solid var(--color-success);
	}

	.player-avatar {
		width: 40px;
		height: 40px;
		border-radius: 50%;
		background: var(--color-border);
		display: flex;
		align-items: center;
		justify-content: center;
		font-weight: var(--weight-bold);
		font-size: var(--text-h4);
		color: var(--color-text-muted);
	}

	.player-card.rooting .player-avatar {
		background: var(--color-accent);
		color: var(--color-background);
	}

	.player-info {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.player-name {
		font-weight: var(--weight-semibold);
	}

	.rooter-count {
		font-size: var(--text-tiny);
		color: var(--color-text-muted);
	}

	.root-indicator {
		font-size: var(--text-h4);
	}

	.rooting-icon {
		animation: pulse 1s ease-in-out infinite;
	}

	@keyframes pulse {
		0%, 100% { transform: scale(1); }
		50% { transform: scale(1.2); }
	}

	.change-indicator {
		text-align: center;
		font-size: var(--text-tiny);
		color: var(--color-text-muted);
		margin-top: var(--space-2);
	}

	.panel-footer {
		padding: var(--space-2) var(--space-3);
		background: var(--color-background);
		border-top: var(--border-thin);
		font-size: var(--text-tiny);
		display: flex;
		gap: var(--space-1);
	}

	.footer-label {
		color: var(--color-text-muted);
	}

	.rooter-names {
		color: var(--color-text);
	}
</style>
