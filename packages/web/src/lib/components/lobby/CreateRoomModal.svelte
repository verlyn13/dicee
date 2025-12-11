<script lang="ts">
/**
 * CreateRoomModal - Modal for creating a new room
 *
 * Shows room code with copy functionality and invite link.
 * Part of the Multiplayer flow.
 */

interface Props {
	/** Whether the modal is open */
	open: boolean;
	/** Callback to close the modal */
	onClose: () => void;
	/** Callback when room is created */
	onCreate: () => void;
	/** Callback to switch to join mode */
	onSwitchToJoin: () => void;
}

let { open, onClose, onCreate, onSwitchToJoin }: Props = $props();

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
</script>

{#if open}
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<div
		class="modal-backdrop"
		role="dialog"
		aria-modal="true"
		aria-labelledby="create-modal-title"
		tabindex="-1"
		onclick={handleBackdropClick}
		onkeydown={handleKeydown}
	>
		<div class="modal-content">
			<header class="modal-header">
				<h2 id="create-modal-title" class="modal-title">Multiplayer</h2>
				<button type="button" class="modal-close" onclick={onClose} aria-label="Close">
					✕
				</button>
			</header>

			<div class="modal-body">
				<p class="modal-description">
					Create a private room and share the code with friends, or join an existing room.
				</p>

				<div class="action-buttons">
					<button type="button" class="action-btn action-btn--primary" onclick={onCreate}>
						<span class="btn-icon">🎲</span>
						<span class="btn-text">Create Room</span>
						<span class="btn-subtext">Get a code to share</span>
					</button>

					<div class="divider">
						<span>or</span>
					</div>

					<button type="button" class="action-btn action-btn--secondary" onclick={onSwitchToJoin}>
						<span class="btn-icon">🔗</span>
						<span class="btn-text">Join Room</span>
						<span class="btn-subtext">Enter a friend's code</span>
					</button>
				</div>
			</div>
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
	}

	.modal-description {
		font-size: var(--text-body);
		color: var(--color-text-muted);
		text-align: center;
		margin: 0 0 var(--space-3);
	}

	.action-buttons {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.action-btn {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-1);
		padding: var(--space-3);
		border: var(--border-thick);
		cursor: pointer;
		transition:
			transform var(--transition-fast),
			box-shadow var(--transition-fast);
	}

	.action-btn:hover {
		transform: translate(-2px, -2px);
		box-shadow: 4px 4px 0 var(--color-border);
	}

	.action-btn:active {
		transform: translate(0, 0);
		box-shadow: none;
	}

	.action-btn--primary {
		background: var(--color-success);
	}

	.action-btn--secondary {
		background: var(--color-surface);
	}

	.btn-icon {
		font-size: var(--text-h2);
	}

	.btn-text {
		font-size: var(--text-h3);
		font-weight: var(--weight-bold);
		text-transform: uppercase;
		letter-spacing: var(--tracking-wide);
	}

	.btn-subtext {
		font-size: var(--text-small);
		color: var(--color-text-muted);
	}

	.divider {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		color: var(--color-text-muted);
	}

	.divider::before,
	.divider::after {
		content: '';
		flex: 1;
		height: 1px;
		background: var(--color-border);
	}

	.divider span {
		font-family: var(--font-mono);
		font-size: var(--text-tiny);
		text-transform: uppercase;
	}
</style>
