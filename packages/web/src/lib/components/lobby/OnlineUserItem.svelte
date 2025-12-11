<script lang="ts">
/**
 * OnlineUserItem - Displays an online user with optional invite button
 *
 * Shows user avatar, display name, and an invite button if the viewer
 * can invite this user (i.e., viewer is host in a waiting room).
 */
import { Avatar } from '$lib/components/ui';
import type { OnlineUser } from '$lib/stores/lobby.svelte';

interface Props {
	/** The online user to display */
	user: OnlineUser;
	/** Whether the current user can send invites (is host in waiting room) */
	canInvite?: boolean;
	/** Whether this user has a pending invite */
	hasPendingInvite?: boolean;
	/** Whether this user is the current user (can't invite self) */
	isSelf?: boolean;
	/** Callback when invite button is clicked */
	onInvite?: (userId: string) => void;
}

let {
	user,
	canInvite = false,
	hasPendingInvite = false,
	isSelf = false,
	onInvite,
}: Props = $props();

// Determine invite button state
const showInviteButton = $derived(canInvite && !isSelf);
const inviteDisabled = $derived(hasPendingInvite);
const inviteLabel = $derived(hasPendingInvite ? 'Invited' : 'Invite');

function handleInvite() {
	if (onInvite && !inviteDisabled) {
		onInvite(user.userId);
	}
}
</script>

<div class="online-user-item" class:is-self={isSelf}>
	<Avatar seed={user.avatarSeed} size="sm" />

	<span class="user-name">
		{user.displayName}
		{#if isSelf}
			<span class="self-badge">(you)</span>
		{/if}
	</span>

	{#if showInviteButton}
		<button
			type="button"
			class="invite-btn"
			class:invited={hasPendingInvite}
			disabled={inviteDisabled}
			onclick={handleInvite}
		>
			{inviteLabel}
		</button>
	{/if}
</div>

<style>
	.online-user-item {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-2);
		background: var(--color-surface);
		border: var(--border-thin);
	}

	.online-user-item.is-self {
		background: var(--color-surface-alt);
	}

	.user-name {
		flex: 1;
		font-size: var(--text-body);
		font-weight: var(--weight-medium);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.self-badge {
		font-size: var(--text-small);
		font-weight: var(--weight-normal);
		color: var(--color-text-muted);
	}

	.invite-btn {
		padding: var(--space-1) var(--space-2);
		font-size: var(--text-small);
		font-weight: var(--weight-bold);
		text-transform: uppercase;
		letter-spacing: var(--tracking-wide);
		background: var(--color-primary);
		border: var(--border-medium);
		cursor: pointer;
		transition:
			transform var(--transition-fast),
			box-shadow var(--transition-fast);
	}

	.invite-btn:hover:not(:disabled) {
		transform: translate(-1px, -1px);
		box-shadow: 2px 2px 0 var(--color-border);
	}

	.invite-btn:active:not(:disabled) {
		transform: translate(0, 0);
		box-shadow: none;
	}

	.invite-btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.invite-btn.invited {
		background: var(--color-surface);
		color: var(--color-text-muted);
	}
</style>
