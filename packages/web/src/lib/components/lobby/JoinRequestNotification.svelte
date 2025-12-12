<script lang="ts">
/**
 * JoinRequestNotification - Shows incoming join request to host
 *
 * Displayed in the waiting room when a player requests to join.
 * Host can approve or decline.
 */

import Avatar from '$lib/components/ui/Avatar.svelte';
import { type JoinRequest, joinRequestsStore } from '$lib/stores/joinRequests.svelte';

// Props
interface Props {
	request: JoinRequest;
	compact?: boolean;
}

let { request, compact = false }: Props = $props();

// Countdown timer
let secondsRemaining = $state(0);
let countdownInterval: ReturnType<typeof setInterval> | null = null;

$effect(() => {
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
});

function handleApprove() {
	joinRequestsStore.approve(request.id);
}

function handleDecline() {
	joinRequestsStore.decline(request.id);
}
</script>

{#if compact}
	<div class="notification-compact">
		<Avatar seed={request.requesterAvatarSeed} size="sm" />
		<div class="info">
			<span class="name">{request.requesterDisplayName}</span>
			<span class="action">wants to join</span>
		</div>
		<span class="countdown">{secondsRemaining}s</span>
		<div class="actions">
			<button class="btn-approve" onclick={handleApprove} title="Accept">✓</button>
			<button class="btn-decline" onclick={handleDecline} title="Decline">✕</button>
		</div>
	</div>
{:else}
	<div class="notification-card">
		<div class="header">
			<span class="label">JOIN REQUEST</span>
			<span class="countdown">{secondsRemaining}s</span>
		</div>

		<div class="requester">
			<Avatar seed={request.requesterAvatarSeed} size="md" />
			<div class="details">
				<span class="name">{request.requesterDisplayName}</span>
				<span class="action">wants to join your game</span>
			</div>
		</div>

		<div class="actions">
			<button class="btn-approve full" onclick={handleApprove}>Accept</button>
			<button class="btn-decline full" onclick={handleDecline}>Decline</button>
		</div>
	</div>
{/if}

<style>
	/* Compact variant (for list display) */
	.notification-compact {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-2);
		background: var(--color-accent);
		border: var(--border-medium);
		animation: slide-in 0.3s ease-out;
	}

	.notification-compact .info {
		flex: 1;
		display: flex;
		flex-direction: column;
		min-width: 0;
	}

	.notification-compact .name {
		font-weight: var(--weight-bold);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.notification-compact .action {
		font-size: var(--text-tiny);
		text-transform: uppercase;
		color: var(--color-signal-muted);
	}

	.notification-compact .countdown {
		font-family: var(--font-mono);
		font-size: var(--text-small);
		font-weight: var(--weight-bold);
		background: var(--color-surface);
		padding: 2px 6px;
		border: var(--border-thin);
	}

	.notification-compact .actions {
		display: flex;
		gap: var(--space-1);
	}

	.notification-compact .btn-approve,
	.notification-compact .btn-decline {
		width: 32px;
		height: 32px;
		border: var(--border-medium);
		font-weight: var(--weight-black);
		cursor: pointer;
		transition:
			transform var(--transition-fast),
			background var(--transition-fast);
	}

	.notification-compact .btn-approve {
		background: var(--color-signal-live);
	}

	.notification-compact .btn-decline {
		background: var(--color-signal-busy);
	}

	.notification-compact .btn-approve:hover,
	.notification-compact .btn-decline:hover {
		transform: scale(1.1);
	}

	/* Full card variant */
	.notification-card {
		background: var(--color-surface);
		border: var(--border-thick);
		padding: var(--space-3);
		box-shadow: 6px 6px 0 var(--color-border);
		animation: pop-in 0.3s ease-out;
	}

	.header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: var(--space-3);
		padding-bottom: var(--space-2);
		border-bottom: var(--border-thin);
	}

	.label {
		font-size: var(--text-small);
		font-weight: var(--weight-black);
		text-transform: uppercase;
		letter-spacing: var(--tracking-wide);
		background: var(--color-accent);
		padding: 2px 8px;
		border: var(--border-thin);
	}

	.countdown {
		font-family: var(--font-mono);
		font-size: var(--text-small);
		font-weight: var(--weight-bold);
		background: var(--color-primary);
		color: var(--color-text);
		padding: 2px 8px;
		border: var(--border-thin);
	}

	.requester {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		margin-bottom: var(--space-3);
	}

	.details {
		display: flex;
		flex-direction: column;
	}

	.name {
		font-size: var(--text-h4);
		font-weight: var(--weight-bold);
	}

	.action {
		font-size: var(--text-small);
		text-transform: uppercase;
		color: var(--color-signal-muted);
	}

	.actions {
		display: flex;
		gap: var(--space-2);
	}

	.btn-approve.full,
	.btn-decline.full {
		flex: 1;
		padding: var(--space-2);
		border: var(--border-medium);
		font-weight: var(--weight-bold);
		text-transform: uppercase;
		cursor: pointer;
		transition:
			transform var(--transition-fast),
			box-shadow var(--transition-fast);
	}

	.btn-approve.full {
		background: var(--color-signal-live);
	}

	.btn-decline.full {
		background: var(--color-signal-busy);
	}

	.btn-approve.full:hover,
	.btn-decline.full:hover {
		transform: translate(-2px, -2px);
		box-shadow: 4px 4px 0 var(--color-border);
	}

	.btn-approve.full:active,
	.btn-decline.full:active {
		transform: translate(2px, 2px);
		box-shadow: none;
	}

	@keyframes slide-in {
		from {
			transform: translateX(-20px);
			opacity: 0;
		}
		to {
			transform: translateX(0);
			opacity: 1;
		}
	}

	@keyframes pop-in {
		from {
			transform: scale(0.9);
			opacity: 0;
		}
		to {
			transform: scale(1);
			opacity: 1;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.notification-compact,
		.notification-card {
			animation: none;
		}
	}
</style>
