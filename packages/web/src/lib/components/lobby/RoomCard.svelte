<script lang="ts">
/**
 * RoomCard - Game room card for lobby browser
 *
 * Displays room info with Neo-Brutalist styling.
 * Includes join button with error animations for non-joinable rooms.
 *
 * Join flow:
 * - Open rooms: Send join request, wait for host approval
 * - Playing rooms: Navigate directly (spectator mode)
 * - Full rooms: Show error animation
 * - Rejoin: Player with reserved seat (within grace period) goes directly
 */

import { goto } from '$app/navigation';
import { auth } from '$lib/stores/auth.svelte';
import { lobby, type RoomInfo } from '$lib/stores/lobby.svelte';

interface Props {
	room: RoomInfo;
}

let { room }: Props = $props();
let isShaking = $state(false);
let isFlashing = $state(false);

// Check if current user has a seat in this room
const myPlayerData = $derived(room.players?.find((p) => p.userId === auth.userId) ?? null);
const myPresenceState = $derived(myPlayerData?.presenceState ?? 'connected');
const canRejoin = $derived(
	myPlayerData !== null &&
		myPresenceState !== 'abandoned' &&
		['waiting', 'playing', 'paused'].includes(room.status),
);

interface StatusConfig {
	bg: string;
	text: string;
	canJoin: boolean;
	canSpectate: boolean;
}

function getStatusConfig(status: RoomInfo['status']): StatusConfig {
	switch (status) {
		case 'waiting':
			return { bg: 'bg-live', text: 'OPEN', canJoin: true, canSpectate: false };
		case 'playing':
			return { bg: 'bg-accent', text: 'LIVE', canJoin: false, canSpectate: true };
		case 'paused':
			return { bg: 'bg-warning', text: 'PAUSED', canJoin: true, canSpectate: true };
		case 'finished':
			return { bg: 'bg-muted', text: 'DONE', canJoin: false, canSpectate: false };
	}
}

const statusConfig = $derived(getStatusConfig(room.status));

function getButtonText(): string {
	if (canRejoin) {
		// Show RECONNECT for disconnected players (within grace period)
		if (myPresenceState === 'disconnected') return 'RECONNECT';
		return 'REJOIN';
	}
	if (statusConfig.canJoin) return 'JOIN';
	if (statusConfig.canSpectate) return 'WATCH';
	return 'FULL';
}

async function handleAction() {
	// Can't do anything with full rooms (unless we can rejoin)
	if (!statusConfig.canJoin && !statusConfig.canSpectate && !canRejoin) {
		// Trigger error animation
		isFlashing = true;
		isShaking = true;

		// Haptic feedback
		if ('vibrate' in navigator) {
			navigator.vibrate([50, 30, 50]);
		}

		setTimeout(() => {
			isFlashing = false;
			isShaking = false;
		}, 300);
		return;
	}

	// Check if we already have a pending request
	if (lobby.hasActiveJoinRequest && !canRejoin) {
		// Already have a pending request - can't join another room
		isFlashing = true;
		isShaking = true;
		setTimeout(() => {
			isFlashing = false;
			isShaking = false;
		}, 300);
		return;
	}

	// Success haptic
	if ('vibrate' in navigator) {
		navigator.vibrate(100);
	}

	// Rejoin - navigate directly (bypass join request)
	if (canRejoin) {
		goto(`/games/dicee/room/${room.code}`);
		return;
	}

	// Spectator mode - navigate directly
	if (statusConfig.canSpectate) {
		goto(`/games/dicee/room/${room.code}?mode=spectator`);
		return;
	}

	// Open room - send join request (host approval required)
	lobby.sendJoinRequest(room.code);
}
</script>

<article class="room-card" class:shake={isShaking} class:flash-error={isFlashing}>
	<div class="card-header">
		<span class="room-code">#{room.code}</span>
		<span class="status-badge {statusConfig.bg}">
			{statusConfig.text}
		</span>
	</div>

	<div class="card-meta">
		<span class="host">Host: {room.hostName}</span>
		<span class="players">{room.playerCount}/{room.maxPlayers}</span>
	</div>

	<button
		class="join-button"
		class:spectate={statusConfig.canSpectate}
		class:rejoin={canRejoin}
		onclick={handleAction}
		disabled={!statusConfig.canJoin && !statusConfig.canSpectate && !canRejoin}
	>
		{getButtonText()}
	</button>
</article>

<style>
	.room-card {
		position: relative;
		border: var(--border-thick);
		background: var(--color-surface);
		padding: var(--space-2);
		box-shadow: var(--lobby-card-shadow);
		transition:
			transform var(--transition-fast),
			box-shadow var(--transition-fast);
	}

	.room-card:hover {
		transform: translate(-2px, -2px);
		box-shadow: var(--lobby-card-shadow-hover);
	}

	.room-card:active {
		transform: translate(2px, 2px);
		box-shadow: none;
	}

	.shake {
		animation: shake 0.3s ease-in-out;
	}

	.flash-error {
		background: var(--color-signal-busy) !important;
	}

	@keyframes shake {
		0%,
		100% {
			transform: translateX(0);
		}
		20% {
			transform: translateX(-8px);
		}
		40% {
			transform: translateX(8px);
		}
		60% {
			transform: translateX(-6px);
		}
		80% {
			transform: translateX(6px);
		}
	}

	.card-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: var(--space-1);
	}

	.room-code {
		font-family: var(--font-mono);
		font-size: var(--text-h3);
		font-weight: var(--weight-black);
		letter-spacing: var(--tracking-wide);
	}

	.status-badge {
		padding: 0.125rem 0.5rem;
		border: var(--border-medium);
		font-size: var(--text-tiny);
		font-weight: var(--weight-bold);
	}

	.bg-live {
		background: var(--color-signal-live);
	}

	.bg-accent {
		background: var(--color-accent);
	}

	.bg-muted {
		background: var(--color-disabled);
	}

	.bg-warning {
		background: var(--color-signal-busy);
	}

	.card-meta {
		display: flex;
		justify-content: space-between;
		font-size: var(--text-small);
		font-weight: var(--weight-semibold);
		text-transform: uppercase;
		margin-bottom: var(--space-2);
		color: var(--color-signal-muted);
	}

	.host {
		color: var(--color-text);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.join-button {
		width: 100%;
		padding: var(--space-1) var(--space-2);
		background: var(--color-text);
		color: var(--color-surface);
		border: none;
		font-weight: var(--weight-bold);
		text-transform: uppercase;
		cursor: pointer;
		transition:
			background var(--transition-fast),
			color var(--transition-fast);
	}

	.join-button:hover:not(:disabled) {
		background: var(--color-accent);
		color: var(--color-text);
	}

	.join-button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.join-button.spectate {
		background: var(--color-accent);
		color: var(--color-text);
	}

	.join-button.spectate:hover {
		background: var(--color-primary);
	}

	.join-button.rejoin {
		background: var(--color-signal-live);
		color: var(--color-text);
	}

	.join-button.rejoin:hover {
		background: var(--color-accent);
	}

	@media (prefers-reduced-motion: reduce) {
		.room-card,
		.shake {
			animation: none;
		}
	}
</style>
