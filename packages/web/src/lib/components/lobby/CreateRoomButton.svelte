<script lang="ts">
/**
 * CreateRoomButton - Creates a new multiplayer room
 *
 * Mobile-first, Neo-Brutalist design matching PlayNowButton.
 * Requires authenticated user with valid session token.
 */
import { auth } from '$lib/stores/auth.svelte';
import { getRoomStore } from '$lib/stores/room.svelte';

interface Props {
	/** Callback when room is created successfully */
	onCreated?: (roomCode: string) => void;
	/** Additional CSS classes */
	class?: string;
}

let { onCreated, class: className = '' }: Props = $props();

const room = getRoomStore();

let loading = $state(false);
let error = $state<string | null>(null);
let createdCode = $state<string | null>(null);

async function handleClick() {
	if (!auth.session?.access_token) {
		error = 'You must be signed in to create a room';
		return;
	}

	error = null;
	loading = true;

	try {
		const roomCode = await room.createRoom(auth.session.access_token);
		createdCode = roomCode;
		onCreated?.(roomCode);
	} catch (e) {
		error = e instanceof Error ? e.message : 'Failed to create room';
		console.error('Create room error:', e);
	} finally {
		loading = false;
	}
}

/** Copy room code to clipboard */
async function copyCode() {
	if (!createdCode) return;
	try {
		await navigator.clipboard.writeText(createdCode);
	} catch {
		// Fallback: select text if clipboard API fails
		console.warn('Clipboard API not available');
	}
}
</script>

{#if createdCode && room.isConnected}
	<!-- Room created - show code -->
	<div class="room-created {className}">
		<p class="created-label">Room Created!</p>
		<button type="button" class="room-code" onclick={copyCode} title="Click to copy">
			{createdCode}
		</button>
		<p class="copy-hint">Share this code with friends</p>
	</div>
{:else}
	<!-- Create room button -->
	<button
		type="button"
		class="create-room-button {className}"
		onclick={handleClick}
		disabled={loading || !auth.isAuthenticated}
		aria-busy={loading}
	>
		{#if loading}
			<span class="loading-text">Creating...</span>
		{:else}
			<span class="button-text">CREATE ROOM</span>
			<span class="button-subtext">Start a new game</span>
		{/if}
	</button>
{/if}

{#if error}
	<p class="error-message" role="alert">{error}</p>
{/if}

<style>
	.create-room-button {
		/* Neo-Brutalist: Prominent, honest button */
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: var(--space-1);

		/* Size: Full width, comfortable touch target */
		width: 100%;
		min-height: var(--touch-target-comfortable);
		padding: var(--space-2) var(--space-3);

		/* Colors: Primary action */
		background: var(--color-accent);
		color: var(--color-text);
		border: var(--border-thick);

		/* Typography */
		font-family: var(--font-sans);
		font-weight: var(--weight-bold);
		text-transform: uppercase;
		letter-spacing: var(--tracking-wide);

		/* Interaction */
		cursor: pointer;
		transition: transform var(--transition-fast), box-shadow var(--transition-fast);
	}

	.create-room-button:hover:not(:disabled) {
		transform: translate(-2px, -2px);
		box-shadow: 4px 4px 0 var(--color-border);
	}

	.create-room-button:active:not(:disabled) {
		transform: translate(0, 0);
		box-shadow: none;
	}

	.create-room-button:disabled {
		background: var(--color-disabled);
		cursor: not-allowed;
	}

	.create-room-button:focus-visible {
		outline: 3px solid var(--color-border);
		outline-offset: 2px;
	}

	.button-text {
		font-size: var(--text-h3);
		line-height: 1.2;
	}

	.button-subtext {
		font-size: var(--text-small);
		font-weight: var(--weight-normal);
		color: var(--color-text-muted);
		text-transform: none;
		letter-spacing: var(--tracking-normal);
	}

	.loading-text {
		font-size: var(--text-body);
	}

	/* Room created state */
	.room-created {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-3);
		background: var(--color-surface);
		border: var(--border-thick);
	}

	.created-label {
		font-size: var(--text-body);
		font-weight: var(--weight-bold);
		color: var(--color-success);
		text-transform: uppercase;
		letter-spacing: var(--tracking-wide);
	}

	.room-code {
		font-family: var(--font-mono);
		font-size: var(--text-h1);
		font-weight: var(--weight-bold);
		letter-spacing: 0.2em;
		padding: var(--space-2) var(--space-3);
		background: var(--color-background);
		border: var(--border-medium);
		cursor: pointer;
		transition: transform var(--transition-fast), box-shadow var(--transition-fast);
	}

	.room-code:hover {
		transform: translate(-1px, -1px);
		box-shadow: 2px 2px 0 var(--color-border);
	}

	.room-code:active {
		transform: translate(0, 0);
		box-shadow: none;
	}

	.copy-hint {
		font-size: var(--text-small);
		color: var(--color-text-muted);
	}

	.error-message {
		margin-top: var(--space-1);
		padding: var(--space-1);
		font-size: var(--text-small);
		color: var(--color-danger);
		text-align: center;
	}

	/* Desktop: Constrain width */
	@media (min-width: 768px) {
		.create-room-button,
		.room-created {
			max-width: 320px;
		}
	}
</style>
