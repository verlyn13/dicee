<script lang="ts">
/**
 * DisconnectedPlayersBanner Component
 *
 * Shows a list of disconnected opponents with countdown timers
 * indicating how long until their seat expires.
 */

import { onDestroy, onMount } from 'svelte';
import type { DisconnectedPlayer } from '$lib/stores/multiplayerGame.svelte';

interface Props {
	/** List of disconnected players with reconnection deadlines */
	disconnectedPlayers: DisconnectedPlayer[];
}

let { disconnectedPlayers }: Props = $props();

// Update countdowns every second
let now = $state(Date.now());
let intervalId: ReturnType<typeof setInterval> | null = null;

onMount(() => {
	intervalId = setInterval(() => {
		now = Date.now();
	}, 1000);
});

onDestroy(() => {
	if (intervalId) {
		clearInterval(intervalId);
	}
});

// Format remaining time
function formatTimeRemaining(deadline: number): string {
	const remaining = Math.max(0, deadline - now);
	const minutes = Math.floor(remaining / 60000);
	const seconds = Math.floor((remaining % 60000) / 1000);

	if (minutes > 0) {
		return `${minutes}:${seconds.toString().padStart(2, '0')}`;
	}
	return `${seconds}s`;
}

// Get urgency level for styling
function getUrgency(deadline: number): 'normal' | 'warning' | 'critical' {
	const remaining = deadline - now;
	if (remaining < 30000) return 'critical'; // < 30s
	if (remaining < 60000) return 'warning'; // < 1min
	return 'normal';
}
</script>

{#if disconnectedPlayers.length > 0}
	<div class="disconnected-banner" role="alert" aria-live="polite">
		<span class="banner-icon" aria-hidden="true">⚠</span>
		<div class="players-list">
			{#each disconnectedPlayers as player (player.userId)}
				{@const urgency = getUrgency(player.reconnectDeadline)}
				<div class="player-item" class:warning={urgency === 'warning'} class:critical={urgency === 'critical'}>
					<span class="player-name">{player.displayName}</span>
					<span class="status-text">disconnected</span>
					<span class="countdown" class:pulse={urgency === 'critical'}>
						{formatTimeRemaining(player.reconnectDeadline)}
					</span>
				</div>
			{/each}
		</div>
	</div>
{/if}

<style>
	.disconnected-banner {
		display: flex;
		align-items: flex-start;
		gap: var(--space-2);
		padding: var(--space-2) var(--space-3);
		background: var(--color-warning-light, #fff3cd);
		color: var(--color-warning-dark, #856404);
		border-bottom: 2px solid var(--color-warning, #ffc107);
		animation: slide-in-banner 0.3s ease-out;
	}

	@keyframes slide-in-banner {
		from {
			opacity: 0;
			transform: translateY(-10px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	.banner-icon {
		font-size: 1.2rem;
		flex-shrink: 0;
		margin-top: 2px;
	}

	.players-list {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		flex: 1;
	}

	.player-item {
		display: flex;
		align-items: center;
		gap: var(--space-1);
		padding: var(--space-1) var(--space-2);
		background: rgba(255, 255, 255, 0.5);
		border-radius: 4px;
		font-size: var(--text-small);
	}

	.player-item.warning {
		background: rgba(255, 193, 7, 0.3);
	}

	.player-item.critical {
		background: rgba(220, 53, 69, 0.2);
		color: var(--color-danger-dark, #721c24);
	}

	.player-name {
		font-weight: var(--weight-bold);
	}

	.status-text {
		color: inherit;
		opacity: 0.8;
	}

	.countdown {
		font-family: var(--font-mono);
		font-weight: var(--weight-bold);
		padding: 2px 6px;
		background: rgba(0, 0, 0, 0.1);
		border-radius: 3px;
	}

	.countdown.pulse {
		animation: pulse-countdown 1s ease-in-out infinite;
	}

	@keyframes pulse-countdown {
		0%, 100% {
			opacity: 1;
		}
		50% {
			opacity: 0.5;
		}
	}
</style>
