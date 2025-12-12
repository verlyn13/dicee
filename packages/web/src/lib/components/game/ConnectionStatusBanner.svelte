<script lang="ts">
/**
 * ConnectionStatusBanner Component
 *
 * Shows the user's own connection status:
 * - Reconnecting state with spinner
 * - Successfully reconnected toast (auto-dismisses)
 */

import { onDestroy, onMount } from 'svelte';
import { type ConnectionStatus, roomService } from '$lib/services/roomService.svelte';

interface Props {
	/** Whether the player successfully reconnected (reclaimed their seat) */
	didReconnect: boolean;
	/** Callback to clear the reconnection banner */
	onDismissReconnect?: () => void;
}

let { didReconnect, onDismissReconnect }: Props = $props();

// Track connection status reactively
let connectionStatus = $state<ConnectionStatus>(roomService.status);
let unsubscribe: (() => void) | null = null;

onMount(() => {
	// Subscribe to status changes
	const listener = (status: ConnectionStatus) => {
		connectionStatus = status;
	};
	roomService.addStatusListener(listener);
	unsubscribe = () => roomService.removeStatusListener(listener);
});

onDestroy(() => {
	unsubscribe?.();
});

// Derived: show reconnecting banner when status is 'connecting' but we were previously connected
const isReconnecting = $derived(connectionStatus === 'connecting');
const isConnected = $derived(connectionStatus === 'connected');
const hasError = $derived(connectionStatus === 'error');

function handleDismiss(): void {
	onDismissReconnect?.();
}
</script>

{#if isReconnecting}
	<div class="connection-banner reconnecting" role="alert" aria-live="polite">
		<span class="spinner" aria-hidden="true"></span>
		<span class="banner-text">Reconnecting to game...</span>
	</div>
{:else if didReconnect && isConnected}
	<div class="connection-banner reconnected" role="status" aria-live="polite">
		<span class="icon" aria-hidden="true">✓</span>
		<span class="banner-text">Successfully reconnected!</span>
		<button
			type="button"
			class="dismiss-btn"
			onclick={handleDismiss}
			aria-label="Dismiss notification"
		>
			×
		</button>
	</div>
{:else if hasError}
	<div class="connection-banner error" role="alert" aria-live="assertive">
		<span class="icon" aria-hidden="true">⚠</span>
		<span class="banner-text">Connection lost. Attempting to reconnect...</span>
	</div>
{/if}

<style>
	.connection-banner {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-2);
		padding: var(--space-2) var(--space-3);
		font-size: var(--text-small);
		font-weight: var(--weight-semibold);
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

	.reconnecting {
		background: var(--color-warning-light, #fff3cd);
		color: var(--color-warning-dark, #856404);
		border-bottom: 2px solid var(--color-warning, #ffc107);
	}

	.reconnected {
		background: var(--color-success-light, #d4edda);
		color: var(--color-success-dark, #155724);
		border-bottom: 2px solid var(--color-success, #28a745);
	}

	.error {
		background: var(--color-danger-light, #f8d7da);
		color: var(--color-danger-dark, #721c24);
		border-bottom: 2px solid var(--color-danger, #dc3545);
	}

	.spinner {
		width: 16px;
		height: 16px;
		border: 2px solid currentColor;
		border-right-color: transparent;
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.icon {
		font-size: 1.2em;
	}

	.banner-text {
		flex: 1;
	}

	.dismiss-btn {
		padding: 0;
		width: 24px;
		height: 24px;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 1.25rem;
		line-height: 1;
		background: transparent;
		border: none;
		opacity: 0.7;
		cursor: pointer;
		transition: opacity var(--transition-fast);
	}

	.dismiss-btn:hover {
		opacity: 1;
	}
</style>
