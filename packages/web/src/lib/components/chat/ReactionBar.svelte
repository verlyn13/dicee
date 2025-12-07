<script lang="ts">
/**
 * ReactionBar - Emoji reaction picker
 *
 * Floating bar that appears on message hover/tap.
 * Allows users to add reactions to messages.
 */
import { REACTION_EMOJIS, type ReactionEmoji } from '$lib/stores/chat.svelte';

interface Props {
	/** Callback when a reaction is selected */
	onReact: (emoji: ReactionEmoji) => void;
}

let { onReact }: Props = $props();
</script>

<div class="reaction-bar" role="group" aria-label="Add reaction">
	{#each REACTION_EMOJIS as emoji}
		<button
			type="button"
			class="reaction-btn"
			onclick={() => onReact(emoji)}
			aria-label="React with {emoji}"
		>
			{emoji}
		</button>
	{/each}
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
</style>
