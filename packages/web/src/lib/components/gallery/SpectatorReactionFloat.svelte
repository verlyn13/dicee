<!--
  SpectatorReactionFloat.svelte - Floating reaction display

  Shows reactions that float up and fade out when spectators react.
  Supports combo counts for multiple same-emoji reactions.
  Optionally plays sounds for reactions.
-->
<script lang="ts">
import { onMount } from 'svelte';
import type { SpectatorReactionEmoji } from '$lib/services/spectatorService.svelte';

interface Props {
	/** The emoji to display */
	emoji: SpectatorReactionEmoji;
	/** Spectator who sent the reaction */
	spectatorName: string;
	/** Combo count (multiple same-emoji reactions) */
	comboCount?: number;
	/** Position offset from container */
	position?: { x: number; y: number };
	/** Duration in ms before removal */
	duration?: number;
	/** Callback when animation completes */
	onComplete?: () => void;
	/** Whether to show the spectator name */
	showName?: boolean;
}

let {
	emoji,
	spectatorName,
	comboCount = 1,
	position = { x: 0, y: 0 },
	duration = 2000,
	onComplete,
	showName = false,
}: Props = $props();

let element: HTMLDivElement;

// Determine size based on combo
const size = $derived(
	comboCount >= 5 ? 'xl' : comboCount >= 3 ? 'lg' : comboCount > 1 ? 'md' : 'sm',
);

// Random horizontal offset for variety
const randomOffset = $derived(Math.random() * 60 - 30);

onMount(() => {
	const timeout = setTimeout(() => {
		onComplete?.();
	}, duration);

	return () => clearTimeout(timeout);
});
</script>

<div
	bind:this={element}
	class="spectator-reaction-float"
	class:combo={comboCount > 1}
	class:sm={size === 'sm'}
	class:md={size === 'md'}
	class:lg={size === 'lg'}
	class:xl={size === 'xl'}
	style:--x="{position.x + randomOffset}px"
	style:--y="{position.y}px"
	style:--duration="{duration}ms"
	role="img"
	aria-label="{spectatorName} reacted with {emoji}{comboCount > 1 ? ` x${comboCount}` : ''}"
>
	<span class="float-emoji">{emoji}</span>
	{#if comboCount > 1}
		<span class="combo-count">x{comboCount}</span>
	{/if}
	{#if showName}
		<span class="spectator-name">{spectatorName}</span>
	{/if}
</div>

<style>
	.spectator-reaction-float {
		position: absolute;
		left: calc(50% + var(--x));
		bottom: var(--y);
		transform: translateX(-50%);
		pointer-events: none;
		z-index: 100;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.25rem;
		animation: floatUp var(--duration) ease-out forwards;
	}

	@keyframes floatUp {
		0% {
			opacity: 1;
			transform: translateX(-50%) translateY(0) scale(1);
		}
		30% {
			opacity: 1;
			transform: translateX(-50%) translateY(-40px) scale(1.15);
		}
		100% {
			opacity: 0;
			transform: translateX(-50%) translateY(-100px) scale(0.8);
		}
	}

	.float-emoji {
		filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3));
		transition: font-size 0.1s ease;
	}

	/* Size variants */
	.spectator-reaction-float.sm .float-emoji {
		font-size: 1.5rem;
	}

	.spectator-reaction-float.md .float-emoji {
		font-size: 2rem;
	}

	.spectator-reaction-float.lg .float-emoji {
		font-size: 2.5rem;
	}

	.spectator-reaction-float.xl .float-emoji {
		font-size: 3rem;
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
		font-size: 0.875rem;
		font-weight: 700;
		color: var(--color-primary, #6366f1);
		text-shadow:
			1px 1px 0 var(--color-surface-1, #0f0f1a),
			-1px -1px 0 var(--color-surface-1, #0f0f1a),
			1px -1px 0 var(--color-surface-1, #0f0f1a),
			-1px 1px 0 var(--color-surface-1, #0f0f1a);
	}

	.spectator-reaction-float.lg .combo-count,
	.spectator-reaction-float.xl .combo-count {
		font-size: 1rem;
	}

	.spectator-name {
		font-size: 0.625rem;
		color: var(--color-text-secondary, #a0a0a0);
		background: var(--color-surface-2, #1a1a2e);
		padding: 0.125rem 0.375rem;
		border-radius: 0.25rem;
		white-space: nowrap;
		max-width: 80px;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	/* Combo effects */
	.spectator-reaction-float.combo {
		animation:
			floatUp var(--duration) ease-out forwards,
			shake 0.2s ease-in-out;
	}

	@keyframes shake {
		0%,
		100% {
			transform: translateX(-50%) rotate(0deg);
		}
		25% {
			transform: translateX(-50%) rotate(-5deg);
		}
		75% {
			transform: translateX(-50%) rotate(5deg);
		}
	}

	/* Reduced motion */
	@media (prefers-reduced-motion: reduce) {
		.spectator-reaction-float {
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

		.spectator-reaction-float.xl .float-emoji,
		.spectator-reaction-float.combo {
			animation: fadeOut var(--duration) ease-out forwards;
		}
	}
</style>
