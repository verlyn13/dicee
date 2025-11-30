<script lang="ts">
interface Props {
	turnNumber: number;
	totalTurns?: number;
	grandTotal: number;
	isGameOver?: boolean;
	onNewGame?: () => void;
}

let {
	turnNumber,
	totalTurns = 13,
	grandTotal,
	isGameOver = false,
	onNewGame,
}: Props = $props();

const turnsRemaining = $derived(totalTurns - turnNumber);
</script>

<div class="game-status" class:game-over={isGameOver}>
	{#if isGameOver}
		<div class="final-score-display">
			<span class="final-label">Final Score</span>
			<span class="final-score">{grandTotal}</span>
		</div>
		{#if onNewGame}
			<button class="new-game-btn" onclick={onNewGame}>
				Play Again
			</button>
		{/if}
	{:else}
		<div class="status-row">
			<div class="status-item turn">
				<span class="status-label">Turn</span>
				<span class="status-value">{turnNumber}/{totalTurns}</span>
			</div>

			<div class="status-divider"></div>

			<div class="status-item score">
				<span class="status-label">Score</span>
				<span class="status-value">{grandTotal}</span>
			</div>

			<div class="status-divider"></div>

			<div class="status-item remaining">
				<span class="status-label">Left</span>
				<span class="status-value">{turnsRemaining}</span>
			</div>
		</div>
	{/if}
</div>

<style>
	.game-status {
		background: var(--color-surface);
		border: var(--border-medium);
		padding: var(--space-2) var(--space-3);
	}

	.game-status.game-over {
		background: var(--color-accent);
		text-align: center;
		padding: var(--space-4);
	}

	/* Status Row (during game) */
	.status-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
	}

	.status-item {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 2px;
	}

	.status-label {
		font-size: var(--text-tiny);
		font-weight: var(--weight-semibold);
		text-transform: uppercase;
		letter-spacing: var(--tracking-wider);
		color: var(--color-text-muted);
	}

	.status-value {
		font-family: var(--font-mono);
		font-size: var(--text-body);
		font-weight: var(--weight-bold);
		font-variant-numeric: tabular-nums;
	}

	.status-item.score .status-value {
		font-size: var(--text-h3);
	}

	.status-divider {
		width: 1px;
		height: 30px;
		background: var(--color-border);
		opacity: 0.3;
	}

	/* Game Over State */
	.final-score-display {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		margin-bottom: var(--space-3);
	}

	.final-label {
		font-size: var(--text-small);
		font-weight: var(--weight-bold);
		text-transform: uppercase;
		letter-spacing: var(--tracking-widest);
	}

	.final-score {
		font-family: var(--font-mono);
		font-size: var(--text-display);
		font-weight: var(--weight-black);
		font-variant-numeric: tabular-nums;
	}

	.new-game-btn {
		padding: var(--space-2) var(--space-4);
		font-size: var(--text-body);
		font-weight: var(--weight-bold);
		text-transform: uppercase;
		letter-spacing: var(--tracking-wide);
		background: var(--color-surface);
		border: var(--border-thick);
		cursor: pointer;
		transition:
			transform var(--transition-fast),
			background var(--transition-fast);
	}

	.new-game-btn:hover {
		transform: translateY(-2px);
		background: var(--color-background);
	}

	.new-game-btn:active {
		transform: translateY(0);
	}

	/* Responsive */
	@media (max-width: 480px) {
		.game-status {
			padding: var(--space-2);
		}

		.status-row {
			gap: var(--space-2);
		}

		.status-value {
			font-size: var(--text-small);
		}

		.status-item.score .status-value {
			font-size: var(--text-body);
		}

		.final-score {
			font-size: var(--text-h1);
		}
	}
</style>
