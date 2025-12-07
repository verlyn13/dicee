<script lang="ts">
/**
 * TypingIndicator - Shows who is typing
 *
 * Displays animated dots and formatted text showing which users
 * are currently typing in the chat.
 */
import { getChatStore } from '$lib/stores/chat.svelte';

const chat = getChatStore();
</script>

{#if chat.typingText}
	<div class="typing-indicator" aria-live="polite">
		<span class="dots">
			<span class="dot"></span>
			<span class="dot"></span>
			<span class="dot"></span>
		</span>
		<span class="text">{chat.typingText}</span>
	</div>
{/if}

<style>
	.typing-indicator {
		display: flex;
		align-items: center;
		gap: var(--space-1);
		padding: var(--space-1) 0;
		font-size: var(--text-small);
		color: var(--color-text-muted);
		animation: fadeIn var(--transition-fast) ease;
	}

	@keyframes fadeIn {
		from {
			opacity: 0;
		}
	}

	.dots {
		display: flex;
		gap: 3px;
	}

	.dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--color-text-muted);
		animation: bounce 1.4s infinite ease-in-out both;
	}

	.dot:nth-child(1) {
		animation-delay: -0.32s;
	}

	.dot:nth-child(2) {
		animation-delay: -0.16s;
	}

	@keyframes bounce {
		0%,
		80%,
		100% {
			transform: scale(0);
		}
		40% {
			transform: scale(1);
		}
	}
</style>
