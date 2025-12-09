<script lang="ts">
/**
 * PredictionResult
 *
 * Displays the results of predictions after a turn is complete.
 * Shows correct/incorrect status, points earned, and outcome details.
 */

import type { Prediction, PredictionResult } from '$lib/services/spectatorService.svelte';

interface Props {
	/** Prediction results from the server */
	results: PredictionResult[];
	/** Original predictions made by the spectator */
	predictions: Prediction[];
	/** Player name the predictions were about */
	playerName: string;
	/** Callback when results are dismissed */
	onDismiss?: () => void;
}

let { results, predictions, playerName, onDismiss }: Props = $props();

// Calculate total points earned
const totalPoints = $derived(results.reduce((sum, r) => sum + r.pointsAwarded, 0));
const correctCount = $derived(results.filter((r) => r.correct).length);

// Get prediction details for a result
function getPredictionForResult(result: PredictionResult): Prediction | undefined {
	return predictions.find((p) => p.id === result.predictionId);
}

// Get icon for prediction type
function getTypeIcon(type: string): string {
	switch (type) {
		case 'dicee':
			return '🎲';
		case 'improves':
			return '📈';
		case 'bricks':
			return '🧱';
		case 'exact':
			return '🎯';
		default:
			return '❓';
	}
}

// Auto-dismiss after 5 seconds
$effect(() => {
	if (results.length > 0 && onDismiss) {
		const timer = setTimeout(() => {
			onDismiss();
		}, 5000);

		return () => clearTimeout(timer);
	}
});
</script>

{#if results.length > 0}
	<div class="prediction-results" role="alert" aria-live="polite">
		<header class="results-header">
			<h4 class="results-title">
				{#if correctCount === results.length}
					🎉 Perfect!
				{:else if correctCount > 0}
					👍 {correctCount}/{results.length} Correct
				{:else}
					😅 Better luck next time
				{/if}
			</h4>
			{#if onDismiss}
				<button class="close-btn" onclick={onDismiss} aria-label="Close results">×</button>
			{/if}
		</header>

		<div class="results-content">
			<div class="player-outcome">
				<span class="player-name">{playerName}</span>
				{#if results[0]?.actualOutcome}
					{@const outcome = results[0].actualOutcome}
					<div class="outcome-details">
						{#if outcome.wasDicee}
							<span class="outcome-badge dicee">DICEE! 🎲🎲🎲🎲🎲</span>
						{:else if outcome.bricked}
							<span class="outcome-badge brick">Bricked</span>
						{:else if outcome.improved}
							<span class="outcome-badge improve">Improved</span>
						{/if}
						<span class="final-score">Final: {outcome.finalScore}</span>
					</div>
				{/if}
			</div>

			<ul class="results-list">
				{#each results as result (result.predictionId)}
					{@const prediction = getPredictionForResult(result)}
					<li class="result-item" class:correct={result.correct} class:incorrect={!result.correct}>
						<span class="result-icon">{result.correct ? '✅' : '❌'}</span>
						<span class="result-type">
							{#if prediction}
								{getTypeIcon(prediction.type)} {prediction.type}
								{#if prediction.type === 'exact'}
									= {prediction.exactScore}
								{/if}
							{:else}
								Unknown
							{/if}
						</span>
						{#if result.pointsAwarded > 0}
							<span class="result-points">+{result.pointsAwarded}</span>
						{/if}
					</li>
				{/each}
			</ul>

			{#if totalPoints > 0}
				<div class="total-points">
					<span class="total-label">Points Earned</span>
					<span class="total-value">+{totalPoints}</span>
				</div>
			{/if}
		</div>
	</div>
{/if}

<style>
	.prediction-results {
		background: var(--color-surface);
		border: 2px solid var(--color-accent);
		border-radius: 8px;
		overflow: hidden;
		animation: slide-in 0.3s ease-out;
	}

	@keyframes slide-in {
		from {
			transform: translateY(-10px);
			opacity: 0;
		}
		to {
			transform: translateY(0);
			opacity: 1;
		}
	}

	.results-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: var(--space-2) var(--space-3);
		background: var(--color-accent);
		color: var(--color-background);
	}

	.results-title {
		margin: 0;
		font-size: var(--text-base);
		font-weight: var(--weight-bold);
	}

	.close-btn {
		background: none;
		border: none;
		color: var(--color-background);
		font-size: var(--text-h3);
		cursor: pointer;
		padding: 0;
		line-height: 1;
		opacity: 0.8;
	}

	.close-btn:hover {
		opacity: 1;
	}

	.results-content {
		padding: var(--space-3);
	}

	.player-outcome {
		text-align: center;
		margin-bottom: var(--space-3);
	}

	.player-name {
		font-weight: var(--weight-semibold);
		font-size: var(--text-base);
	}

	.outcome-details {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-2);
		margin-top: var(--space-1);
	}

	.outcome-badge {
		padding: 2px 8px;
		border-radius: 12px;
		font-size: var(--text-tiny);
		font-weight: var(--weight-bold);
		text-transform: uppercase;
	}

	.outcome-badge.dicee {
		background: linear-gradient(135deg, #ffd700, #ff6b6b);
		color: #000;
		animation: celebrate 0.5s ease-in-out;
	}

	@keyframes celebrate {
		0%, 100% { transform: scale(1); }
		50% { transform: scale(1.1); }
	}

	.outcome-badge.brick {
		background: var(--color-error);
		color: var(--color-background);
	}

	.outcome-badge.improve {
		background: var(--color-success);
		color: var(--color-background);
	}

	.final-score {
		font-size: var(--text-small);
		color: var(--color-text-muted);
	}

	.results-list {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.result-item {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-2);
		border-radius: 4px;
		background: var(--color-background);
	}

	.result-item.correct {
		background: color-mix(in srgb, var(--color-success) 10%, var(--color-background));
	}

	.result-item.incorrect {
		background: color-mix(in srgb, var(--color-error) 5%, var(--color-background));
	}

	.result-icon {
		font-size: var(--text-base);
	}

	.result-type {
		flex: 1;
		font-size: var(--text-small);
		text-transform: capitalize;
	}

	.result-points {
		font-weight: var(--weight-bold);
		color: var(--color-success);
		font-size: var(--text-small);
	}

	.total-points {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-2);
		margin-top: var(--space-3);
		padding-top: var(--space-2);
		border-top: var(--border-thin);
	}

	.total-label {
		font-size: var(--text-small);
		color: var(--color-text-muted);
	}

	.total-value {
		font-size: var(--text-h4);
		font-weight: var(--weight-bold);
		color: var(--color-success);
	}
</style>
