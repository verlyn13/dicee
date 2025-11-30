<script lang="ts">
import { onMount } from 'svelte';
import {
	initEngine,
	scoreAllCategories,
	calculateProbabilities,
	type ScoringResult,
} from '$lib/engine.js';
import type {
	Category,
	CategoryProbability,
	StatsProfile,
} from '$lib/types.js';
import { game } from '$lib/stores/game.svelte.js';

// Components
import { DiceTray } from '$lib/components/dice/index.js';
import { Scorecard } from '$lib/components/scorecard/index.js';
import { StatsToggle, GameStatus } from '$lib/components/hud/index.js';

// State
let ready = $state(false);
let scores = $state<ScoringResult[]>([]);
let probabilities = $state<CategoryProbability[]>([]);
let bestEV = $state(0);
let rolling = $state(false);

// Derived from game state
const dice = $derived(game.dice.values);
const kept = $derived(game.dice.kept);
const rollsRemaining = $derived(game.rollsRemaining);
const statsEnabled = $derived(game.statsEnabled);
const statsProfile = $derived(game.statsProfile);
const isGameActive = $derived(game.isGameActive);
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

onMount(async () => {
	await initEngine();
	ready = true;
	game.startGame();
	doRoll();
});

async function doRoll() {
	if (!canRoll) return;

	rolling = true;

	// Brief visual delay for roll feel
	await new Promise((r) => setTimeout(r, 100));

	game.roll();
	updateAnalysis();

	rolling = false;
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

function updateAnalysis() {
	scores = scoreAllCategories(game.dice.values);
	const result = calculateProbabilities(
		game.dice.values,
		game.dice.kept,
		rollsRemaining,
	);
	probabilities = result.categories;
	bestEV = result.bestEV;
}

function scoreCategory(category: Category) {
	if (!canScore) return;
	if (!game.scorecard.isAvailable(category)) return;

	game.score(category);

	// Start next turn if game not over
	if (!isGameOver) {
		doRoll();
	}
}

function newGame() {
	game.startGame();
	doRoll();
}

function handleStatsToggle() {
	game.toggleStats();
}

function handleProfileChange(profile: StatsProfile) {
	game.setStatsProfile(profile);
}
</script>

<svelte:head>
	<title>Dicee - Probability Learning Game</title>
	<meta name="description" content="Learn probability through the classic dice game Yahtzee" />
</svelte:head>

{#if !ready}
	<div class="loading">
		<div class="loading-content">
			<h1 class="loading-title">DICEE</h1>
			<p class="loading-text">Loading probability engine...</p>
		</div>
	</div>
{:else}
	<div class="game-container" class:game-over={isGameOver}>
		<!-- Header -->
		<header class="header">
			<h1 class="logo">DICEE</h1>
			<p class="tagline">Probability Learning Game</p>
		</header>

		<!-- Context Zone (Game Status) -->
		<div class="context-zone">
			<GameStatus
				{turnNumber}
				{grandTotal}
				{isGameOver}
				onNewGame={newGame}
			/>
		</div>

		{#if !isGameOver}
			<!-- Action Zone (Dice Tray) -->
			<div class="action-zone">
				<DiceTray
					{dice}
					{kept}
					{rollsRemaining}
					{canRoll}
					canKeep={game.rollNumber > 0 && rollsRemaining > 0}
					{rolling}
					onRoll={doRoll}
					onToggleKeep={toggleKeep}
					onKeepAll={keepAll}
					onReleaseAll={releaseAll}
				/>

				<!-- Stats Control -->
				<div class="stats-control-wrapper">
					<StatsToggle
						enabled={statsEnabled}
						profile={statsProfile}
						onToggle={handleStatsToggle}
						onProfileChange={handleProfileChange}
					/>
				</div>
			</div>

			<!-- Decision Zone (Scorecard) -->
			<div class="decision-zone">
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
			</div>
		{:else}
			<!-- Game Over Display -->
			<div class="game-over-zone">
				<div class="final-results">
					<h2>Game Complete!</h2>

					<div class="score-breakdown">
						<div class="breakdown-row">
							<span class="breakdown-label">Upper Section</span>
							<span class="breakdown-value">{upperSubtotal}</span>
						</div>
						{#if upperBonus > 0}
							<div class="breakdown-row bonus">
								<span class="breakdown-label">Upper Bonus</span>
								<span class="breakdown-value">+{upperBonus}</span>
							</div>
						{/if}
						<div class="breakdown-row">
							<span class="breakdown-label">Lower Section</span>
							<span class="breakdown-value">{lowerTotal}</span>
						</div>
						<div class="breakdown-row total">
							<span class="breakdown-label">Grand Total</span>
							<span class="breakdown-value">{grandTotal}</span>
						</div>
					</div>

					<button class="play-again-btn" onclick={newGame}>
						Play Again
					</button>
				</div>
			</div>
		{/if}
	</div>
{/if}

<style>
	/* Loading Screen */
	.loading {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 100vh;
		background: var(--color-background);
	}

	.loading-content {
		text-align: center;
	}

	.loading-title {
		font-size: var(--text-display);
		font-weight: var(--weight-black);
		letter-spacing: var(--tracking-widest);
		margin-bottom: var(--space-2);
	}

	.loading-text {
		font-size: var(--text-body);
		color: var(--color-text-muted);
		animation: pulse 1.5s ease-in-out infinite;
	}

	@keyframes pulse {
		0%,
		100% {
			opacity: 0.5;
		}
		50% {
			opacity: 1;
		}
	}

	/* Game Container */
	.game-container {
		min-height: 100vh;
		max-width: 800px;
		margin: 0 auto;
		padding: var(--space-2);
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	/* Header */
	.header {
		text-align: center;
		padding: var(--space-2) var(--space-3);
		border: var(--border-thick);
		background: var(--color-surface);
	}

	.logo {
		font-size: var(--text-h1);
		font-weight: var(--weight-black);
		letter-spacing: var(--tracking-widest);
		margin: 0;
	}

	.tagline {
		font-size: var(--text-small);
		color: var(--color-text-muted);
		text-transform: uppercase;
		letter-spacing: var(--tracking-wider);
		margin: var(--space-1) 0 0;
	}

	/* Zones (Mobile-first: stacked) */
	.context-zone {
		flex-shrink: 0;
	}

	.action-zone {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.stats-control-wrapper {
		display: flex;
		justify-content: center;
	}

	.decision-zone {
		flex: 1;
		overflow-y: auto;
	}

	/* Game Over */
	.game-over-zone {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.final-results {
		text-align: center;
		padding: var(--space-4);
		background: var(--color-surface);
		border: var(--border-thick);
		max-width: 400px;
		width: 100%;
	}

	.final-results h2 {
		margin: 0 0 var(--space-3);
		font-size: var(--text-h2);
	}

	.score-breakdown {
		margin-bottom: var(--space-3);
	}

	.breakdown-row {
		display: flex;
		justify-content: space-between;
		padding: var(--space-1) var(--space-2);
		border-bottom: var(--border-thin);
	}

	.breakdown-row:last-child {
		border-bottom: none;
	}

	.breakdown-label {
		font-weight: var(--weight-medium);
	}

	.breakdown-value {
		font-family: var(--font-mono);
		font-weight: var(--weight-bold);
		font-variant-numeric: tabular-nums;
	}

	.breakdown-row.bonus {
		color: var(--color-success);
	}

	.breakdown-row.total {
		background: var(--color-accent);
		margin-top: var(--space-2);
		padding: var(--space-2);
		font-size: var(--text-h3);
	}

	.breakdown-row.total .breakdown-value {
		font-size: var(--text-h2);
	}

	.play-again-btn {
		padding: var(--space-2) var(--space-4);
		font-size: var(--text-body);
		font-weight: var(--weight-bold);
		text-transform: uppercase;
		letter-spacing: var(--tracking-wide);
		background: var(--color-accent);
		border: var(--border-thick);
		cursor: pointer;
		transition:
			transform var(--transition-fast),
			background var(--transition-fast);
	}

	.play-again-btn:hover {
		background: var(--color-accent-dark);
		transform: translateY(-2px);
	}

	.play-again-btn:active {
		transform: translateY(0);
	}

	/* Desktop Layout */
	@media (min-width: 1024px) {
		.game-container {
			max-width: 1200px;
			padding: var(--space-3);
		}

		/* Two-column layout for action + decision */
		.game-container:not(.game-over) {
			display: grid;
			grid-template-areas:
				'header header'
				'context context'
				'action decision';
			grid-template-columns: 1fr 1fr;
			grid-template-rows: auto auto 1fr;
			gap: var(--space-3);
		}

		.header {
			grid-area: header;
		}

		.context-zone {
			grid-area: context;
		}

		.action-zone {
			grid-area: action;
			position: sticky;
			top: var(--space-3);
			align-self: start;
		}

		.decision-zone {
			grid-area: decision;
			overflow: visible;
		}
	}

	/* Mobile optimizations */
	@media (max-width: 480px) {
		.game-container {
			padding: var(--space-1);
			gap: var(--space-1);
		}

		.header {
			padding: var(--space-1) var(--space-2);
		}

		.logo {
			font-size: var(--text-h2);
		}

		.tagline {
			font-size: var(--text-tiny);
		}
	}
</style>
