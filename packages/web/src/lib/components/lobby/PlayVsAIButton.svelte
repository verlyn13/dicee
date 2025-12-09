<script lang="ts">
/**
 * Play vs AI Button
 *
 * Opens a modal to select an AI opponent and start a solo game.
 * Creates a room with the selected AI profile.
 *
 * Design: Neo-Brutalist button matching CreateRoomButton
 */

import { auth } from '$lib/stores/auth.svelte';
import { getRoomStore } from '$lib/stores/room.svelte';
import AIOpponentSelector from './AIOpponentSelector.svelte';

interface Props {
	/** Callback when game is created successfully */
	onCreated?: (roomCode: string, aiProfileId: string) => void;
	/** Additional CSS classes */
	class?: string;
}

let { onCreated, class: className = '' }: Props = $props();

const room = getRoomStore();

let showModal = $state(false);
let selectedProfile = $state<string>('carmen'); // Default to Carmen
let loading = $state(false);
let error = $state<string | null>(null);

function openModal() {
	if (!auth.isAuthenticated) {
		error = 'You must be signed in to play';
		return;
	}
	error = null;
	showModal = true;
}

function closeModal() {
	showModal = false;
	error = null;
}

function handleProfileSelect(profileId: string) {
	selectedProfile = profileId;
}

async function startGame() {
	if (!auth.session?.access_token) {
		error = 'You must be signed in to play';
		return;
	}

	if (!selectedProfile) {
		error = 'Please select an AI opponent';
		return;
	}

	error = null;
	loading = true;

	try {
		// Create room with AI opponent flag
		// The server will add the AI player when the game starts
		const roomCode = await room.createRoom(auth.session.access_token);

		// Store the AI profile selection for when game starts
		// This will be sent with the START_GAME command
		sessionStorage.setItem('ai_opponent_profile', selectedProfile);

		closeModal();
		onCreated?.(roomCode, selectedProfile);
	} catch (e) {
		error = e instanceof Error ? e.message : 'Failed to create game';
		console.error('Create AI game error:', e);
	} finally {
		loading = false;
	}
}

function handleKeydown(event: KeyboardEvent) {
	if (event.key === 'Escape') {
		closeModal();
	}
}

function handleBackdropClick(event: MouseEvent) {
	if (event.target === event.currentTarget) {
		closeModal();
	}
}
</script>

<button
	type="button"
	class="play-ai-button {className}"
	onclick={openModal}
	disabled={!auth.isAuthenticated}
>
	<span class="button-icon" aria-hidden="true">🤖</span>
	<span class="button-text">PLAY VS AI</span>
	<span class="button-subtext">Practice with AI opponents</span>
</button>

{#if error && !showModal}
	<p class="error-message" role="alert">{error}</p>
{/if}

{#if showModal}
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<div 
		class="modal-backdrop" 
		role="dialog" 
		aria-modal="true"
		aria-labelledby="ai-modal-title"
		tabindex="-1"
		onclick={handleBackdropClick}
		onkeydown={handleKeydown}
	>
		<div class="modal-content">
			<header class="modal-header">
				<h2 id="ai-modal-title" class="modal-title">Play vs AI</h2>
				<button 
					type="button" 
					class="modal-close" 
					onclick={closeModal}
					aria-label="Close"
				>
					✕
				</button>
			</header>

			<div class="modal-body">
				<AIOpponentSelector 
					selected={selectedProfile} 
					onSelect={handleProfileSelect}
					disabled={loading}
				/>
			</div>

			{#if error}
				<p class="error-message" role="alert">{error}</p>
			{/if}

			<footer class="modal-footer">
				<button 
					type="button" 
					class="cancel-button" 
					onclick={closeModal}
					disabled={loading}
				>
					Cancel
				</button>
				<button 
					type="button" 
					class="start-button" 
					onclick={startGame}
					disabled={loading || !selectedProfile}
					aria-busy={loading}
				>
					{#if loading}
						Starting...
					{:else}
						Start Game
					{/if}
				</button>
			</footer>
		</div>
	</div>
{/if}

<style>
	.play-ai-button {
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

		/* Colors: Secondary action */
		background: var(--color-surface);
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

	.play-ai-button:hover:not(:disabled) {
		transform: translate(-2px, -2px);
		box-shadow: 4px 4px 0 var(--color-border);
	}

	.play-ai-button:active:not(:disabled) {
		transform: translate(0, 0);
		box-shadow: none;
	}

	.play-ai-button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.play-ai-button:focus-visible {
		outline: 3px solid var(--color-border);
		outline-offset: 2px;
	}

	.button-icon {
		font-size: var(--text-h2);
		line-height: 1;
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

	/* Modal */
	.modal-backdrop {
		position: fixed;
		inset: 0;
		z-index: var(--z-modal);
		
		display: flex;
		align-items: center;
		justify-content: center;
		padding: var(--space-3);
		
		background: rgba(0, 0, 0, 0.7);
	}

	.modal-content {
		width: 100%;
		max-width: 600px;
		max-height: 90vh;
		overflow-y: auto;
		
		background: var(--color-background);
		border: var(--border-thick);
		box-shadow: 8px 8px 0 var(--color-border);
	}

	.modal-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: var(--space-2) var(--space-3);
		border-bottom: var(--border-medium);
		background: var(--color-surface);
	}

	.modal-title {
		font-size: var(--text-h3);
		font-weight: var(--weight-bold);
		text-transform: uppercase;
		letter-spacing: var(--tracking-wide);
		margin: 0;
	}

	.modal-close {
		appearance: none;
		background: none;
		border: var(--border-thin);
		padding: var(--space-1);
		font-size: var(--text-body);
		cursor: pointer;
		line-height: 1;
	}

	.modal-close:hover {
		background: var(--color-surface-alt);
	}

	.modal-body {
		padding: var(--space-3);
	}

	.modal-footer {
		display: flex;
		gap: var(--space-2);
		justify-content: flex-end;
		padding: var(--space-2) var(--space-3);
		border-top: var(--border-medium);
		background: var(--color-surface);
	}

	.cancel-button,
	.start-button {
		padding: var(--space-1) var(--space-3);
		font-family: var(--font-sans);
		font-weight: var(--weight-bold);
		text-transform: uppercase;
		letter-spacing: var(--tracking-wide);
		cursor: pointer;
		transition: transform var(--transition-fast), box-shadow var(--transition-fast);
	}

	.cancel-button {
		background: var(--color-surface);
		border: var(--border-medium);
	}

	.start-button {
		background: var(--color-primary);
		color: var(--color-text-on-primary, var(--color-text));
		border: var(--border-medium);
	}

	.cancel-button:hover:not(:disabled),
	.start-button:hover:not(:disabled) {
		transform: translate(-1px, -1px);
		box-shadow: 2px 2px 0 var(--color-border);
	}

	.cancel-button:disabled,
	.start-button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.error-message {
		margin: var(--space-1) var(--space-3);
		padding: var(--space-1);
		font-size: var(--text-small);
		color: var(--color-danger);
		text-align: center;
	}

	/* Desktop: Constrain button width */
	@media (min-width: 768px) {
		.play-ai-button {
			max-width: 320px;
		}
	}
</style>
