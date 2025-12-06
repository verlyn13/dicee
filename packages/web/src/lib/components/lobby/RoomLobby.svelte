<script lang="ts">
/**
 * RoomLobby - Main lobby view when connected to a room
 *
 * Shows room code, player list, and game controls.
 * Host can start the game when 2+ players are present.
 */
import { auth } from '$lib/stores/auth.svelte';
import { getRoomStore } from '$lib/stores/room.svelte';
import PlayerListItem from './PlayerListItem.svelte';

interface Props {
	/** Callback when leaving the room */
	onleave?: () => void;
	/** Callback when game starts */
	ongamestart?: () => void;
	/** Additional CSS classes */
	class?: string;
}

let { onleave, ongamestart, class: className = '' }: Props = $props();

const room = getRoomStore();

let countdown = $state<number | null>(null);

// Subscribe to game starting events
$effect(() => {
	const unsubscribe = room.subscribe((event) => {
		if (event.type === 'game.starting') {
			countdown = event.countdown;
		} else if (event.type === 'game.started') {
			countdown = null;
			ongamestart?.();
		}
	});

	return unsubscribe;
});

function handleLeave() {
	room.leaveRoom();
	onleave?.();
}

function handleStart() {
	room.startGame();
}

/** Copy room code to clipboard */
async function copyCode() {
	if (!room.roomCode) return;
	try {
		await navigator.clipboard.writeText(room.roomCode);
	} catch {
		console.warn('Clipboard API not available');
	}
}

const waitingMessage = $derived.by(() => {
	if (room.playerCount < 2) {
		return 'Waiting for more players...';
	}
	if (!room.isHost) {
		return 'Waiting for host to start...';
	}
	return null;
});
</script>

<div class="room-lobby {className}">
	<!-- Room Header -->
	<header class="lobby-header">
		<div class="room-info">
			<span class="room-label">ROOM CODE</span>
			<button type="button" class="room-code" onclick={copyCode} title="Click to copy">
				{room.roomCode}
			</button>
		</div>

		<button type="button" class="leave-button" onclick={handleLeave}>
			LEAVE
		</button>
	</header>

	<!-- Player List -->
	<section class="player-section">
		<h2 class="section-title">
			Players ({room.playerCount}/{room.room?.config.maxPlayers ?? 4})
		</h2>

		<div class="player-list">
			{#each room.room?.players ?? [] as player (player.id)}
				<PlayerListItem {player} isCurrentUser={player.id === auth.userId} />
			{/each}
		</div>

		{#if !room.isFull}
			<p class="invite-hint">Share the room code to invite friends!</p>
		{/if}
	</section>

	<!-- Game Controls -->
	<footer class="lobby-footer">
		{#if countdown !== null}
			<!-- Countdown state -->
			<div class="countdown">
				<span class="countdown-label">Game starting in</span>
				<span class="countdown-number">{countdown}</span>
			</div>
		{:else if room.canStart}
			<!-- Host can start -->
			<button type="button" class="start-button" onclick={handleStart}>
				START GAME
			</button>
		{:else if waitingMessage}
			<!-- Waiting state -->
			<p class="waiting-message">{waitingMessage}</p>
		{/if}

		{#if room.error}
			<p class="error-message" role="alert">{room.error}</p>
		{/if}
	</footer>
</div>

<style>
	.room-lobby {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		width: 100%;
		max-width: 480px;
	}

	/* Header */
	.lobby-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: var(--space-2);
		padding: var(--space-3);
		background: var(--color-surface);
		border: var(--border-thick);
	}

	.room-info {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
	}

	.room-label {
		font-size: var(--text-small);
		font-weight: var(--weight-bold);
		text-transform: uppercase;
		letter-spacing: var(--tracking-wide);
		color: var(--color-text-muted);
	}

	.room-code {
		font-family: var(--font-mono);
		font-size: var(--text-h2);
		font-weight: var(--weight-bold);
		letter-spacing: 0.15em;
		padding: var(--space-1) var(--space-2);
		background: var(--color-background);
		border: var(--border-medium);
		cursor: pointer;
		transition: transform var(--transition-fast), box-shadow var(--transition-fast);
	}

	.room-code:hover {
		transform: translate(-1px, -1px);
		box-shadow: 2px 2px 0 var(--color-border);
	}

	.leave-button {
		padding: var(--space-1) var(--space-2);
		min-height: var(--touch-target-minimum);
		background: var(--color-surface);
		border: var(--border-medium);
		font-size: var(--text-small);
		font-weight: var(--weight-bold);
		text-transform: uppercase;
		letter-spacing: var(--tracking-wide);
		color: var(--color-danger);
		cursor: pointer;
		transition: transform var(--transition-fast), box-shadow var(--transition-fast);
	}

	.leave-button:hover {
		transform: translate(-1px, -1px);
		box-shadow: 2px 2px 0 var(--color-border);
	}

	/* Player Section */
	.player-section {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.section-title {
		font-size: var(--text-body);
		font-weight: var(--weight-bold);
		text-transform: uppercase;
		letter-spacing: var(--tracking-wide);
	}

	.player-list {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
	}

	.invite-hint {
		font-size: var(--text-small);
		color: var(--color-text-muted);
		text-align: center;
		padding: var(--space-2);
		border: var(--border-thin);
		border-style: dashed;
	}

	/* Footer */
	.lobby-footer {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-2);
	}

	.start-button {
		width: 100%;
		min-height: var(--touch-target-comfortable);
		padding: var(--space-2) var(--space-3);
		background: var(--color-success);
		border: var(--border-thick);
		font-size: var(--text-h3);
		font-weight: var(--weight-bold);
		text-transform: uppercase;
		letter-spacing: var(--tracking-wide);
		cursor: pointer;
		transition: transform var(--transition-fast), box-shadow var(--transition-fast);
	}

	.start-button:hover {
		transform: translate(-2px, -2px);
		box-shadow: 4px 4px 0 var(--color-border);
	}

	.start-button:active {
		transform: translate(0, 0);
		box-shadow: none;
	}

	.waiting-message {
		font-size: var(--text-body);
		color: var(--color-text-muted);
		text-align: center;
		padding: var(--space-2);
	}

	.countdown {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-1);
		padding: var(--space-3);
		background: var(--color-accent);
		border: var(--border-thick);
		width: 100%;
	}

	.countdown-label {
		font-size: var(--text-body);
		font-weight: var(--weight-bold);
		text-transform: uppercase;
		letter-spacing: var(--tracking-wide);
	}

	.countdown-number {
		font-family: var(--font-mono);
		font-size: var(--text-h1);
		font-weight: var(--weight-bold);
		animation: pulse 1s ease-in-out infinite;
	}

	@keyframes pulse {
		0%,
		100% {
			transform: scale(1);
		}
		50% {
			transform: scale(1.1);
		}
	}

	.error-message {
		padding: var(--space-1);
		font-size: var(--text-small);
		color: var(--color-danger);
		text-align: center;
	}
</style>
