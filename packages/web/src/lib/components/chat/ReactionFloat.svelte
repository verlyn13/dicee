<script lang="ts">
/**
 * ReactionFloat - Animated floating reaction
 *
 * Displays an emoji that floats up and fades out.
 * Used when reactions are sent to provide visual feedback.
 */
import { onMount } from 'svelte';

interface Props {
	/** The emoji to display */
	emoji: string;
	/** Position offset from container (x, y in pixels) */
	position?: { x: number; y: number };
	/** Duration in ms before auto-removal */
	duration?: number;
	/** Callback when animation completes */
	onComplete?: () => void;
	/** If part of a combo, show count */
	comboCount?: number;
}

let { emoji, position = { x: 0, y: 0 }, duration = 1500, onComplete, comboCount }: Props = $props();

let element: HTMLDivElement;

onMount(() => {
	// Remove after animation
	const timeout = setTimeout(() => {
		onComplete?.();
	}, duration);

	return () => clearTimeout(timeout);
});
</script>

<div
	bind:this={element}
	class="reaction-float"
	class:combo={comboCount && comboCount > 1}
	style:--x="{position.x}px"
	style:--y="{position.y}px"
	style:--duration="{duration}ms"
>
	<span class="emoji">{emoji}</span>
	{#if comboCount && comboCount > 1}
		<span class="combo-count">x{comboCount}</span>
	{/if}
</div>

<style>
	.reaction-float {
		position: absolute;
		left: calc(50% + var(--x));
		top: var(--y);
		transform: translateX(-50%);
		pointer-events: none;
		z-index: 100;
		animation: floatUp var(--duration) ease-out forwards;
		display: flex;
		align-items: center;
		gap: var(--space-1);
	}

	@keyframes floatUp {
		0% {
			opacity: 1;
			transform: translateX(-50%) translateY(0) scale(1);
		}
		50% {
			opacity: 1;
			transform: translateX(-50%) translateY(-30px) scale(1.2);
		}
		100% {
			opacity: 0;
			transform: translateX(-50%) translateY(-60px) scale(0.8);
		}
	}

	.emoji {
		font-size: 2rem;
		filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2));
	}

	.combo .emoji {
		font-size: 2.5rem;
		animation: pulse 0.3s ease-out;
	}

	@keyframes pulse {
		0%,
		100% {
			transform: scale(1);
		}
		50% {
			transform: scale(1.3);
		}
	}

	.combo-count {
		font-size: var(--font-size-lg);
		font-weight: var(--font-weight-bold);
		color: var(--color-primary);
		text-shadow:
			1px 1px 0 var(--color-background),
			-1px -1px 0 var(--color-background),
			1px -1px 0 var(--color-background),
			-1px 1px 0 var(--color-background);
	}

	/* Reduced motion */
	@media (prefers-reduced-motion: reduce) {
		.reaction-float {
			animation: fadeOut var(--duration) ease-out forwards;
		}

		@keyframes fadeOut {
			0% {
				opacity: 1;
			}
			100% {
				opacity: 0;
			}
		}

		.combo .emoji {
			animation: none;
		}
	}
</style>
