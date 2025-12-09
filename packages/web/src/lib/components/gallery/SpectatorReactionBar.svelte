<!--
  SpectatorReactionBar.svelte - Enhanced reaction picker for spectators

  Features:
  - Shows all available reactions (standard + spectator-exclusive)
  - Shows rooting reactions only when backing a player
  - Rate limit indicator
  - Haptic feedback on selection
  - Categorized layout with dividers
-->
<script lang="ts">
import {
	REACTION_METADATA,
	ROOTING_REACTIONS,
	SPECTATOR_REACTIONS,
	type SpectatorReactionEmoji,
	STANDARD_REACTIONS,
	spectatorService,
} from '$lib/services/spectatorService.svelte';
import { haptic } from '$lib/utils/haptics';

interface Props {
	/** Optional target player for the reaction */
	targetPlayerId?: string;
	/** Callback when reaction is sent */
	onReact?: (emoji: SpectatorReactionEmoji) => void;
	/** Whether to show labels */
	showLabels?: boolean;
	/** Compact mode (smaller buttons) */
	compact?: boolean;
}

let { targetPlayerId, onReact, showLabels = false, compact = false }: Props = $props();

// Derived state from service
const canSend = $derived(spectatorService.canSendReaction);
const rateLimit = $derived(spectatorService.reactionRateLimit);
const myRootingChoice = $derived(spectatorService.myRootingChoice);

// Calculate remaining reactions
const rateLimitDisplay = $derived(() => {
	if (!rateLimit) return null;
	const remaining = Math.max(0, rateLimit.remaining);
	const total = 10; // Default max reactions
	return { remaining, total };
});

// Group reactions by category
const standardGroup = STANDARD_REACTIONS;
const spectatorGroup = SPECTATOR_REACTIONS;
const rootingGroup = $derived(myRootingChoice ? ROOTING_REACTIONS : []);

function handleReact(emoji: SpectatorReactionEmoji) {
	if (!canSend) return;

	haptic('light');
	spectatorService.sendSpectatorReaction(emoji, targetPlayerId);
	onReact?.(emoji);
}

function handleKeyDown(event: KeyboardEvent, emoji: SpectatorReactionEmoji) {
	if (event.key === 'Enter' || event.key === ' ') {
		event.preventDefault();
		handleReact(emoji);
	}
}
</script>

<div
	class="spectator-reaction-bar"
	class:compact
	class:disabled={!canSend}
	role="toolbar"
	aria-label="Spectator reactions"
