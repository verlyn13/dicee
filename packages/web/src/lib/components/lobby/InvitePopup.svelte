<script lang="ts">
/**
 * InvitePopup - Floating notification for incoming game invites
 *
 * Displays when another user invites this user to their game room.
 * Shows host info, room details, countdown timer, and accept/decline buttons.
 */
import { Avatar } from '$lib/components/ui';
import type { PendingInvite } from '$lib/stores/lobby.svelte';

interface Props {
	/** The invite to display */
	invite: PendingInvite;
	/** Callback when user accepts */
	onAccept: (inviteId: string, roomCode: string) => void;
	/** Callback when user declines */
	onDecline: (inviteId: string) => void;
}

let { invite, onAccept, onDecline }: Props = $props();

// Countdown timer
let timeRemaining = $state(0);

$effect(() => {
	function updateTimer() {
		const remaining = Math.max(0, Math.floor((invite.expiresAt - Date.now()) / 1000));
		timeRemaining = remaining;
	}

	updateTimer();
	const interval = setInterval(updateTimer, 1000);

	return () => clearInterval(interval);
});

// Format time remaining
const timeDisplay = $derived(() => {
	const minutes = Math.floor(timeRemaining / 60);
	const seconds = timeRemaining % 60;
	if (minutes > 0) {
		return `${minutes}:${seconds.toString().padStart(2, '0')}`;
	}
	return `${seconds}s`;
});

// Urgency class for countdown
const countdownClass = $derived(
	timeRemaining <= 30 ? 'urgent' : timeRemaining <= 60 ? 'warning' : '',
);

function handleAccept() {
	onAccept(invite.inviteId, invite.roomCode);
}

function handleDecline() {
	onDecline(invite.inviteId);
}
</script>

<div class="invite-popup" role="alertdialog" aria-labelledby="invite-title">
	<div class="invite-header">
		<span id="invite-title" class="invite-title">Game Invite</span>
		<span class="countdown {countdownClass}">{timeDisplay()}</span>
	</div>

	<div class="invite-body">
		<div class="host-info">
			<Avatar seed={invite.hostAvatarSeed} size="md" />
			<div class="host-details">
				<span class="host-name">{invite.hostDisplayName}</span>
				<span class="host-action">wants you to join their game</span>
			</div>
		</div>

		<div class="room-info">
			<span class="room-detail">
				<span class="label">Game:</span>
				<span class="value">{invite.game.toUpperCase()}</span>
			</span>
			<span class="room-detail">
				<span class="label">Players:</span>
				<span class="value">{invite.playerCount}/{invite.maxPlayers}</span>
			</span>
			<span class="room-detail">
				<span class="label">Room:</span>
				<span class="value code">{invite.roomCode}</span>
			</span>
		</div>
	</div>

	<div class="invite-actions">
		<button type="button" class="decline-btn" onclick={handleDecline}>
			Decline
		</button>
		<button type="button" class="accept-btn" onclick={handleAccept}>
			Join Game
		</button>
	</div>
</div>

<style>
	.invite-popup {
		position: fixed;
		bottom: var(--space-3);
		right: var(--space-3);
		z-index: var(--z-modal);
		width: 100%;
		max-width: 360px;
		background: var(--color-background);
		border: var(--border-thick);
		box-shadow: 8px 8px 0 var(--color-border);
		animation: slide-up 0.3s ease-out;
	}

	@keyframes slide-up {
		from {
			opacity: 0;
			transform: translateY(20px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	.invite-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: var(--space-2) var(--space-3);
		background: var(--color-primary);
		border-bottom: var(--border-medium);
	}

	.invite-title {
		font-size: var(--text-body);
		font-weight: var(--weight-bold);
		text-transform: uppercase;
		letter-spacing: var(--tracking-wide);
	}

	.countdown {
		font-family: var(--font-mono);
		font-size: var(--text-body);
		font-weight: var(--weight-bold);
		padding: var(--space-1) var(--space-2);
		background: var(--color-background);
		border: var(--border-thin);
	}

	.countdown.warning {
		color: var(--color-warning);
	}

	.countdown.urgent {
		color: var(--color-danger);
		animation: pulse 1s ease-in-out infinite;
	}

	@keyframes pulse {
		50% {
			opacity: 0.6;
		}
	}

	.invite-body {
		padding: var(--space-3);
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}

	.host-info {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}

	.host-details {
		display: flex;
		flex-direction: column;
		gap: 0;
	}

	.host-name {
		font-size: var(--text-body);
		font-weight: var(--weight-bold);
	}

	.host-action {
		font-size: var(--text-small);
		color: var(--color-text-muted);
	}

	.room-info {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		padding: var(--space-2);
		background: var(--color-surface);
		border: var(--border-thin);
	}

	.room-detail {
		display: flex;
		gap: var(--space-1);
		font-size: var(--text-small);
	}

	.room-detail .label {
		color: var(--color-text-muted);
	}

	.room-detail .value {
		font-weight: var(--weight-semibold);
	}

	.room-detail .value.code {
		font-family: var(--font-mono);
		letter-spacing: 0.1em;
	}

	.invite-actions {
		display: flex;
		gap: var(--space-2);
		padding: var(--space-2) var(--space-3) var(--space-3);
	}

	.decline-btn,
	.accept-btn {
		flex: 1;
		padding: var(--space-2);
		font-size: var(--text-body);
		font-weight: var(--weight-bold);
		text-transform: uppercase;
		letter-spacing: var(--tracking-wide);
		border: var(--border-thick);
		cursor: pointer;
		transition:
			transform var(--transition-fast),
			box-shadow var(--transition-fast);
	}

	.decline-btn {
		background: var(--color-surface);
	}

	.accept-btn {
		background: var(--color-success);
	}

	.decline-btn:hover,
	.accept-btn:hover {
		transform: translate(-2px, -2px);
		box-shadow: 4px 4px 0 var(--color-border);
	}

	.decline-btn:active,
	.accept-btn:active {
		transform: translate(0, 0);
		box-shadow: none;
	}

	/* Mobile adjustments */
	@media (max-width: 480px) {
		.invite-popup {
			bottom: 0;
			right: 0;
			max-width: none;
			border-left: none;
			border-right: none;
			border-bottom: none;
			box-shadow: 0 -4px 0 var(--color-border);
		}
	}
</style>
