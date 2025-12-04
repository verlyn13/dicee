<script lang="ts">
import type { Category, StatsProfile } from '$lib/types.js';
import { CATEGORY_DISPLAY_NAMES } from '$lib/types.js';

interface Props {
	category: Category;
	score: number | null;
	potentialScore: number;
	probability?: number;
	expectedValue?: number;
	isOptimal?: boolean;
	statsEnabled?: boolean;
	statsProfile?: StatsProfile;
	available?: boolean;
	onclick?: () => void;
}

let {
	category,
	score,
	potentialScore,
	probability = 0,
	expectedValue = 0,
	isOptimal = false,
	statsEnabled = false,
	statsProfile = 'intermediate',
	available = true,
	onclick,
}: Props = $props();

// Derived
const isScored = $derived(score !== null);
const displayName = $derived(CATEGORY_DISPLAY_NAMES[category]);

// Heat intensity (0-1)
const heatIntensity = $derived.by(() => {
	if (!available || !statsEnabled) return 0;
	// Normalize EV to 0-1 range (assuming max ~50 for Yahtzee)
	return Math.min(expectedValue / 50, 1);
});

// Stats visibility based on profile
const showProbability = $derived(statsEnabled && statsProfile !== 'beginner');
const showEV = $derived(
	statsEnabled && (statsProfile === 'intermediate' || statsProfile === 'expert'),
);
const showSimplified = $derived(statsEnabled && statsProfile === 'beginner');

// Simplified probability text for beginners
const simplifiedProbability = $derived.by(() => {
	if (probability >= 0.5) return 'Likely';
	if (probability >= 0.2) return 'Possible';
	return 'Unlikely';
});

// Format helpers
function formatPercent(n: number): string {
	return (n * 100).toFixed(1) + '%';
}

function formatEV(n: number): string {
	return n.toFixed(1);
}

// Category icons
const categoryIcons: Record<Category, string> = {
	Ones: '⚀',
	Twos: '⚁',
	Threes: '⚂',
	Fours: '⚃',
	Fives: '⚄',
	Sixes: '⚅',
	ThreeOfAKind: '🎲',
	FourOfAKind: '🎲',
	FullHouse: '🏠',
	SmallStraight: '📏',
	LargeStraight: '📐',
	Yahtzee: '🎯',
	Chance: '❓',
};
</script>

<button
	class="category-row"
	class:scored={isScored}
	class:optimal={isOptimal && available}
	class:available
	disabled={!available || isScored}
	{onclick}
	aria-label="{displayName}: {isScored ? `scored ${score}` : `potential ${potentialScore}`}{isOptimal ? ', best choice' : ''}"
>
	<!-- Heat Bar Background -->
	{#if available && statsEnabled}
		<div
			class="heat-bar"
			style="width: {heatIntensity * 100}%"
			class:optimal={isOptimal}
		></div>
	{/if}

	<!-- Category Info -->
	<div class="category-info">
		<span class="icon">{categoryIcons[category]}</span>
		<span class="name">{displayName}</span>
	</div>

	<!-- Score Display -->
	<div class="category-score">
		{#if isScored}
			<span class="score scored-value">{score}</span>
			<span class="check">✓</span>
		{:else}
			<span class="score potential-value">{potentialScore}</span>
		{/if}
	</div>

	<!-- Stats Display -->
	{#if available && !isScored}
		<div class="category-stats">
			{#if showSimplified}
				<span class="simple-prob">{simplifiedProbability}</span>
			{:else if showProbability}
				<span class="probability">{formatPercent(probability)}</span>
			{/if}

			{#if showEV}
				<span class="ev">EV: {formatEV(expectedValue)}</span>
			{/if}
		</div>
	{/if}

	<!-- Optimal Badge -->
	{#if isOptimal && available && !isScored}
		<div class="optimal-badge">
			{#if statsProfile === 'beginner'}
				★ Best
			{:else}
				★
			{/if}
		</div>
	{/if}
</button>

<style>
	.category-row {
		position: relative;
		display: grid;
		grid-template-columns: 1fr auto auto auto;
		gap: var(--space-2);
		align-items: center;
		padding: var(--space-2);
		background: var(--color-surface);
		border: var(--border-thin);
		border-bottom: none;
		text-align: left;
		cursor: pointer;
		overflow: hidden;
		transition:
			border-color var(--transition-fast),
			background var(--transition-fast);
		min-height: var(--touch-target-min);
	}

	.category-row:last-child {
		border-bottom: var(--border-thin);
	}

	.category-row:hover:not(:disabled) {
		border-color: var(--color-accent);
		background: var(--color-accent-light);
	}

	.category-row:disabled {
		cursor: default;
	}

	.category-row.scored {
		background: var(--color-background);
		opacity: 0.6;
	}

	.category-row.optimal:not(.scored) {
		border-color: var(--color-success);
		border-width: 2px;
		border-left-width: 4px;
	}

	/* Heat Bar */
	.heat-bar {
		position: absolute;
		left: 0;
		top: 0;
		height: 100%;
		background: var(--color-accent);
		opacity: 0.15;
		pointer-events: none;
		transition: width var(--transition-medium);
		z-index: 0;
	}

	.heat-bar.optimal {
		background: var(--color-success);
		opacity: 0.2;
	}

	.category-row:hover:not(:disabled) .heat-bar {
		opacity: 0.25;
	}

	/* Category Info */
	.category-info {
		position: relative;
		z-index: 1;
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}

	.icon {
		font-size: var(--text-h3);
		line-height: 1;
	}

	.name {
		font-weight: var(--weight-semibold);
		font-size: var(--text-body);
	}

	/* Score */
	.category-score {
		position: relative;
		z-index: 1;
		display: flex;
		align-items: center;
		gap: var(--space-1);
		font-family: var(--font-mono);
		font-variant-numeric: tabular-nums;
	}

	.score {
		font-weight: var(--weight-bold);
		font-size: var(--text-body);
		min-width: 3ch;
		text-align: right;
	}

	.scored-value {
		color: var(--color-text);
	}

	.potential-value {
		color: var(--color-text-muted);
	}

	.check {
		color: var(--color-success);
		font-weight: var(--weight-bold);
	}

	/* Stats */
	.category-stats {
		position: relative;
		z-index: 1;
		display: flex;
		gap: var(--space-2);
		font-family: var(--font-mono);
		font-size: var(--text-small);
		color: var(--color-text-muted);
	}

	.probability,
	.ev {
		min-width: 6ch;
		text-align: right;
	}

	.simple-prob {
		font-size: var(--text-small);
		font-weight: var(--weight-medium);
		color: var(--color-text-muted);
	}

	/* Optimal Badge */
	.optimal-badge {
		position: relative;
		z-index: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 2px 8px;
		background: var(--color-accent);
		border: var(--border-medium);
		font-size: var(--text-tiny);
		font-weight: var(--weight-bold);
		white-space: nowrap;
	}

	/* Responsive */
	@media (max-width: 600px) {
		.category-row {
			grid-template-columns: 1fr auto auto;
		}

		.category-stats {
			display: none;
		}

		.icon {
			font-size: var(--text-body);
		}

		.name {
			font-size: var(--text-small);
		}
	}
</style>
