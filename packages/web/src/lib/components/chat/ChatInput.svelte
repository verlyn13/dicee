<script lang="ts">
/**
 * ChatInput - Text input with character counter
 *
 * Textarea with send button, character limit display,
 * and rate limit awareness.
 */
import { CHAT_RATE_LIMITS, getChatStore } from '$lib/stores/chat.svelte';

const chat = getChatStore();

let inputValue = $state('');
let inputElement: HTMLTextAreaElement | undefined = $state();

const charCount = $derived(inputValue.length);
const isOverLimit = $derived(charCount > CHAT_RATE_LIMITS.MAX_MESSAGE_LENGTH);
const showCharCount = $derived(charCount > CHAT_RATE_LIMITS.MAX_MESSAGE_LENGTH - 50);
const canSend = $derived(inputValue.trim().length > 0 && !isOverLimit && chat.canSendMessage);

function handleSubmit(e: Event): void {
	e.preventDefault();
	if (!canSend) return;

	chat.sendMessage(inputValue);
	inputValue = '';
	inputElement?.focus();
}

function handleKeydown(e: KeyboardEvent): void {
	if (e.key === 'Enter' && !e.shiftKey) {
		e.preventDefault();
		handleSubmit(e);
	}
}

function handleInput(): void {
	chat.setTyping(true);
}

function handleBlur(): void {
	chat.setTyping(false);
}

/**
 * Scroll input into view when focused on mobile.
 * Waits for keyboard animation to complete before scrolling.
 */
function handleFocus(): void {
	// Delay to allow keyboard animation to complete (typically 250-300ms)
	setTimeout(() => {
		inputElement?.scrollIntoView({ behavior: 'smooth', block: 'center' });
	}, 300);
}
</script>

<form class="chat-input-container" onsubmit={handleSubmit}>
	<div class="input-wrapper">
		<textarea
			bind:this={inputElement}
			bind:value={inputValue}
			oninput={handleInput}
			onkeydown={handleKeydown}
			onblur={handleBlur}
			onfocus={handleFocus}
			placeholder="Type a message..."
			rows="1"
			maxlength={CHAT_RATE_LIMITS.MAX_MESSAGE_LENGTH + 50}
			disabled={chat.sendCooldown > 0}
			aria-label="Chat message"
		></textarea>

		{#if showCharCount}
			<span class="char-count" class:over={isOverLimit}>
				{charCount}/{CHAT_RATE_LIMITS.MAX_MESSAGE_LENGTH}
			</span>
		{/if}
	</div>

	<button type="submit" class="send-btn" disabled={!canSend} aria-label="Send message">
		{#if chat.sendCooldown > 0}
			<span class="cooldown">{chat.sendCooldown}</span>
		{:else}
			<svg
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
				class="send-icon"
			>
				<line x1="22" y1="2" x2="11" y2="13" />
				<polygon points="22 2 15 22 11 13 2 9 22 2" />
			</svg>
		{/if}
	</button>
</form>

<style>
	.chat-input-container {
		display: flex;
		gap: var(--space-1);
		align-items: flex-end;
		padding-top: var(--space-2);
	}

	.input-wrapper {
		position: relative;
		flex: 1;
	}

	textarea {
		width: 100%;
		padding: var(--space-2);
		border: var(--border-medium);
		background: var(--color-surface);
		font-size: var(--text-body);
		font-family: inherit;
		line-height: 1.4;
		resize: none;
		outline: none;
		transition: border-color var(--transition-fast);
		min-height: 40px;
		max-height: 100px;
	}

	textarea:focus {
		border-color: var(--color-accent);
	}

	textarea:disabled {
		opacity: 0.6;
	}

	.char-count {
		position: absolute;
		right: var(--space-2);
		bottom: var(--space-1);
		font-size: var(--text-tiny);
		color: var(--color-text-muted);
	}

	.char-count.over {
		color: var(--color-danger);
		font-weight: var(--weight-bold);
	}

	.send-btn {
		width: 40px;
		height: 40px;
		border: var(--border-thick);
		background: var(--color-accent);
		color: var(--color-surface);
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition:
			transform var(--transition-fast),
			background var(--transition-fast);
		flex-shrink: 0;
	}

	.send-btn:hover:not(:disabled) {
		background: var(--color-accent-dark);
		transform: translate(-1px, -1px);
		box-shadow: 2px 2px 0 var(--color-border);
	}

	.send-btn:active:not(:disabled) {
		transform: translate(0, 0);
		box-shadow: none;
	}

	.send-btn:disabled {
		background: var(--color-text-muted);
		cursor: not-allowed;
	}

	.send-icon {
		width: 18px;
		height: 18px;
	}

	.cooldown {
		font-size: var(--text-small);
		font-weight: var(--weight-bold);
		font-family: var(--font-mono);
	}

	/* Touch-friendly on mobile */
	@media (max-width: 768px) {
		textarea {
			font-size: 16px; /* Prevents iOS zoom */
			padding: var(--space-2);
		}

		.send-btn {
			width: 44px;
			height: 44px;
		}
	}
</style>
