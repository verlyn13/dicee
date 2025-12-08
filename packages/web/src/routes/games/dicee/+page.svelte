<script lang="ts">
/**
 * /games/dicee - Solo Game Route
 *
 * Mode selection and solo game play.
 * Shows GameGateway for mode selection, then inline solo game when selected.
 * If ?mode=solo query param is present, skips gateway and starts immediately.
 */

import { onMount } from 'svelte';
import { page } from '$app/stores';
import { DiceTray } from '$lib/components/dice/index.js';
import { GameGateway, GameOverModal } from '$lib/components/game/index.js';
import { GameStatus, KeyboardHelp, StatsToggle } from '$lib/components/hud/index.js';
import { Scorecard } from '$lib/components/scorecard/index.js';
import {
	trackCategoryScore,
	trackDecisionQuality,
	trackGameComplete,
	trackGameStart,
	trackRoll,
	useKeyboardNavigation,
} from '$lib/hooks/index.js';
import { analyzeTurnOptimal, initializeEngine } from '$lib/services/engine.js';
import { game } from '$lib/stores/game.svelte.js';
import type {
	Category,
	CategoryAnalysis,
	CategoryProbability,
	ScoringResult,
	StatsProfile,
	TurnAnalysis,
} from '$lib/types.js';

// View state - check if we should skip gateway (e.g., came from lobby SOLO button)
const skipGateway = $derived($page.url.searchParams.get('mode') === 'solo');
let showGateway = $state(true);
let ready = $state(false);

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

const bestEV = $derived(currentAnalysis?.expectedValue ?? 0);

// Derived from game state
const dice = $derived(game.dice.values);
const kept = $derived(game.dice.kept);
const rollsRemaining = $derived(game.rollsRemaining);
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

// Keyboard navigation - use getter to capture current showGateway value
const canKeep = $derived(game.rollNumber > 0 && rollsRemaining > 0);
useKeyboardNavigation({
	onRoll: () => doRoll(),
	onToggleKeep: (index) => toggleKeep(index),
	onKeepAll: () => keepAll(),
	onReleaseAll: () => releaseAll(),
	canRoll: () => canRoll && !rolling,
	canKeep: () => canKeep && !isGameOver,
	enabled: true, // Always enabled, handlers check showGateway
});

onMount(async () => {
	await initializeEngine();
	ready = true;

	// Auto-start if mode=solo query param (user clicked SOLO from lobby)
	if (skipGateway) {
		handleStartSolo();
	}
});

function handleStartSolo() {
	showGateway = false;
	game.startGame();
	trackGameStart('solo', 1);
	doRoll();
}

async function doRoll() {
	if (showGateway) return;
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
	if (showGateway) return;
	if (game.rollNumber === 0 || rollsRemaining === 0) return;
	game.dice.toggleKeep(index);
	updateAnalysis();
}

function keepAll() {
	if (showGateway) return;
	game.dice.keepAll();
	updateAnalysis();
}

function releaseAll() {
	if (showGateway) return;
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
	} else {
		// Start next turn
		doRoll();
	}
}

function newGame() {
	game.startGame();
	trackGameStart('solo', 1);
	doRoll();
}

function handleStatsToggle() {
	game.toggleStats();
}

function handleProfileChange(profile: StatsProfile) {
	game.setStatsProfile(profile);
}

function handleBackToGateway() {
	showGateway = true;
	// Reset game state for fresh start
	game.startGame();
}
</script>

<svelte:head>
	<title>Play Dicee</title>
</svelte:head>

{#if showGateway}
	<GameGateway onStartSolo={handleStartSolo} />
{:else}
	<div class="game-container">
		<!-- Header -->
		<header class="game-header">
			<button class="back-button" onclick={handleBackToGateway} aria-label="Back to mode selection">
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
			<GameStatus
				{turnNumber}
				{grandTotal}
				{isGameOver}
				onNewGame={newGame}
			/>
			<div class="header-actions">
				<StatsToggle
					enabled={statsEnabled}
					profile={statsProfile}
					onToggle={handleStatsToggle}
					onProfileChange={handleProfileChange}
				/>
				<KeyboardHelp />
			</div>
		</header>

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
			<GameOverModal
				{upperSubtotal}
				{upperBonus}
				{lowerTotal}
				{grandTotal}
				onPlayAgain={newGame}
			/>
		{/if}
	</div>
{/if}

<style>
	.game-container {
		min-height: 100svh;
		display: flex;
		flex-direction: column;
		background: var(--color-background);
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
