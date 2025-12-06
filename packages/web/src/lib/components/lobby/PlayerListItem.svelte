<script lang="ts">
/**
 * PlayerListItem - Displays a player in the room lobby
 *
 * Shows avatar, display name, host badge, and connection status.
 * Highlights the current user's entry.
 */
import Avatar from '$lib/components/ui/Avatar.svelte';
import type { RoomPlayer } from '$lib/types/multiplayer';

interface Props {
	/** Player data */
	player: RoomPlayer;
	/** Whether this is the current user */
	isCurrentUser?: boolean;
	/** Additional CSS classes */
	class?: string;
}

let { player, isCurrentUser = false, class: className = '' }: Props = $props();
</script>

<div
	class="player-item"
	class:player-item--current={isCurrentUser}
	class:player-item--disconnected={!player.isConnected}
	class:className
>
	<div class="player-avatar">
		<Avatar seed={player.avatarSeed} size="sm" alt="{player.displayName}'s avatar" />
		{#if !player.isConnected}
			<span class="connection-indicator" title="Reconnecting..."></span>
		{/if}
	</div>

	<div class="player-info">
		<span class="player-name">
			{player.displayName}
			{#if isCurrentUser}
				<span class="you-badge">(you)</span>
			{/if}
		</span>

		{#if player.isHost}
			<span class="host-badge">HOST</span>
		{/if}
	</div>

	{#if !player.isConnected}
		<span class="status-text">Reconnecting...</span>
	{/if}
</div>

<style>
	.player-item {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-2);
		background: var(--color-surface);
		border: var(--border-medium);
		transition: background var(--transition-fast);
	}

	.player-item--current {
		background: var(--color-accent-subtle, rgba(255, 213, 0, 0.1));
		border-color: var(--color-accent);
	}

	.player-item--disconnected {
		opacity: 0.6;
	}

	.player-avatar {
		position: relative;
		flex-shrink: 0;
	}

	.connection-indicator {
		position: absolute;
		bottom: -2px;
		right: -2px;
		width: 12px;
		height: 12px;
		background: var(--color-warning);
		border: 2px solid var(--color-surface);
		border-radius: 50%;
		animation: pulse 1.5s ease-in-out infinite;
	}

	@keyframes pulse {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.5;
		}
	}

	.player-info {
		display: flex;
		align-items: center;
		gap: var(--space-1);
		flex: 1;
		min-width: 0;
	}

	.player-name {
		font-size: var(--text-body);
		font-weight: var(--weight-medium);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.you-badge {
		font-size: var(--text-small);
		font-weight: var(--weight-normal);
		color: var(--color-text-muted);
	}

	.host-badge {
		flex-shrink: 0;
		padding: var(--space-0) var(--space-1);
		font-size: var(--text-small);
		font-weight: var(--weight-bold);
		text-transform: uppercase;
		letter-spacing: var(--tracking-wide);
		background: var(--color-accent);
		border: var(--border-thin);
	}

	.status-text {
		flex-shrink: 0;
		font-size: var(--text-small);
		color: var(--color-warning);
		font-style: italic;
	}
</style>
