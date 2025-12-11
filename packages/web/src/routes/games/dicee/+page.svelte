<script lang="ts">
/**
 * /games/dicee - Solo Game Route
 *
 * Direct solo game play without mode selection.
 * Mode selection is handled by LobbyLanding at the root path.
 *
 * Entry points:
 * - /games/dicee - Solo game
 * - /games/dicee?mode=solo - Same (backward compatibility)
 */

import { onMount } from 'svelte';
import { goto } from '$app/navigation';
import { DiceTray } from '$lib/components/dice/index.js';
import { GameOverModal } from '$lib/components/game/index.js';
import { GameStatus, KeyboardHelp, StatsToggle } from '$lib/components/hud/index.js';
import { Scorecard } from '$lib/components/scorecard/index.js';
import { SettingsButton, SettingsPanel } from '$lib/components/settings';
import {
	trackCategoryScore,
	trackDecisionQuality,
	trackGameComplete,
	trackGameStart,
	trackRoll,
	useKeyboardNavigation,
} from '$lib/hooks/index.js';
import { analyzeTurnOptimal, initializeEngine } from '$lib/services/engine.js';
import { audioStore } from '$lib/stores/audio.svelte';
import { game } from '$lib/stores/game.svelte.js';
import type {
	Category,
	CategoryProbability,
	ScoringResult,
	StatsProfile,
	TurnAnalysis,
} from '$lib/types.js';

// Engine ready state
let ready = $state(false);

// Settings panel state
let settingsOpen = $state(false);

// Game state (M1-M4 turn analysis)
let currentAnalysis = $state<TurnAnalysis | null>(null);
let rolling = $state(false);

// Derived from analysis for Scorecard compatibility
const scores = $derived<ScoringResult[]>(
	currentAnalysis?.categories.map((c) => ({
		category: c.category,
		score: c.immediateScore,
		valid: c.isValid,
	})) ?? [],
);

const probabilities = $derived<CategoryProbability[]>(
	currentAnalysis?.categories.map((c) => ({
		category: c.category,
		probability: 1, // M1-M4 solver provides EV, not raw probability
		expectedValue: c.expectedValue,
		currentScore: c.immediateScore,
		isOptimal: c.category === currentAnalysis?.recommendedCategory,
	})) ?? [],
);

// Derived from game state
const dice = $derived(game.dice.values);
const kept = $derived(game.dice.kept);
const rollsRemaining = $derived(game.rollsRemaining);
const hasRolled = $derived(game.rollNumber > 0);
const statsEnabled = $derived(game.statsEnabled);
const statsProfile = $derived(game.statsProfile);
const isGameOver = $derived(game.isGameOver);
const turnNumber = $derived(game.turnNumber);
const canRoll = $derived(game.canRoll);
const canScore = $derived(game.canScore);

// Scorecard values
const scorecardScores = $derived(game.scorecard.scores);
const upperSubtotal = $derived(game.scorecard.upperSubtotal);
const upperBonus = $derived(game.scorecard.upperBonus);
const upperTotal = $derived(game.scorecard.upperTotal);
const lowerTotal = $derived(game.scorecard.lowerTotal);
const grandTotal = $derived(game.scorecard.grandTotal);

// Keyboard navigation
const canKeep = $derived(game.rollNumber > 0 && rollsRemaining > 0);
useKeyboardNavigation({
	onRoll: () => doRoll(),
	onToggleKeep: (index) => toggleKeep(index),
	onKeepAll: () => keepAll(),
	onReleaseAll: () => releaseAll(),
	canRoll: () => canRoll && !rolling,
	canKeep: () => canKeep && !isGameOver,
	enabled: true,
});

onMount(async () => {
	await initializeEngine();
	ready = true;
	// Start the solo game immediately
	game.startGame();
	trackGameStart('solo', 1);
});

async function doRoll() {
	if (!canRoll) return;

	rolling = true;

	// Brief visual delay for roll feel
	await new Promise((r) => setTimeout(r, 100));

	game.roll();
	trackRoll(turnNumber, game.rollNumber);
	await updateAnalysis();

	rolling = false;
}

async function updateAnalysis() {
	try {
		// Fetch turn analysis from M1-M4 solver
		currentAnalysis = await analyzeTurnOptimal(
			game.dice.values,
			rollsRemaining,
			game.scorecard.categoriesRemaining,
		);
	} catch (err) {
		console.warn('Failed to update analysis:', err);
		currentAnalysis = null;
	}
}

function toggleKeep(index: number) {
	if (game.rollNumber === 0 || rollsRemaining === 0) return;
	game.dice.toggleKeep(index);
	updateAnalysis();
}

function keepAll() {
	game.dice.keepAll();
	updateAnalysis();
}

function releaseAll() {
	game.dice.releaseAll();
	updateAnalysis();
}

function scoreCategory(category: Category) {
	if (!canScore) return;
	if (!game.scorecard.isAvailable(category)) return;

	// Get optimal category from analysis before scoring
	const wasOptimal = currentAnalysis?.recommendedCategory === category;
	const score = game.getPotentialScore(category);

	const feedback = game.score(category);

	// Track telemetry
	trackCategoryScore(category, score, wasOptimal, turnNumber);
	if (feedback) {
		trackDecisionQuality(feedback);
	}

	// Check for game completion
	if (isGameOver) {
		trackGameComplete(grandTotal);
	}
}

