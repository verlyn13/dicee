<script lang="ts">
/**
 * ChatMessage - Individual chat message display
 *
 * Shows message content, author, timestamp, and reactions.
 * Supports text, quick chat, and system message types.
 */
import {
	type ChatMessageWithMeta,
	getChatStore,
	type ReactionEmoji,
} from '$lib/stores/chat.svelte';
import ReactionBar from './ReactionBar.svelte';

interface Props {
	/** The message to display */
	message: ChatMessageWithMeta;
	/** Whether to show the author (first in group) */
	showAuthor?: boolean;
}

let { message, showAuthor = true }: Props = $props();

const chat = getChatStore();

let showReactions = $state(false);

const isSystem = $derived(message.type === 'system');
const isQuick = $derived(message.type === 'quick');
const isPending = $derived(message.isPending ?? false);
const isFailed = $derived(message.isFailed ?? false);

const timeDisplay = $derived(formatTime(message.timestamp));
const totalReactions = $derived(
	Object.values(message.reactions).reduce((sum, arr) => sum + arr.length, 0),
);

function formatTime(timestamp: number): string {
	return new Date(timestamp).toLocaleTimeString([], {
		hour: '2-digit',
		minute: '2-digit',
	});
}

function handleReaction(emoji: ReactionEmoji): void {
	chat.toggleReaction(message.id, emoji);
	showReactions = false;
}

function handleRetry(): void {
	chat.retryMessage(message.id);
}

function handleRemove(): void {
	chat.removeFailedMessage(message.id);
}

function hasUserReacted(emoji: ReactionEmoji): boolean {
	// Check if current user has reacted with this emoji
	// The store tracks this via the reactions array containing user IDs
	return message.reactions[emoji].length > 0;
}
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="message"
	class:system={isSystem}
	class:quick={isQuick}
	class:pending={isPending}
	class:failed={isFailed}
	onmouseenter={() => (showReactions = true)}
	onmouseleave={() => (showReactions = false)}
	role="article"
	aria-label="Chat message from {message.displayName}"
>
	{#if isSystem}
		<p class="system-text">{message.content}</p>
	{:else}
		{#if showAuthor}
			<div class="message-header">
				<span class="author">{message.displayName}</span>
				<span class="time">{timeDisplay}</span>
				{#if isPending}
					<span class="status pending-status">Sending...</span>
				{/if}
			</div>
		{/if}

		<p class="content" class:quick-content={isQuick}>{message.content}</p>

		<!-- Failed message actions -->
		{#if isFailed}
			<div class="failed-actions">
				<span class="error-text">{message.errorMessage ?? 'Failed to send'}</span>
				<button type="button" class="retry-btn" onclick={handleRetry}>Retry</button>
				<button type="button" class="remove-btn" onclick={handleRemove}>Remove</button>
			</div>
		{/if}

		<!-- Reaction Summary -->
		{#if totalReactions > 0}
			<div class="reaction-summary">
				{#each Object.entries(message.reactions) as [emoji, users]}
					{#if users.length > 0}
						<button
							type="button"
							class="reaction-chip"
							class:active={hasUserReacted(emoji as ReactionEmoji)}
							onclick={() => handleReaction(emoji as ReactionEmoji)}
							title="{users.length} {emoji}"
						>
							{emoji}
							<span class="count">{users.length}</span>
						</button>
					{/if}
				{/each}
			</div>
		{/if}

		<!-- Reaction Picker (on hover/tap) -->
		{#if showReactions && !isPending && !isFailed}
			<ReactionBar onReact={handleReaction} />
		{/if}
	{/if}
</div>

<style>
	.message {
		position: relative;
		padding: var(--space-1) var(--space-2);
		margin-bottom: var(--space-1);
		background: var(--color-surface);
		border: var(--border-thin);
		animation: fadeIn var(--transition-fast) ease;
	}

	@keyframes fadeIn {
		from {
			opacity: 0;
			transform: translateY(4px);
		}
	}

	.message.system {
		background: transparent;
		border: none;
		text-align: center;
		padding: var(--space-1);
	}

	.system-text {
		font-size: var(--text-small);
		color: var(--color-text-muted);
		margin: 0;
		font-style: italic;
	}

	.message.quick {
		background: var(--color-accent-light);
		border-color: var(--color-accent);
	}

	.message.pending {
		opacity: 0.7;
	}

	.message.failed {
		border-color: var(--color-danger);
		background: rgba(239, 68, 68, 0.05);
	}

	.message-header {
		display: flex;
		align-items: baseline;
		gap: var(--space-1);
		margin-bottom: var(--space-0);
	}

	.author {
		font-weight: var(--weight-bold);
		font-size: var(--text-small);
		color: var(--color-text);
	}

	.time {
		font-size: var(--text-tiny);
		color: var(--color-text-muted);
	}

	.status {
		font-size: var(--text-tiny);
		margin-left: auto;
	}

	.pending-status {
		color: var(--color-text-muted);
	}

	.content {
		margin: 0;
		font-size: var(--text-body);
		line-height: 1.4;
		color: var(--color-text);
		word-wrap: break-word;
	}

	.quick-content {
		font-size: var(--text-h3);
	}

	.failed-actions {
		display: flex;
		align-items: center;
		gap: var(--space-1);
		margin-top: var(--space-1);
		font-size: var(--text-small);
	}

	.error-text {
		color: var(--color-danger);
		flex: 1;
	}

	.retry-btn,
	.remove-btn {
		padding: var(--space-0) var(--space-1);
		font-size: var(--text-tiny);
		font-weight: var(--weight-bold);
		text-transform: uppercase;
		background: transparent;
		border: var(--border-thin);
		cursor: pointer;
	}

	.retry-btn {
		color: var(--color-accent);
		border-color: var(--color-accent);
	}

	.remove-btn {
		color: var(--color-text-muted);
	}

	.reaction-summary {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-0);
		margin-top: var(--space-1);
	}

	.reaction-chip {
		display: flex;
		align-items: center;
		gap: 2px;
		padding: 2px var(--space-1);
		border: var(--border-thin);
		background: var(--color-background);
		font-size: var(--text-small);
		cursor: pointer;
		transition: all var(--transition-fast);
	}

	.reaction-chip:hover {
		background: var(--color-surface);
	}

	.reaction-chip.active {
		background: var(--color-accent-light);
		border-color: var(--color-accent);
	}

	.reaction-chip .count {
		font-size: var(--text-tiny);
		color: var(--color-text-muted);
	}
</style>
