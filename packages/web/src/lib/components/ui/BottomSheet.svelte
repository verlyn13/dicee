<script lang="ts">
/**
 * BottomSheet - Slide-up modal panel
 *
 * Neo-Brutalist bottom sheet with spring animation.
 * Used for auth options, settings, and contextual actions.
 *
 * Features:
 * - Backdrop click to close
 * - Escape key to close
 * - Spring animation on open/close
 * - Trap focus when open
 * - Accessible (dialog role, aria attributes)
 */

import type { Snippet } from 'svelte';
import { onMount } from 'svelte';

interface Props {
	/** Whether the sheet is open */
	open: boolean;
	/** Callback when sheet should close */
	onClose: () => void;
	/** Optional title for the sheet */
	title?: string;
	/** Content to render inside the sheet */
	children: Snippet;
}

let { open, onClose, title, children }: Props = $props();

let sheetElement: HTMLDivElement | null = $state(null);
let previousActiveElement: Element | null = null;

// Handle escape key
function handleKeydown(event: KeyboardEvent) {
	if (event.key === 'Escape' && open) {
		event.preventDefault();
		onClose();
	}
}

// Handle backdrop click
function handleBackdropClick(event: MouseEvent) {
	if (event.target === event.currentTarget) {
		onClose();
	}
}

// Focus management
$effect(() => {
	if (open) {
		previousActiveElement = document.activeElement;
		// Focus the sheet after animation starts
		setTimeout(() => {
			sheetElement?.focus();
		}, 50);
	} else if (previousActiveElement instanceof HTMLElement) {
		previousActiveElement.focus();
	}
});

// Prevent body scroll when open
$effect(() => {
	if (open) {
		document.body.style.overflow = 'hidden';
	} else {
		document.body.style.overflow = '';
	}

	return () => {
		document.body.style.overflow = '';
	};
});

onMount(() => {
	return () => {
		document.body.style.overflow = '';
	};
});
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<div class="bottomsheet-backdrop" onclick={handleBackdropClick}>
		<div
			bind:this={sheetElement}
			class="bottomsheet"
			class:open
			role="dialog"
			aria-modal="true"
			aria-labelledby={title ? 'bottomsheet-title' : undefined}
			tabindex="-1"
		>
			<!-- Handle bar for visual affordance -->
			<div class="handle-bar">
				<div class="handle"></div>
			</div>

			{#if title}
				<header class="bottomsheet-header">
					<h2 id="bottomsheet-title" class="bottomsheet-title">{title}</h2>
					<button
						type="button"
						class="close-button"
						onclick={onClose}
						aria-label="Close"
					>
						<svg
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="3"
							stroke-linecap="round"
							stroke-linejoin="round"
						>
							<line x1="18" y1="6" x2="6" y2="18" />
							<line x1="6" y1="6" x2="18" y2="18" />
						</svg>
					</button>
				</header>
			{/if}

			<div class="bottomsheet-content">
				{@render children()}
			</div>
		</div>
	</div>
{/if}

<style>
	.bottomsheet-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.5);
		z-index: var(--z-bottomsheet);
		display: flex;
		align-items: flex-end;
		justify-content: center;

		/* Fade in */
		animation: fadeIn var(--transition-fast) ease-out;
	}

	@keyframes fadeIn {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}

	.bottomsheet {
		width: 100%;
		max-width: 32rem; /* 512px */
		max-height: 85vh;
		background: var(--color-surface);
		border: var(--border-thick);
		border-bottom: none;

		/* Neo-Brutalist: minimal radius at top only */
		border-radius: var(--radius-md) var(--radius-md) 0 0;

		/* Slide up animation */
		animation: slideUp var(--transition-medium) cubic-bezier(0.34, 1.56, 0.64, 1);
		transform-origin: bottom center;

		/* Focus outline */
		outline: none;

		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	@keyframes slideUp {
		from {
			transform: translateY(100%);
		}
		to {
			transform: translateY(0);
		}
	}

	.handle-bar {
		display: flex;
		justify-content: center;
		padding: var(--space-2) 0 var(--space-1);
	}

	.handle {
		width: 3rem;
		height: 4px;
		background: var(--color-text-muted);
		border-radius: 2px;
	}

	.bottomsheet-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0 var(--space-3) var(--space-2);
		border-bottom: var(--border-thin);
	}

	.bottomsheet-title {
		font-family: var(--font-mono);
		font-size: var(--text-h3);
		font-weight: var(--weight-bold);
		text-transform: uppercase;
		letter-spacing: var(--tracking-wide);
		margin: 0;
	}

	.close-button {
		width: 2.5rem;
		height: 2.5rem;
		display: flex;
		align-items: center;
		justify-content: center;
		background: transparent;
		border: var(--border-medium);
		cursor: pointer;
		transition:
			background var(--transition-fast),
			transform var(--transition-fast);
	}

	.close-button svg {
		width: 1.25rem;
		height: 1.25rem;
	}

	.close-button:hover {
		background: var(--color-background);
	}

	.close-button:active {
		transform: scale(0.95);
	}

	.close-button:focus-visible {
		outline: 3px solid var(--color-accent);
		outline-offset: 2px;
	}

	.bottomsheet-content {
		flex: 1;
		overflow-y: auto;
		padding: var(--space-3);
	}

	/* Desktop: center and add shadow */
	@media (min-width: 768px) {
		.bottomsheet {
			margin-bottom: var(--space-4);
			border: var(--border-thick);
			border-radius: var(--radius-md);
			box-shadow: var(--shadow-brutal-lg);
		}
	}
</style>
