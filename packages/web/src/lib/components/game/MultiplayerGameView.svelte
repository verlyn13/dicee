<script lang="ts">
/**
 * MultiplayerGameView Component
 *
 * Smart container for multiplayer game.
 * Subscribes to multiplayerGame store and orchestrates child components.
 * Computes WASM analysis for scorecard statistical display.
 */
import { onDestroy, onMount } from 'svelte';
import { ChatPanel } from '$lib/components/chat';
import { DiceTray } from '$lib/components/dice';
import { RoomLobby } from '$lib/components/lobby';
import { SettingsButton, SettingsPanel } from '$lib/components/settings';
import { KEY_BINDINGS, useKeyboardNavigation } from '$lib/hooks/useKeyboardNavigation.svelte';
import { analyzeTurnOptimal, isEngineReady, preloadEngine } from '$lib/services/engine';
import { preferencesService } from '$lib/services/preferences.svelte';
import { audioStore } from '$lib/stores/audio.svelte';
import type { ChatStore } from '$lib/stores/chat.svelte';
import type {
	AIActivity,
	MultiplayerGameStore,
	ScoringNotification,
} from '$lib/stores/multiplayerGame.svelte';
import type { Category as CoreCategory, DiceArray, DieValue, TurnAnalysis } from '$lib/types';
import { isWireCategory, toCoreCategory, type WireCategory } from '$lib/types/category-convert';
import type { Category, KeptMask, Scorecard } from '$lib/types/multiplayer';
import { isPlayingPhase } from '$lib/types/multiplayer';
import ConnectionStatusBanner from './ConnectionStatusBanner.svelte';
import DisconnectedPlayersBanner from './DisconnectedPlayersBanner.svelte';
import MultiplayerGameOverModal from './MultiplayerGameOverModal.svelte';
import MultiplayerScorecard from './MultiplayerScorecard.svelte';
import OpponentPanel from './OpponentPanel.svelte';
import TurnIndicator from './TurnIndicator.svelte';

interface Props {
	/** The multiplayer game store instance */
	store: MultiplayerGameStore;
	/** Optional chat store for chat functionality */
	chatStore?: ChatStore;
	/** Callback when player wants to leave the game */
	onLeave?: () => void;
	/** Whether this is a Quick Play session (skip waiting room) */
	isQuickPlay?: boolean;
}

let { store, chatStore, onLeave, isQuickPlay = false }: Props = $props();

// Subscribe to store events
let unsubscribe: (() => void) | null = null;

