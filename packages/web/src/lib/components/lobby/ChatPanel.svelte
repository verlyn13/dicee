<script lang="ts">
/**
 * ChatPanel - Global lobby chat interface
 *
 * Shows chat messages with auto-scroll and input field.
 * Uses monospace terminal aesthetic.
 */

import { onMount } from 'svelte';
import { lobby } from '$lib/stores/lobby.svelte';

let inputValue = $state('');
let chatContainer: HTMLElement | undefined;
let inputElement: HTMLInputElement | undefined;

// Auto-scroll to bottom on new messages
$effect(() => {
	if (lobby.messages.length > 0 && chatContainer) {
		// Wait for DOM update
		requestAnimationFrame(() => {
			if (chatContainer) {
				chatContainer.scrollTop = chatContainer.scrollHeight;
			}
		});
	}
});

// Focus input when switching to chat tab
$effect(() => {
	if (lobby.activeTab === 'chat' && inputElement) {
		inputElement.focus();
	}
});

function handleSubmit(event: Event) {
	event.preventDefault();
	if (inputValue.trim()) {
		lobby.sendChat(inputValue.trim());
		inputValue = '';
	}
}

function formatTime(timestamp: number): string {
	const date = new Date(timestamp);
	return date.toLocaleTimeString('en-US', {
		hour: '2-digit',
		minute: '2-digit',
		hour12: false,
	});
}
</script>

<div class="chat-panel">
	<div class="chat-messages" bind:this={chatContainer}>
		{#if lobby.messages.length === 0}
			<div class="chat-empty">
				<span class="system-msg">[SYS] No messages yet. Say hello!</span>
			</div>
		{:else}
			{#each lobby.messages as msg (msg.id)}
				<div class="chat-message" class:system={msg.type === 'system'} class:self={msg.userId === 'self'}>
					<span class="msg-time">{formatTime(msg.timestamp)}</span>
					<span class="msg-user" class:system-user={msg.type === 'system'}>
						{msg.type === 'system' ? '[SYS]' : `${msg.username}:`}
					</span>
					<span class="msg-content">{msg.content}</span>
				</div>
			{/each}
		{/if}
	</div>

	<form class="chat-input-form" onsubmit={handleSubmit}>
		<input
			type="text"
			bind:value={inputValue}
			bind:this={inputElement}
			placeholder="Type a message..."
			maxlength="500"
			class="chat-input"
			disabled={lobby.connectionState !== 'connected'}
		/>
		<button
			type="submit"
			class="chat-send"
			disabled={!inputValue.trim() || lobby.connectionState !== 'connected'}
		>
			SEND
		</button>
	</form>
</div>

<style>
	.chat-panel {
		display: flex;
		flex-direction: column;
		height: 100%;
		background: var(--color-surface);
		border: var(--border-thick);
	}

	.chat-messages {
		flex: 1;
		overflow-y: auto;
		padding: var(--space-2);
		font-family: var(--font-mono);
		font-size: var(--text-small);
		line-height: 1.4;
		background: var(--color-text);
		color: var(--color-surface);
	}

	.chat-empty {
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.chat-message {
		margin-bottom: 0.25rem;
		word-break: break-word;
	}

	.chat-message.self {
		opacity: 0.7;
	}

	.msg-time {
		color: var(--color-signal-muted);
		margin-right: 0.5rem;
	}

	.msg-user {
		font-weight: var(--weight-bold);
		color: var(--color-accent);
		margin-right: 0.5rem;
		text-transform: lowercase;
	}

	.msg-user.system-user {
		color: var(--color-signal-sys);
	}

	.msg-content {
		color: var(--color-surface);
	}

	.system-msg {
		color: var(--color-signal-muted);
		font-style: italic;
	}

	.chat-input-form {
		display: flex;
		border-top: var(--border-medium);
	}

	.chat-input {
		flex: 1;
		padding: var(--space-2);
		font-family: var(--font-mono);
		font-size: var(--text-body);
		border: none;
		background: var(--color-background);
		color: var(--color-text);
	}

	.chat-input::placeholder {
		color: var(--color-signal-muted);
	}

	.chat-input:focus {
		outline: none;
		background: var(--color-surface);
	}

	.chat-input:disabled {
		opacity: 0.5;
	}

	.chat-send {
		padding: var(--space-2) var(--space-3);
		background: var(--color-text);
		color: var(--color-surface);
		font-family: var(--font-mono);
		font-weight: var(--weight-bold);
		border: none;
		cursor: pointer;
		transition: background var(--transition-fast);
	}

	.chat-send:hover:not(:disabled) {
		background: var(--color-accent);
		color: var(--color-text);
	}

	.chat-send:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
</style>
