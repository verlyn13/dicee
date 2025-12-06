<script lang="ts">
/**
 * NewsDev - System log / news display
 *
 * Shows system status, feature updates, and development news.
 * Uses terminal-style inverted color scheme (dark background).
 */

import { onMount } from 'svelte';

interface Update {
	type: 'FEATURE' | 'SYSTEM' | 'PLANNED' | 'NEW';
	message: string;
	timestamp?: string;
}

// Static updates - will be fetched from API in production
const updates: Update[] = [
	{ type: 'NEW', message: 'Multiplayer mode now live!' },
	{ type: 'FEATURE', message: 'Expected value display added' },
	{ type: 'SYSTEM', message: 'Server-side dice validation' },
	{ type: 'PLANNED', message: 'Tournament mode coming soon' },
];

let currentTime = $state('');

onMount(() => {
	// Update time every second for terminal feel
	const updateTime = () => {
		const now = new Date();
		currentTime = now.toLocaleTimeString('en-US', {
			hour12: false,
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit',
		});
	};
	updateTime();
	const interval = setInterval(updateTime, 1000);
	return () => clearInterval(interval);
});

// Type color mapping
function getTypeColor(type: Update['type']): string {
	switch (type) {
		case 'NEW':
			return 'var(--color-accent)';
		case 'FEATURE':
			return 'var(--color-success)';
		case 'SYSTEM':
			return 'rgba(255, 255, 255, 0.6)';
		case 'PLANNED':
			return 'var(--color-warning)';
		default:
			return 'rgba(255, 255, 255, 0.5)';
	}
}
</script>

<div class="news-card">
	<div class="news-header">
		<div class="header-left">
			<svg
				class="terminal-icon"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2.5"
				stroke-linecap="round"
				stroke-linejoin="round"
			>
				<polyline points="4 17 10 11 4 5" />
				<line x1="12" y1="19" x2="20" y2="19" />
			</svg>
			<span class="header-text">SYS</span>
		</div>
		<span class="header-time">{currentTime}</span>
	</div>

	<div class="updates-list">
		{#each updates as update}
			<div class="update-item">
				<span class="update-type" style="color: {getTypeColor(update.type)}">[{update.type}]</span>
				<span class="update-message">{update.message}</span>
			</div>
		{/each}
	</div>

	<div class="news-footer">
		<div class="status-indicator">
			<div class="status-dot"></div>
			<span class="status-text">All systems operational</span>
		</div>
	</div>
</div>

<style>
	.news-card {
		width: 100%;
		height: 100%;
		border: var(--border-thick);
		border-radius: var(--radius-md);
		background: var(--color-text);
		color: var(--color-surface);
		box-shadow: var(--shadow-brutal);
		padding: var(--space-3);
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	.news-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding-bottom: var(--space-1);
		border-bottom: 1px solid rgba(255, 255, 255, 0.2);
		margin-bottom: var(--space-1);
	}

	.header-left {
		display: flex;
		align-items: center;
		gap: var(--space-1);
	}

	.terminal-icon {
		width: 0.875rem;
		height: 0.875rem;
	}

	.header-text {
		font-family: var(--font-mono);
		font-size: var(--text-tiny);
		font-weight: var(--weight-bold);
	}

	.header-time {
		font-family: var(--font-mono);
		font-size: var(--text-tiny);
		opacity: 0.6;
	}

	.updates-list {
		flex: 1;
		overflow: auto;
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
	}

	.update-item {
		font-family: var(--font-mono);
		font-size: var(--text-tiny);
	}

	.update-type {
		color: rgba(255, 255, 255, 0.5);
	}

	.update-message {
		color: rgba(255, 255, 255, 0.8);
	}

	.news-footer {
		margin-top: auto;
		padding-top: var(--space-2);
		border-top: 1px solid rgba(255, 255, 255, 0.2);
	}

	.status-indicator {
		display: flex;
		align-items: center;
		gap: var(--space-1);
	}

	.status-dot {
		width: 0.375rem;
		height: 0.375rem;
		background: #22c55e; /* green-500 */
		border-radius: 50%;
	}

	.status-text {
		font-family: var(--font-mono);
		font-size: var(--text-tiny);
		color: rgba(255, 255, 255, 0.5);
	}
</style>
