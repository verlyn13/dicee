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
 */

import { goto } from '$app/navigation';
import { lobby, type RoomInfo } from '$lib/stores/lobby.svelte';

interface Props {
	room: RoomInfo;
}

let { room }: Props = $props();
let isShaking = $state(false);
let isFlashing = $state(false);

interface StatusConfig {
	bg: string;
	text: string;
	canJoin: boolean;
	canSpectate: boolean;
}

function getStatusConfig(status: RoomInfo['status']): StatusConfig {
	switch (status) {
		case 'open':
			return { bg: 'bg-live', text: 'OPEN', canJoin: true, canSpectate: false };
		case 'playing':
			return { bg: 'bg-accent', text: 'LIVE', canJoin: false, canSpectate: true };
		case 'full':
			return { bg: 'bg-muted', text: 'FULL', canJoin: false, canSpectate: false };
	}
}

function getModeEmoji(mode: RoomInfo['mode']): string {
	switch (mode) {
		case 'classic':
			return '[STD]';
		case 'blitz':
			return '[BLZ]';
		case 'hardcore':
			return '[HRD]';
	}
}

const statusConfig = $derived(getStatusConfig(room.status));
const modeLabel = $derived(getModeEmoji(room.mode));

async function handleAction() {
	// Can't do anything with full rooms
	if (!statusConfig.canJoin && !statusConfig.canSpectate) {
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
	if (lobby.hasActiveJoinRequest) {
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

	// Spectator mode - navigate directly
	if (statusConfig.canSpectate) {
		goto(`/games/dicee/room/${room.code}?mode=spectator`);
		return;
	}

	// Open room - send join request (host approval required)
	lobby.sendJoinRequest(room.code);
}

function getButtonText(): string {
	if (statusConfig.canJoin) return 'Join Game';
	return room.status === 'playing' ? '👁 Watch' : 'Full';
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
		<span class="mode">{modeLabel} {room.mode.toUpperCase()}</span>
		<span class="players">{room.playerCount}/{room.maxPlayers}</span>
	</div>

	<button
		class="join-button"
		class:spectate={statusConfig.canSpectate}
		onclick={handleAction}
		disabled={!statusConfig.canJoin && !statusConfig.canSpectate}
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

	.card-meta {
		display: flex;
		justify-content: space-between;
		font-size: var(--text-small);
		font-weight: var(--weight-semibold);
		text-transform: uppercase;
		margin-bottom: var(--space-2);
		color: var(--color-signal-muted);
	}

	.mode {
		color: var(--color-text);
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

	@media (prefers-reduced-motion: reduce) {
		.room-card,
		.shake {
			animation: none;
		}
	}
</style>
