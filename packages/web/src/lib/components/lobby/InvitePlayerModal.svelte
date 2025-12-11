<script lang="ts">
/**
 * InvitePlayerModal - Modal for inviting online players to a game room
 *
 * Shows list of online users (excluding self and players already in room).
 * Includes fallback for external sharing when no users are online.
 */
import { onMount } from 'svelte';
import { auth } from '$lib/stores/auth.svelte';
import { lobby } from '$lib/stores/lobby.svelte';
import type { SentInvite } from '$lib/stores/room.svelte';
import OnlineUserItem from './OnlineUserItem.svelte';

interface Props {
	/** Whether the modal is open */
	open: boolean;
	/** Room code for external sharing fallback */
	roomCode: string;
	/** IDs of players already in the room */
	playerIds: string[];
	/** Invites already sent by host */
	sentInvites: SentInvite[];
	/** Callback when modal closes */
	onClose: () => void;
	/** Callback when inviting a user */
	onInvite: (userId: string) => void;
}

let { open, roomCode, playerIds, sentInvites, onClose, onInvite }: Props = $props();

let copiedCode = $state(false);
let copiedLink = $state(false);

// Request fresh online users when modal opens
$effect(() => {
	if (open) {
		lobby.requestOnlineUsers();
	}
});

// Filter online users (exclude self and players already in room)
const invitableUsers = $derived.by(() => {
	const inRoom = new Set(playerIds);
	return lobby.onlineUsers.filter((u) => !inRoom.has(u.userId) && u.userId !== auth.userId);
});

// Check if a user has a pending invite
function hasPendingInvite(userId: string): boolean {
	return sentInvites.some((inv) => inv.targetUserId === userId && inv.status === 'pending');
}

// Handle invite click
function handleInvite(userId: string) {
	onInvite(userId);
}

// Copy room code
async function copyCode() {
	try {
		await navigator.clipboard.writeText(roomCode);
		copiedCode = true;
		setTimeout(() => (copiedCode = false), 2000);
	} catch {
		console.warn('Clipboard API not available');
	}
}

// Copy invite link
async function copyLink() {
	try {
		const url = `${window.location.origin}/games/dicee/room/${roomCode}`;
		await navigator.clipboard.writeText(url);
		copiedLink = true;
		setTimeout(() => (copiedLink = false), 2000);
	} catch {
		console.warn('Clipboard API not available');
	}
}

// Close on backdrop click
function handleBackdropClick(e: MouseEvent) {
	if (e.target === e.currentTarget) {
		onClose();
	}
}

// Close on Escape key
function handleKeydown(e: KeyboardEvent) {
	if (e.key === 'Escape') {
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
		aria-labelledby="invite-modal-title"
		tabindex="-1"
		onclick={handleBackdropClick}
		onkeydown={handleKeydown}
	>
		<div class="modal-content">
			<header class="modal-header">
				<h2 id="invite-modal-title" class="modal-title">Invite Player</h2>
				<button type="button" class="modal-close" onclick={onClose} aria-label="Close">
					✕
				</button>
			</header>

			<div class="modal-body">
				{#if invitableUsers.length > 0}
					<div class="online-section">
						<h3 class="section-label">Online Now ({invitableUsers.length})</h3>
						<div class="users-list">
							{#each invitableUsers as user (user.userId)}
								<OnlineUserItem
									{user}
									canInvite={true}
									hasPendingInvite={hasPendingInvite(user.userId)}
									isSelf={false}
									onInvite={handleInvite}
								/>
							{/each}
						</div>
					</div>
				{:else}
					<div class="empty-state">
						<span class="empty-icon">👥</span>
						<p class="empty-text">No other players online right now</p>
					</div>
				{/if}

				<!-- External sharing fallback -->
				<div class="external-section">
					<h3 class="section-label">Share Externally</h3>
					<div class="share-row">
						<div class="code-display">
							<span class="code-label">Room:</span>
							<span class="code-value">{roomCode}</span>
						</div>
						<div class="share-buttons">
							<button type="button" class="share-btn" onclick={copyCode} title="Copy room code">
								{copiedCode ? '✓' : '📋'}
							</button>
							<button type="button" class="share-btn" onclick={copyLink} title="Copy invite link">
								{copiedLink ? '✓' : '🔗'}
							</button>
						</div>
					</div>
				</div>
			</div>

			<footer class="modal-footer">
				<button type="button" class="done-btn" onclick={onClose}>
					Done
				</button>
			</footer>
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
		max-height: 80vh;
		display: flex;
		flex-direction: column;
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
		flex: 1;
		overflow-y: auto;
		padding: var(--space-3);
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}

	.online-section {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.section-label {
		font-size: var(--text-small);
		font-weight: var(--weight-bold);
		text-transform: uppercase;
		letter-spacing: var(--tracking-wide);
		color: var(--color-text-muted);
		margin: 0;
	}

	.users-list {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		max-height: 250px;
		overflow-y: auto;
	}

	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-4);
		text-align: center;
	}

	.empty-icon {
		font-size: var(--text-h1);
		opacity: 0.5;
	}

	.empty-text {
		font-size: var(--text-body);
		color: var(--color-text-muted);
		margin: 0;
	}

	.external-section {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		padding-top: var(--space-2);
		border-top: var(--border-thin);
	}

	.share-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2);
		padding: var(--space-2);
		background: var(--color-surface);
		border: var(--border-medium);
	}

	.code-display {
		display: flex;
		align-items: center;
		gap: var(--space-1);
	}

	.code-label {
		font-size: var(--text-small);
		color: var(--color-text-muted);
	}

	.code-value {
		font-family: var(--font-mono);
		font-size: var(--text-body);
		font-weight: var(--weight-bold);
		letter-spacing: 0.1em;
	}

	.share-buttons {
		display: flex;
		gap: var(--space-1);
	}

	.share-btn {
		width: 36px;
		height: 36px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--color-background);
		border: var(--border-medium);
		font-size: var(--text-body);
		cursor: pointer;
		transition: transform var(--transition-fast), box-shadow var(--transition-fast);
	}

	.share-btn:hover {
		transform: translate(-1px, -1px);
		box-shadow: 2px 2px 0 var(--color-border);
	}

	.modal-footer {
		display: flex;
		justify-content: flex-end;
		padding: var(--space-2) var(--space-3);
		border-top: var(--border-medium);
		background: var(--color-surface);
	}

	.done-btn {
		padding: var(--space-1) var(--space-3);
		background: var(--color-primary);
		color: var(--color-text-on-primary, var(--color-text));
		border: var(--border-medium);
		font-family: var(--font-sans);
		font-weight: var(--weight-bold);
		text-transform: uppercase;
		letter-spacing: var(--tracking-wide);
		cursor: pointer;
		transition: transform var(--transition-fast), box-shadow var(--transition-fast);
	}

	.done-btn:hover {
		transform: translate(-1px, -1px);
		box-shadow: 2px 2px 0 var(--color-border);
	}
</style>
