<script lang="ts">
/**
 * JoinRequestPending - Shows pending join request status
 *
 * Displayed when user has an active join request.
 * Shows countdown, status, and cancel button.
 */

import { goto } from '$app/navigation';
import { type ActiveJoinRequest, lobby } from '$lib/stores/lobby.svelte';

// Props
interface Props {
	request: ActiveJoinRequest;
}

let { request }: Props = $props();

// Countdown timer
let secondsRemaining = $state(0);
let countdownInterval: ReturnType<typeof setInterval> | null = null;

$effect(() => {
	if (request.status === 'pending') {
		// Start countdown
		secondsRemaining = Math.max(0, Math.ceil((request.expiresAt - Date.now()) / 1000));
		countdownInterval = setInterval(() => {
			secondsRemaining = Math.max(0, Math.ceil((request.expiresAt - Date.now()) / 1000));
			if (secondsRemaining <= 0 && countdownInterval) {
				clearInterval(countdownInterval);
			}
		}, 1000);

		return () => {
			if (countdownInterval) clearInterval(countdownInterval);
		};
	}
});

// Navigate to room when approved
$effect(() => {
	if (request.status === 'approved') {
		goto(`/games/dicee/room/${request.roomCode}`);
	}
});

function handleCancel() {
	lobby.cancelJoinRequest();
}

function getStatusText(status: ActiveJoinRequest['status']): string {
	switch (status) {
		case 'pending':
			return 'Waiting for host...';
		case 'approved':
			return 'Approved! Joining...';
		case 'declined':
			return request.errorMessage ?? 'Request declined';
		case 'expired':
			return 'Request expired';
		case 'cancelled':
			return 'Cancelled';
		case 'error':
			return request.errorMessage ?? 'Error';
	}
}

function getStatusClass(status: ActiveJoinRequest['status']): string {
	switch (status) {
		case 'pending':
			return 'status-pending';
		case 'approved':
			return 'status-approved';
		case 'declined':
		case 'expired':
		case 'cancelled':
		case 'error':
			return 'status-error';
	}
}
</script>

<div class="pending-overlay">
	<div class="pending-card {getStatusClass(request.status)}">
		<div class="header">
			<span class="room-code">#{request.roomCode}</span>
			{#if request.status === 'pending'}
				<span class="countdown">{secondsRemaining}s</span>
			{/if}
		</div>

		<div class="status">
			{#if request.status === 'pending'}
				<div class="spinner"></div>
			{:else if request.status === 'approved'}
				<span class="icon">✓</span>
			{:else}
				<span class="icon">✕</span>
			{/if}
			<span class="text">{getStatusText(request.status)}</span>
		</div>

		{#if request.status === 'pending'}
			<button class="cancel-button" onclick={handleCancel}> Cancel Request </button>
		{/if}
	</div>
</div>

<style>
	.pending-overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.5);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: var(--z-modal);
		animation: fade-in 0.2s ease-out;
	}

	.pending-card {
		background: var(--color-surface);
		border: var(--border-thick);
		padding: var(--space-4);
		min-width: 280px;
		text-align: center;
		box-shadow: 8px 8px 0 var(--color-border);
		animation: slide-up 0.3s ease-out;
	}

	.header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: var(--space-3);
		padding-bottom: var(--space-2);
		border-bottom: var(--border-thin);
	}

	.room-code {
		font-family: var(--font-mono);
		font-size: var(--text-h3);
		font-weight: var(--weight-black);
		letter-spacing: var(--tracking-wide);
	}

	.countdown {
		font-family: var(--font-mono);
		font-size: var(--text-small);
		font-weight: var(--weight-bold);
		background: var(--color-accent);
		padding: 2px 8px;
		border: var(--border-thin);
	}

	.status {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-2);
		margin-bottom: var(--space-3);
	}

	.spinner {
		width: 32px;
		height: 32px;
		border: 3px solid var(--color-border);
		border-top-color: var(--color-primary);
		border-radius: 50%;
		animation: spin 1s linear infinite;
	}

	.icon {
		font-size: var(--text-h2);
		font-weight: var(--weight-black);
	}

	.status-approved .icon {
		color: var(--color-signal-live);
	}

	.status-error .icon {
		color: var(--color-signal-busy);
	}

	.text {
		font-weight: var(--weight-semibold);
		text-transform: uppercase;
		font-size: var(--text-small);
	}

	.cancel-button {
		width: 100%;
		padding: var(--space-2);
		background: transparent;
		border: var(--border-medium);
		font-weight: var(--weight-bold);
		text-transform: uppercase;
		cursor: pointer;
		transition:
			background var(--transition-fast),
			transform var(--transition-fast);
	}

	.cancel-button:hover {
		background: var(--color-disabled);
		transform: translate(-2px, -2px);
	}

	.cancel-button:active {
		transform: translate(2px, 2px);
	}

	@keyframes fade-in {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}

	@keyframes slide-up {
		from {
			transform: translateY(20px);
			opacity: 0;
		}
		to {
			transform: translateY(0);
			opacity: 1;
		}
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.pending-overlay,
		.pending-card,
		.spinner {
			animation: none;
		}
	}
</style>
