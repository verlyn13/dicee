<script lang="ts">
import { audioStore } from '$lib/stores/audio.svelte';
import type { Category, CategoryProbability, ScoringResult, StatsProfile } from '$lib/types.js';
import { LOWER_CATEGORIES, UPPER_CATEGORIES } from '$lib/types.js';
import { haptic } from '$lib/utils/haptics';
import CategoryRow from './CategoryRow.svelte';

interface Props {
	scores: Record<Category, number | null>;
	potentialScores: ScoringResult[];
	probabilities: CategoryProbability[];
	upperSubtotal: number;
	upperBonus: number;
	upperTotal: number;
	lowerTotal: number;
	grandTotal: number;
	statsEnabled?: boolean;
	statsProfile?: StatsProfile;
	canScore?: boolean;
	onScore: (category: Category) => void;
}

let {
	scores,
	potentialScores,
	probabilities,
	upperSubtotal,
	upperBonus,
	upperTotal,
	lowerTotal,
	grandTotal,
	statsEnabled = false,
	statsProfile = 'intermediate',
	canScore = true,
	onScore,
}: Props = $props();

// Helpers
function getScore(category: Category): number | null {
	return scores[category];
}

function getPotentialScore(category: Category): number {
	return potentialScores.find((s) => s.category === category)?.score ?? 0;
}

function getProbability(category: Category): CategoryProbability | undefined {
	return probabilities.find((p) => p.category === category);
}

function isAvailable(category: Category): boolean {
	return scores[category] === null;
}

// Upper bonus progress
const bonusProgress = $derived(Math.min(upperSubtotal, 63));
const bonusNeeded = $derived(Math.max(63 - upperSubtotal, 0));
const bonusAchieved = $derived(upperBonus > 0);

// Track bonus achievement for audio/haptic feedback
let wasBonusAchieved = $state(false);
$effect(() => {
	if (bonusAchieved && !wasBonusAchieved) {
		// Bonus just achieved - celebrate!
		audioStore.playBonusAchieved();
		haptic('success');
	}
	wasBonusAchieved = bonusAchieved;
});
</script>

