<script lang="ts">
/**
 * RoomCartridge - Neo-Brutalist game room card
 *
 * Displays room as a tactile "game cartridge" with procedurally
 * generated identity (color, pattern, hype name).
 *
 * Features:
 * - Grid layout: [STATUS] [CONTENT] [META] [JOIN]
 * - Background color from room identity
 * - Pattern overlay from room identity
 * - Slight rotation for visual interest
 * - Hover lift effect
 * - Full keyboard accessibility
 */

import { generateRoomIdentity, getColorVar, getPatternClass } from '@dicee/shared';
import { goto } from '$app/navigation';
import Avatar from '$lib/components/ui/Avatar.svelte';
import { auth } from '$lib/stores/auth.svelte';
import { lobby, type RoomInfo } from '$lib/stores/lobby.svelte';

interface Props {
	/** Room data including identity */
	room: RoomInfo;
	/** Position in stack (affects rotation direction) */
	index?: number;
	/** Optional callback when join button clicked (for open rooms) */
	onJoin?: (roomCode: string) => void;
	/** Optional callback when requesting to join (host approval flow) */
	onRequestJoin?: (roomCode: string) => void;
}

let { room, index = 0, onJoin, onRequestJoin }: Props = $props();

let isShaking = $state(false);
let isFlashing = $state(false);

// Generate identity if not provided (fallback for migration)
const identity = $derived(room.identity ?? generateRoomIdentity(room.code));

// Status configuration
interface StatusConfig {
	label: string;
	canJoin: boolean;
	canSpectate: boolean;
}

function getStatusConfig(status: RoomInfo['status']): StatusConfig {
	switch (status) {
		case 'waiting':
			return { label: 'OPEN', canJoin: true, canSpectate: false };
		case 'playing':
			return { label: 'LIVE', canSpectate: true, canJoin: false };
		case 'finished':
			return { label: 'DONE', canJoin: false, canSpectate: false };
	}
}

const statusConfig = $derived(getStatusConfig(room.status));

// Calculate rotation based on index (alternate directions)
const rotation = $derived(identity.baseRotation * (index % 2 === 0 ? 1 : -1));

// Dynamic styles
const bgColor = $derived(getColorVar(identity.color));
const patternClass = $derived(getPatternClass(identity.pattern));

// Check if current user is host or already a player (for direct rejoin)
const isHost = $derived(auth.userId === room.hostId);
const isExistingPlayer = $derived(room.players?.some((p) => p.userId === auth.userId) ?? false);

// Accessibility description
const ariaLabel = $derived(
	`${identity.hypeName} room, code ${room.code}. ` +
		`${room.playerCount} of ${room.maxPlayers} players. ` +
		`Status: ${statusConfig.label}. ` +
		`Host: ${room.hostName}.`,
);

