<script lang="ts">
/**
 * Game Over Modal Component
 * Displays final score breakdown and play again option
 */

interface Props {
	upperSubtotal: number;
	upperBonus: number;
	lowerTotal: number;
	grandTotal: number;
	onPlayAgain: () => void;
}

let { upperSubtotal, upperBonus, lowerTotal, grandTotal, onPlayAgain }: Props = $props();
</script>

<div class="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="game-over-title">
	<div class="modal-content">
		<h2 id="game-over-title">Game Complete!</h2>

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

		<button class="play-again-btn" onclick={onPlayAgain}>Play Again</button>
	</div>
</div>

<style>
	.modal-overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.7);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 100;
		padding: var(--space-2);
	}

	.modal-content {
		text-align: center;
		padding: var(--space-4);
		background: var(--color-surface);
		border: var(--border-thick);
		max-width: 400px;
		width: 100%;
		animation: modal-enter 0.3s ease-out;
	}

	@keyframes modal-enter {
		from {
			opacity: 0;
			transform: scale(0.95) translateY(10px);
		}
		to {
			opacity: 1;
			transform: scale(1) translateY(0);
		}
	}

	.modal-content h2 {
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

	.play-again-btn:focus-visible {
		outline: 2px solid var(--color-focus);
		outline-offset: 2px;
	}
</style>
