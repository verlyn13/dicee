<script lang="ts">
/**
 * SpectatorHeader Component
 *
 * Header bar for spectator view showing room info, spectator count, and controls.
 */
import type { RoomCode } from '$lib/types/multiplayer';

interface Props {
	/** Room code being watched */
	roomCode: RoomCode | null;
	/** Display text for spectator count */
	spectatorDisplay: string;
	/** Whether there are unread chat messages */
	hasChatUnread: boolean;
	/** Callback when leaving */
	onLeave: () => void;
	/** Callback when toggling chat */
	onChatToggle: () => void;
}

let { roomCode, spectatorDisplay, hasChatUnread, onLeave, onChatToggle }: Props = $props();
</script>

<header class="spectator-header">
	<button class="leave-btn" onclick={onLeave} type="button">
		← Stop Watching
	</button>

	<div class="header-center">
		<span class="spectator-badge">
			<span class="eye">👁</span>
			SPECTATING
		</span>
		<span class="room-code">{roomCode ?? '----'}</span>
	</div>

	<div class="header-right">
		<span class="spectator-count">{spectatorDisplay}</span>
		<button
			type="button"
			class="chat-toggle"
			onclick={onChatToggle}
			aria-label="Toggle chat"
		>
			💬
			{#if hasChatUnread}
				<span class="unread-dot"></span>
			{/if}
		</button>
	</div>
</header>

<style>
	.spectator-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: var(--space-2);
		background: var(--color-surface);
		border-bottom: var(--border-thick);
		gap: var(--space-2);
	}

	.leave-btn {
		padding: var(--space-1) var(--space-2);
		font-size: var(--text-small);
		font-weight: var(--weight-semibold);
		background: transparent;
		border: var(--border-thin);
		cursor: pointer;
		transition: background var(--transition-fast);
		white-space: nowrap;
	}

	.leave-btn:hover {
		background: var(--color-background);
	}

	.header-center {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}

	.spectator-badge {
		display: flex;
		align-items: center;
		gap: var(--space-1);
		padding: var(--space-1) var(--space-2);
		font-size: var(--text-tiny);
		font-weight: var(--weight-bold);
		text-transform: uppercase;
		letter-spacing: var(--tracking-wider);
		background: var(--color-warning);
		color: var(--color-background);
		border: var(--border-thin);
	}

	.eye {
		font-size: 14px;
	}

	.room-code {
		font-family: var(--font-mono);
		font-size: var(--text-body);
		font-weight: var(--weight-bold);
		letter-spacing: var(--tracking-wider);
		padding: var(--space-1) var(--space-2);
		background: var(--color-background);
		border: var(--border-thin);
	}

	.header-right {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}

	.spectator-count {
		font-size: var(--text-small);
		color: var(--color-text-muted);
		white-space: nowrap;
	}

	/* Hide spectator count on mobile */
	@media (max-width: 480px) {
		.spectator-count {
			display: none;
		}
	}

	.chat-toggle {
		position: relative;
		width: 40px;
		height: 40px;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 20px;
		background: var(--color-background);
		border: var(--border-medium);
		cursor: pointer;
		transition: transform var(--transition-fast), box-shadow var(--transition-fast);
	}

	.chat-toggle:hover {
		transform: translate(-1px, -1px);
		box-shadow: 2px 2px 0 var(--color-border);
	}

	.unread-dot {
		position: absolute;
		top: 4px;
		right: 4px;
		width: 10px;
		height: 10px;
		background: var(--color-accent);
		border-radius: 50%;
		border: 2px solid var(--color-surface);
	}
</style>
