<script lang="ts">
/**
 * SpectatorView Component
 *
 * Main view for watching a game as a spectator.
 * Displays all player scorecards, dice state, and chat.
 * Spectators can chat and react but cannot interact with the game.
 */
import { onDestroy, onMount } from 'svelte';
import { ChatPanel } from '$lib/components/chat';
import { DiceTray } from '$lib/components/dice';
import type { ChatStore } from '$lib/stores/chat.svelte';
import type { SpectatorStore } from '$lib/stores/spectator.svelte';
import type { DiceArray, DieValue } from '$lib/types';
import AllScorecards from './AllScorecards.svelte';
import SpectatorHeader from './SpectatorHeader.svelte';

interface Props {
	/** The spectator store instance */
	store: SpectatorStore;
	/** Optional chat store for chat functionality */
	chatStore?: ChatStore;
	/** Callback when spectator wants to stop watching */
	onLeave?: () => void;
}

let { store, chatStore, onLeave }: Props = $props();

// Derived state from store
const status = $derived(store.status);
const roomCode = $derived(store.roomCode);
const roomStatus = $derived(store.roomStatus);
const players = $derived(store.players);
const spectatorCount = $derived(store.spectatorCount);
const spectatorDisplay = $derived(store.spectatorDisplay);
const error = $derived(store.error);

// Chat state
let chatCollapsed = $state(true);

function handleChatToggle(): void {
	chatCollapsed = !chatCollapsed;
}

// Default dice for display
const defaultDice: DiceArray = [1, 1, 1, 1, 1] as DiceArray;

// Game state (will be populated by game events)
let currentDice = $state<DiceArray>(defaultDice);
let keptDice = $state<[boolean, boolean, boolean, boolean, boolean]>([
	false,
	false,
	false,
	false,
	false,
]);
let rollsRemaining = $state(3);
let currentPlayerId = $state<string | null>(null);
let hasRolled = $state(false);

/**
 * Handle game events for dice state updates
 * Processes DICE_ROLLED, DICE_KEPT, TURN_STARTED, etc.
 */
function handleGameEvent(event: unknown): void {
	if (!event) return;

	const eventType = (event as { type?: string }).type;
	const payload = (event as { payload?: Record<string, unknown> }).payload;

	switch (eventType) {
		case 'DICE_ROLLED':
			if (payload?.dice) {
				currentDice = (payload.dice as number[]).map(
					(d) => Math.max(1, Math.min(6, d)) as DieValue,
				) as DiceArray;
			}
			if (payload?.kept) {
				keptDice = payload.kept as [boolean, boolean, boolean, boolean, boolean];
			}
			if (typeof payload?.rollsRemaining === 'number') {
				rollsRemaining = payload.rollsRemaining;
			}
			if (payload?.playerId) {
				currentPlayerId = payload.playerId as string;
			}
			hasRolled = true;
			break;

		case 'DICE_KEPT':
			if (payload?.kept) {
				keptDice = payload.kept as [boolean, boolean, boolean, boolean, boolean];
			}
			if (payload?.playerId) {
				currentPlayerId = payload.playerId as string;
			}
			break;

		case 'TURN_STARTED':
		case 'TURN_CHANGED':
		case 'PLAYER_TURN':
			if (payload?.playerId || payload?.currentPlayerId) {
				currentPlayerId = (payload.playerId ?? payload.currentPlayerId) as string;
			}
			// Reset dice state for new turn
			currentDice = defaultDice;
			keptDice = [false, false, false, false, false];
			rollsRemaining = 3;
			hasRolled = false;
			break;

		case 'CATEGORY_SCORED':
			// Clear dice after scoring
			hasRolled = false;
			break;
	}
}

// Subscribe to store events (single subscription to avoid memory leaks)
let unsubscribe: (() => void) | null = null;

onMount(() => {
	unsubscribe = store.subscribe(handleGameEvent);
});

onDestroy(() => {
	unsubscribe?.();
});

// Current player info
const currentPlayer = $derived(players.find((p) => p.id === currentPlayerId) ?? null);

// Spectator label for DiceTray
const spectatorLabel = $derived(
	currentPlayer ? `Watching ${currentPlayer.displayName}...` : 'Watching game...',
);

// Check if game is active
const isGameActive = $derived(roomStatus === 'playing');

function handleLeave(): void {
	onLeave?.();
}

