<script lang="ts">
/**
 * AI Badge
 *
 * Visual indicator that a player is an AI opponent.
 * Shows robot emoji with optional tooltip showing profile info.
 *
 * Design: Neo-Brutalist badge with hard borders
 */

interface Props {
	/** AI profile name (e.g., "Riley", "Professor") */
	profileName?: string;
	/** AI profile tagline */
	tagline?: string;
	/** Size variant */
	size?: 'sm' | 'md' | 'lg';
	/** Show tooltip on hover */
	showTooltip?: boolean;
}

let { profileName, tagline, size = 'md', showTooltip = true }: Props = $props();

let showingTooltip = $state(false);

function handleMouseEnter() {
	if (showTooltip && (profileName || tagline)) {
		showingTooltip = true;
	}
}

function handleMouseLeave() {
	showingTooltip = false;
}
</script>

{#if showTooltip && (profileName || tagline)}
	<button 
		type="button"
		class="ai-badge ai-badge--{size} ai-badge--interactive"
		aria-label="AI Player{profileName ? `: ${profileName}` : ''}"
		onmouseenter={handleMouseEnter}
		onmouseleave={handleMouseLeave}
		onfocus={handleMouseEnter}
		onblur={handleMouseLeave}
	>
		<span class="ai-badge__icon" aria-hidden="true">🤖</span>
		
		{#if showingTooltip}
			<span class="ai-badge__tooltip" role="tooltip">
				{#if profileName}
					<span class="ai-badge__name">{profileName}</span>
				{/if}
				{#if tagline}
					<span class="ai-badge__tagline">{tagline}</span>
				{/if}
			</span>
		{/if}
	</button>
{:else}
	<span 
		class="ai-badge ai-badge--{size}"
		role="img"
		aria-label="AI Player"
	>
		<span class="ai-badge__icon">🤖</span>
	</span>
{/if}

<style>
	.ai-badge {
		position: relative;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		
		/* Neo-Brutalist */
		background: var(--color-surface);
		border: var(--border-thin);
		
		cursor: default;
	}

	/* Reset button styles for interactive variant */
	.ai-badge--interactive {
		appearance: none;
		font: inherit;
		color: inherit;
		
		cursor: default;
	}

	.ai-badge__icon {
		line-height: 1;
	}

	/* Size variants */
	.ai-badge--sm {
		padding: 1px 3px;
		font-size: 0.75rem;
	}

	.ai-badge--md {
		padding: 2px 4px;
		font-size: 1rem;
	}

	.ai-badge--lg {
		padding: 4px 6px;
		font-size: 1.25rem;
	}

	/* Tooltip */
	.ai-badge__tooltip {
		position: absolute;
		bottom: calc(100% + 8px);
		left: 50%;
		transform: translateX(-50%);
		
		display: flex;
		flex-direction: column;
		gap: 2px;
		
		padding: var(--spacing-xs) var(--spacing-sm);
		min-width: 120px;
		max-width: 200px;
		
		/* Neo-Brutalist */
		background: var(--color-surface);
		border: var(--border-medium);
		box-shadow: 3px 3px 0 var(--color-border);
		
		text-align: center;
		white-space: nowrap;
		z-index: var(--z-tooltip);
		
		/* Arrow */
		&::after {
			content: '';
			position: absolute;
			top: 100%;
			left: 50%;
			transform: translateX(-50%);
			
			border: 6px solid transparent;
			border-top-color: var(--color-border);
		}
	}

	.ai-badge__name {
		font-size: var(--font-size-sm);
		font-weight: var(--font-weight-bold);
	}

	.ai-badge__tagline {
		font-size: var(--font-size-xs);
		color: var(--color-text-muted);
		font-style: italic;
		white-space: normal;
	}

	/* Focus styles */
	.ai-badge:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 1px;
	}
</style>
