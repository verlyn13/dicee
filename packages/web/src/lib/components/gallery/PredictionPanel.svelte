<script lang="ts">
/**
 * PredictionPanel
 *
 * Gallery prediction interface for spectators.
 * Allows spectators to make predictions about the current player's turn.
 */

import {
	type Prediction,
	type PredictionStats,
	type PredictionType,
	spectatorService,
} from '$lib/services/spectatorService.svelte';
import type { RoomPlayer } from '$lib/types/multiplayer';

interface Props {
	/** Current player whose turn it is */
	currentPlayer: RoomPlayer | null;
	/** Whether predictions are open for this turn */
	predictionsOpen?: boolean;
}

let { currentPlayer, predictionsOpen = false }: Props = $props();

// Local state
let exactScoreInput = $state<number>(0);
let showExactInput = $state(false);

// Derived state from service
const predictions = $derived(spectatorService.predictions);
const stats = $derived(spectatorService.predictionStats);
const canPredict = $derived(spectatorService.canMakePrediction && predictionsOpen);

// Check if a prediction type has already been made
function hasPrediction(type: PredictionType): boolean {
	return predictions.some((p) => p.type === type);
}

// Prediction type descriptions
const PREDICTION_TYPES: {
	type: PredictionType;
	label: string;
	icon: string;
	points: number;
	description: string;
}[] = [
	{ type: 'dicee', label: 'Dicee!', icon: '🎲', points: 50, description: '5 of a kind' },
	{ type: 'improves', label: 'Improves', icon: '📈', points: 10, description: 'Gets a good score' },
	{ type: 'bricks', label: 'Bricks', icon: '🧱', points: 10, description: 'Gets nothing' },
	{ type: 'exact', label: 'Exact', icon: '🎯', points: 25, description: 'Predict the exact score' },
];

function handlePrediction(type: PredictionType) {
	if (!canPredict || !currentPlayer) return;

	if (type === 'exact') {
		if (showExactInput) {
			// Submit exact prediction
			spectatorService.makePrediction(currentPlayer.id, type, exactScoreInput);
			showExactInput = false;
			exactScoreInput = 0;
		} else {
			// Show exact score input
			showExactInput = true;
		}
	} else {
		spectatorService.makePrediction(currentPlayer.id, type);
	}
}

function handleCancelPrediction(predictionId: string) {
	spectatorService.cancelPrediction(predictionId);
}

function cancelExactInput() {
	showExactInput = false;
	exactScoreInput = 0;
}
</script>

