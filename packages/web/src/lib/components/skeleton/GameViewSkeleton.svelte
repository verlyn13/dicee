<script lang="ts">
/**
 * GameViewSkeleton Component
 *
 * Loading skeleton for the complete game view while game data loads.
 * Shows dice tray, scorecard, and HUD placeholders.
 * Respects prefers-reduced-motion for accessibility.
 */

import ScorecardSkeleton from './ScorecardSkeleton.svelte';
</script>

<div class="game-view-skeleton" aria-busy="true" aria-label="Loading game">
	<!-- Main Game Area -->
	<div class="game-area">
		<!-- Dice Tray Skeleton -->
		<div class="dice-tray-skeleton">
			<div class="tray-surface">
				<!-- Dice Grid -->
				<div class="dice-grid">
					{#each Array(5) as _, i}
						<div class="die-skeleton shimmer" style="--delay: {i * 75}ms"></div>
					{/each}
				</div>

				<!-- Roll Button -->
				<div class="roll-button-skeleton shimmer" style="--delay: 400ms"></div>

				<!-- Quick Actions -->
				<div class="quick-actions-skeleton">
					<div class="quick-btn-skeleton shimmer" style="--delay: 500ms"></div>
					<div class="quick-btn-skeleton shimmer" style="--delay: 550ms"></div>
				</div>
			</div>

			<!-- Roll Counter -->
			<div class="roll-counter-skeleton">
				<div class="skeleton-text short shimmer" style="--delay: 600ms"></div>
				<div class="counter-pips">
					{#each Array(3) as _, i}
						<div class="pip-skeleton shimmer" style="--delay: {650 + i * 50}ms"></div>
					{/each}
				</div>
			</div>
		</div>

		<!-- HUD Area -->
		<div class="hud-skeleton">
			<!-- Coach Panel / Analysis placeholder -->
			<div class="panel-skeleton shimmer" style="--delay: 800ms"></div>
		</div>
	</div>

	<!-- Sidebar with Scorecard -->
	<aside class="sidebar-skeleton">
		<ScorecardSkeleton />
	</aside>
</div>

<style>
	.game-view-skeleton {
		display: grid;
		grid-template-columns: 1fr 320px;
		gap: var(--space-3);
		height: 100%;
		padding: var(--space-3);
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

	/* Game Area */
	.game-area {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}

	/* Dice Tray Skeleton */
	.dice-tray-skeleton {
		background: linear-gradient(
			135deg,
			var(--color-felt) 0%,
			var(--color-felt-light) 100%
		);
		border: var(--border-thick);
		padding: var(--space-3);
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.tray-surface {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-3);
	}

	.dice-grid {
		display: flex;
		justify-content: center;
		gap: var(--space-3);
		padding-bottom: var(--space-2);
	}

	.die-skeleton {
		width: 60px;
		height: 60px;
		border: var(--border-thick);
		border-radius: 4px;
	}

	.roll-button-skeleton {
		width: 100%;
		max-width: 300px;
		height: 44px;
		border: var(--border-thick);
		border-radius: 2px;
	}

	.quick-actions-skeleton {
		display: flex;
		gap: var(--space-2);
		width: 100%;
		max-width: 300px;
	}

	.quick-btn-skeleton {
		flex: 1;
		height: 32px;
		border: var(--border-thin);
		border-radius: 2px;
	}

	.roll-counter-skeleton {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-2);
		padding-top: var(--space-2);
		border-top: 1px solid rgba(255, 255, 255, 0.2);
	}

	.counter-pips {
		display: flex;
		gap: var(--space-1);
	}

	.pip-skeleton {
		width: 12px;
		height: 12px;
		border: 2px solid rgba(255, 255, 255, 0.5);
		border-radius: 50%;
	}

	/* Text sizes */
	.skeleton-text {
		height: 14px;
		border-radius: 2px;
	}

	.skeleton-text.short {
		width: 50px;
	}

	/* HUD Skeleton */
	.hud-skeleton {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.panel-skeleton {
		height: 80px;
		border: var(--border-medium);
		border-radius: 2px;
	}

	/* Sidebar */
	.sidebar-skeleton {
		overflow-y: auto;
	}

	/* Responsive */
	@media (max-width: 900px) {
		.game-view-skeleton {
			grid-template-columns: 1fr;
			grid-template-rows: auto 1fr;
		}

		.sidebar-skeleton {
			order: -1;
			max-height: 300px;
		}
	}

	@media (max-width: 480px) {
		.dice-grid {
			display: grid;
			grid-template-columns: repeat(3, auto);
			gap: var(--space-2);
		}

		.die-skeleton {
			width: 50px;
			height: 50px;
		}
	}
</style>
