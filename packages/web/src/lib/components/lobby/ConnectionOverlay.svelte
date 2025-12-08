<script lang="ts">
/**
 * ConnectionOverlay - Full-screen connection status overlay
 *
 * Displays during initial connection and reconnection attempts.
 * Uses split-screen animation to reveal lobby when connected.
 */

import { onMount } from 'svelte';
import { type ConnectionState, lobby } from '$lib/stores/lobby.svelte';

let dismissed = $state(false);
let mounted = $state(false);

onMount(() => {
	mounted = true;
});

// Auto-dismiss when connected
$effect(() => {
	if (lobby.connectionState === 'connected') {
		// Small delay for the animation
		setTimeout(() => {
			dismissed = true;
		}, 300);
	}
});

const isVisible = $derived(mounted && !dismissed && lobby.connectionState !== 'connected');

function getStatusText(state: ConnectionState): string {
	switch (state) {
		case 'connecting':
			return 'CONNECTING';
		case 'reconnecting':
			return `RECONNECTING (${lobby.reconnectAttempts})`;
		case 'disconnected':
			return 'DISCONNECTED';
		default:
			return 'ENTERING';
	}
}

const statusText = $derived(getStatusText(lobby.connectionState));
</script>

{#if isVisible}
	<div
		class="connection-overlay"
		class:split={lobby.connectionState === 'connected'}
		role="status"
		aria-live="polite"
	>
		<div class="overlay-top">
			<span class="status-text">{statusText}</span>
		</div>
		<div class="overlay-bottom">
			<div class="loading-bar"></div>
		</div>
	</div>
{/if}

<style>
	.connection-overlay {
		position: fixed;
		inset: 0;
		z-index: 9999;
		display: flex;
		flex-direction: column;
		background: var(--color-text);
		color: var(--color-background);
	}

	.overlay-top,
	.overlay-bottom {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1);
	}

	.split .overlay-top {
		transform: translateY(-100%);
	}

	.split .overlay-bottom {
		transform: translateY(100%);
	}

	.status-text {
		font-family: var(--font-mono);
		font-size: 1.5rem;
		font-weight: var(--weight-black);
		letter-spacing: var(--tracking-widest);
		animation: pulse 1.5s ease-in-out infinite;
	}

	.loading-bar {
		width: 200px;
		height: 4px;
		background: var(--color-signal-muted);
		position: relative;
		overflow: hidden;
	}

	.loading-bar::after {
		content: '';
		position: absolute;
		left: 0;
		top: 0;
		height: 100%;
		width: 50%;
		background: var(--color-accent);
		animation: loading 1s ease-in-out infinite;
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

	@keyframes loading {
		0% {
			transform: translateX(-100%);
		}
		100% {
			transform: translateX(300%);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.status-text,
		.loading-bar::after {
			animation: none;
		}

		.overlay-top,
		.overlay-bottom {
			transition: none;
		}
	}
</style>