>
	<!-- Standard reactions -->
	<div class="reaction-group" role="group" aria-label="Standard reactions">
		{#each standardGroup as emoji (emoji)}
			{@const meta = REACTION_METADATA[emoji]}
			<button
				type="button"
				class="reaction-btn"
				class:compact
				onclick={() => handleReact(emoji)}
				onkeydown={(e) => handleKeyDown(e, emoji)}
				disabled={!canSend}
				aria-label={meta.label}
				title={meta.label}
			>
				<span class="reaction-emoji">{emoji}</span>
				{#if showLabels}
					<span class="reaction-label">{meta.label}</span>
				{/if}
			</button>
		{/each}
	</div>

	<div class="divider"></div>

	<!-- Spectator-exclusive reactions -->
	<div class="reaction-group spectator-exclusive" role="group" aria-label="Spectator reactions">
		{#each spectatorGroup as emoji (emoji)}
			{@const meta = REACTION_METADATA[emoji]}
			<button
				type="button"
				class="reaction-btn exclusive"
				class:compact
				onclick={() => handleReact(emoji)}
				onkeydown={(e) => handleKeyDown(e, emoji)}
				disabled={!canSend}
				aria-label={meta.label}
				title={meta.label}
			>
				<span class="reaction-emoji">{emoji}</span>
				{#if showLabels}
					<span class="reaction-label">{meta.label}</span>
				{/if}
			</button>
		{/each}
	</div>

	<!-- Rooting reactions (only if backing a player) -->
	{#if rootingGroup.length > 0}
		<div class="divider"></div>
		<div class="reaction-group rooting" role="group" aria-label="Rooting reactions">
			{#each rootingGroup as emoji (emoji)}
				{@const meta = REACTION_METADATA[emoji]}
				<button
					type="button"
					class="reaction-btn rooting"
					class:compact
					onclick={() => handleReact(emoji)}
					onkeydown={(e) => handleKeyDown(e, emoji)}
					disabled={!canSend}
					aria-label={meta.label}
					title={meta.label}
				>
					<span class="reaction-emoji">{emoji}</span>
					{#if showLabels}
						<span class="reaction-label">{meta.label}</span>
					{/if}
				</button>
			{/each}
		</div>
	{/if}

	<!-- Rate limit indicator -->
	{#if rateLimitDisplay()}
		<div class="rate-limit" class:warning={rateLimitDisplay()!.remaining <= 2}>
			<span class="rate-count">
				{rateLimitDisplay()!.remaining}/{rateLimitDisplay()!.total}
			</span>
		</div>
	{/if}
</div>

<style>
	.spectator-reaction-bar {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		padding: 0.5rem;
		background: var(--color-surface-1, #0f0f1a);
		border: 1px solid var(--color-border, #333);
		border-radius: 0.5rem;
		flex-wrap: wrap;
	}

	.spectator-reaction-bar.disabled {
		opacity: 0.5;
		pointer-events: none;
	}

	.reaction-group {
		display: flex;
		gap: 2px;
	}

	.divider {
		width: 1px;
		height: 24px;
		background: var(--color-border, #333);
		margin: 0 0.25rem;
	}

	.reaction-btn {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		width: 40px;
		height: 40px;
		background: transparent;
		border: none;
		border-radius: 0.375rem;
		cursor: pointer;
		transition: all 0.15s ease;
		padding: 0.25rem;
	}

	.reaction-btn.compact {
		width: 32px;
		height: 32px;
	}

	.reaction-btn:hover:not(:disabled) {
		background: var(--color-surface-2, #1a1a2e);
		transform: scale(1.1);
	}

	.reaction-btn:active:not(:disabled) {
		transform: scale(1.05);
	}

	.reaction-btn:disabled {
		cursor: not-allowed;
		opacity: 0.5;
	}

	.reaction-btn.exclusive:hover:not(:disabled) {
		background: var(--color-primary-alpha, rgba(99, 102, 241, 0.15));
	}

	.reaction-btn.rooting:hover:not(:disabled) {
		background: var(--color-success-alpha, rgba(16, 185, 129, 0.15));
	}

	.reaction-emoji {
		font-size: 1.25rem;
		line-height: 1;
	}

	.reaction-btn.compact .reaction-emoji {
		font-size: 1rem;
	}

	.reaction-label {
		font-size: 0.5rem;
		color: var(--color-text-tertiary, #666);
		margin-top: 2px;
		white-space: nowrap;
	}

	.rate-limit {
		display: flex;
		align-items: center;
		margin-left: auto;
		padding: 0.25rem 0.5rem;
		background: var(--color-surface-2, #1a1a2e);
		border-radius: 0.25rem;
		font-size: 0.75rem;
		color: var(--color-text-secondary, #a0a0a0);
	}

	.rate-limit.warning {
		color: var(--color-warning, #f59e0b);
		background: var(--color-warning-alpha, rgba(245, 158, 11, 0.1));
	}

	/* Touch-friendly on mobile */
	@media (max-width: 768px) {
		.reaction-btn {
			width: 44px;
			height: 44px;
		}

		.reaction-btn.compact {
			width: 36px;
			height: 36px;
		}

		.reaction-emoji {
			font-size: 1.375rem;
		}

		.reaction-btn.compact .reaction-emoji {
			font-size: 1.125rem;
		}
	}

	/* Reduced motion */
	@media (prefers-reduced-motion: reduce) {
		.reaction-btn {
			transition: none;
		}

		.reaction-btn:hover:not(:disabled) {
			transform: none;
		}
	}
</style>
