<script lang="ts">
import { type CoachFeedback, coach } from '$lib/stores/coach.svelte.js';
import type { Category, KeepRecommendation, TurnAnalysis } from '$lib/types.js';
import { CATEGORY_DISPLAY_NAMES } from '$lib/types.js';

interface Props {
	/** Current turn analysis from the engine */
	analysis?: TurnAnalysis;
	/** Current dice values for keep display */
	dice?: [number, number, number, number, number];
	/** Rolls remaining */
	rollsRemaining?: number;
	/** Callback when user dismisses feedback */
	onDismiss?: () => void;
}

let { analysis, dice = [1, 1, 1, 1, 1], rollsRemaining = 3, onDismiss }: Props = $props();

// Die faces for display
const DIE_FACES = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'] as const;

// Format keep pattern as dice faces
function formatKeepPattern(pattern: [number, number, number, number, number, number]): string {
	const faces: string[] = [];
	for (let i = 0; i < 6; i++) {
		for (let j = 0; j < pattern[i]; j++) {
			faces.push(DIE_FACES[i]);
		}
	}
	return faces.length > 0 ? faces.join('') : 'Roll all';
}

// Generate suggestion message based on analysis
const suggestionMessage = $derived.by(() => {
	if (!analysis || !coach.showSuggestions) return null;

	if (analysis.action === 'score' && analysis.recommendedCategory) {
		const catName = CATEGORY_DISPLAY_NAMES[analysis.recommendedCategory];
		const score = analysis.categoryScore ?? 0;
		return {
			type: 'score' as const,
			primary: `Score ${catName}`,
			secondary: `for ${score} points`,
			ev: analysis.expectedValue,
		};
	}

	if (analysis.action === 'reroll' && analysis.keepRecommendation) {
		const keepDisplay = formatKeepPattern(analysis.keepRecommendation.keepPattern);
		return {
			type: 'reroll' as const,
			primary: `Keep ${keepDisplay}`,
			secondary: analysis.keepRecommendation.explanation,
			ev: analysis.expectedValue,
		};
	}

	return null;
});

// Show panel only when coach mode is active and there's something to show
const showPanel = $derived(
	coach.isActive && (suggestionMessage !== null || coach.lastFeedback !== null),
);

// Feedback type styling
function getFeedbackClass(type: CoachFeedback['type']): string {
	switch (type) {
		case 'optimal':
			return 'feedback-optimal';
		case 'suboptimal':
			return 'feedback-suboptimal';
		case 'warning':
			return 'feedback-warning';
		default:
			return 'feedback-info';
	}
}

function handleDismiss() {
	coach.clearFeedback();
	onDismiss?.();
}
</script>

