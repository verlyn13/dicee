<script lang="ts">
/**
 * ShoutBubble Component
 *
 * Displays an ephemeral speech bubble above a player's avatar.
 * Animated pop-in with auto-fade after the shout expires.
 *
 * Usage:
 * <div class="avatar-container">
 *   <ShoutBubble shout={activeShout} />
 *   <Avatar ... />
 * </div>
 */
import { SHOUT_DISPLAY_DURATION_MS } from '$lib/stores/chat.svelte';
import type { ShoutMessage } from '$lib/types/multiplayer';

interface Props {
	/** The shout message to display */
	shout: ShoutMessage;
	/** Position relative to avatar (default: top) */
	position?: 'top' | 'left' | 'right';
	/** Custom max width */
	maxWidth?: string;
}

let { shout, position = 'top', maxWidth = '180px' }: Props = $props();

// Calculate how much time is left for the animation
const fadeStartPercent = 80; // Start fading at 80% of duration
</script>

<div
	class="shout-bubble position-{position}"
	role="alert"
	aria-live="polite"
	style:max-width={maxWidth}
	style:--animation-duration="{SHOUT_DISPLAY_DURATION_MS}ms"
>
	<div class="bubble-content">
		{shout.content}
	</div>
	<div class="bubble-tail"></div>
</div>

<style>
	.shout-bubble {
		position: absolute;
		z-index: var(--z-tooltip, 100);
		padding: var(--space-2) var(--space-3);
		background: var(--color-accent);
		color: var(--color-text);
		border: var(--border-thick);
		box-shadow: 4px 4px 0 var(--color-border);
		font-weight: var(--weight-bold);
		font-size: var(--text-small);
		line-height: 1.3;
		word-break: break-word;
		animation:
			shout-pop 0.2s ease-out,
			shout-fade var(--animation-duration) ease-in forwards;
	}

	/* Position variants */
	.position-top {
		bottom: 100%;
		left: 50%;
		transform: translateX(-50%);
		margin-bottom: var(--space-2);
	}

	.position-left {
		right: 100%;
		top: 50%;
		transform: translateY(-50%);
		margin-right: var(--space-2);
	}

	.position-right {
		left: 100%;
		top: 50%;
		transform: translateY(-50%);
		margin-left: var(--space-2);
	}

	/* Bubble tail (speech pointer) */
	.bubble-tail {
		position: absolute;
		width: 0;
		height: 0;
	}

	.position-top .bubble-tail {
		top: 100%;
		left: 50%;
		transform: translateX(-50%);
		border-left: 8px solid transparent;
		border-right: 8px solid transparent;
		border-top: 8px solid var(--color-border);
	}

	.position-top .bubble-tail::after {
		content: '';
		position: absolute;
		top: -10px;
		left: -6px;
		border-left: 6px solid transparent;
		border-right: 6px solid transparent;
		border-top: 6px solid var(--color-accent);
	}

	.position-left .bubble-tail {
		left: 100%;
		top: 50%;
		transform: translateY(-50%);
		border-top: 8px solid transparent;
		border-bottom: 8px solid transparent;
		border-left: 8px solid var(--color-border);
	}

	.position-left .bubble-tail::after {
		content: '';
		position: absolute;
		top: -6px;
		left: -10px;
		border-top: 6px solid transparent;
		border-bottom: 6px solid transparent;
		border-left: 6px solid var(--color-accent);
	}

	.position-right .bubble-tail {
		right: 100%;
		top: 50%;
		transform: translateY(-50%);
		border-top: 8px solid transparent;
		border-bottom: 8px solid transparent;
		border-right: 8px solid var(--color-border);
	}

	.position-right .bubble-tail::after {
		content: '';
		position: absolute;
		top: -6px;
		right: -10px;
		border-top: 6px solid transparent;
		border-bottom: 6px solid transparent;
		border-right: 6px solid var(--color-accent);
	}

	.bubble-content {
		max-width: 100%;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	/* Animations */
	@keyframes shout-pop {
		0% {
			transform: translateX(-50%) scale(0.8);
			opacity: 0;
		}
		50% {
			transform: translateX(-50%) scale(1.05);
		}
		100% {
			transform: translateX(-50%) scale(1);
			opacity: 1;
		}
	}

	@keyframes shout-fade {
		0%,
		80% {
			opacity: 1;
		}
		100% {
			opacity: 0;
		}
	}

	/* Position-specific pop animations */
	.position-left {
		animation:
			shout-pop-left 0.2s ease-out,
			shout-fade var(--animation-duration) ease-in forwards;
	}

	.position-right {
		animation:
			shout-pop-right 0.2s ease-out,
			shout-fade var(--animation-duration) ease-in forwards;
	}

	@keyframes shout-pop-left {
		0% {
			transform: translateY(-50%) scale(0.8);
			opacity: 0;
		}
		50% {
			transform: translateY(-50%) scale(1.05);
		}
		100% {
			transform: translateY(-50%) scale(1);
			opacity: 1;
		}
	}

	@keyframes shout-pop-right {
		0% {
			transform: translateY(-50%) scale(0.8);
			opacity: 0;
		}
		50% {
			transform: translateY(-50%) scale(1.05);
		}
		100% {
			transform: translateY(-50%) scale(1);
			opacity: 1;
		}
	}

	/* Reduced motion preference */
	@media (prefers-reduced-motion: reduce) {
		.shout-bubble {
			animation: none;
			opacity: 1;
		}
	}
</style>