<div class="prediction-panel">
	<header class="panel-header">
		<h3 class="panel-title">
			<span class="title-icon">🔮</span>
			Make a Prediction
		</h3>
		{#if stats}
			<div class="stats-badge">
				<span class="points">{stats.totalPoints} pts</span>
				{#if stats.streak > 0}
					<span class="streak">🔥 {stats.streak}</span>
				{/if}
			</div>
		{/if}
	</header>

	<div class="panel-content">
		{#if !predictionsOpen}
			<div class="waiting-state">
				<span class="waiting-icon">⏳</span>
				<span class="waiting-text">Waiting for next turn...</span>
			</div>
		{:else if !currentPlayer}
			<div class="waiting-state">
				<span class="waiting-icon">👀</span>
				<span class="waiting-text">No active player</span>
			</div>
		{:else}
			<div class="current-player">
				Predicting for: <strong>{currentPlayer.displayName}</strong>
			</div>

			<!-- Active predictions -->
			{#if predictions.length > 0}
				<div class="active-predictions">
					<h4 class="section-title">Your Predictions</h4>
					<div class="prediction-list">
						{#each predictions as prediction (prediction.id)}
							<div class="prediction-chip">
								<span class="chip-type">{PREDICTION_TYPES.find(t => t.type === prediction.type)?.icon}</span>
								<span class="chip-label">{prediction.type}</span>
								{#if prediction.type === 'exact'}
									<span class="chip-value">= {prediction.exactScore}</span>
								{/if}
								<button
									class="chip-cancel"
									onclick={() => handleCancelPrediction(prediction.id)}
									aria-label="Cancel prediction"
								>
									×
								</button>
							</div>
						{/each}
					</div>
				</div>
			{/if}

			<!-- Prediction buttons -->
			<div class="prediction-buttons">
				{#each PREDICTION_TYPES as { type, label, icon, points, description }}
					{@const alreadyPredicted = hasPrediction(type)}
					<button
						class="prediction-btn"
						class:predicted={alreadyPredicted}
						class:active={type === 'exact' && showExactInput}
						disabled={!canPredict || alreadyPredicted || predictions.length >= 3}
						onclick={() => handlePrediction(type)}
						title={description}
					>
						<span class="btn-icon">{icon}</span>
						<span class="btn-label">{label}</span>
						<span class="btn-points">+{points}</span>
					</button>
				{/each}
			</div>

			<!-- Exact score input -->
			{#if showExactInput}
				<div class="exact-input-row">
					<label for="exact-score">Score:</label>
					<input
						id="exact-score"
						type="number"
						min="0"
						max="50"
						bind:value={exactScoreInput}
						class="exact-input"
					/>
					<button class="submit-exact" onclick={() => handlePrediction('exact')}>
						Submit
					</button>
					<button class="cancel-exact" onclick={cancelExactInput}>
						Cancel
					</button>
				</div>
			{/if}

			<!-- Limit indicator -->
			{#if predictions.length > 0}
				<div class="limit-indicator">
					{predictions.length}/3 predictions used
				</div>
			{/if}
		{/if}
	</div>

	<!-- Stats summary -->
	{#if stats && stats.totalPredictions > 0}
		<footer class="panel-footer">
			<div class="stat-row">
				<span class="stat-label">Accuracy</span>
				<span class="stat-value">{(stats.accuracy * 100).toFixed(0)}%</span>
			</div>
			<div class="stat-row">
				<span class="stat-label">Correct</span>
				<span class="stat-value">{stats.correctPredictions}/{stats.totalPredictions}</span>
			</div>
			{#if stats.bestStreak > 0}
				<div class="stat-row">
					<span class="stat-label">Best Streak</span>
					<span class="stat-value">🔥 {stats.bestStreak}</span>
				</div>
			{/if}
		</footer>
	{/if}
</div>

<style>
	.prediction-panel {
		background: var(--color-surface);
		border: var(--border-thin);
		border-radius: 8px;
		overflow: hidden;
	}

	.panel-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: var(--space-2) var(--space-3);
		border-bottom: var(--border-thin);
		background: var(--color-background);
	}

	.panel-title {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		font-size: var(--text-base);
		font-weight: var(--weight-semibold);
		margin: 0;
	}

	.title-icon {
		font-size: var(--text-h4);
	}

	.stats-badge {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		font-size: var(--text-small);
	}

	.points {
		background: var(--color-accent);
		color: var(--color-background);
		padding: 2px 8px;
		border-radius: 12px;
		font-weight: var(--weight-semibold);
	}

	.streak {
		font-weight: var(--weight-bold);
	}

	.panel-content {
		padding: var(--space-3);
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}

	.waiting-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-4);
		color: var(--color-text-muted);
	}

	.waiting-icon {
		font-size: var(--text-h2);
	}

	.waiting-text {
		font-style: italic;
	}

	.current-player {
		text-align: center;
		font-size: var(--text-small);
		color: var(--color-text-muted);
	}

	.current-player strong {
		color: var(--color-text);
	}

	.section-title {
		font-size: var(--text-tiny);
		font-weight: var(--weight-semibold);
		color: var(--color-text-muted);
		text-transform: uppercase;
		letter-spacing: var(--tracking-wide);
		margin: 0 0 var(--space-2) 0;
	}

	.prediction-list {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
	}

	.prediction-chip {
		display: flex;
		align-items: center;
		gap: var(--space-1);
		padding: var(--space-1) var(--space-2);
		background: color-mix(in srgb, var(--color-accent) 15%, transparent);
		border: 1px solid var(--color-accent);
		border-radius: 16px;
		font-size: var(--text-small);
	}

	.chip-cancel {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 18px;
		height: 18px;
		background: none;
		border: none;
		color: var(--color-text-muted);
		cursor: pointer;
		font-size: var(--text-base);
		line-height: 1;
		padding: 0;
		margin-left: var(--space-1);
	}

	.chip-cancel:hover {
		color: var(--color-error);
	}

	.prediction-buttons {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: var(--space-2);
	}

	.prediction-btn {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-1);
		padding: var(--space-3) var(--space-2);
		background: var(--color-background);
		border: var(--border-thin);
		border-radius: 8px;
		cursor: pointer;
		transition: all var(--transition-fast);
	}

	.prediction-btn:hover:not(:disabled) {
		border-color: var(--color-accent);
		transform: translateY(-2px);
	}

	.prediction-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.prediction-btn.predicted {
		background: color-mix(in srgb, var(--color-success) 10%, var(--color-background));
		border-color: var(--color-success);
	}

	.prediction-btn.active {
		border-color: var(--color-accent);
		background: color-mix(in srgb, var(--color-accent) 10%, var(--color-background));
	}

	.btn-icon {
		font-size: var(--text-h3);
	}

	.btn-label {
		font-weight: var(--weight-semibold);
		font-size: var(--text-small);
	}

	.btn-points {
		font-size: var(--text-tiny);
		color: var(--color-success);
		font-weight: var(--weight-bold);
	}

	.exact-input-row {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-2);
		background: var(--color-background);
		border-radius: 4px;
	}

	.exact-input-row label {
		font-size: var(--text-small);
		font-weight: var(--weight-semibold);
	}

	.exact-input {
		width: 60px;
		padding: var(--space-1) var(--space-2);
		border: var(--border-thin);
		border-radius: 4px;
		font-size: var(--text-base);
		text-align: center;
	}

	.submit-exact, .cancel-exact {
		padding: var(--space-1) var(--space-2);
		border: none;
		border-radius: 4px;
		font-size: var(--text-small);
		cursor: pointer;
	}

	.submit-exact {
		background: var(--color-accent);
		color: var(--color-background);
	}

	.cancel-exact {
		background: var(--color-border);
		color: var(--color-text);
	}

	.limit-indicator {
		text-align: center;
		font-size: var(--text-tiny);
		color: var(--color-text-muted);
	}

	.panel-footer {
		padding: var(--space-2) var(--space-3);
		background: var(--color-background);
		border-top: var(--border-thin);
		display: flex;
		gap: var(--space-4);
		justify-content: center;
	}

	.stat-row {
		display: flex;
		gap: var(--space-1);
		font-size: var(--text-tiny);
	}

	.stat-label {
		color: var(--color-text-muted);
	}

	.stat-value {
		font-weight: var(--weight-semibold);
	}

	@media (max-width: 480px) {
		.prediction-buttons {
			grid-template-columns: repeat(2, 1fr);
		}
	}
</style>
