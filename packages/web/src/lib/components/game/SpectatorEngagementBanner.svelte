<script lang="ts">
/**
 * SpectatorEngagementBanner Component
 *
 * Displays ephemeral notifications when spectators send reactions.
 * Shows the spectator name, emoji, and optional combo count.
 * Auto-fades after display duration.
 */
import type { SpectatorEngagement } from '$lib/stores/multiplayerGame.svelte';

interface Props {
	/** List of active spectator engagements */
	engagements: SpectatorEngagement[];
}

let { engagements }: Props = $props();

// Emoji labels for accessibility
const emojiLabels: Record<string, string> = {
	'👍': 'Nice!',
	'🎲': 'Good roll!',
	'😱': 'Wow!',
	'💀': 'Oof',
	'🎉': 'Dicee!',
	'🍿': 'Drama!',
	'📢': 'Called it!',
	'🙈': "Can't watch",
	'🪦': 'RIP',
	'🔥': 'On fire!',
	'🤡': 'Clown play',
	'📣': "Let's GO!",
	'💪': 'You got this',
};

function getLabel(emoji: string): string {
	return emojiLabels[emoji] ?? emoji;
}
</script>

{#if engagements.length > 0}
	<div class="spectator-engagement-banner" role="status" aria-live="polite">
		{#each engagements as engagement (engagement.id)}
			<div class="engagement-item" class:combo={engagement.comboCount > 1}>
				<span class="engagement-emoji" aria-label={getLabel(engagement.emoji)}>
					{engagement.emoji}
				</span>
				<span class="engagement-name">{engagement.spectatorName}</span>
				{#if engagement.comboCount > 1}
					<span class="combo-badge">×{engagement.comboCount}</span>
				{/if}
			</div>
		{/each}
	</div>
{/if}

<style>
	.spectator-engagement-banner {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-1);
		padding: var(--space-2);
		justify-content: center;
		background: linear-gradient(
			to right,
			transparent,
			var(--color-accent-light),
			transparent
		);
	}

	.engagement-item {
		display: flex;
		align-items: center;
		gap: var(--space-1);
		padding: var(--space-1) var(--space-2);
		background: var(--color-surface);
		border: var(--border-thin);
		border-radius: 999px;
		font-size: var(--text-small);
		animation: engagement-pop 0.3s ease-out, engagement-fade 4s ease-in forwards;
		box-shadow: 2px 2px 0 var(--color-border);
	}

	.engagement-item.combo {
		background: var(--color-accent);
		border-color: var(--color-accent-dark);
	}

	.engagement-emoji {
		font-size: 1.2em;
	}

	.engagement-name {
		font-weight: var(--weight-semibold);
		max-width: 100px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.combo-badge {
		font-family: var(--font-mono);
		font-size: 0.75em;
		font-weight: var(--weight-bold);
		padding: 2px 6px;
		background: var(--color-warning);
		border-radius: 4px;
		color: var(--color-text);
	}

	@keyframes engagement-pop {
		0% {
			opacity: 0;
			transform: scale(0.8) translateY(10px);
		}
		50% {
			transform: scale(1.05) translateY(-2px);
		}
		100% {
			opacity: 1;
			transform: scale(1) translateY(0);
		}
	}

	@keyframes engagement-fade {
		0%, 75% {
			opacity: 1;
		}
		100% {
			opacity: 0;
		}
	}

	/* Reduced motion preference */
	@media (prefers-reduced-motion: reduce) {
		.engagement-item {
			animation: none;
			opacity: 1;
		}
	}

	/* Mobile: Stack vertically when many items */
	@media (max-width: 480px) {
		.spectator-engagement-banner {
			flex-direction: column;
			align-items: center;
		}
	}
</style>
