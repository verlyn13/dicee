<script lang="ts">
/**
 * QuickChatBar - Preset quick chat buttons
 *
 * Horizontally scrollable bar of 6 Yahtzee-themed quick chat presets.
 * On mobile, shows only emoji; on desktop, shows emoji + text.
 */
import { getChatStore, QUICK_CHAT_MESSAGES, type QuickChatKey } from '$lib/stores/chat.svelte';

const chat = getChatStore();

const quickChats = Object.entries(QUICK_CHAT_MESSAGES) as [
	QuickChatKey,
	{ emoji: string; text: string },
][];
</script>

<div class="quick-chat-bar">
	<div class="quick-chat-scroll">
		{#each quickChats as [key, { emoji, text }]}
			<button
				type="button"
				class="quick-chat-btn"
				onclick={() => chat.sendQuickChat(key)}
				disabled={!chat.canSendMessage}
				title={text}
				aria-label={text}
			>
				<span class="emoji">{emoji}</span>
				<span class="label">{text}</span>
			</button>
		{/each}
	</div>
</div>

<style>
	.quick-chat-bar {
		padding: var(--space-1) 0;
		border-bottom: var(--border-thin);
	}

	.quick-chat-scroll {
		display: flex;
		gap: var(--space-1);
		overflow-x: auto;
		padding-bottom: var(--space-1);
		-webkit-overflow-scrolling: touch;
		scrollbar-width: none;
	}

	.quick-chat-scroll::-webkit-scrollbar {
		display: none;
	}

	.quick-chat-btn {
		display: flex;
		align-items: center;
		gap: var(--space-1);
		padding: var(--space-1) var(--space-2);
		border: var(--border-thin);
		background: var(--color-surface);
		white-space: nowrap;
		cursor: pointer;
		transition:
			transform var(--transition-fast),
			background var(--transition-fast);
		flex-shrink: 0;
	}

	.quick-chat-btn:hover:not(:disabled) {
		background: var(--color-accent-light);
		border-color: var(--color-accent);
	}

	.quick-chat-btn:active:not(:disabled) {
		transform: scale(0.95);
	}

	.quick-chat-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.emoji {
		font-size: var(--text-body);
	}

	.label {
		font-size: var(--text-small);
		color: var(--color-text-muted);
	}

	/* Mobile: Hide labels, show only emoji */
	@media (max-width: 480px) {
		.quick-chat-btn {
			padding: var(--space-1);
		}
		.label {
			display: none;
		}
		.emoji {
			font-size: 18px;
		}
	}
</style>
