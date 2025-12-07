<script lang="ts">
/**
 * ChatPanel - Main chat container
 *
 * Responsive chat panel that works as:
 * - Mobile: Collapsible bottom sheet
 * - Desktop: Fixed-width sidebar
 *
 * Contains message list, typing indicator, quick chat, and input.
 */
import { getChatStore } from '$lib/stores/chat.svelte';
import ChatInput from './ChatInput.svelte';
import ChatMessage from './ChatMessage.svelte';
import QuickChatBar from './QuickChatBar.svelte';
import TypingIndicator from './TypingIndicator.svelte';

interface Props {
	/** Whether the panel is collapsed (mobile only) */
	collapsed?: boolean;
	/** Callback when toggle button is clicked */
	onToggle?: () => void;
}

let { collapsed = false, onToggle }: Props = $props();

const chat = getChatStore();

let messagesContainer: HTMLDivElement | undefined = $state();

// Auto-scroll to bottom when new messages arrive
$effect(() => {
	// Trigger on messageGroups change
	const _groups = chat.messageGroups;
	if (messagesContainer) {
		// Defer to allow DOM update
		setTimeout(() => {
			if (messagesContainer) {
				messagesContainer.scrollTop = messagesContainer.scrollHeight;
			}
		}, 0);
	}
});
</script>

<div class="chat-panel" class:collapsed>
	<!-- Header (mobile toggle) -->
	<button
		type="button"
		class="chat-header"
		onclick={onToggle}
		aria-expanded={!collapsed}
	>
		<span class="chat-title">💬 CHAT</span>
		{#if collapsed && chat.hasUnread}
			<span class="unread-badge">{chat.unreadCount}</span>
		{/if}
		<span class="toggle-icon">{collapsed ? '▲' : '▼'}</span>
	</button>

	{#if !collapsed}
		<div class="chat-body">
			<!-- Messages -->
			<div bind:this={messagesContainer} class="messages-container">
				{#if chat.messageGroups.length === 0}
					<p class="empty-state">No messages yet. Say hello! 👋</p>
				{:else}
					{#each chat.messageGroups as group (group.timestamp + group.userId)}
						{#each group.messages as message, i (message.id)}
							<ChatMessage {message} showAuthor={i === 0} />
						{/each}
					{/each}
				{/if}
			</div>

			<!-- Typing Indicator -->
			<TypingIndicator />

			<!-- Quick Chat -->
			<QuickChatBar />

			<!-- Input -->
			<ChatInput />

			<!-- Error Toast -->
			{#if chat.error}
				<div class="error-toast" role="alert">
					{chat.error.message}
				</div>
			{/if}
		</div>
	{/if}
</div>

<style>
	.chat-panel {
		display: flex;
		flex-direction: column;
		height: 100%;
		max-height: 100%;
		background: var(--color-background);
		border: var(--border-thick);
		overflow: hidden;
	}

	/* Mobile: Fixed bottom sheet */
	@media (max-width: 768px) {
		.chat-panel {
			position: fixed;
			bottom: 0;
			left: 0;
			right: 0;
			max-height: 60vh;
			border-radius: var(--radius-md) var(--radius-md) 0 0;
			z-index: var(--z-bottomsheet, 100);
			transition: transform var(--transition-medium) ease;
			box-shadow: var(--shadow-brutal-lg);
		}

		.chat-panel.collapsed {
			transform: translateY(calc(100% - 48px));
		}
	}

	.chat-header {
		display: flex;
		align-items: center;
		gap: var(--space-1);
		padding: var(--space-2);
		background: var(--color-surface);
		border: none;
		border-bottom: var(--border-thin);
		cursor: pointer;
		font-weight: var(--weight-bold);
		color: var(--color-text);
		text-transform: uppercase;
		letter-spacing: var(--tracking-wide);
		touch-action: manipulation;
	}

	.chat-title {
		flex: 1;
		text-align: left;
		font-size: var(--text-small);
	}

	.unread-badge {
		background: var(--color-accent);
		color: var(--color-surface);
		font-size: var(--text-tiny);
		font-weight: var(--weight-bold);
		padding: 2px var(--space-1);
		min-width: 20px;
		text-align: center;
	}

	.toggle-icon {
		font-size: var(--text-tiny);
		opacity: 0.6;
	}

	/* Desktop: Hide toggle */
	@media (min-width: 769px) {
		.chat-header {
			cursor: default;
		}
		.toggle-icon {
			display: none;
		}
	}

	.chat-body {
		display: flex;
		flex-direction: column;
		flex: 1;
		min-height: 0;
		padding: var(--space-2);
	}

	.messages-container {
		flex: 1;
		overflow-y: auto;
		overflow-x: hidden;
		padding: var(--space-1) 0;
		scroll-behavior: smooth;
		-webkit-overflow-scrolling: touch;
	}

	.empty-state {
		text-align: center;
		color: var(--color-text-muted);
		padding: var(--space-4);
		font-size: var(--text-body);
	}

	.error-toast {
		position: absolute;
		bottom: 80px;
		left: var(--space-2);
		right: var(--space-2);
		background: var(--color-danger);
		color: var(--color-surface);
		padding: var(--space-1) var(--space-2);
		font-size: var(--text-small);
		font-weight: var(--weight-semibold);
		animation: slideUp var(--transition-fast) ease;
	}

	@keyframes slideUp {
		from {
			transform: translateY(10px);
			opacity: 0;
		}
		to {
			transform: translateY(0);
			opacity: 1;
		}
	}
</style>
