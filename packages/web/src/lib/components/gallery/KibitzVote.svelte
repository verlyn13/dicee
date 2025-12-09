<!--
  KibitzVote.svelte - Single vote option display

  Shows a voting option with:
  - Option label (category name, keep pattern, or action)
  - Vote count and percentage bar
  - Voter preview (first 3 voters)
  - Selected state indicator
-->
<script lang="ts">
import type { KibitzOption } from '$lib/services/spectatorService.svelte';

interface Props {
	option: KibitzOption;
	isSelected?: boolean;
	isLeading?: boolean;
	onVote?: (optionId: string) => void;
	disabled?: boolean;
}

let { option, isSelected = false, isLeading = false, onVote, disabled = false }: Props = $props();

function handleClick() {
	if (!disabled && onVote) {
		onVote(option.optionId);
	}
}

function handleKeyDown(event: KeyboardEvent) {
	if (event.key === 'Enter' || event.key === ' ') {
		event.preventDefault();
		handleClick();
	}
}

const voterText = $derived(() => {
	if (option.voterPreview.length === 0) return '';
	if (option.voterPreview.length === 1) return option.voterPreview[0];
	if (option.voterPreview.length === 2) {
		return `${option.voterPreview[0]} and ${option.voterPreview[1]}`;
	}
	const othersCount = option.voteCount - 3;
	if (othersCount > 0) {
		return `${option.voterPreview.join(', ')} +${othersCount} more`;
	}
	return option.voterPreview.join(', ');
});
</script>

<button
	type="button"
	class="kibitz-vote"
	class:selected={isSelected}
	class:leading={isLeading}
	class:disabled
	onclick={handleClick}
	onkeydown={handleKeyDown}
	{disabled}
	aria-pressed={isSelected}
	aria-label={`Vote for ${option.label}, ${option.voteCount} votes, ${option.percentage}%`}
>
	<div class="vote-content">
		<span class="vote-label">{option.label}</span>
		<span class="vote-count">
			{option.voteCount}
			{#if isLeading && option.voteCount > 0}
				<span class="leading-badge">Leading</span>
			{/if}
		</span>
	</div>

	<div class="vote-bar-container" role="progressbar" aria-valuenow={option.percentage} aria-valuemin={0} aria-valuemax={100}>
		<div class="vote-bar" style="width: {option.percentage}%"></div>
	</div>

	{#if option.voterPreview.length > 0}
		<div class="voter-preview">
			<span class="voter-text">{voterText()}</span>
		</div>
	{/if}
</button>

<style>
	.kibitz-vote {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
		padding: 0.625rem 0.75rem;
		background: var(--color-surface-2, #1a1a2e);
		border: 1px solid var(--color-border, #333);
		border-radius: 0.5rem;
		cursor: pointer;
		transition: all 0.15s ease;
		text-align: left;
		width: 100%;
	}

	.kibitz-vote:hover:not(.disabled) {
		background: var(--color-surface-3, #242444);
		border-color: var(--color-primary, #6366f1);
	}

	.kibitz-vote:focus-visible {
		outline: 2px solid var(--color-primary, #6366f1);
		outline-offset: 2px;
	}

	.kibitz-vote.selected {
		background: var(--color-primary-alpha, rgba(99, 102, 241, 0.15));
		border-color: var(--color-primary, #6366f1);
	}

	.kibitz-vote.leading {
		border-color: var(--color-success, #10b981);
	}

	.kibitz-vote.disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.vote-content {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 0.5rem;
	}

	.vote-label {
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--color-text, #f0f0f0);
		flex: 1;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.vote-count {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		font-size: 0.75rem;
		color: var(--color-text-secondary, #a0a0a0);
		font-weight: 600;
	}

	.leading-badge {
		font-size: 0.625rem;
		padding: 0.125rem 0.375rem;
		background: var(--color-success, #10b981);
		color: white;
		border-radius: 0.25rem;
		text-transform: uppercase;
		letter-spacing: 0.025em;
	}

	.vote-bar-container {
		height: 4px;
		background: var(--color-surface-4, #333);
		border-radius: 2px;
		overflow: hidden;
	}

	.vote-bar {
		height: 100%;
		background: var(--color-primary, #6366f1);
		border-radius: 2px;
		transition: width 0.3s ease;
	}

	.kibitz-vote.leading .vote-bar {
		background: var(--color-success, #10b981);
	}

	.voter-preview {
		padding-top: 0.125rem;
	}

	.voter-text {
		font-size: 0.6875rem;
		color: var(--color-text-tertiary, #666);
		font-style: italic;
	}
</style>
