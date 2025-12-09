<script lang="ts">
/**
 * GameGateway - Mode selection screen
 *
 * Presents the choice between Solo and Multiplayer modes.
 * Solo mode starts immediately, Multiplayer navigates to lobby.
 *
 * Features:
 * - Clear mode selection cards
 * - Quick rules reference
 * - Animated dice preview
 * - Responsive layout
 */

import { goto } from '$app/navigation';
import { auth } from '$lib/stores/auth.svelte';

interface Props {
	/** Callback when solo mode is selected */
	onStartSolo?: () => void;
	/** Callback when AI mode is selected */
	onStartAI?: () => void;
	/** Whether to show AI mode option */
	showAIMode?: boolean;
}

let { onStartSolo, onStartAI, showAIMode = true }: Props = $props();

// Generate random dice values for preview
const previewDice = $state([1, 2, 3, 4, 5].map(() => Math.floor(Math.random() * 6) + 1));

function handleSoloPlay() {
	if (onStartSolo) {
		onStartSolo();
	}
}

function handleMultiplayer() {
	// Check if authenticated for multiplayer
	if (!auth.isAuthenticated) {
		// Could show auth prompt, for now just navigate
		goto('/lobby');
	} else {
		goto('/lobby');
	}
}

function handleAIPlay() {
	if (onStartAI) {
		onStartAI();
	}
}

function handleBackToHub() {
	goto('/');
}
</script>

