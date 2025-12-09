<script lang="ts">
/**
 * ScorecardSkeleton Component
 *
 * Loading skeleton for the scorecard while game data loads.
 * Respects prefers-reduced-motion for accessibility.
 */

interface Props {
	/** Number of upper section rows to show */
	upperRows?: number;
	/** Number of lower section rows to show */
	lowerRows?: number;
}

let { upperRows = 6, lowerRows = 7 }: Props = $props();
</script>

<div class="scorecard-skeleton" aria-busy="true" aria-label="Loading scorecard">
	<!-- Header -->
	<div class="skeleton-header">
		<div class="skeleton-title shimmer"></div>
	</div>

	<!-- Upper Section -->
	<div class="skeleton-section">
		<div class="skeleton-section-header">
			<div class="skeleton-text short shimmer"></div>
		</div>
		{#each Array(upperRows) as _, i}
			<div class="skeleton-row" style="--delay: {i * 50}ms">
				<div class="skeleton-icon shimmer"></div>
				<div class="skeleton-name shimmer"></div>
				<div class="skeleton-score shimmer"></div>
			</div>
		{/each}
		<div class="skeleton-totals">
			<div class="skeleton-total-row">
				<div class="skeleton-text medium shimmer"></div>
				<div class="skeleton-value shimmer"></div>
			</div>
			<div class="skeleton-total-row">
				<div class="skeleton-text medium shimmer"></div>
				<div class="skeleton-value shimmer"></div>
			</div>
		</div>
	</div>

	<!-- Lower Section -->
	<div class="skeleton-section">
		<div class="skeleton-section-header">
			<div class="skeleton-text short shimmer"></div>
		</div>
		{#each Array(lowerRows) as _, i}
			<div class="skeleton-row" style="--delay: {(upperRows + i) * 50}ms">
				<div class="skeleton-icon shimmer"></div>
				<div class="skeleton-name shimmer"></div>
				<div class="skeleton-score shimmer"></div>
			</div>
		{/each}
		<div class="skeleton-totals">
			<div class="skeleton-total-row">
				<div class="skeleton-text medium shimmer"></div>
				<div class="skeleton-value shimmer"></div>
			</div>
		</div>
	</div>

	<!-- Grand Total -->
	<div class="skeleton-grand-total">
		<div class="skeleton-text long shimmer"></div>
		<div class="skeleton-grand-value shimmer"></div>
	</div>
</div>

<style>
	.scorecard-skeleton {
		background: var(--color-surface);
		border: var(--border-medium);
		display: flex;
		flex-direction: column;
	}

	/* Shimmer Animation */
	.shimmer {
		background: linear-gradient(
			90deg,
			var(--color-background) 0%,
			var(--color-surface) 50%,
			var(--color-background) 100%
		);
		background-size: 200% 100%;
		animation: shimmer 1.5s ease-in-out infinite;
		animation-delay: var(--delay, 0ms);
	}

	@keyframes shimmer {
		0% {
			background-position: 200% 0;
		}
		100% {
			background-position: -200% 0;
		}
	}

	/* Reduced Motion */
	@media (prefers-reduced-motion: reduce) {
		.shimmer {
			animation: none;
			background: var(--color-background);
		}
	}

	/* Header */
	.skeleton-header {
		padding: var(--space-2) var(--space-3);
		border-bottom: var(--border-thick);
		background: var(--color-background);
	}

	.skeleton-title {
		height: 24px;
		width: 120px;
		border-radius: 2px;
	}

	/* Sections */
	.skeleton-section {
		padding: var(--space-2);
		border-bottom: var(--border-medium);
	}

	.skeleton-section-header {
		padding: var(--space-1);
		margin-bottom: var(--space-1);
		border-bottom: var(--border-thin);
	}

	/* Rows */
	.skeleton-row {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-2);
		border-bottom: var(--border-thin);
	}

	.skeleton-row:last-child {
		border-bottom: none;
	}

	.skeleton-icon {
		width: 24px;
		height: 24px;
		border-radius: 2px;
		flex-shrink: 0;
	}

	.skeleton-name {
		height: 16px;
		flex: 1;
		max-width: 100px;
		border-radius: 2px;
	}

	.skeleton-score {
		width: 36px;
		height: 20px;
		border-radius: 2px;
	}

	/* Text sizes */
	.skeleton-text {
		height: 14px;
		border-radius: 2px;
	}

	.skeleton-text.short {
		width: 80px;
	}

	.skeleton-text.medium {
		width: 100px;
	}

	.skeleton-text.long {
		width: 120px;
	}

	/* Totals */
	.skeleton-totals {
		margin-top: var(--space-2);
		padding-top: var(--space-2);
		border-top: var(--border-thin);
	}

	.skeleton-total-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: var(--space-1) var(--space-2);
	}

	.skeleton-value {
		width: 40px;
		height: 18px;
		border-radius: 2px;
	}

	/* Grand Total */
	.skeleton-grand-total {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: var(--space-3);
		background: var(--color-accent);
		opacity: 0.5;
	}

	.skeleton-grand-value {
		width: 60px;
		height: 28px;
		border-radius: 2px;
	}
</style>