{#if showPanel}
	<div class="coach-panel" role="status" aria-live="polite">
		<!-- Feedback Message (if any) -->
		{#if coach.lastFeedback}
			<div class="feedback {getFeedbackClass(coach.lastFeedback.type)}">
				<span class="feedback-icon">
					{#if coach.lastFeedback.type === 'optimal'}✓
					{:else if coach.lastFeedback.type === 'suboptimal'}↓
					{:else if coach.lastFeedback.type === 'warning'}⚠
					{:else}ℹ
					{/if}
				</span>
				<span class="feedback-message">{coach.lastFeedback.message}</span>
				{#if coach.lastFeedback.evLoss}
					<span class="feedback-ev-loss">-{coach.lastFeedback.evLoss.toFixed(1)} EV</span>
				{/if}
				<button class="dismiss-btn" onclick={handleDismiss} aria-label="Dismiss">×</button>
			</div>
		{/if}

		<!-- Suggestion (coach/training mode) -->
		{#if suggestionMessage && !coach.lastFeedback}
			<div class="suggestion">
				<div class="suggestion-header">
					<span class="suggestion-icon">🎯</span>
					<span class="suggestion-label">Suggested</span>
				</div>
				<div class="suggestion-content">
					<span class="suggestion-primary">{suggestionMessage.primary}</span>
					{#if suggestionMessage.secondary}
						<span class="suggestion-secondary">{suggestionMessage.secondary}</span>
					{/if}
				</div>
				<div class="suggestion-ev">
					EV: {suggestionMessage.ev.toFixed(1)}
				</div>
			</div>
		{/if}
	</div>
{/if}

<!-- Training Mode Confirmation Modal -->
{#if coach.showConfirmModal && coach.pendingDecision}
	<div class="modal-backdrop" role="presentation">
		<div class="confirm-modal" role="alertdialog" aria-labelledby="confirm-title">
			<h3 id="confirm-title" class="modal-title">
				{#if coach.pendingDecision.type === 'score'}
					Suboptimal Score
				{:else}
					Suboptimal Reroll
				{/if}
			</h3>
			<p class="modal-message">
				{#if coach.pendingDecision.explanation}
					{coach.pendingDecision.explanation}
				{:else}
					This isn't the optimal play. You'll lose approximately
					<strong>{(coach.pendingDecision.optimalEV - coach.pendingDecision.chosenEV).toFixed(1)}</strong>
					expected value.
				{/if}
			</p>
			<div class="modal-ev-comparison">
				<div class="ev-item">
					<span class="ev-label">Your choice:</span>
					<span class="ev-value">{coach.pendingDecision.chosenEV.toFixed(1)}</span>
				</div>
				<div class="ev-item optimal">
					<span class="ev-label">Optimal:</span>
					<span class="ev-value">{coach.pendingDecision.optimalEV.toFixed(1)}</span>
				</div>
			</div>
			<div class="modal-actions">
				<button class="btn btn-secondary" onclick={() => coach.cancelDecision()}>
					Let me reconsider
				</button>
				<button class="btn btn-primary" onclick={() => coach.confirmDecision()}>
					Proceed anyway
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.coach-panel {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		padding: var(--space-2) var(--space-3);
		background: var(--color-surface);
		border: var(--border-thin);
		font-size: var(--text-small);
	}

	/* Feedback Styles */
	.feedback {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-2);
		border-radius: 2px;
	}

	.feedback-optimal {
		background: color-mix(in srgb, var(--color-success) 15%, transparent);
		border-left: 3px solid var(--color-success);
	}

	.feedback-suboptimal {
		background: color-mix(in srgb, var(--color-warning) 15%, transparent);
		border-left: 3px solid var(--color-warning);
	}

	.feedback-warning {
		background: color-mix(in srgb, var(--color-error) 15%, transparent);
		border-left: 3px solid var(--color-error);
	}

	.feedback-info {
		background: color-mix(in srgb, var(--color-accent) 15%, transparent);
		border-left: 3px solid var(--color-accent);
	}

	.feedback-icon {
		font-weight: var(--weight-bold);
		width: 1.5em;
		text-align: center;
	}

	.feedback-optimal .feedback-icon {
		color: var(--color-success);
	}

	.feedback-suboptimal .feedback-icon {
		color: var(--color-warning);
	}

	.feedback-warning .feedback-icon {
		color: var(--color-error);
	}

	.feedback-message {
		flex: 1;
	}

	.feedback-ev-loss {
		font-family: var(--font-mono);
		font-weight: var(--weight-semibold);
		color: var(--color-error);
	}

	.dismiss-btn {
		padding: 0 var(--space-1);
		background: none;
		border: none;
		font-size: var(--text-body);
		color: var(--color-text-muted);
		cursor: pointer;
		opacity: 0.7;
	}

	.dismiss-btn:hover {
		opacity: 1;
	}

	/* Suggestion Styles */
	.suggestion {
		display: flex;
		align-items: center;
		gap: var(--space-3);
	}

	.suggestion-header {
		display: flex;
		align-items: center;
		gap: var(--space-1);
	}

	.suggestion-icon {
		font-size: var(--text-body);
	}

	.suggestion-label {
		font-weight: var(--weight-semibold);
		color: var(--color-text-muted);
		text-transform: uppercase;
		letter-spacing: var(--tracking-wide);
		font-size: var(--text-tiny);
	}

	.suggestion-content {
		flex: 1;
		display: flex;
		flex-direction: column;
	}

	.suggestion-primary {
		font-weight: var(--weight-bold);
		font-size: var(--text-body);
	}

	.suggestion-secondary {
		color: var(--color-text-muted);
		font-size: var(--text-small);
	}

	.suggestion-ev {
		font-family: var(--font-mono);
		font-size: var(--text-small);
		color: var(--color-success);
	}

	/* Confirmation Modal */
	.modal-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.7);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 100;
	}

	.confirm-modal {
		background: var(--color-surface);
		border: var(--border-thick);
		padding: var(--space-4);
		max-width: 400px;
		width: 90%;
	}

	.modal-title {
		font-size: var(--text-h3);
		font-weight: var(--weight-bold);
		margin-bottom: var(--space-2);
		color: var(--color-warning);
	}

	.modal-message {
		color: var(--color-text-muted);
		margin-bottom: var(--space-3);
	}

	.modal-ev-comparison {
		display: flex;
		gap: var(--space-4);
		margin-bottom: var(--space-4);
		padding: var(--space-2);
		background: var(--color-background);
	}

	.ev-item {
		display: flex;
		flex-direction: column;
	}

	.ev-label {
		font-size: var(--text-tiny);
		color: var(--color-text-muted);
		text-transform: uppercase;
	}

	.ev-value {
		font-family: var(--font-mono);
		font-size: var(--text-h3);
		font-weight: var(--weight-bold);
	}

	.ev-item.optimal .ev-value {
		color: var(--color-success);
	}

	.modal-actions {
		display: flex;
		gap: var(--space-2);
		justify-content: flex-end;
	}

	.btn {
		padding: var(--space-2) var(--space-3);
		font-weight: var(--weight-semibold);
		border: var(--border-thin);
		cursor: pointer;
		transition: background var(--transition-fast);
	}

	.btn-secondary {
		background: transparent;
	}

	.btn-secondary:hover {
		background: var(--color-background);
	}

	.btn-primary {
		background: var(--color-accent);
	}

	.btn-primary:hover {
		background: var(--color-accent-dark);
	}

	/* Responsive */
	@media (max-width: 480px) {
		.suggestion {
			flex-direction: column;
			align-items: flex-start;
			gap: var(--space-1);
		}

		.modal-actions {
			flex-direction: column;
		}

		.btn {
			width: 100%;
		}
	}
</style>
