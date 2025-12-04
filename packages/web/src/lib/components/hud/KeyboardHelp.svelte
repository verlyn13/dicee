<script lang="ts">
/**
 * Keyboard Shortcuts Help Component
 * Displays available keyboard shortcuts in a collapsible panel
 */

import { KEY_BINDINGS } from '$lib/hooks/index.js';

let expanded = $state(false);

function toggle() {
	expanded = !expanded;
}
</script>

<div class="keyboard-help">
	<button
		class="help-toggle"
		onclick={toggle}
		aria-expanded={expanded}
		aria-controls="keyboard-shortcuts"
		title="Keyboard shortcuts"
	>
		<span class="help-icon">?</span>
	</button>

	{#if expanded}
		<div
			id="keyboard-shortcuts"
			class="shortcuts-panel"
			role="tooltip"
		>
			<div class="shortcuts-header">Keyboard Shortcuts</div>
			<ul class="shortcuts-list">
				{#each KEY_BINDINGS as binding}
					<li class="shortcut-item">
						<kbd class="shortcut-key">{binding.key}</kbd>
						<span class="shortcut-action">{binding.action}</span>
					</li>
				{/each}
			</ul>
		</div>
	{/if}
</div>

<style>
	.keyboard-help {
		position: relative;
		display: inline-block;
	}

	.help-toggle {
		width: 28px;
		height: 28px;
		border-radius: 50%;
		border: var(--border-thick);
		background: var(--color-surface);
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: background var(--transition-fast);
	}

	.help-toggle:hover {
		background: var(--color-surface-hover);
	}

	.help-toggle:focus-visible {
		outline: 2px solid var(--color-focus);
		outline-offset: 2px;
	}

	.help-icon {
		font-weight: var(--weight-bold);
		font-size: var(--text-small);
	}

	.shortcuts-panel {
		position: absolute;
		bottom: 100%;
		right: 0;
		margin-bottom: var(--space-1);
		background: var(--color-surface);
		border: var(--border-thick);
		padding: var(--space-2);
		min-width: 200px;
		z-index: 50;
		animation: panel-enter 0.15s ease-out;
	}

	@keyframes panel-enter {
		from {
			opacity: 0;
			transform: translateY(4px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	.shortcuts-header {
		font-weight: var(--weight-bold);
		font-size: var(--text-small);
		text-transform: uppercase;
		letter-spacing: var(--tracking-wide);
		margin-bottom: var(--space-2);
		padding-bottom: var(--space-1);
		border-bottom: var(--border-thin);
	}

	.shortcuts-list {
		list-style: none;
		padding: 0;
		margin: 0;
	}

	.shortcut-item {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-1) 0;
	}

	.shortcut-key {
		font-family: var(--font-mono);
		font-size: var(--text-tiny);
		font-weight: var(--weight-medium);
		background: var(--color-background);
		border: var(--border-thin);
		padding: 2px 6px;
		border-radius: 2px;
		min-width: 60px;
		text-align: center;
	}

	.shortcut-action {
		font-size: var(--text-small);
		color: var(--color-text-muted);
	}
</style>
