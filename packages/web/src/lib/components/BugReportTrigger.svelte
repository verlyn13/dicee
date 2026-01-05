<!-- Bug Report Trigger Button -->
<script lang="ts">
/**
 * Bug Report Trigger
 *
 * A compact button that opens the bug reporter modal.
 * Designed to fit in settings panels and menus.
 */

import BugReporter from './BugReporter.svelte';

// Props
interface Props {
	size?: 'sm' | 'default' | 'lg';
	variant?: 'default' | 'outline' | 'ghost';
	class?: string;
}
let { size = 'default', variant = 'outline', class: className = '' }: Props = $props();

// State
let showReporter = $state(false);
</script>

<button
	class="trigger-btn {size} {variant} {className}"
	onclick={() => (showReporter = true)}
	aria-haspopup="dialog"
>
	<span class="btn-icon">🐛</span>
	<span class="btn-label">Report Bug</span>
</button>

{#if showReporter}
	<BugReporter open={showReporter} onClose={() => (showReporter = false)} />
{/if}

<style>
	.trigger-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-1);
		background: var(--color-surface);
		border: var(--border-medium);
		font-family: var(--font-sans);
		font-weight: var(--weight-bold);
		color: var(--color-text);
		cursor: pointer;
		transition: all var(--transition-fast);
		width: 100%;
	}

	/* Sizes */
	.trigger-btn.sm {
		padding: var(--space-1) var(--space-2);
		font-size: var(--text-small);
		min-height: 36px;
	}

	.trigger-btn.default {
		padding: var(--space-2);
		font-size: var(--text-body);
		min-height: var(--touch-target-min);
	}

	.trigger-btn.lg {
		padding: var(--space-2) var(--space-3);
		font-size: var(--text-h4);
		min-height: var(--touch-target-comfortable);
	}

	/* Variants */
	.trigger-btn.default:not(.outline):not(.ghost) {
		background: var(--color-accent);
		border-color: var(--color-text);
	}

	.trigger-btn.default:not(.outline):not(.ghost):hover {
		box-shadow: var(--shadow-brutal-sm);
	}

	.trigger-btn.outline {
		background: var(--color-surface);
		border-color: var(--color-border);
	}

	.trigger-btn.outline:hover {
		background: var(--color-background);
		border-color: var(--color-accent);
	}

	.trigger-btn.ghost {
		background: transparent;
		border-color: transparent;
	}

	.trigger-btn.ghost:hover {
		background: var(--color-background);
		border-color: var(--color-border);
	}

	/* Icon */
	.btn-icon {
		font-size: 1.1em;
	}
</style>