// Handle action (join/spectate/error)
async function handleAction() {
	// Can't do anything with finished rooms
	if (!statusConfig.canJoin && !statusConfig.canSpectate) {
		triggerErrorFeedback();
		return;
	}

	// Check if we already have a pending request
	if (lobby.hasActiveJoinRequest) {
		triggerErrorFeedback();
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

	// Host or existing player - navigate directly to rejoin
	if (isHost || isExistingPlayer) {
		goto(`/games/dicee/room/${room.code}`);
		return;
	}

	// Open room - use callback if provided, otherwise send join request
	if (onJoin) {
		onJoin(room.code);
	} else if (onRequestJoin) {
		onRequestJoin(room.code);
	} else {
		// Default: send join request through lobby
		lobby.sendJoinRequest(room.code);
	}
}

function triggerErrorFeedback() {
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
}

function getButtonText(): string {
	if (isHost || isExistingPlayer) return 'REJOIN';
	if (statusConfig.canJoin) return 'JOIN';
	if (statusConfig.canSpectate) return 'WATCH';
	return 'FULL';
}
</script>

<article
	class="cartridge {patternClass}"
	class:shake={isShaking}
	style:--bg-color={isFlashing ? 'var(--color-signal-busy)' : bgColor}
	style:--rotation="{rotation}deg"
	aria-label={ariaLabel}
>
	<!-- Status indicator -->
	<div class="status" class:open={room.status === 'waiting'} class:live={room.status === 'playing'}>
		{statusConfig.label}
	</div>

	<!-- Main content: hype name and room code -->
	<div class="content">
		<h3 class="hype-name">{identity.hypeName}</h3>
		<div class="room-info">
			<span class="room-code">#{room.code}</span>
			{#if room.status === 'playing' && room.roundNumber > 0}
				<span class="round-progress">Round {room.roundNumber}/{room.totalRounds}</span>
			{/if}
		</div>
	</div>

	<!-- Meta info: host and player count -->
	<div class="meta">
		<span class="host">{room.hostName}</span>
		<span class="players">{room.playerCount}/{room.maxPlayers}</span>
	</div>

	<!-- Player avatars (max 4 displayed) -->
	<div class="players-display">
		{#each room.players?.slice(0, 4) ?? [] as player (player.userId)}
			<div class="player-avatar" title={player.displayName}>
				<Avatar seed={player.avatarSeed} size="sm" alt={player.displayName} />
				{#if player.isHost}
					<span class="host-badge" aria-label="Host">★</span>
				{/if}
			</div>
		{/each}
		{#if (room.players?.length ?? 0) > 4}
			<div class="overflow-indicator" title="{(room.players?.length ?? 0) - 4} more">
				+{(room.players?.length ?? 0) - 4}
			</div>
		{/if}
	</div>

	<!-- Action button -->
	<button
		class="action-btn"
		class:spectate={statusConfig.canSpectate}
		onclick={handleAction}
		disabled={!statusConfig.canJoin && !statusConfig.canSpectate}
		aria-label={`${getButtonText()} ${identity.hypeName}`}
	>
		{getButtonText()}
	</button>
</article>

<style>
	.cartridge {
		position: relative;
		display: grid;
		grid-template-columns: auto 1fr auto auto;
		grid-template-rows: auto auto;
		grid-template-areas:
			'status content players action'
			'status meta players action';
		gap: var(--space-1);
		align-items: center;

		padding: var(--space-2);
		background-color: var(--bg-color);
		border: var(--cartridge-border);
		box-shadow: var(--cartridge-shadow);

		transform: rotate(var(--rotation));
		transition: var(--cartridge-transition-transform);
	}

	.cartridge:hover {
		transform: rotate(var(--rotation)) translate(-2px, -2px);
		box-shadow: var(--cartridge-shadow-hover);
	}

	/* Error animations */
	.shake {
		animation: var(--cartridge-animation-shake);
	}

	@keyframes shake {
		0%, 100% { transform: rotate(var(--rotation)) translateX(0); }
		20% { transform: rotate(var(--rotation)) translateX(-8px); }
		40% { transform: rotate(var(--rotation)) translateX(8px); }
		60% { transform: rotate(var(--rotation)) translateX(-6px); }
		80% { transform: rotate(var(--rotation)) translateX(6px); }
	}

	/* Status indicator */
	.status {
		grid-area: status;
		writing-mode: vertical-rl;
		text-orientation: mixed;
		transform: rotate(180deg);

		padding: var(--space-1) 0.25rem;
		background: var(--color-text);
		color: var(--color-surface);
		font-size: var(--cartridge-code-size);
		font-weight: var(--weight-black);
		letter-spacing: var(--tracking-wide);
		text-align: center;
	}

	.status.open {
		background: var(--color-signal-live);
		color: var(--color-text);
	}

	.status.live {
		background: var(--color-accent);
		color: var(--color-text);
	}

	/* Main content area */
	.content {
		grid-area: content;
		min-width: 0; /* Allow text truncation */
	}

	.hype-name {
		margin: 0;
		font-size: var(--cartridge-name-size);
		font-weight: var(--cartridge-name-weight);
		letter-spacing: var(--cartridge-name-tracking);
		line-height: 1.1;
		text-transform: uppercase;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.room-info {
		display: flex;
		gap: var(--space-1);
		align-items: center;
		flex-wrap: wrap;
	}

	.room-code {
		font-family: var(--font-mono);
		font-size: var(--cartridge-code-size);
		font-weight: var(--weight-semibold);
		color: var(--color-signal-muted);
	}

	.round-progress {
		font-family: var(--font-mono);
		font-size: var(--text-small);
		font-weight: var(--weight-semibold);
		color: var(--color-accent);
	}

	/* Meta information */
	.meta {
		grid-area: meta;
		display: flex;
		gap: var(--space-2);
		font-size: var(--text-small);
		color: var(--color-signal-muted);
	}

	.host {
		font-weight: var(--weight-semibold);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		max-width: 12ch;
	}

	.players {
		font-family: var(--font-mono);
		font-weight: var(--weight-bold);
	}

	/* Player avatars display */
	.players-display {
		grid-area: players;
		display: flex;
		gap: 4px;
		align-items: center;
		padding: 0 var(--space-1);
	}

	.player-avatar {
		position: relative;
		width: 24px;
		height: 24px;
	}

	.host-badge {
		position: absolute;
		top: -4px;
		right: -4px;
		font-size: 10px;
		background: var(--color-accent);
		color: var(--color-text);
		border: 1px solid var(--color-text);
		padding: 0 2px;
		line-height: 1;
	}

	.overflow-indicator {
		font-size: var(--text-small);
		font-weight: var(--weight-bold);
		color: var(--color-signal-muted);
	}

	/* Action button */
	.action-btn {
		grid-area: action;
		align-self: stretch;

		padding: var(--space-1) var(--space-2);
		background: var(--color-text);
		color: var(--color-surface);
		border: none;

		font-size: var(--text-small);
		font-weight: var(--weight-black);
		letter-spacing: var(--tracking-wide);
		text-transform: uppercase;

		cursor: pointer;
		transition: var(--cartridge-transition-background);
	}

	.action-btn:hover:not(:disabled) {
		background: var(--color-accent);
		color: var(--color-text);
	}

	.action-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.action-btn.spectate {
		background: var(--color-accent);
		color: var(--color-text);
	}

	.action-btn.spectate:hover:not(:disabled) {
		background: var(--color-primary);
	}

	/* Mobile adjustments */
	@media (max-width: 480px) {
		.cartridge {
			grid-template-columns: auto 1fr;
			grid-template-rows: auto auto auto auto;
			grid-template-areas:
				'status content'
				'players players'
				'meta meta'
				'action action';
		}

		.players-display {
			justify-content: center;
		}

		.status {
			writing-mode: horizontal-tb;
			transform: none;
			padding: 0.25rem var(--space-1);
		}

		.action-btn {
			width: 100%;
		}

		.hype-name {
			font-size: 1rem;
		}
	}
</style>
