<script lang="ts">
/**
 * ReactionBar - Emoji reaction picker
 *
 * Floating bar that appears on message hover/tap.
 * Allows users to add reactions to messages.
 * Supports rate limiting and haptic feedback.
 */
import { REACTION_EMOJIS, type ReactionEmoji } from '$lib/stores/chat.svelte';
import { haptic } from '$lib/utils/haptics';

interface Props {
	/** Callback when a reaction is selected */
	onReact: (emoji: ReactionEmoji) => void;
	/** Number of reactions sent this turn (for rate limit display) */
	reactionCount?: number;
	/** Maximum reactions per turn */
	maxReactions?: number;
	/** Whether the bar is disabled (rate limited) */
	disabled?: boolean;
}

let { onReact, reactionCount = 0, maxReactions = 3, disabled = false }: Props = $props();

// Derived: remaining reactions
const remaining = $derived(maxReactions - reactionCount);
const isLimited = $derived(remaining <= 0);

function handleReact(emoji: ReactionEmoji) {
	if (isLimited || disabled) return;
	haptic('light');
	onReact(emoji);
}
</script>

<div
	class="reaction-bar"
	class:limited={isLimited}
	class:disabled
	role="group"
	aria-label="Add reaction"
>
	{#each REACTION_EMOJIS as emoji}
		<button
			type="button"
			class="reaction-btn"
			onclick={() => handleReact(emoji)}
			aria-label="React with {emoji}"
			disabled={isLimited || disabled}
		>
			{emoji}
		</button>
	{/each}
	{#if maxReactions > 0 && reactionCount > 0}
		<span class="reaction-count" class:warning={remaining === 1}>
			{remaining}/{maxReactions}
		</span>
	{/if}
</div>

<style>
	.reaction-bar {
		position: absolute;
		top: -36px;
		right: var(--space-1);
		display: flex;
		gap: 2px;
		padding: var(--space-1);
		background: var(--color-surface);
		border: var(--border-medium);
		box-shadow: var(--shadow-brutal);
		animation: popIn var(--transition-fast) ease;
		z-index: 10;
	}

	@keyframes popIn {
		from {
			transform: scale(0.9);
			opacity: 0;
		}
	}

	.reaction-btn {
		width: 32px;
		height: 32px;
		display: flex;
		align-items: center;
		justify-content: center;
		border: none;
		background: transparent;
		cursor: pointer;
		font-size: 18px;
		transition: transform var(--transition-fast);
	}

	.reaction-btn:hover {
		transform: scale(1.2);
		background: var(--color-background);
	}

	.reaction-btn:active {
		transform: scale(1.1);
	}

	/* Touch-friendly sizing on mobile */
	@media (max-width: 768px) {
		.reaction-btn {
			width: 40px;
			height: 40px;
			font-size: 20px;
		}
	}

	/* Rate limit states */
	.reaction-bar.limited {
		opacity: 0.5;
	}

	.reaction-bar.disabled {
		pointer-events: none;
		opacity: 0.3;
	}

	.reaction-btn:disabled {
		cursor: not-allowed;
		opacity: 0.5;
	}

	.reaction-btn:disabled:hover {
		transform: none;
		background: transparent;
	}

	/* Reaction count badge */
	.reaction-count {
		font-size: var(--font-size-xs);
		color: var(--color-text-muted);
		padding: 0 var(--space-1);
		align-self: center;
	}

	.reaction-count.warning {
		color: var(--color-warning);
		font-weight: var(--font-weight-bold);
	}
</style>