<div class="gateway">
	<!-- Header -->
	<header class="gateway-header">
		<button class="back-button" onclick={handleBackToHub} aria-label="Back to Hub">
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
		<h1 class="gateway-title">DICEE</h1>
		<div class="header-spacer"></div>
	</header>

	<!-- Mode Selection -->
	<div class="mode-cards">
		<!-- Solo Mode -->
		<button class="mode-card mode-card--solo" onclick={handleSoloPlay}>
			<div class="mode-icon">
				<svg
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
					<circle cx="12" cy="7" r="4" />
				</svg>
			</div>
			<h2 class="mode-title">SOLO</h2>
			<p class="mode-description">Practice your probability skills</p>
			<div class="mode-features">
				<span class="feature">No account needed</span>
				<span class="feature">Track your stats</span>
			</div>
		</button>

		<!-- VS AI Mode -->
		{#if showAIMode}
			<button class="mode-card mode-card--ai" onclick={handleAIPlay}>
				<div class="mode-icon">
					<span class="ai-emoji">🤖</span>
				</div>
				<h2 class="mode-title">VS AI</h2>
				<p class="mode-description">Challenge AI opponents</p>
				<div class="mode-features">
					<span class="feature">5 personalities</span>
					<span class="feature">Adjustable difficulty</span>
				</div>
			</button>
		{/if}

		<!-- Multiplayer Mode -->
		<button class="mode-card mode-card--multi" onclick={handleMultiplayer}>
			<div class="mode-icon">
				<svg
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
					<circle cx="9" cy="7" r="4" />
					<path d="M23 21v-2a4 4 0 0 0-3-3.87" />
					<path d="M16 3.13a4 4 0 0 1 0 7.75" />
				</svg>
			</div>
			<h2 class="mode-title">MULTIPLAYER</h2>
			<p class="mode-description">Compete against other players</p>
			<div class="mode-features">
				<span class="feature">Real-time matches</span>
				<span class="feature">Leaderboards</span>
			</div>
		</button>
	</div>

	<!-- Quick Rules - applies to all game modes -->
	<section class="rules-section">
		<h3 class="rules-title">HOW TO PLAY</h3>
		<div class="rules-grid">
			<div class="rule">
				<span class="rule-number">1</span>
				<span class="rule-text">Roll 5 dice up to 3 times per turn</span>
			</div>
			<div class="rule">
				<span class="rule-number">2</span>
				<span class="rule-text">Keep dice between rolls to build combos</span>
			</div>
			<div class="rule">
				<span class="rule-number">3</span>
				<span class="rule-text">Score in one category each turn</span>
			</div>
			<div class="rule">
				<span class="rule-number">4</span>
				<span class="rule-text">13 turns total — maximize your score!</span>
			</div>
		</div>
	</section>

	<!-- Dice Preview -->
	<div class="dice-preview">
		{#each previewDice as value, i}
			<div class="preview-die" style="animation-delay: {i * 0.1}s">
				<span>{value}</span>
			</div>
		{/each}
	</div>
</div>

<style>
	.gateway {
		min-height: 100svh;
		padding: var(--space-3);
		background: var(--color-background);
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
	}

	.gateway-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
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

	.gateway-title {
		font-family: var(--font-mono);
		font-size: var(--text-h2);
		font-weight: var(--weight-black);
		letter-spacing: var(--tracking-wider);
	}

	.header-spacer {
		width: 2.5rem;
	}

	/* Mode Cards */
	.mode-cards {
		display: grid;
		grid-template-columns: 1fr;
		gap: var(--space-3);
	}

	@media (min-width: 640px) {
		.mode-cards {
			grid-template-columns: repeat(2, 1fr);
		}
	}

	@media (min-width: 900px) {
		.mode-cards {
			grid-template-columns: repeat(3, 1fr);
		}
	}

	.mode-card {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: var(--space-2);
		padding: var(--space-3) var(--space-4);
		background: var(--color-surface);
		border: var(--border-thick);
		cursor: pointer;
		transition:
			transform var(--transition-fast),
			box-shadow var(--transition-fast);
		min-height: 180px;
	}

	.mode-card:hover {
		transform: translate(-4px, -4px);
		box-shadow: var(--shadow-brutal-lg);
	}

	.mode-card:active {
		transform: translate(0, 0);
		box-shadow: none;
	}

	.mode-card--solo {
		border-color: var(--color-accent-dark);
	}

	.mode-card--solo:hover {
		background: var(--color-accent-light);
	}

	.mode-card--multi {
		border-color: var(--color-success);
	}

	.mode-card--multi:hover {
		background: rgba(16, 185, 129, 0.1);
	}

	.mode-card--ai {
		border-color: var(--color-primary);
	}

	.mode-card--ai:hover {
		background: rgba(99, 102, 241, 0.1);
	}

	.mode-card--ai .mode-icon {
		color: var(--color-primary);
	}

	.ai-emoji {
		font-size: 2.5rem;
	}

	.mode-icon {
		width: 3rem;
		height: 3rem;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.mode-icon svg {
		width: 100%;
		height: 100%;
	}

	.mode-card--solo .mode-icon {
		color: var(--color-accent-dark);
	}

	.mode-card--multi .mode-icon {
		color: var(--color-success);
	}

	.mode-title {
		font-family: var(--font-mono);
		font-size: var(--text-h3);
		font-weight: var(--weight-bold);
		letter-spacing: var(--tracking-wide);
	}

	.mode-description {
		font-size: var(--text-small);
		color: var(--color-text-muted);
		text-align: center;
	}

	.mode-features {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-1);
		justify-content: center;
	}

	.feature {
		font-family: var(--font-mono);
		font-size: var(--text-tiny);
		padding: 0.25rem 0.5rem;
		background: var(--color-background);
		border: var(--border-thin);
	}

	/* Rules Section */
	.rules-section {
		padding: var(--space-3);
		background: var(--color-surface);
		border: var(--border-medium);
	}

	.rules-title {
		font-family: var(--font-mono);
		font-size: var(--text-small);
		font-weight: var(--weight-bold);
		letter-spacing: var(--tracking-wide);
		margin-bottom: var(--space-2);
		color: var(--color-text-muted);
	}

	.rules-grid {
		display: grid;
		grid-template-columns: 1fr;
		gap: var(--space-2);
	}

	@media (min-width: 640px) {
		.rules-grid {
			grid-template-columns: repeat(2, 1fr);
		}
	}

	.rule {
		display: flex;
		align-items: flex-start;
		gap: var(--space-2);
	}

	.rule-number {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 1.5rem;
		height: 1.5rem;
		background: var(--color-text);
		color: var(--color-surface);
		font-family: var(--font-mono);
		font-size: var(--text-tiny);
		font-weight: var(--weight-bold);
		flex-shrink: 0;
	}

	.rule-text {
		font-size: var(--text-small);
		line-height: 1.4;
	}

	/* Dice Preview */
	.dice-preview {
		display: flex;
		justify-content: center;
		gap: var(--space-2);
		padding: var(--space-3) 0;
	}

	.preview-die {
		width: 2.5rem;
		height: 2.5rem;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--color-surface);
		border: var(--border-medium);
		font-family: var(--font-mono);
		font-size: var(--text-body);
		font-weight: var(--weight-bold);
		animation: float 2s ease-in-out infinite;
	}

	@keyframes float {
		0%,
		100% {
			transform: translateY(0);
		}
		50% {
			transform: translateY(-4px);
		}
	}

	/* Desktop layout */
	@media (min-width: 768px) {
		.gateway {
			max-width: 48rem;
			margin: 0 auto;
			padding: var(--space-5);
		}

		.preview-die {
			width: 3rem;
			height: 3rem;
			font-size: var(--text-h3);
		}
	}
</style>
