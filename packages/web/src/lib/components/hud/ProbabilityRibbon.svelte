<script lang="ts">
import type { Category, CategoryProbability } from '$lib/types.js';

interface Props {
	probabilities: CategoryProbability[];
	rollsRemaining: number;
}

let { probabilities, rollsRemaining }: Props = $props();

// Key outcomes we want to highlight (high-value categories)
const KEY_CATEGORIES: Category[] = [
	'Dicee',
	'LargeStraight',
	'SmallStraight',
	'FullHouse',
	'FourOfAKind',
	'ThreeOfAKind',
];

// Short names for compact display
const SHORT_NAMES: Partial<Record<Category, string>> = {
	Dicee: 'DCE',
	LargeStraight: 'LG',
	SmallStraight: 'SM',
	FullHouse: 'FH',
	FourOfAKind: '4K',
	ThreeOfAKind: '3K',
};

// Filter and sort key outcomes by probability (highest first)
const keyOutcomes = $derived.by(() => {
	const filtered = probabilities
		.filter((p) => KEY_CATEGORIES.includes(p.category))
		.filter((p) => p.probability > 0) // Only show outcomes with non-zero probability
		.sort((a, b) => b.probability - a.probability);

	// Return top 4 to keep ribbon compact
	return filtered.slice(0, 4);
});

// Format probability as percentage
function formatPercent(p: number): string {
	if (p >= 1) return '100%';
	if (p < 0.001) return '<0.1%';
	return (p * 100).toFixed(1) + '%';
}

// Hide ribbon if no rolls remaining or no outcomes to show
const showRibbon = $derived(rollsRemaining > 0 && keyOutcomes.length > 0);
</script>

{#if showRibbon}
	<div class="probability-ribbon" role="status" aria-label="Key outcome probabilities">
		<span class="ribbon-label">Odds:</span>
		<div class="outcomes">
			{#each keyOutcomes as outcome (outcome.category)}
				<div
					class="outcome"
					class:high={outcome.probability >= 0.5}
					class:medium={outcome.probability >= 0.2 && outcome.probability < 0.5}
					class:low={outcome.probability >= 0.05 && outcome.probability < 0.2}
				>
					<span class="label">{SHORT_NAMES[outcome.category]}</span>
					<div
						class="bar"
						style="--probability: {Math.min(outcome.probability * 100, 100)}%"
					>
						<span class="value">{formatPercent(outcome.probability)}</span>
					</div>
				</div>
			{/each}
		</div>
		{#if rollsRemaining > 0}
			<span class="rolls-badge">{rollsRemaining} roll{rollsRemaining > 1 ? 's' : ''}</span>
		{/if}
	</div>
{/if}

<style>
	.probability-ribbon {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-2) var(--space-3);
		background: var(--color-surface);
		border: var(--border-thin);
		font-family: var(--font-mono);
		font-size: var(--text-small);
	}

	.ribbon-label {
		color: var(--color-text-muted);
		font-weight: var(--weight-medium);
		white-space: nowrap;
	}

	.outcomes {
		display: flex;
		flex: 1;
		gap: var(--space-3);
		overflow-x: auto;
	}

	.outcome {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 48px;
	}

	.label {
		font-weight: var(--weight-bold);
		color: var(--color-text);
		text-align: center;
	}

	.bar {
		position: relative;
		height: 4px;
		background: var(--color-background);
		border-radius: 2px;
		overflow: hidden;
	}

	.bar::before {
		content: '';
		position: absolute;
		left: 0;
		top: 0;
		height: 100%;
		width: var(--probability);
		background: var(--color-accent);
		transition: width var(--transition-medium);
	}

	.outcome.high .bar::before {
		background: var(--color-success);
	}

	.outcome.medium .bar::before {
		background: var(--color-accent);
	}

	.outcome.low .bar::before {
		background: var(--color-warning);
	}

	.value {
		position: absolute;
		top: 6px;
		left: 0;
		width: 100%;
		text-align: center;
		font-size: var(--text-tiny);
		color: var(--color-text-muted);
	}

	.rolls-badge {
		padding: 2px 6px;
		background: var(--color-accent);
		border: var(--border-thin);
		font-size: var(--text-tiny);
		font-weight: var(--weight-semibold);
		white-space: nowrap;
	}

	/* High probability outcomes get visual emphasis */
	.outcome.high .label {
		color: var(--color-success);
	}

	/* Responsive: stack on very small screens */
	@media (max-width: 400px) {
		.probability-ribbon {
			flex-direction: column;
			align-items: stretch;
		}

		.ribbon-label {
			text-align: center;
		}

		.outcomes {
			justify-content: center;
		}

		.rolls-badge {
			align-self: center;
		}
	}
</style>