onMount(() => {
	unsubscribe = store.subscribe();
	// Preload WASM engine for scorecard statistics
	preloadEngine();
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
const aiActivity = $derived(store.aiActivity);
const scoringNotifications = $derived(store.scoringNotifications);

// Reconnection state (Phase 3)
const disconnectedPlayers = $derived(store.disconnectedPlayers);
const didReconnect = $derived(store.didReconnect);

// Active player's dice (show opponent's dice when watching their turn)
const activeDice = $derived(
	isMyTurn
		? currentDice
		: ((currentPlayer?.currentDice as [number, number, number, number, number] | null) ?? null),
);

// Active player's kept dice
const activeKept = $derived(
	isMyTurn
		? keptDice
		: ((currentPlayer?.keptDice as KeptMask | null) ??
				([false, false, false, false, false] as KeptMask)),
);

// Active player's rolls remaining
const activeRollsRemaining = $derived(
	isMyTurn ? rollsRemaining : (currentPlayer?.rollsRemaining ?? 0),
);

// Spectator label when watching opponent
const spectatorLabel = $derived(
	!isMyTurn && currentPlayer ? `Watching ${currentPlayer.displayName}...` : undefined,
);

// WASM Analysis for scorecard statistics
let turnAnalysis = $state<TurnAnalysis | null>(null);
let analysisLoading = $state(false);

// Compute analysis when dice or scorecard changes
$effect(() => {
	// Only compute when it's my turn and I have dice
	if (!isMyTurn || !currentDice || !myScorecard) {
		turnAnalysis = null;
		return;
	}

	// Get available categories (convert from wire to core format)
	const available: CoreCategory[] = [];
	const scorecard = myScorecard as Scorecard;
	for (const key of Object.keys(scorecard)) {
		if (isWireCategory(key) && scorecard[key as Category] === null) {
			available.push(toCoreCategory(key as WireCategory));
		}
	}

	if (available.length === 0) {
		turnAnalysis = null;
		return;
	}

	// Convert dice to DiceArray
	const diceArray = currentDice as DiceArray;

	// Fetch analysis (async)
	analysisLoading = true;
	analyzeTurnOptimal(diceArray, rollsRemaining ?? 0, available)
		.then((result) => {
			turnAnalysis = result;
		})
		.catch((err) => {
			console.warn('WASM analysis failed:', err);
			turnAnalysis = null;
		})
		.finally(() => {
			analysisLoading = false;
		});
});

// Chat state
let chatCollapsed = $state(true);

function handleChatToggle(): void {
	chatCollapsed = !chatCollapsed;
}

// Settings panel state
let settingsOpen = $state(false);

function handleOpenSettings(): void {
	settingsOpen = true;
}

function handleCloseSettings(): void {
	settingsOpen = false;
}

function handleVolumeChange(volume: number): void {
	audioStore.setMasterVolume(volume / 100); // Convert 0-100 to 0-1
}

function handleMuteChange(muted: boolean): void {
	audioStore.setMuted(muted);
}

function handleHapticsChange(enabled: boolean): void {
	audioStore.setHapticsEnabled(enabled);
}

function handleKeepDiceChange(enabled: boolean): void {
	preferencesService.setKeepDiceByDefault(enabled);
}

function handleResetSettings(): void {
	audioStore.resetToDefaults();
	preferencesService.reset();
}

// Keyboard navigation for game controls (only active when it's my turn and game is in playing phase)
const keyboardNav = useKeyboardNavigation({
	onRoll: handleRoll,
	onToggleKeep: handleToggleKeep,
	onKeepAll: handleKeepAll,
	onReleaseAll: handleReleaseAll,
	canRoll: () => canRoll,
	canKeep: () => canKeep,
	enabled: () => isMyTurn && isPlayingPhase(phase),
});

// Keyboard shortcuts: 'C' to toggle chat, 'Escape' to close chat
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

// Default dice for display before first roll
const defaultDice: DiceArray = [1, 1, 1, 1, 1] as DiceArray;

// Convert multiplayer dice (number[]) to DiceArray (DieValue[])
function toDiceArray(dice: [number, number, number, number, number] | null): DiceArray {
	if (!dice) return defaultDice;
	return dice.map((d) => Math.max(1, Math.min(6, d)) as DieValue) as DiceArray;
}

// Display the active player's dice (self or opponent)
const displayDice = $derived(toDiceArray(activeDice));

// Has the active player rolled this turn? (dice are null until first roll)
const hasRolled = $derived(activeDice !== null);

// Is the game in a rolling animation state?
const isRolling = $derived(uiPhase === 'ROLLING');

// Total players including self
const totalPlayers = $derived(opponents.length + 1);

// Helper to format category names for display
function formatCategory(category: string): string {
	const names: Record<string, string> = {
		ones: 'Ones',
		twos: 'Twos',
		threes: 'Threes',
		fours: 'Fours',
		fives: 'Fives',
		sixes: 'Sixes',
		threeOfAKind: '3 of a Kind',
		fourOfAKind: '4 of a Kind',
		fullHouse: 'Full House',
		smallStraight: 'Small Straight',
		largeStraight: 'Large Straight',
		dicee: 'DICEE!',
		chance: 'Chance',
	};
	return names[category] ?? category;
}

// Get AI activity description
const aiActivityText = $derived.by(() => {
	if (!aiActivity || !currentPlayer) return null;
	const name = currentPlayer.displayName;
	switch (aiActivity.action) {
		case 'thinking':
			return `${name} is thinking...`;
		case 'rolling':
			return `${name} is rolling...`;
		case 'keeping':
			return `${name} is selecting dice...`;
		case 'scoring':
			return aiActivity.category
				? `${name} scored ${formatCategory(aiActivity.category)}`
				: `${name} is scoring...`;
		default:
			return null;
	}
});

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

function handleDismissReconnect(): void {
	store.clearReconnectionBanner();
}
</script>

<!-- Show Waiting Room or Game View based on phase -->
{#if (phase === 'waiting' || phase === 'starting') && !isQuickPlay}
	<!-- Full-screen Waiting Room (not shown for Quick Play) -->
	<div class="waiting-room-container">
		<RoomLobby {chatStore} onleave={handleLeave} />
	</div>
{:else if (phase === 'waiting' || phase === 'starting') && isQuickPlay}
	<!-- Quick Play loading state - game is starting -->
	<div class="quick-play-loading">
		<div class="loading-content">
			<div class="loading-spinner">🎲</div>
			<p class="loading-text">Starting game...</p>
		</div>
	</div>
{:else}
	<div class="multiplayer-game-view" data-phase={phase} data-ui-phase={uiPhase}>
		<!-- Error Banner -->
		{#if error}
			<div class="error-banner" role="alert">
				<span class="error-message">{error}</span>
			</div>
		{/if}

		<!-- Connection Status Banners (Phase 3 - Reconnection) -->
		<ConnectionStatusBanner
			{didReconnect}
			onDismissReconnect={handleDismissReconnect}
		/>
		<DisconnectedPlayersBanner {disconnectedPlayers} />

		<!-- Scoring Notifications -->
		{#if scoringNotifications.length > 0}
			<div class="scoring-notifications" role="status" aria-live="polite">
				{#each scoringNotifications as notification (notification.id)}
					<div class="scoring-notification">
						<span class="notification-player">{notification.playerName}</span>
						<span class="notification-action">scored</span>
						<span class="notification-category">{formatCategory(notification.category)}</span>
						<span class="notification-score">+{notification.score}</span>
					</div>
				{/each}
			</div>
		{/if}

		<!-- Game Header -->
		<header class="game-header">
			<button class="leave-btn" onclick={handleLeave} type="button">
				← Leave
			</button>
			<div class="game-info">
				<SettingsButton onclick={handleOpenSettings} isOpen={settingsOpen} />
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
						kept={activeKept}
						rollsRemaining={activeRollsRemaining}
						{canRoll}
						{canKeep}
						rolling={isRolling}
						{hasRolled}
						readonly={!isMyTurn}
						{spectatorLabel}
						onRoll={handleRoll}
						onToggleKeep={handleToggleKeep}
						onKeepAll={handleKeepAll}
						onReleaseAll={handleReleaseAll}
					/>
				</div>

				<!-- Turn Status Message -->
				<div class="turn-status" class:my-turn={isMyTurn} class:waiting={!isMyTurn} class:ai-active={aiActivity !== null}>
					{#if !isMyTurn}
						{#if aiActivityText}
							<p class="status-text ai-activity-text">
								<span class="ai-icon" class:thinking={aiActivity?.action === 'thinking'} class:rolling={aiActivity?.action === 'rolling'}>🤖</span>
								{aiActivityText}
							</p>
						{:else}
							<p class="status-text waiting-text">
								<span class="waiting-icon">⏳</span>
								{currentPlayer?.displayName ?? 'Opponent'}'s turn
							</p>
						{/if}
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

				<!-- Keyboard Shortcuts Hint (desktop only) -->
				<div class="keyboard-hints">
					<span class="hint-label">Keys:</span>
					<span class="hint-key">R</span> roll
					<span class="hint-key">1-5</span> keep
					<span class="hint-key">C</span> chat
				</div>
			</main>

			<!-- Right Column: Scorecard -->
			<aside class="scorecard-area">
				<MultiplayerScorecard
					scorecard={myScorecard}
					{currentDice}
					{canScore}
					analysis={turnAnalysis}
					onScore={handleScore}
				/>
			</aside>
		</div>

		<!-- Chat Panel -->
		{#if chatStore}
			<ChatPanel collapsed={chatCollapsed} onToggle={handleChatToggle} />
		{/if}

		<!-- Settings Panel -->
		{#if settingsOpen}
			<div class="settings-overlay" role="presentation">
				<button
					type="button"
					class="settings-backdrop"
					onclick={handleCloseSettings}
					aria-label="Close settings"
				></button>
				<div class="settings-container">
					<SettingsPanel
						masterVolume={Math.round(audioStore.masterVolume * 100)}
						muted={audioStore.isMuted}
						hapticsEnabled={audioStore.hapticsEnabled}
						keepDiceByDefault={preferencesService.preferences.gameplay?.keepDiceByDefault ?? true}
						onVolumeChange={handleVolumeChange}
						onMuteChange={handleMuteChange}
						onHapticsChange={handleHapticsChange}
						onKeepDiceChange={handleKeepDiceChange}
						onReset={handleResetSettings}
						onClose={handleCloseSettings}
					/>
				</div>
			</div>
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
	/* Waiting Room Container
	 * Simple approach: normal document flow, let browser handle keyboard.
	 * No fixed heights, no viewport units, no keyboard detection.
	 */
	.waiting-room-container {
		min-height: 100vh;
		min-height: 100dvh; /* Dynamic viewport for mobile */
		padding: var(--space-3);
		padding-bottom: var(--space-6); /* Extra space at bottom for breathing room */
		background: var(--color-background);
		overflow-y: auto;
		-webkit-overflow-scrolling: touch;
	}

	.multiplayer-game-view {
		display: flex;
		flex-direction: column;
		min-height: 100vh;
		min-height: 100svh;
		background: var(--color-background);
	}

	/* Desktop: Fixed viewport, internal scrolling */
	@media (min-width: 768px) {
		.multiplayer-game-view {
			max-height: 100svh;
			overflow: hidden;
		}
	}

	/* Mobile: Natural scrolling for entire view */
	@media (max-width: 767px) {
		.multiplayer-game-view {
			overflow-y: auto;
			-webkit-overflow-scrolling: touch;
		}
	}

	/* Quick Play Loading */
	.quick-play-loading {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 100vh;
		background: var(--color-background);
	}

	.quick-play-loading .loading-content {
		text-align: center;
		padding: var(--space-4);
	}

	.quick-play-loading .loading-spinner {
		font-size: 4rem;
		animation: spin 1s ease-in-out infinite;
	}

	.quick-play-loading .loading-text {
		font-size: var(--text-h3);
		font-weight: var(--weight-semibold);
		margin-top: var(--space-2);
	}

	@keyframes spin {
		0%, 100% { transform: rotate(0deg); }
		50% { transform: rotate(180deg); }
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

	/* Hide mobile player bar when keyboard is open to save space */
	@media (max-width: 767px) {
		:global(html.keyboard-open) .mobile-player-bar {
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
	}

	/* Mobile: Natural flow, no constraints */
	@media (max-width: 767px) {
		.game-layout {
			padding-bottom: var(--space-4); /* Extra space at bottom for comfortable scrolling */
		}
	}

	/* Desktop Layout */
	@media (min-width: 768px) {
		.game-layout {
			grid-template-columns: 240px 1fr 280px;
			gap: var(--space-3);
			padding: var(--space-3);
			flex: 1;
			min-height: 0; /* Allow grid to shrink below content size */
			/* Ensure grid fits in available space */
			max-height: 100%;
			overflow: hidden;
		}
	}

	/* Sidebar */
	.sidebar {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		min-height: 0; /* Allow flexbox to shrink */
	}

	/* Desktop: Constrain sidebar to available height */
	@media (min-width: 768px) {
		.sidebar {
			max-height: 100%;
			overflow-y: auto;
			scrollbar-width: thin;
			scrollbar-color: var(--color-border) transparent;
		}
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

	.turn-status.ai-active {
		background: var(--color-accent-light);
		border: var(--border-medium);
		border-color: var(--color-accent);
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

	.ai-activity-text {
		color: var(--color-accent);
		font-weight: var(--weight-semibold);
	}

	.waiting-icon,
	.turn-icon {
		font-size: 1.2em;
	}

	.ai-icon {
		font-size: 1.2em;
		display: inline-block;
	}

	.ai-icon.thinking {
		animation: pulse-think 1.5s ease-in-out infinite;
	}

	.ai-icon.rolling {
		animation: shake-roll 0.3s ease-in-out infinite;
	}

	@keyframes pulse-think {
		0%, 100% { opacity: 1; transform: scale(1); }
		50% { opacity: 0.6; transform: scale(1.1); }
	}

	@keyframes shake-roll {
		0%, 100% { transform: translateX(0) rotate(0deg); }
		25% { transform: translateX(-2px) rotate(-5deg); }
		75% { transform: translateX(2px) rotate(5deg); }
	}

	/* Scoring Notifications */
	.scoring-notifications {
		position: fixed;
		top: 60px;
		left: 50%;
		transform: translateX(-50%);
		z-index: 100;
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		pointer-events: none;
	}

	.scoring-notification {
		display: flex;
		align-items: center;
		gap: var(--space-1);
		padding: var(--space-1) var(--space-2);
		background: var(--color-surface);
		border: var(--border-medium);
		box-shadow: 2px 2px 0 var(--color-border);
		font-size: var(--text-small);
		animation: slide-in-notification 0.3s ease-out;
	}

	@keyframes slide-in-notification {
		from {
			opacity: 0;
			transform: translateY(-10px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	.notification-player {
		font-weight: var(--weight-bold);
	}

	.notification-action {
		color: var(--color-text-muted);
	}

	.notification-category {
		font-weight: var(--weight-semibold);
		color: var(--color-primary);
	}

	.notification-score {
		font-family: var(--font-mono);
		font-weight: var(--weight-bold);
		color: var(--color-success, var(--color-accent));
	}

	/* Scorecard Area */
	.scorecard-area {
		display: flex;
		flex-direction: column;
	}

	/* Desktop: Constrain scorecard to available height */
	@media (min-width: 768px) {
		.scorecard-area {
			max-height: 100%;
			overflow-y: auto;
			min-height: 0;
			/* Custom scrollbar for desktop */
			scrollbar-width: thin;
			scrollbar-color: var(--color-border) transparent;
		}

		.scorecard-area::-webkit-scrollbar {
			width: 6px;
		}

		.scorecard-area::-webkit-scrollbar-track {
			background: transparent;
		}

		.scorecard-area::-webkit-scrollbar-thumb {
			background: var(--color-border);
			border-radius: 3px;
		}
	}

	/* Mobile: Scorecard below dice, full natural height */
	@media (max-width: 767px) {
		.scorecard-area {
			order: 2;
		}

		.game-main {
			order: 1;
		}
	}

	/* Keyboard Hints */
	.keyboard-hints {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-2);
		padding: var(--space-1) var(--space-2);
		font-size: var(--text-tiny);
		color: var(--color-text-muted);
		text-transform: uppercase;
		letter-spacing: var(--tracking-wide);
	}

	.hint-label {
		font-weight: var(--weight-semibold);
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
		.keyboard-hints {
			display: none;
		}
	}

	/* ==========================================================================
	 * Mobile Keyboard Awareness
	 * When virtual keyboard is open, hide non-essential elements to make room
	 * for chat panel. User can close chat to see full game view.
	 * ========================================================================== */
	@media (max-width: 767px) {
		:global(html.keyboard-open) .game-layout {
			max-height: calc(100svh - var(--keyboard-height, 0px) - 48px);
			overflow: hidden;
		}

		:global(html.keyboard-open) .scorecard-area {
			display: none;
		}

		:global(html.keyboard-open) .dice-area {
			max-height: 150px;
			overflow: hidden;
		}

		:global(html.keyboard-open) .turn-status {
			display: none;
		}

		:global(html.keyboard-open) .sidebar {
			display: none;
		}
	}

	/* Settings Overlay */
	.settings-overlay {
		position: fixed;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
	}

	.settings-backdrop {
		position: absolute;
		inset: 0;
		background: rgba(0, 0, 0, 0.4);
		border: none;
		cursor: pointer;
	}

	.settings-container {
		position: relative;
		z-index: 1;
	}
</style>
