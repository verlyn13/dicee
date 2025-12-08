<script lang="ts">
/**
 * MobileTabToggle - Tab switcher for Games/Chat on mobile
 *
 * Displays unread badge for chat when not active.
 */
import { lobby } from '$lib/stores/lobby.svelte';

interface Props {
	gamesCount: number;
}

let { gamesCount }: Props = $props();
</script>

<div class="tab-toggle" role="tablist">
	<button
		role="tab"
		aria-selected={lobby.activeTab === 'games'}
		class="tab"
		class:active={lobby.activeTab === 'games'}
		onclick={() => lobby.setActiveTab('games')}
	>
		GAMES ({gamesCount})
	</button>

	<button
		role="tab"
		aria-selected={lobby.activeTab === 'chat'}
		class="tab"
		class:active={lobby.activeTab === 'chat'}
		onclick={() => lobby.setActiveTab('chat')}
	>
		CHAT
		{#if lobby.unreadCount > 0}
			<span class="unread-badge">{lobby.unreadCount > 99 ? '99+' : lobby.unreadCount}</span>
		{/if}
	</button>
</div>

<style>
	.tab-toggle {
		display: flex;
		border: var(--border-thick);
		background: var(--color-surface);
	}

	.tab {
		flex: 1;
		padding: var(--space-1) var(--space-2);
		font-weight: var(--weight-bold);
		text-transform: uppercase;
		border: none;
		cursor: pointer;
		position: relative;
		background: var(--color-surface);
		color: var(--color-text);
		font-family: var(--font-mono);
		font-size: var(--text-small);
		transition: none; /* Hard cuts, no transitions */
	}

	/* Inactive: hatch pattern overlay */
	.tab:not(.active)::before {
		content: '';
		position: absolute;
		inset: 0;
		background: repeating-linear-gradient(
			45deg,
			transparent,
			transparent 2px,
			var(--color-text) 2px,
			var(--color-text) 3px
		);
		opacity: 0.1;
		pointer-events: none;
	}

	.tab.active {
		background: var(--color-text);
		color: var(--color-surface);
	}

	.unread-badge {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 1.25rem;
		height: 1.25rem;
		padding: 0 0.25rem;
		margin-left: 0.5rem;
		background: var(--color-signal-busy);
		color: white;
		font-size: var(--text-tiny);
		font-weight: var(--weight-black);
		border-radius: var(--radius-sm);
	}
</style>