function newGame() {
	game.startGame();
	trackGameStart('solo', 1);
}

function handleStatsToggle() {
	game.toggleStats();
}

function handleProfileChange(profile: StatsProfile) {
	game.setStatsProfile(profile);
}

function handleBackToLobby() {
	goto('/');
}
</script>

<svelte:head>
	<title>Solo Game | Dicee</title>
</svelte:head>

{#if !ready}
	<div class="loading-state">
		<div class="loading-content">
			<p class="loading-text">Loading game...</p>
		</div>
	</div>
{:else}
	<div class="game-container">
		<!-- Header -->
		<header class="game-header">
			<button class="back-button" onclick={handleBackToLobby} aria-label="Back to lobby">
				<svg
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="3"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<line x1="19" y1="12" x2="5" y2="12" />
					<polyline points="12 19 5 12 12 5" />
				</svg>
			</button>
			<GameStatus {turnNumber} {grandTotal} {isGameOver} onNewGame={newGame} />
			<div class="header-actions">
				<StatsToggle
					enabled={statsEnabled}
					profile={statsProfile}
					onToggle={handleStatsToggle}
					onProfileChange={handleProfileChange}
				/>
				<SettingsButton onclick={() => (settingsOpen = !settingsOpen)} isOpen={settingsOpen} />
				<KeyboardHelp />
			</div>
		</header>

		<!-- Settings Panel (positioned absolutely) -->
		{#if settingsOpen}
			<div class="settings-dropdown">
				<SettingsPanel
					masterVolume={Math.round(audioStore.masterVolume * 100)}
					muted={audioStore.isMuted}
					hapticsEnabled={audioStore.hapticsEnabled}
					onVolumeChange={(v) => audioStore.setMasterVolume(v / 100)}
					onMuteChange={(m) => audioStore.setMuted(m)}
					onHapticsChange={(e) => audioStore.setHapticsEnabled(e)}
					onReset={() => audioStore.resetToDefaults()}
					onClose={() => (settingsOpen = false)}
				/>
			</div>
		{/if}

		<!-- Game Content -->
		<main class="game-main">
			<!-- Dice Tray -->
			<section class="dice-section">
				<DiceTray
					{dice}
					{kept}
					{rollsRemaining}
					canRoll={canRoll && !rolling}
					{canKeep}
					{rolling}
					{hasRolled}
					onRoll={doRoll}
					onToggleKeep={toggleKeep}
					onKeepAll={keepAll}
					onReleaseAll={releaseAll}
				/>
			</section>

			<!-- Scorecard -->
			<section class="scorecard-section">
				<Scorecard
					scores={scorecardScores}
					potentialScores={scores}
					{probabilities}
					{upperSubtotal}
					{upperBonus}
					{upperTotal}
					{lowerTotal}
					{grandTotal}
					{statsEnabled}
					{statsProfile}
					{canScore}
					onScore={scoreCategory}
				/>
			</section>
		</main>

		<!-- Game Over Modal -->
		{#if isGameOver}
			<GameOverModal {upperSubtotal} {upperBonus} {lowerTotal} {grandTotal} onPlayAgain={newGame} />
		{/if}
	</div>
{/if}

<style>
	.loading-state {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 100vh;
		padding: var(--space-3);
		background: var(--color-background);
	}

	.loading-content {
		text-align: center;
		padding: var(--space-4);
		background: var(--color-surface);
		border: var(--border-thick);
	}

	.loading-text {
		font-size: var(--text-body);
		margin: 0;
	}

	.game-container {
		min-height: 100svh;
		display: flex;
		flex-direction: column;
		background: var(--color-background);
		position: relative;
	}

	.game-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: var(--space-2) var(--space-3);
		background: var(--color-surface);
		border-bottom: var(--border-medium);
		gap: var(--space-2);
	}

	/* Settings Dropdown */
	.settings-dropdown {
		position: absolute;
		top: 60px;
		right: var(--space-3);
		z-index: 100;
	}

	.back-button {
		width: 2.5rem;
		height: 2.5rem;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--color-surface);
		border: var(--border-medium);
		cursor: pointer;
		flex-shrink: 0;
		transition:
			transform var(--transition-fast),
			box-shadow var(--transition-fast);
	}

	.back-button svg {
		width: 1.25rem;
		height: 1.25rem;
	}

	.back-button:hover {
		transform: translate(-2px, -2px);
		box-shadow: var(--shadow-brutal-sm);
	}

	.back-button:active {
		transform: translate(0, 0);
		box-shadow: none;
	}

	.header-actions {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}

	.game-main {
		flex: 1;
		display: flex;
		flex-direction: column;
		padding: var(--space-2);
		gap: var(--space-2);
		overflow: hidden;
	}

	.dice-section {
		flex-shrink: 0;
	}

	.scorecard-section {
		flex: 1;
		overflow-y: auto;
		min-height: 0;
	}

	/* Desktop layout */
	@media (min-width: 1024px) {
		.game-main {
			flex-direction: row;
			max-width: 80rem;
			margin: 0 auto;
			padding: var(--space-4);
			gap: var(--space-4);
		}

		.dice-section {
			flex: 0 0 320px;
		}

		.scorecard-section {
			flex: 1;
			overflow-y: visible;
		}
	}
</style>