<div class="scorecard">
	<header class="scorecard-header">
		<h2>Scorecard</h2>
	</header>

	<!-- Upper Section -->
	<section class="section upper-section">
		<div class="section-header">
			<span class="section-title">Upper Section</span>
			<span class="section-hint">Sum of matching dice</span>
		</div>

		<div class="categories">
			{#each UPPER_CATEGORIES as category}
				{@const prob = getProbability(category)}
				<CategoryRow
					{category}
					score={getScore(category)}
					potentialScore={getPotentialScore(category)}
					probability={prob?.probability ?? 0}
					expectedValue={prob?.expectedValue ?? 0}
					isOptimal={prob?.isOptimal ?? false}
					{statsEnabled}
					{statsProfile}
					available={isAvailable(category)}
					onclick={() => isAvailable(category) && canScore && onScore(category)}
				/>
			{/each}
		</div>

		<!-- Upper Section Totals -->
		<div class="totals-group">
			<div class="total-row subtotal-row">
				<span class="total-label">Upper Subtotal</span>
				<span class="total-value">{upperSubtotal}</span>
			</div>

			<div class="total-row bonus-row" class:achieved={bonusAchieved}>
				<span class="total-label">
					Bonus (63+)
					{#if !bonusAchieved && bonusNeeded > 0}
						<span class="bonus-hint">need {bonusNeeded} more</span>
					{/if}
				</span>
				<span class="total-value">
					{#if bonusAchieved}
						+35
					{:else}
						—
					{/if}
				</span>
			</div>

			<!-- Bonus Progress Bar -->
			{#if !bonusAchieved}
				<div class="bonus-progress">
					<div class="progress-bar" style="width: {(bonusProgress / 63) * 100}%"></div>
					<span class="progress-text">{upperSubtotal}/63</span>
				</div>
			{/if}

			<div class="total-row section-total">
				<span class="total-label">Upper Total</span>
				<span class="total-value">{upperTotal}</span>
			</div>
		</div>
	</section>

	<!-- Lower Section -->
	<section class="section lower-section">
		<div class="section-header">
			<span class="section-title">Lower Section</span>
			<span class="section-hint">Special combinations</span>
		</div>

		<div class="categories">
			{#each LOWER_CATEGORIES as category}
				{@const prob = getProbability(category)}
				<CategoryRow
					{category}
					score={getScore(category)}
					potentialScore={getPotentialScore(category)}
					probability={prob?.probability ?? 0}
					expectedValue={prob?.expectedValue ?? 0}
					isOptimal={prob?.isOptimal ?? false}
					{statsEnabled}
					{statsProfile}
					available={isAvailable(category)}
					onclick={() => isAvailable(category) && canScore && onScore(category)}
				/>
			{/each}
		</div>

		<div class="totals-group">
			<div class="total-row section-total">
				<span class="total-label">Lower Total</span>
				<span class="total-value">{lowerTotal}</span>
			</div>
		</div>
	</section>

	<!-- Grand Total -->
	<div class="grand-total">
		<span class="grand-label">Grand Total</span>
		<span class="grand-value">{grandTotal}</span>
	</div>
</div>

<style>
	.scorecard {
		background: var(--color-surface);
		border: var(--border-medium);
		display: flex;
		flex-direction: column;
	}

	.scorecard-header {
		padding: var(--space-2) var(--space-3);
		border-bottom: var(--border-thick);
		background: var(--color-background);
	}

	.scorecard-header h2 {
		margin: 0;
		font-size: var(--text-h3);
		font-weight: var(--weight-black);
		text-transform: uppercase;
		letter-spacing: var(--tracking-widest);
	}

	/* Sections */
	.section {
		padding: var(--space-2);
		border-bottom: var(--border-medium);
	}

	.section:last-of-type {
		border-bottom: none;
	}

	.section-header {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		padding: var(--space-1) var(--space-1);
		margin-bottom: var(--space-1);
		border-bottom: var(--border-thin);
	}

	.section-title {
		font-size: var(--text-small);
		font-weight: var(--weight-bold);
		text-transform: uppercase;
		letter-spacing: var(--tracking-wider);
	}

	.section-hint {
		font-size: var(--text-tiny);
		color: var(--color-text-muted);
	}

	.categories {
		display: flex;
		flex-direction: column;
	}

	/* Totals */
	.totals-group {
		margin-top: var(--space-2);
		padding-top: var(--space-2);
		border-top: var(--border-thin);
	}

	.total-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: var(--space-1) var(--space-2);
	}

	.total-label {
		font-weight: var(--weight-semibold);
		font-size: var(--text-small);
	}

	.total-value {
		font-family: var(--font-mono);
		font-weight: var(--weight-bold);
		font-variant-numeric: tabular-nums;
	}

	.subtotal-row {
		color: var(--color-text-muted);
	}

	.bonus-row {
		background: var(--color-background);
	}

	.bonus-row.achieved {
		background: var(--color-success);
		color: var(--color-surface);
	}

	.bonus-row.achieved .total-value {
		font-weight: var(--weight-black);
	}

	.bonus-hint {
		font-size: var(--text-tiny);
		color: var(--color-warning);
		margin-left: var(--space-1);
	}

	.bonus-row.achieved .bonus-hint {
		display: none;
	}

	/* Bonus Progress Bar */
	.bonus-progress {
		position: relative;
		height: 20px;
		background: var(--color-background);
		border: var(--border-thin);
		margin: var(--space-1) var(--space-2);
		overflow: hidden;
	}

	.progress-bar {
		position: absolute;
		left: 0;
		top: 0;
		height: 100%;
		background: var(--color-accent);
		transition: width var(--transition-medium);
	}

	.progress-text {
		position: absolute;
		left: 50%;
		top: 50%;
		transform: translate(-50%, -50%);
		font-size: var(--text-tiny);
		font-weight: var(--weight-bold);
		font-family: var(--font-mono);
		z-index: 1;
	}

	.section-total {
		font-weight: var(--weight-bold);
		border-top: var(--border-thin);
		margin-top: var(--space-1);
		padding-top: var(--space-2);
	}

	/* Grand Total */
	.grand-total {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: var(--space-3);
		background: var(--color-accent);
		border-top: var(--border-heavy);
	}

	.grand-label {
		font-size: var(--text-body);
		font-weight: var(--weight-black);
		text-transform: uppercase;
		letter-spacing: var(--tracking-wider);
	}

	.grand-value {
		font-family: var(--font-mono);
		font-size: var(--text-h2);
		font-weight: var(--weight-black);
		font-variant-numeric: tabular-nums;
	}
</style>
