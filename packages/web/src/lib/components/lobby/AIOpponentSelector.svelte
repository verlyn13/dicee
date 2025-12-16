<script lang="ts">
/**
 * AI Opponent Selector
 *
 * Grid of AI profiles for selecting opponents in Quick Play mode.
 * Supports multi-select (1-3 AI opponents).
 * Shows avatar, name, skill level, and personality tagline.
 *
 * Design: Neo-Brutalist cards with skill indicators and checkbox-like multi-select
 */

import Avatar from '../ui/Avatar.svelte';

/**
 * AI Profile type (matches cloudflare-do/src/ai/types.ts)
 */
interface AIProfile {
	id: string;
	name: string;
	avatarSeed: string;
	tagline: string;
	skillLevel: number;
}

interface Props {
	/** Currently selected profile IDs (array for multi-select) */
	selected?: string[];
	/** Callback when selection changes */
	onSelect: (profileIds: string[]) => void;
	/** Maximum AI opponents to select (default: 3) */
	maxSelection?: number;
	/** Whether selection is disabled */
	disabled?: boolean;
}

let props: Props = $props();

// Destructure with reactivity
const selected = $derived(props.selected ?? []);
const onSelect = $derived(props.onSelect);
const maxSelection = $derived(props.maxSelection ?? 3);
const disabled = $derived(props.disabled ?? false);

// Derived: selection count for UI
const selectionCount = $derived(selected.length);
const isAtMax = $derived(selectionCount >= maxSelection);

/**
 * Pre-built AI profiles (synced with cloudflare-do/src/ai/profiles.ts)
 */
const AI_PROFILES: AIProfile[] = [
	{
		id: 'riley',
		name: 'Riley',
		avatarSeed: 'riley-beginner-dice',
		tagline: 'Still learning the ropes!',
		skillLevel: 0.35,
	},
	{
		id: 'carmen',
		name: 'Carmen',
		avatarSeed: 'carmen-intermediate-dice',
		tagline: 'May the dice be ever in your favor',
		skillLevel: 0.6,
	},
	{
		id: 'liam',
		name: 'Liam',
		avatarSeed: 'liam-risktaker-dice',
		tagline: 'Go big or go home!',
		skillLevel: 0.7,
	},
	{
		id: 'professor',
		name: 'Professor',
		avatarSeed: 'professor-expert-dice',
		tagline: 'The math never lies.',
		skillLevel: 0.95,
	},
	{
		id: 'charlie',
		name: 'Charlie',
		avatarSeed: 'charlie-chaos-dice',
		tagline: 'Chaos is a ladder! Or a snake.',
		skillLevel: 0.2,
	},
];

/**
 * Get difficulty label from skill level
 */
function getDifficultyLabel(skillLevel: number): string {
	if (skillLevel >= 0.9) return 'Expert';
	if (skillLevel >= 0.65) return 'Hard';
	if (skillLevel >= 0.45) return 'Medium';
	if (skillLevel >= 0.25) return 'Easy';
	return 'Chaos';
}

/**
 * Get difficulty color class
 */
function getDifficultyClass(skillLevel: number): string {
	if (skillLevel >= 0.9) return 'difficulty--expert';
	if (skillLevel >= 0.65) return 'difficulty--hard';
	if (skillLevel >= 0.45) return 'difficulty--medium';
	if (skillLevel >= 0.25) return 'difficulty--easy';
	return 'difficulty--chaos';
}

/**
 * Check if profile is selected
 */
function isSelected(profileId: string): boolean {
	return selected.includes(profileId);
}

/**
 * Handle profile toggle (multi-select)
 */
function handleSelect(profileId: string) {
	if (disabled) return;

	if (isSelected(profileId)) {
		// Deselect - but keep at least 1 selected
		if (selectionCount > 1) {
			onSelect(selected.filter((id) => id !== profileId));
		}
	} else if (!isAtMax) {
		// Select if under max limit
		onSelect([...selected, profileId]);
	}
}

/**
 * Handle keyboard navigation
 */
function handleKeydown(event: KeyboardEvent, profileId: string) {
	if (event.key === 'Enter' || event.key === ' ') {
		event.preventDefault();
		handleSelect(profileId);
	}
}
</script>

