<script lang="ts">
/**
 * MultiplayerGameView Component
 *
 * Smart container for multiplayer game.
 * Subscribes to multiplayerGame store and orchestrates child components.
 */
import { onDestroy, onMount } from 'svelte';
import { ChatPanel } from '$lib/components/chat';
import { DiceTray } from '$lib/components/dice';
import { RoomLobby } from '$lib/components/lobby';
import { getChatStoreOptional } from '$lib/stores/chat.svelte';
import type { MultiplayerGameStore } from '$lib/stores/multiplayerGame.svelte';
import type { DiceArray, DieValue } from '$lib/types';
import type { Category, KeptMask } from '$lib/types/multiplayer';
import MultiplayerGameOverModal from './MultiplayerGameOverModal.svelte';
import MultiplayerScorecard from './MultiplayerScorecard.svelte';
import OpponentPanel from './OpponentPanel.svelte';
import TurnIndicator from './TurnIndicator.svelte';

interface Props {
	/** The multiplayer game store instance */
	store: MultiplayerGameStore;
	/** Callback when player wants to leave the game */
	onLeave?: () => void;
}

let { store, onLeave }: Props = $props();

// Subscribe to store events
let unsubscribe: (() => void) | null = null;

onMount(() => {
	unsubscribe = store.subscribe();
});

onDestroy(() => {
	unsubscribe?.();
});

// Derived state from store
const gameState = $derived(store.gameState);
const uiPhase = $derived(store.uiPhase);
const isMyTurn = $derived(store.isMyTurn);
const canRoll = $derived(store.canRoll);
const canKeep = $derived(store.canKeep);
const canScore = $derived(store.canScore);
const currentDice = $derived(store.currentDice);
const keptDice = $derived(store.keptDice);
const rollsRemaining = $derived(store.rollsRemaining);
const myScorecard = $derived(store.myScorecard);
const myPlayer = $derived(store.myPlayer);
const currentPlayer = $derived(store.currentPlayer);
const currentPlayerId = $derived(store.currentPlayerId);
const opponents = $derived(store.opponents);
const isGameOver = $derived(store.isGameOver);
const rankings = $derived(store.rankings);
const phase = $derived(store.phase);
const turnNumber = $derived(store.turnNumber);
const roundNumber = $derived(store.roundNumber);
const afkWarning = $derived(store.afkWarning);
const error = $derived(store.error);

// Chat state
const chatStore = getChatStoreOptional();
let chatCollapsed = $state(true);

function handleChatToggle(): void {
	chatCollapsed = !chatCollapsed;
}

// Default dice for display before first roll
const defaultDice: DiceArray = [1, 1, 1, 1, 1] as DiceArray;

// Convert multiplayer dice (number[]) to DiceArray (DieValue[])
function toDiceArray(dice: [number, number, number, number, number] | null): DiceArray {
	if (!dice) return defaultDice;
	return dice.map((d) => Math.max(1, Math.min(6, d)) as DieValue) as DiceArray;
}

const displayDice = $derived(toDiceArray(currentDice));

// Has the player rolled this turn? (dice are null until first roll)
const hasRolled = $derived(currentDice !== null);

// Is the game in a rolling animation state?
const isRolling = $derived(uiPhase === 'ROLLING');

// Total players including self
const totalPlayers = $derived(opponents.length + 1);

// Handlers
function handleRoll(): void {
	store.rollDice(keptDice);
}

function handleToggleKeep(index: number): void {
	store.toggleKeep(index);
}

function handleKeepAll(): void {
	store.keepDice([0, 1, 2, 3, 4]);
}

function handleReleaseAll(): void {
	store.keepDice([]);
}

function handleScore(category: Category): void {
	store.scoreCategory(category);
}

function handleLeave(): void {
	onLeave?.();
}

function handleCloseGameOver(): void {
	// Could navigate away or show rematch options
	onLeave?.();
}
</script>

