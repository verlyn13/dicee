<script lang="ts">
/**
 * MultiplayerGameView Component
 *
 * Smart container for multiplayer game.
 * Subscribes to multiplayerGame store and orchestrates child components.
 */
import { onDestroy, onMount } from 'svelte';
import { DiceTray } from '$lib/components/dice';
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

// Default dice for display before first roll
const defaultDice: DiceArray = [1, 1, 1, 1, 1] as DiceArray;

// Convert multiplayer dice (number[]) to DiceArray (DieValue[])
function toDiceArray(dice: [number, number, number, number, number] | null): DiceArray {
	if (!dice) return defaultDice;
	return dice.map((d) => Math.max(1, Math.min(6, d)) as DieValue) as DiceArray;
}

const displayDice = $derived(toDiceArray(currentDice));

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
		</div>
	</header>

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
			{#if phase === 'waiting' || phase === 'starting'}
				<div class="waiting-state">
					<p class="waiting-text">
						{#if phase === 'waiting'}
							Waiting for game to start...
						{:else}
							Game starting...
						{/if}
					</p>
				</div>
			{:else}
				<div class="dice-area">
					<DiceTray
						dice={displayDice}
						kept={keptDice}
						{rollsRemaining}
						{canRoll}
						{canKeep}
						rolling={isRolling}
						onRoll={handleRoll}
						onToggleKeep={handleToggleKeep}
						onKeepAll={handleKeepAll}
						onReleaseAll={handleReleaseAll}
					/>
				</div>

				<!-- Turn Status Message -->
				<div class="turn-status" class:my-turn={isMyTurn}>
					{#if !isMyTurn}
						<p class="status-text">Waiting for {currentPlayer?.displayName ?? 'opponent'}...</p>
					{:else if uiPhase === 'ROLLING'}
						<p class="status-text">Rolling...</p>
					{:else if uiPhase === 'SCORING'}
						<p class="status-text">Scoring...</p>
					{:else if rollsRemaining === 3}
						<p class="status-text">Roll the dice to start your turn!</p>
					{:else if rollsRemaining > 0}
						<p class="status-text">Keep dice or roll again ({rollsRemaining} left)</p>
					{:else}
						<p class="status-text">Select a category to score</p>
					{/if}
				</div>
			{/if}
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

	<!-- Game Over Modal -->
	{#if isGameOver && rankings}
		<MultiplayerGameOverModal
			{rankings}
			myPlayerId={myPlayer?.id ?? ''}
			onClose={handleCloseGameOver}
		/>
	{/if}
</div>

<style>
	.multiplayer-game-view {
		display: flex;
		flex-direction: column;
		min-height: 100vh;
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

	.waiting-state {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 200px;
	}

	.waiting-text {
		font-size: var(--text-body);
		color: var(--color-text-muted);
		text-transform: uppercase;
		letter-spacing: var(--tracking-wide);
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

	.status-text {
		margin: 0;
		font-size: var(--text-body);
		font-weight: var(--weight-semibold);
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
