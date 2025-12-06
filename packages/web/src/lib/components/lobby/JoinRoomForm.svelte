<script lang="ts">
/**
 * JoinRoomForm - Join an existing room by code
 *
 * Mobile-first, Neo-Brutalist design.
 * Validates 6-character alphanumeric room codes.
 */
import { auth } from '$lib/stores/auth.svelte';
import { getRoomStore } from '$lib/stores/room.svelte';
import { isValidRoomCode } from '$lib/types/multiplayer.schema';

interface Props {
	/** Callback when successfully joined */
	onjoined?: (roomCode: string) => void;
	/** Additional CSS classes */
	class?: string;
}

let { onjoined, class: className = '' }: Props = $props();

const room = getRoomStore();

let roomCode = $state('');
let loading = $state(false);
let error = $state<string | null>(null);

/** Format input: uppercase, remove invalid chars */
function handleInput(event: Event) {
	const input = event.target as HTMLInputElement;
	// Remove invalid characters and uppercase
	const cleaned = input.value.toUpperCase().replace(/[^A-HJ-NP-Z2-9]/g, '');
	// Limit to 6 characters
	roomCode = cleaned.slice(0, 6);
	// Update input value to show formatted code
	input.value = roomCode;
	// Clear error on input
	error = null;
}

async function handleSubmit(event: Event) {
	event.preventDefault();

	if (!auth.session?.access_token) {
		error = 'You must be signed in to join a room';
		return;
	}

	if (roomCode.length !== 6) {
		error = 'Room code must be 6 characters';
		return;
	}

	if (!isValidRoomCode(roomCode)) {
		error = 'Invalid room code format';
		return;
	}

	error = null;
	loading = true;

	try {
		await room.joinRoom(roomCode, auth.session.access_token);
		onjoined?.(roomCode);
	} catch (e) {
		error = e instanceof Error ? e.message : 'Failed to join room';
		console.error('Join room error:', e);
	} finally {
		loading = false;
	}
}

const isValid = $derived(roomCode.length === 6 && isValidRoomCode(roomCode));
</script>

<form class="join-room-form {className}" onsubmit={handleSubmit}>
	<label for="room-code-input" class="form-label">Join a Room</label>

	<div class="input-row">
		<input
			id="room-code-input"
			type="text"
			class="room-code-input"
			placeholder="ABC123"
			value={roomCode}
			oninput={handleInput}
			maxlength="6"
			autocomplete="off"
			autocapitalize="characters"
			spellcheck="false"
			disabled={loading}
			aria-describedby={error ? 'join-error' : undefined}
			aria-invalid={error ? 'true' : undefined}
		/>

		<button
			type="submit"
			class="join-button"
			disabled={loading || !isValid || !auth.isAuthenticated}
			aria-busy={loading}
		>
			{loading ? '...' : 'JOIN'}
		</button>
	</div>

	{#if error}
		<p id="join-error" class="error-message" role="alert">{error}</p>
	{/if}
</form>

<style>
	.join-room-form {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		width: 100%;
	}

	.form-label {
		font-size: var(--text-body);
		font-weight: var(--weight-bold);
		text-transform: uppercase;
		letter-spacing: var(--tracking-wide);
	}

	.input-row {
		display: flex;
		gap: var(--space-1);
	}

	.room-code-input {
		/* Layout */
		flex: 1;
		min-height: var(--touch-target-comfortable);
		padding: var(--space-2);

		/* Neo-Brutalist styling */
		background: var(--color-background);
		border: var(--border-thick);
		font-family: var(--font-mono);
		font-size: var(--text-h3);
		font-weight: var(--weight-bold);
		letter-spacing: 0.15em;
		text-align: center;
		text-transform: uppercase;

		/* Remove default styling */
		outline: none;
	}

	.room-code-input::placeholder {
		color: var(--color-text-muted);
		opacity: 0.5;
	}

	.room-code-input:focus {
		border-color: var(--color-accent);
		box-shadow: 0 0 0 2px var(--color-accent);
	}

	.room-code-input:disabled {
		background: var(--color-disabled);
		cursor: not-allowed;
	}

	.join-button {
		/* Size */
		min-width: 80px;
		min-height: var(--touch-target-comfortable);
		padding: var(--space-2);

		/* Neo-Brutalist styling */
		background: var(--color-surface);
		border: var(--border-thick);
		font-family: var(--font-sans);
		font-size: var(--text-body);
		font-weight: var(--weight-bold);
		text-transform: uppercase;
		letter-spacing: var(--tracking-wide);

		/* Interaction */
		cursor: pointer;
		transition: transform var(--transition-fast), box-shadow var(--transition-fast);
	}

	.join-button:hover:not(:disabled) {
		transform: translate(-2px, -2px);
		box-shadow: 4px 4px 0 var(--color-border);
	}

	.join-button:active:not(:disabled) {
		transform: translate(0, 0);
		box-shadow: none;
	}

	.join-button:disabled {
		background: var(--color-disabled);
		cursor: not-allowed;
	}

	.join-button:focus-visible {
		outline: 3px solid var(--color-border);
		outline-offset: 2px;
	}

	.error-message {
		padding: var(--space-1);
		font-size: var(--text-small);
		color: var(--color-danger);
		text-align: center;
	}

	/* Desktop: Constrain width */
	@media (min-width: 768px) {
		.join-room-form {
			max-width: 320px;
		}
	}
</style>
