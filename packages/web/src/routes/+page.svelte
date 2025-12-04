<script lang="ts">
import { onMount } from 'svelte';
import {
	AuthStatus,
	GoogleButton,
	MagicLinkForm,
	PlayNowButton,
} from '$lib/components/auth/index.js';
// Components
import { DiceTray } from '$lib/components/dice/index.js';
import { GameOverModal } from '$lib/components/game/index.js';
import { GameStatus, KeyboardHelp, StatsToggle } from '$lib/components/hud/index.js';
import { Scorecard } from '$lib/components/scorecard/index.js';
// Hooks
import { useKeyboardNavigation } from '$lib/hooks/index.js';
import {
	calculateProbabilities,
	calculateScores,
	initializeEngine,
	isEngineReady,
} from '$lib/services/engine.js';
import { auth } from '$lib/stores/auth.svelte.js';
import { game } from '$lib/stores/game.svelte.js';
import type { Category, CategoryProbability, ScoringResult, StatsProfile } from '$lib/types.js';

// State
let ready = $state(false);
let scores = $state<ScoringResult[]>([]);
let probabilities = $state<CategoryProbability[]>([]);
let bestEV = $state(0);
let rolling = $state(false);
let showGame = $state(false); // Controls whether to show game vs landing

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

	// If user is already authenticated, show game immediately
	if (auth.isAuthenticated) {
		startPlaying();
	}
});

// Watch for sign out - return to landing when user signs out
$effect(() => {
	if (auth.initialized && !auth.isAuthenticated && showGame) {
		showGame = false;
	}
});

function startPlaying() {
	showGame = true;
	game.startGame();
	doRoll();
}

async function handlePlayNow() {
	// PlayNowButton handles signInAnonymously, then we start playing
	startPlaying();
}

async function handleGoogleSuccess() {
	// After Google OAuth redirect, user will be authenticated
	// This is handled by the callback route
}

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

async function updateAnalysis() {
	try {
		// Fetch scores and probabilities from WASM engine
		scores = await calculateScores(game.dice.values);
		probabilities = await calculateProbabilities(game.dice.values, game.dice.kept, rollsRemaining);

		// Find best EV from available categories
		const availableProbs = probabilities.filter((p) =>
			game.scorecard.categoriesRemaining.includes(p.category),
		);
		bestEV =
			availableProbs.length > 0 ? Math.max(...availableProbs.map((p) => p.expectedValue)) : 0;
	} catch (err) {
		console.warn('Failed to update analysis:', err);
	}
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
{:else if !showGame}
	<!-- Landing Page -->
	<div class="landing">
		<div class="landing-content">
			<header class="landing-header">
				<h1 class="landing-title">DICEE</h1>
				<p class="landing-subtitle">Learn Probability Through Play</p>
			</header>

			<div class="auth-section">
				<PlayNowButton onclick={handlePlayNow} />

				<div class="auth-divider">
					<span class="divider-line"></span>
					<span class="divider-text">or</span>
					<span class="divider-line"></span>
				</div>

				<div class="auth-options">
					<GoogleButton />
					<MagicLinkForm />
				</div>
			</div>

			<footer class="landing-footer">
				<p class="landing-note">Play as a guest or sign in to save your progress</p>
			</footer>
		</div>
	</div>
{:else}
	<div class="game-container" class:game-over={isGameOver}>
		<!-- Header -->
		<header class="header">
			<div class="header-content">
				<h1 class="logo">DICEE</h1>
				<p class="tagline">Probability Learning Game</p>
			</div>
			<AuthStatus />
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
					<KeyboardHelp />
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
		{/if}

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

	/* Landing Page */
	.landing {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 100vh;
		padding: var(--space-3);
		background: var(--color-background);
	}

	.landing-content {
		width: 100%;
		max-width: 400px;
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
	}

	.landing-header {
		text-align: center;
	}

	.landing-title {
		font-size: var(--text-display);
		font-weight: var(--weight-black);
		letter-spacing: var(--tracking-widest);
		margin: 0;
	}

	.landing-subtitle {
		font-size: var(--text-body);
		color: var(--color-text-muted);
		margin: var(--space-1) 0 0;
	}

	.auth-section {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		padding: var(--space-3);
		background: var(--color-surface);
		border: var(--border-thick);
	}

	.auth-divider {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		margin: var(--space-1) 0;
	}

	.divider-line {
		flex: 1;
		height: 1px;
		background: var(--color-border);
	}

	.divider-text {
		font-size: var(--text-small);
		color: var(--color-text-muted);
		text-transform: lowercase;
	}

	.auth-options {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.landing-footer {
		text-align: center;
	}

	.landing-note {
		font-size: var(--text-small);
		color: var(--color-text-muted);
		margin: 0;
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
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: var(--space-2) var(--space-3);
		border: var(--border-thick);
		background: var(--color-surface);
	}

	.header-content {
		text-align: left;
	}

	.logo {
		font-size: var(--text-h2);
		font-weight: var(--weight-black);
		letter-spacing: var(--tracking-widest);
		margin: 0;
	}

	.tagline {
		font-size: var(--text-tiny);
		color: var(--color-text-muted);
		text-transform: uppercase;
		letter-spacing: var(--tracking-wider);
		margin: 0;
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