<div class="ai-selector" role="group" aria-label="Select AI opponents">
	<div class="ai-selector__header">
		<h3 class="ai-selector__title">Choose Your Opponents</h3>
		<span class="ai-selector__count" class:at-max={isAtMax}>
			{selectionCount}/{maxSelection} selected
		</span>
	</div>

	<div class="carousel-hint" aria-hidden="true">
		← Scroll to see all AI opponents →
	</div>

	<div class="ai-selector__grid">
		{#each AI_PROFILES as profile (profile.id)}
			{@const profileSelected = isSelected(profile.id)}
			{@const canSelect = profileSelected || !isAtMax}
			<button
				type="button"
				class="ai-card"
				class:ai-card--selected={profileSelected}
				class:ai-card--disabled={disabled || (!profileSelected && isAtMax)}
				role="checkbox"
				aria-checked={profileSelected}
				aria-disabled={disabled || (!profileSelected && isAtMax)}
				onclick={() => handleSelect(profile.id)}
				onkeydown={(e) => handleKeydown(e, profile.id)}
			>
				<!-- Selection indicator -->
				<div class="ai-card__check" aria-hidden="true">
					{#if profileSelected}
						<span class="check-icon">✓</span>
					{/if}
				</div>

				<div class="ai-card__avatar">
					<Avatar seed={profile.avatarSeed} size="lg" alt={profile.name} />
					<span class="ai-card__robot-badge" aria-label="AI Player">🤖</span>
				</div>

				<div class="ai-card__info">
					<span class="ai-card__name">{profile.name}</span>
					<span class="ai-card__tagline">{profile.tagline}</span>
				</div>

				<div class="ai-card__difficulty {getDifficultyClass(profile.skillLevel)}">
					<span class="difficulty__label">{getDifficultyLabel(profile.skillLevel)}</span>
					<div class="difficulty__bar" aria-hidden="true">
						<div class="difficulty__fill" style="width: {profile.skillLevel * 100}%"></div>
					</div>
				</div>
			</button>
		{/each}
	</div>

	<p class="ai-selector__hint">
		Select 1-{maxSelection} AI opponents. Click to toggle selection.
	</p>
</div>

<style>
	.ai-selector {
		width: 100%;
	}

	.ai-selector__header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: var(--spacing-md);
		flex-wrap: wrap;
		gap: var(--spacing-sm);
	}

	.ai-selector__title {
		font-size: var(--font-size-lg);
		font-weight: var(--font-weight-bold);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		margin: 0;
	}

	.ai-selector__count {
		font-size: var(--font-size-sm);
		font-weight: var(--font-weight-semibold);
		padding: var(--spacing-xs) var(--spacing-sm);
		background: var(--color-surface-alt);
		border: var(--border-thin);
	}

	.ai-selector__count.at-max {
		background: var(--color-warning);
		color: var(--color-text);
	}

	.ai-selector__grid {
		display: flex;
		gap: var(--spacing-md);
		overflow-x: auto;
		scroll-snap-type: x mandatory;
		scroll-behavior: smooth;
		padding-bottom: var(--spacing-sm);

		/* Hide scrollbar, keep functionality */
		scrollbar-width: none;
		-ms-overflow-style: none;
	}

	.ai-selector__grid::-webkit-scrollbar {
		display: none;
	}

	.ai-selector__hint {
		margin-top: var(--spacing-md);
		font-size: var(--font-size-sm);
		color: var(--color-text-muted);
		text-align: center;
	}

	.carousel-hint {
		text-align: center;
		font-size: var(--font-size-sm);
		color: var(--color-text-muted);
		margin-bottom: var(--spacing-sm);
		font-style: italic;
	}

	.ai-card {
		/* Reset button styles */
		appearance: none;
		border: none;
		background: none;
		font: inherit;
		cursor: pointer;
		text-align: left;

		/* Card styling */
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--spacing-sm);
		padding: var(--spacing-md);
		padding-top: calc(var(--spacing-md) + 8px);

		/* Fixed width for carousel */
		min-width: 180px;
		max-width: 180px;
		flex-shrink: 0;
		scroll-snap-align: start;

		/* Neo-Brutalist */
		background: var(--color-surface);
		border: var(--border-medium);

		transition:
			transform var(--transition-fast),
			box-shadow var(--transition-fast);
	}

	.ai-card:hover:not(.ai-card--disabled) {
		transform: translate(-2px, -2px);
		box-shadow: 4px 4px 0 var(--color-border);
	}

	.ai-card:active:not(.ai-card--disabled) {
		transform: translate(0, 0);
		box-shadow: none;
	}

	.ai-card--selected {
		background: var(--color-success, #90ee90);
		border-color: var(--color-text, #000);
		border-width: 3px;
		box-shadow: 4px 4px 0 var(--color-text, #000);
		transform: translate(-2px, -2px);
	}

	.ai-card--selected:hover {
		box-shadow: 6px 6px 0 var(--color-text, #000);
	}

	.ai-card--disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	/* Selection checkbox indicator */
	.ai-card__check {
		position: absolute;
		top: 8px;
		right: 8px;
		width: 24px;
		height: 24px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--color-surface);
		border: 2px solid var(--color-border);
		font-size: 14px;
		font-weight: bold;
	}

	.ai-card--selected .ai-card__check {
		background: var(--color-text, #000);
		border-color: var(--color-text, #000);
	}

	.check-icon {
		color: var(--color-surface);
	}

	.ai-card__avatar {
		position: relative;
	}

	.ai-card__robot-badge {
		position: absolute;
		bottom: -4px;
		right: -4px;
		font-size: 1.25rem;
		background: var(--color-surface);
		border: var(--border-thin);
		padding: 2px 4px;
		line-height: 1;
	}

	.ai-card__info {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--spacing-xs);
		text-align: center;
	}

	.ai-card__name {
		font-size: var(--font-size-md);
		font-weight: var(--font-weight-bold);
	}

	.ai-card__tagline {
		font-size: var(--font-size-sm);
		color: var(--color-text-muted);
		font-style: italic;
	}

	.ai-card__difficulty {
		width: 100%;
		display: flex;
		flex-direction: column;
		gap: var(--spacing-xs);
	}

	.difficulty__label {
		font-size: var(--font-size-xs);
		font-weight: var(--font-weight-bold);
		text-transform: uppercase;
		letter-spacing: 0.1em;
		text-align: center;
	}

	.difficulty__bar {
		height: 6px;
		background: var(--color-surface-alt);
		border: 1px solid var(--color-border);
		overflow: hidden;
	}

	.difficulty__fill {
		height: 100%;
		transition: width var(--transition-normal);
	}

	/* Difficulty color variants */
	.difficulty--easy .difficulty__label {
		color: var(--color-success);
	}
	.difficulty--easy .difficulty__fill {
		background: var(--color-success);
	}

	.difficulty--medium .difficulty__label {
		color: var(--color-warning);
	}
	.difficulty--medium .difficulty__fill {
		background: var(--color-warning);
	}

	.difficulty--hard .difficulty__label {
		color: var(--color-error);
	}
	.difficulty--hard .difficulty__fill {
		background: var(--color-error);
	}

	.difficulty--expert .difficulty__label {
		color: var(--color-primary);
	}
	.difficulty--expert .difficulty__fill {
		background: var(--color-primary);
	}

	.difficulty--chaos .difficulty__label {
		color: var(--color-accent);
	}
	.difficulty--chaos .difficulty__fill {
		background: linear-gradient(
			90deg,
			var(--color-error),
			var(--color-warning),
			var(--color-success),
			var(--color-primary)
		);
	}

	/* Focus styles */
	.ai-card:focus-visible {
		outline: 3px solid var(--color-primary);
		outline-offset: 2px;
	}

	/* Responsive */
	@media (max-width: 480px) {
		.ai-card {
			padding: var(--spacing-sm);
			padding-top: calc(var(--spacing-sm) + 8px);
			min-width: 160px;
			max-width: 160px;
		}

		.ai-card__tagline {
			display: none;
		}

		.carousel-hint {
			font-size: var(--font-size-xs);
		}
	}
</style>