<!-- Show Waiting Room or Game View based on phase -->
{#if phase === 'waiting' || phase === 'starting'}
	<!-- Full-screen Waiting Room -->
	<div class="waiting-room-container">
		<RoomLobby onleave={handleLeave} />
	</div>
{:else}
	<div class="multiplayer-game-view" data-phase={phase} data-ui-phase={uiPhase}>
		<!-- Error Banner -->
		{#if error}
			<div class="error-banner" role="alert">
				<span class="error-message">{error}</span>
			</div>
		{/if}

		<!-- Game Header -->
		<header class="game-header">
			<button class="leave-btn" onclick={handleLeave} type="button">
				← Leave
			</button>
			<div class="game-info">
				<span class="room-code">{gameState?.roomCode ?? '----'}</span>
				<span class="round-badge">R{roundNumber}/13</span>
				{#if chatStore}
					<button
						type="button"
						class="chat-toggle"
						onclick={handleChatToggle}
						aria-label="Toggle chat"
					>
						💬
						{#if chatStore.hasUnread}
							<span class="unread-dot"></span>
						{/if}
					</button>
				{/if}
			</div>
		</header>

		<!-- Mobile Player Bar (shows all players with turn indicator) -->
		<div class="mobile-player-bar">
			{#if myPlayer}
				<div class="player-chip" class:current-turn={isMyTurn}>
					<img 
						src="https://api.dicebear.com/7.x/bottts-neutral/svg?seed={myPlayer.avatarSeed}" 
						alt="You" 
						class="player-chip-avatar"
					/>
					<span class="player-chip-score">{myPlayer.totalScore}</span>
					{#if isMyTurn}<span class="turn-dot">🎯</span>{/if}
				</div>
			{/if}
			{#each opponents as opponent (opponent.id)}
				<div class="player-chip" class:current-turn={opponent.id === currentPlayerId}>
					<img 
						src="https://api.dicebear.com/7.x/bottts-neutral/svg?seed={opponent.avatarSeed}" 
						alt={opponent.displayName} 
						class="player-chip-avatar"
					/>
					<span class="player-chip-score">{opponent.totalScore}</span>
					{#if opponent.id === currentPlayerId}<span class="turn-dot">⏳</span>{/if}
				</div>
			{/each}
		</div>

		<!-- Main Game Layout -->
		<div class="game-layout">
			<!-- Left Column: Turn Indicator + Opponents -->
			<aside class="sidebar">
				<TurnIndicator
					{currentPlayer}
					{isMyTurn}
					{roundNumber}
					{totalPlayers}
					{afkWarning}
				/>
				<OpponentPanel {opponents} {currentPlayerId} />
			</aside>

			<!-- Center: Dice Tray -->
			<main class="game-main">
				<div class="dice-area">
					<DiceTray
						dice={displayDice}
						kept={keptDice}
						{rollsRemaining}
						{canRoll}
						{canKeep}
						rolling={isRolling}
						hasRolled={hasRolled && isMyTurn}
						onRoll={handleRoll}
						onToggleKeep={handleToggleKeep}
						onKeepAll={handleKeepAll}
						onReleaseAll={handleReleaseAll}
					/>
				</div>

				<!-- Turn Status Message -->
				<div class="turn-status" class:my-turn={isMyTurn} class:waiting={!isMyTurn}>
					{#if !isMyTurn}
						<p class="status-text waiting-text">
							<span class="waiting-icon">⏳</span>
							{currentPlayer?.displayName ?? 'Opponent'}'s turn
						</p>
					{:else if uiPhase === 'ROLLING'}
						<p class="status-text">Rolling...</p>
					{:else if uiPhase === 'SCORING'}
						<p class="status-text">Scoring...</p>
					{:else if rollsRemaining === 3}
						<p class="status-text your-turn-text">
							<span class="turn-icon">🎯</span>
							Your turn! Click to roll the dice
						</p>
					{:else if rollsRemaining > 0}
						<p class="status-text">Keep dice or roll again ({rollsRemaining} rolls left)</p>
					{:else}
						<p class="status-text">Select a category to score</p>
					{/if}
				</div>
			</main>

			<!-- Right Column: Scorecard -->
			<aside class="scorecard-area">
				<MultiplayerScorecard
					scorecard={myScorecard}
					{currentDice}
					{canScore}
					onScore={handleScore}
				/>
			</aside>
		</div>

		<!-- Chat Panel -->
		{#if chatStore}
			<ChatPanel collapsed={chatCollapsed} onToggle={handleChatToggle} />
		{/if}

		<!-- Game Over Modal -->
		{#if isGameOver && rankings}
			<MultiplayerGameOverModal
				{rankings}
				myPlayerId={myPlayer?.id ?? ''}
				onClose={handleCloseGameOver}
			/>
		{/if}
	</div>
{/if}

<style>
	/* Waiting Room Container */
	.waiting-room-container {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 100vh;
		min-height: 100svh;
		padding: var(--space-3);
		background: var(--color-background);
	}

	.multiplayer-game-view {
		display: flex;
		flex-direction: column;
		/* Use svh for stable height (accounts for browser chrome) */
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

	/* Header */
	.game-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: var(--space-2);
		background: var(--color-surface);
		border-bottom: var(--border-thick);
	}

	.leave-btn {
		padding: var(--space-1) var(--space-2);
		font-size: var(--text-small);
		font-weight: var(--weight-semibold);
		background: transparent;
		border: var(--border-thin);
		cursor: pointer;
		transition: background var(--transition-fast);
	}

	.leave-btn:hover {
		background: var(--color-background);
	}

	.game-info {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}

	.room-code {
		font-family: var(--font-mono);
		font-size: var(--text-body);
		font-weight: var(--weight-bold);
		letter-spacing: var(--tracking-wider);
		padding: var(--space-1) var(--space-2);
		background: var(--color-background);
		border: var(--border-thin);
	}

	.round-badge {
		font-family: var(--font-mono);
		font-size: var(--text-small);
		font-weight: var(--weight-semibold);
		padding: var(--space-0) var(--space-1);
		background: var(--color-accent-light);
		border: var(--border-thin);
	}

	/* Mobile Player Bar */
	.mobile-player-bar {
		display: flex;
		justify-content: center;
		gap: var(--space-2);
		padding: var(--space-2);
		background: var(--color-surface);
		border-bottom: var(--border-medium);
	}

	/* Hide on desktop (sidebar shows instead) */
	@media (min-width: 768px) {
		.mobile-player-bar {
			display: none;
		}
	}

	.player-chip {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-0);
		padding: var(--space-1);
		background: var(--color-background);
		border: var(--border-thin);
		position: relative;
		min-width: 48px;
	}

	.player-chip.current-turn {
		background: var(--color-accent-light);
		border-color: var(--color-accent);
		box-shadow: 0 0 0 2px var(--color-accent);
	}

	.player-chip-avatar {
		width: 32px;
		height: 32px;
		border: var(--border-thin);
		background: var(--color-surface);
	}

	.player-chip-score {
		font-family: var(--font-mono);
		font-size: var(--text-tiny);
		font-weight: var(--weight-bold);
	}

	.turn-dot {
		position: absolute;
		top: -4px;
		right: -4px;
		font-size: 12px;
	}

	.chat-toggle {
		position: relative;
		width: 40px;
		height: 40px;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 20px;
		background: var(--color-background);
		border: var(--border-medium);
		cursor: pointer;
		transition: transform var(--transition-fast), box-shadow var(--transition-fast);
	}

	.chat-toggle:hover {
		transform: translate(-1px, -1px);
		box-shadow: 2px 2px 0 var(--color-border);
	}

	.unread-dot {
		position: absolute;
		top: 4px;
		right: 4px;
		width: 10px;
		height: 10px;
		background: var(--color-accent);
		border-radius: 50%;
		border: 2px solid var(--color-surface);
	}

	/* Game Layout */
	.game-layout {
		display: grid;
		grid-template-columns: 1fr;
		gap: var(--space-2);
		padding: var(--space-2);
		flex: 1;
	}

	/* Desktop Layout */
	@media (min-width: 768px) {
		.game-layout {
			grid-template-columns: 240px 1fr 280px;
			gap: var(--space-3);
			padding: var(--space-3);
		}
	}

	/* Sidebar */
	.sidebar {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	/* Mobile: Hide sidebar, show inline */
	@media (max-width: 767px) {
		.sidebar {
			display: none;
		}
	}

	/* Main Game Area */
	.game-main {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-3);
	}

	.dice-area {
		width: 100%;
		max-width: 400px;
	}

	.turn-status {
		text-align: center;
		padding: var(--space-2);
	}

	.turn-status.my-turn {
		background: var(--color-accent-light);
		border: var(--border-medium);
	}

	.turn-status.waiting {
		background: var(--color-surface-alt);
		border: var(--border-thin);
		opacity: 0.8;
	}

	.status-text {
		margin: 0;
		font-size: var(--text-body);
		font-weight: var(--weight-semibold);
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-1);
	}

	.waiting-text {
		color: var(--color-text-muted);
	}

	.your-turn-text {
		color: var(--color-primary);
		font-size: var(--text-h4);
	}

	.waiting-icon,
	.turn-icon {
		font-size: 1.2em;
	}

	/* Scorecard Area */
	.scorecard-area {
		display: flex;
		flex-direction: column;
	}

	/* Mobile: Scorecard below dice */
	@media (max-width: 767px) {
		.scorecard-area {
			order: 2;
		}

		.game-main {
			order: 1;
		}
	}
</style>
