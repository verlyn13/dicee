<script lang="ts">
/**
 * ChatPanel - Main chat container
 *
 * Responsive chat panel that works as:
 * - Mobile: Collapsible bottom sheet
 * - Desktop: Fixed-width sidebar
 *
 * Contains message list, typing indicator, quick chat, and input.
 *
 * Keyboard shortcuts:
 * - Escape: Close/collapse chat panel (when chat is focused)
 */
import { onMount } from 'svelte';
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
let panelElement: HTMLDivElement | undefined = $state();
let chatInputRef: { focus: () => void; blur: () => void } | undefined = $state();

// Track scroll state for scroll-to-bottom button
let isScrolledUp = $state(false);
let hasNewMessages = $state(false);

// Swipe-to-close state
let touchStartY = 0;
let touchDeltaY = $state(0);
let isSwiping = false;

// Auto-scroll to bottom when new messages arrive (if not scrolled up)
$effect(() => {
	// Trigger on messageGroups change
	const _groups = chat.messageGroups;
	if (messagesContainer) {
		if (isScrolledUp) {
			// User is scrolled up, show indicator instead
			hasNewMessages = true;
		} else {
			// Defer to allow DOM update
			setTimeout(() => {
				if (messagesContainer) {
					messagesContainer.scrollTop = messagesContainer.scrollHeight;
				}
			}, 0);
		}
	}
});

// Focus chat input when panel expands
$effect(() => {
	if (!collapsed && chatInputRef) {
		// Small delay to let the panel animation start
		setTimeout(() => chatInputRef?.focus(), 100);
	}
});

// Handle scroll events to track scroll position
function handleScroll(): void {
	if (!messagesContainer) return;
	const { scrollTop, scrollHeight, clientHeight } = messagesContainer;
	// Consider "scrolled up" if more than 100px from bottom
	isScrolledUp = scrollHeight - scrollTop - clientHeight > 100;
	if (!isScrolledUp) {
		hasNewMessages = false;
	}
}

// Scroll to bottom when button clicked
function scrollToBottom(): void {
	if (messagesContainer) {
		messagesContainer.scrollTo({ top: messagesContainer.scrollHeight, behavior: 'smooth' });
		hasNewMessages = false;
		isScrolledUp = false;
	}
}

// Handle Escape key to close chat panel
// Uses global listener to catch Escape even when focus is on non-bubbling elements
// and to properly blur input when closing
onMount(() => {
	function handleEscapeKey(e: KeyboardEvent): void {
		// Only handle Escape if chat is open and focus is within the chat panel
		if (e.key === 'Escape' && !collapsed && panelElement?.contains(document.activeElement)) {
			e.preventDefault();
			e.stopPropagation();
			onToggle?.();
			// Blur chat input to return focus to game
			chatInputRef?.blur();
		}
	}

	document.addEventListener('keydown', handleEscapeKey);
	return () => document.removeEventListener('keydown', handleEscapeKey);
});

// Swipe-to-close handlers for mobile
function handleTouchStart(e: TouchEvent): void {
	touchStartY = e.touches[0].clientY;
	touchDeltaY = 0;
	isSwiping = true;
}

function handleTouchMove(e: TouchEvent): void {
	if (!isSwiping) return;
	const delta = e.touches[0].clientY - touchStartY;

	// Only allow downward swipes
	touchDeltaY = Math.max(0, delta);

	// Apply visual feedback
	if (panelElement && touchDeltaY > 0) {
		panelElement.style.transform = `translateY(${touchDeltaY}px)`;
	}
}

function handleTouchEnd(): void {
	if (!isSwiping) return;
	isSwiping = false;

	// Reset transform
	if (panelElement) {
		panelElement.style.transform = '';
	}

	// If swiped down more than 80px, close the panel
	if (touchDeltaY > 80) {
		onToggle?.();
		chatInputRef?.blur();
	}

	touchDeltaY = 0;
}
</script>

<div
	bind:this={panelElement}
	class="chat-panel"
	class:collapsed
	role="region"
	aria-label="Chat"