// Keyboard shortcuts for spectators
onMount(() => {
	function handleGlobalKeydown(e: KeyboardEvent): void {
		// Skip if typing in input
		if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
			return;
		}

		// 'C' toggles chat panel
		if (e.key.toLowerCase() === 'c' && chatStore) {
			e.preventDefault();
			handleChatToggle();
		}

		// 'Escape' closes chat if open
		if (e.key === 'Escape' && !chatCollapsed) {
			e.preventDefault();
			handleChatToggle();
		}
	}

	document.addEventListener('keydown', handleGlobalKeydown);
	return () => document.removeEventListener('keydown', handleGlobalKeydown);
});
</script>

<div class="spectator-view" data-status={roomStatus}>
	<!-- Error Banner -->
	{#if error}
		<div class="error-banner" role="alert">
			<span class="error-message">{error}</span>
		</div>
	{/if}

	<!-- Header -->
	<SpectatorHeader
		{roomCode}
		{spectatorDisplay}
		hasChatUnread={chatStore?.hasUnread ?? false}
		onLeave={handleLeave}
		onChatToggle={handleChatToggle}
	/>

	<!-- Main Spectator Layout -->
	<div class="spectator-layout">
		<!-- Left: Game Status & Current Turn -->
		<aside class="status-sidebar">
			<div class="game-status-card">
				<h3 class="status-title">Game Status</h3>
				<div class="status-value">{roomStatus?.toUpperCase() ?? 'LOADING'}</div>
			</div>

			{#if currentPlayer}
				<div class="current-turn-card">
					<h3 class="turn-title">Current Turn</h3>
					<div class="turn-player">
						<span class="player-name">{currentPlayer.displayName}</span>
						<span class="rolls-left">{rollsRemaining} rolls left</span>
					</div>
				</div>
			{/if}

			<div class="spectator-count-card">
				<span class="eye-icon">👁</span>
				<span class="count-text">{spectatorDisplay}</span>
			</div>
		</aside>

		<!-- Center: Dice Display (view only) -->
		<main class="game-main">
			{#if roomStatus === 'waiting'}
				<div class="waiting-state">
					<p class="waiting-text">Waiting for game to start...</p>
					<p class="player-count">{players.length} player{players.length !== 1 ? 's' : ''} in lobby</p>
				</div>
			{:else if roomStatus === 'starting'}
				<div class="waiting-state">
					<p class="waiting-text">Game starting...</p>
				</div>
			{:else}
				<div class="dice-display">
					<DiceTray
						dice={currentDice}
						kept={keptDice}
						{rollsRemaining}
						canRoll={false}
						canKeep={false}
						rolling={false}
						{hasRolled}
						readonly={true}
						{spectatorLabel}
						onRoll={() => {}}
						onToggleKeep={() => {}}
						onKeepAll={() => {}}
						onReleaseAll={() => {}}
					/>
				</div>

				<!-- Status Message -->
				<div class="spectator-status">
					{#if currentPlayer}
						<p class="status-text">
							Watching {currentPlayer.displayName}
							{#if rollsRemaining === 3}
								 roll...
							{:else if rollsRemaining > 0}
								 ({rollsRemaining} rolls left)
							{:else}
								 select a category
							{/if}
						</p>
					{:else}
						<p class="status-text">Watching the game...</p>
					{/if}
					<!-- Keyboard Hints -->
					<span class="keyboard-hint">
						<span class="hint-key">C</span> chat
						<span class="hint-key">ESC</span> close
					</span>
				</div>
			{/if}
		</main>

		<!-- Right: All Player Scorecards -->
		<aside class="scorecards-area">
			<AllScorecards {players} {currentPlayerId} />
		</aside>
	</div>

	<!-- Chat Panel -->
	{#if chatStore}
		<ChatPanel collapsed={chatCollapsed} onToggle={handleChatToggle} />
	{/if}
</div>

<style>
	.spectator-view {
		display: flex;
		flex-direction: column;
		min-height: 100vh;
		min-height: 100svh;
		background: var(--color-background);
	}

	/* Error Banner */
	.error-banner {
		background: var(--color-danger);
		color: white;
		padding: var(--space-2);
		text-align: center;
	}

	.error-message {
		font-weight: var(--weight-semibold);
	}

	/* Layout */
	.spectator-layout {
		display: grid;
		grid-template-columns: 1fr;
		gap: var(--space-2);
		padding: var(--space-2);
		flex: 1;
	}

	/* Desktop Layout */
	@media (min-width: 768px) {
		.spectator-layout {
			grid-template-columns: 200px 1fr 320px;
			gap: var(--space-3);
			padding: var(--space-3);
		}
	}

	/* Status Sidebar */
	.status-sidebar {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	/* Mobile: Hide sidebar */
	@media (max-width: 767px) {
		.status-sidebar {
			display: none;
		}
	}

	.game-status-card,
	.current-turn-card,
	.spectator-count-card {
		background: var(--color-surface);
		border: var(--border-medium);
		padding: var(--space-2);
	}

	.status-title,
	.turn-title {
		margin: 0 0 var(--space-1);
		font-size: var(--text-small);
		font-weight: var(--weight-semibold);
		text-transform: uppercase;
		letter-spacing: var(--tracking-wide);
		color: var(--color-text-muted);
	}

	.status-value {
		font-size: var(--text-body);
		font-weight: var(--weight-bold);
		font-family: var(--font-mono);
	}

	.turn-player {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
	}

	.player-name {
		font-weight: var(--weight-bold);
	}

	.rolls-left {
		font-size: var(--text-small);
		color: var(--color-text-muted);
	}

	.spectator-count-card {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}

	.eye-icon {
		font-size: 20px;
	}

	.count-text {
		font-size: var(--text-small);
		font-weight: var(--weight-semibold);
	}

	/* Main Area */
	.game-main {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-3);
	}

	.waiting-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		min-height: 200px;
		gap: var(--space-2);
	}

	.waiting-text {
		font-size: var(--text-body);
		color: var(--color-text-muted);
		text-transform: uppercase;
		letter-spacing: var(--tracking-wide);
		margin: 0;
	}

	.player-count {
		font-size: var(--text-small);
		color: var(--color-text-muted);
		margin: 0;
	}

	.dice-display {
		width: 100%;
		max-width: 400px;
		pointer-events: none;
		opacity: 0.95;
	}

	.spectator-status {
		text-align: center;
		padding: var(--space-2);
		background: var(--color-surface);
		border: var(--border-thin);
	}

	.status-text {
		margin: 0;
		font-size: var(--text-body);
		font-weight: var(--weight-semibold);
		color: var(--color-text-muted);
	}

	/* Keyboard Hints */
	.keyboard-hint {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-2);
		margin-top: var(--space-1);
		font-size: var(--text-tiny);
		color: var(--color-text-muted);
		text-transform: uppercase;
		letter-spacing: var(--tracking-wide);
	}

	.hint-key {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 20px;
		padding: 2px 4px;
		font-family: var(--font-mono);
		font-weight: var(--weight-bold);
		background: var(--color-surface);
		border: var(--border-thin);
		margin-right: 2px;
	}

	/* Hide keyboard hints on mobile (no keyboard) */
	@media (max-width: 768px) {
		.keyboard-hint {
			display: none;
		}
	}

	/* Scorecards Area */
	.scorecards-area {
		display: flex;
		flex-direction: column;
	}

	/* Mobile: Scorecards below dice */
	@media (max-width: 767px) {
		.scorecards-area {
			order: 2;
		}

		.game-main {
			order: 1;
		}
	}

	/* ==========================================================================
	 * Mobile Keyboard Awareness
	 * When virtual keyboard is open, hide non-essential elements to make room
	 * for chat panel. User can close chat to see full spectator view.
	 * ========================================================================== */
	@media (max-width: 767px) {
		:global(html.keyboard-open) .spectator-view {
			max-height: calc(100svh - var(--keyboard-height, 0px));
			overflow: hidden;
		}

		:global(html.keyboard-open) .spectator-layout {
			max-height: calc(100svh - var(--keyboard-height, 0px) - 100px);
			overflow: hidden;
		}

		:global(html.keyboard-open) .scorecards-area {
			display: none;
		}

		:global(html.keyboard-open) .dice-display {
			max-height: 120px;
			overflow: hidden;
		}

		:global(html.keyboard-open) .spectator-status {
			display: none;
		}

		:global(html.keyboard-open) .keyboard-hint {
			display: none;
		}

		:global(html.keyboard-open) .status-sidebar {
			display: none;
		}
	}
</style>
