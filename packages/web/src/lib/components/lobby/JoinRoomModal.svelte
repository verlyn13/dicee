<script lang="ts">
/**
 * JoinRoomModal - Modal for joining an existing room
 *
 * Input field for room code with validation.
 * Part of the Multiplayer flow.
 */

interface Props {
	/** Whether the modal is open */
	open: boolean;
	/** Callback to close the modal */
	onClose: () => void;
	/** Callback when joining a room */
	onJoin: (code: string) => void;
	/** Callback to switch to create mode */
	onSwitchToCreate: () => void;
}

let { open, onClose, onJoin, onSwitchToCreate }: Props = $props();

let roomCode = $state('');
let error = $state<string | null>(null);

function handleSubmit(event: Event) {
	event.preventDefault();
	error = null;

	const code = roomCode.trim().toUpperCase();
	if (!code) {
		error = 'Please enter a room code';
		return;
	}
	if (code.length !== 6) {
		error = 'Room code must be 6 characters';
		return;
	}

	onJoin(code);
}

function handleBackdropClick(event: MouseEvent) {
	if (event.target === event.currentTarget) {
		onClose();
	}
}

function handleKeydown(event: KeyboardEvent) {
	if (event.key === 'Escape') {
		onClose();
	}
}

// Reset state when modal closes
$effect(() => {
	if (!open) {
		roomCode = '';
		error = null;
	}
});
</script>

{#if open}
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<div
		class="modal-backdrop"
		role="dialog"
		aria-modal="true"
		aria-labelledby="join-modal-title"
		tabindex="-1"
		onclick={handleBackdropClick}
		onkeydown={handleKeydown}
	>
		<div class="modal-content">
			<header class="modal-header">
				<h2 id="join-modal-title" class="modal-title">Join Room</h2>
				<button type="button" class="modal-close" onclick={onClose} aria-label="Close">
					✕
				</button>
			</header>

			<form class="modal-body" onsubmit={handleSubmit}>
				<p class="modal-description">
					Enter the 6-character room code shared by your friend.
				</p>

				<div class="input-group">
					<input
						type="text"
						class="code-input"
						placeholder="ABC123"
						maxlength="6"
						autocomplete="off"
						autocapitalize="characters"
						bind:value={roomCode}
					/>
					{#if error}
						<p class="error-message" role="alert">{error}</p>
					{/if}
				</div>

				<div class="action-buttons">
					<button type="submit" class="join-btn" disabled={!roomCode.trim()}>
						Join Game
					</button>
				</div>

				<div class="switch-mode">
					<span>Don't have a code?</span>
					<button type="button" class="link-btn" onclick={onSwitchToCreate}>
						Create a room instead
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}

<style>
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
		max-width: 400px;
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
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}

	.modal-description {
		font-size: var(--text-body);
		color: var(--color-text-muted);
		text-align: center;
		margin: 0;
	}

	.input-group {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
	}

	.code-input {
		width: 100%;
		padding: var(--space-2);
		font-family: var(--font-mono);
		font-size: var(--text-h2);
		font-weight: var(--weight-bold);
		text-align: center;
		text-transform: uppercase;
		letter-spacing: 0.2em;
		border: var(--border-thick);
		background: var(--color-surface);
	}

	.code-input:focus {
		outline: 3px solid var(--color-primary);
		outline-offset: 2px;
	}

	.code-input::placeholder {
		color: var(--color-text-muted);
		opacity: 0.5;
	}

	.error-message {
		font-size: var(--text-small);
		color: var(--color-danger);
		text-align: center;
		margin: 0;
	}

	.action-buttons {
		display: flex;
		flex-direction: column;
	}

	.join-btn {
		width: 100%;
		padding: var(--space-2) var(--space-3);
		font-size: var(--text-h3);
		font-weight: var(--weight-bold);
		text-transform: uppercase;
		letter-spacing: var(--tracking-wide);
		background: var(--color-success);
		border: var(--border-thick);
		cursor: pointer;
		transition:
			transform var(--transition-fast),
			box-shadow var(--transition-fast);
	}

	.join-btn:hover:not(:disabled) {
		transform: translate(-2px, -2px);
		box-shadow: 4px 4px 0 var(--color-border);
	}

	.join-btn:active:not(:disabled) {
		transform: translate(0, 0);
		box-shadow: none;
	}

	.join-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.switch-mode {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-1);
		font-size: var(--text-small);
		color: var(--color-text-muted);
	}

	.link-btn {
		appearance: none;
		background: none;
		border: none;
		padding: 0;
		font-size: var(--text-small);
		font-weight: var(--weight-semibold);
		color: var(--color-primary);
		text-decoration: underline;
		cursor: pointer;
	}

	.link-btn:hover {
		color: var(--color-primary-dark);
	}
</style>