>
	<!-- Header (mobile toggle with swipe-to-close) -->
	<button
		type="button"
		class="chat-header"
		onclick={onToggle}
		ontouchstart={handleTouchStart}
		ontouchmove={handleTouchMove}
		ontouchend={handleTouchEnd}
		aria-expanded={!collapsed}
		aria-controls="chat-body"
	>
		<span class="chat-title">💬 CHAT</span>
		{#if collapsed && chat.hasUnread}
			<span class="unread-badge">{chat.unreadCount}</span>
		{/if}
		<span class="toggle-icon">{collapsed ? '▲' : '▼'}</span>
		<span class="escape-hint" class:visible={!collapsed}>ESC to close</span>
	</button>

	{#if !collapsed}
		<div id="chat-body" class="chat-body">
			<!-- Messages -->
			<div
				bind:this={messagesContainer}
				class="messages-container"
				onscroll={handleScroll}
			>
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

			<!-- Scroll to bottom button -->
			{#if hasNewMessages || isScrolledUp}
				<button
					type="button"
					class="scroll-bottom-btn"
					onclick={scrollToBottom}
					aria-label="Scroll to latest messages"
				>
					{#if hasNewMessages}
						<span class="new-messages-badge">New</span>
					{/if}
					↓
				</button>
			{/if}

			<!-- Typing Indicator -->
			<TypingIndicator />

			<!-- Quick Chat -->
			<QuickChatBar />

			<!-- Input -->
			<ChatInput bind:this={chatInputRef} />

			<!-- Error Toast -->
			{#if chat.error}
				<div class="error-toast" role="alert" aria-live="assertive">
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

	/* Mobile: Fixed bottom sheet with keyboard-aware layout
	 *
	 * IMPORTANT: position:fixed + bottom:0 is problematic with mobile keyboards.
	 * The keyboard pushes the visual viewport up, but fixed elements stay relative
	 * to the layout viewport (which doesn't resize).
	 *
	 * Solution: Use transform: translateY() instead of bottom for smoother animation.
	 * The keyboard.ts utility updates --keyboard-height CSS variable via VisualViewport API.
	 */
	@media (max-width: 768px) {
		.chat-panel {
			position: fixed;
			bottom: 0;
			left: 0;
			right: 0;
			/* Use transform for smoother animation (GPU accelerated) */
			transform: translateY(calc(-1 * var(--keyboard-height, 0px)));
			/* Dynamic max-height based on available space */
			max-height: min(60svh, calc(100svh - var(--keyboard-height, 0px) - 80px));
			border-radius: var(--radius-md) var(--radius-md) 0 0;
			z-index: var(--z-bottomsheet);
			transition:
				transform var(--transition-medium) ease,
				max-height var(--transition-medium) ease;
			box-shadow: var(--shadow-brutal-lg);
			/* Safe area for notched devices (home indicator) */
			padding-bottom: env(safe-area-inset-bottom, 0px);
			/* GPU acceleration hint */
			will-change: transform, max-height;
		}

		.chat-panel.collapsed {
			transform: translateY(calc(100% - 48px));
		}

		/* When keyboard open AND collapsed, account for keyboard offset */
		:global(html.keyboard-open) .chat-panel.collapsed {
			transform: translateY(calc(100% - 48px - var(--keyboard-height, 0px)));
		}

		/* When keyboard is open, reduce max-height to leave room for game view */
		:global(html.keyboard-open) .chat-panel {
			max-height: min(45svh, calc(100svh - var(--keyboard-height, 0px) - 60px));
		}

		/* Reduce messages container when keyboard is open */
		:global(html.keyboard-open) .messages-container {
			max-height: 100px;
			min-height: 60px;
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
		/* Allow vertical touch gestures for swipe-to-close */
		touch-action: pan-y;
		/* Prevent text selection during swipe */
		user-select: none;
		-webkit-user-select: none;
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

	/* Escape hint */
	.escape-hint {
		font-size: var(--text-tiny);
		font-weight: var(--weight-normal);
		color: var(--color-text-muted);
		opacity: 0;
		transition: opacity var(--transition-fast);
		margin-left: auto;
		padding-right: var(--space-1);
	}

	.escape-hint.visible {
		opacity: 0.6;
	}

	/* Hide escape hint on mobile (no physical keyboard) */
	@media (max-width: 768px) {
		.escape-hint {
			display: none;
		}
	}

	/* Scroll to bottom button */
	.scroll-bottom-btn {
		position: absolute;
		bottom: 120px;
		right: var(--space-2);
		width: 36px;
		height: 36px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--color-surface);
		border: var(--border-medium);
		font-size: var(--text-body);
		cursor: pointer;
		z-index: 10;
		transition: all var(--transition-fast);
		box-shadow: var(--shadow-brutal);
	}

	.scroll-bottom-btn:hover {
		background: var(--color-accent-light);
		transform: translateY(-2px);
	}

	.scroll-bottom-btn:active {
		transform: translateY(0);
	}

	.new-messages-badge {
		position: absolute;
		top: -8px;
		left: -8px;
		background: var(--color-accent);
		color: var(--color-surface);
		font-size: 10px;
		font-weight: var(--weight-bold);
		padding: 2px 4px;
		text-transform: uppercase;
		letter-spacing: var(--tracking-wide);
	}
</style>
