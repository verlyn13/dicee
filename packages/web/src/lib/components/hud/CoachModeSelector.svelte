<script lang="ts">
import { COACH_LEVEL_INFO, type CoachLevel, coach } from '$lib/stores/coach.svelte.js';

interface Props {
	/** Compact mode - show only icon + current level */
	compact?: boolean;
	/** Callback when level changes */
	onchange?: (level: CoachLevel) => void;
}

let { compact = false, onchange }: Props = $props();

const levels: CoachLevel[] = ['off', 'hints', 'coach', 'training'];

function handleSelect(level: CoachLevel) {
	coach.setLevel(level);
	onchange?.(level);
}

// Expanded state for compact mode
let expanded = $state(false);

function toggleExpanded() {
	expanded = !expanded;
}

function handleClickOutside(event: MouseEvent) {
	const target = event.target as HTMLElement;
	if (!target.closest('.selector-compact')) {
		expanded = false;
	}
}
</script>

<svelte:window onclick={handleClickOutside} />

{#if compact}
	<!-- Compact Mode: Dropdown -->
	<div class="selector-compact" class:expanded>
		<button
			class="compact-trigger"
			onclick={toggleExpanded}
			aria-expanded={expanded}
			aria-haspopup="listbox"
		>
			<span class="compact-icon">{COACH_LEVEL_INFO[coach.level].icon}</span>
			<span class="compact-label">{COACH_LEVEL_INFO[coach.level].label}</span>
			<span class="compact-chevron" aria-hidden="true">▾</span>
		</button>

		{#if expanded}
			<div class="compact-dropdown" role="listbox" aria-label="Coach mode">
				{#each levels as level}
					<button
						class="dropdown-option"
						class:selected={coach.level === level}
						onclick={() => {
							handleSelect(level);
							expanded = false;
						}}
						role="option"
						aria-selected={coach.level === level}
					>
						<span class="option-icon">{COACH_LEVEL_INFO[level].icon}</span>
						<span class="option-content">
							<span class="option-label">{COACH_LEVEL_INFO[level].label}</span>
							<span class="option-desc">{COACH_LEVEL_INFO[level].description}</span>
						</span>
						{#if coach.level === level}
							<span class="option-check" aria-hidden="true">✓</span>
						{/if}
					</button>
				{/each}
			</div>
		{/if}
	</div>
{:else}
	<!-- Full Mode: Radio Buttons -->
	<div class="selector-full" role="radiogroup" aria-label="Coach mode">
		<div class="selector-header">
			<span class="header-icon">🎓</span>
			<span class="header-title">Coach Mode</span>
		</div>

		<div class="options-grid">
			{#each levels as level}
				<button
					class="option-card"
					class:selected={coach.level === level}
					onclick={() => handleSelect(level)}
					role="radio"
					aria-checked={coach.level === level}
				>
					<span class="card-icon">{COACH_LEVEL_INFO[level].icon}</span>
					<span class="card-label">{COACH_LEVEL_INFO[level].label}</span>
					<span class="card-desc">{COACH_LEVEL_INFO[level].description}</span>
				</button>
			{/each}
		</div>
	</div>
{/if}

<style>
	/* Compact Mode */
	.selector-compact {
		position: relative;
		display: inline-block;
	}

	.compact-trigger {
		display: flex;
		align-items: center;
		gap: var(--space-1);
		padding: var(--space-1) var(--space-2);
		background: var(--color-surface);
		border: var(--border-thin);
		font-size: var(--text-small);
		cursor: pointer;
		transition: border-color var(--transition-fast);
	}

	.compact-trigger:hover {
		border-color: var(--color-accent);
	}

	.compact-icon {
		font-size: var(--text-body);
	}

	.compact-label {
		font-weight: var(--weight-semibold);
	}

	.compact-chevron {
		font-size: var(--text-tiny);
		color: var(--color-text-muted);
		transition: transform var(--transition-fast);
	}

	.selector-compact.expanded .compact-chevron {
		transform: rotate(180deg);
	}

	.compact-dropdown {
		position: absolute;
		top: 100%;
		left: 0;
		min-width: 240px;
		background: var(--color-surface);
		border: var(--border-medium);
		z-index: 50;
		margin-top: var(--space-1);
	}

	.dropdown-option {
		display: flex;
		align-items: flex-start;
		gap: var(--space-2);
		width: 100%;
		padding: var(--space-2);
		background: none;
		border: none;
		border-bottom: var(--border-thin);
		text-align: left;
		cursor: pointer;
		transition: background var(--transition-fast);
	}

	.dropdown-option:last-child {
		border-bottom: none;
	}

	.dropdown-option:hover {
		background: var(--color-background);
	}

	.dropdown-option.selected {
		background: color-mix(in srgb, var(--color-accent) 15%, transparent);
	}

	.option-icon {
		font-size: var(--text-h3);
		flex-shrink: 0;
	}

	.option-content {
		flex: 1;
		display: flex;
		flex-direction: column;
	}

	.option-label {
		font-weight: var(--weight-semibold);
	}

	.option-desc {
		font-size: var(--text-tiny);
		color: var(--color-text-muted);
	}

	.option-check {
		color: var(--color-success);
		font-weight: var(--weight-bold);
	}

	/* Full Mode */
	.selector-full {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}

	.selector-header {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}

	.header-icon {
		font-size: var(--text-h3);
	}

	.header-title {
		font-size: var(--text-h3);
		font-weight: var(--weight-bold);
	}

	.options-grid {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: var(--space-2);
	}

	.option-card {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-1);
		padding: var(--space-3);
		background: var(--color-surface);
		border: var(--border-medium);
		cursor: pointer;
		transition:
			border-color var(--transition-fast),
			background var(--transition-fast),
			transform var(--transition-fast);
	}

	.option-card:hover {
		border-color: var(--color-accent);
		transform: translateY(-2px);
	}

	.option-card.selected {
		border-color: var(--color-success);
		border-width: 2px;
		background: color-mix(in srgb, var(--color-success) 10%, transparent);
	}

	.card-icon {
		font-size: var(--text-h2);
	}

	.card-label {
		font-weight: var(--weight-bold);
		font-size: var(--text-body);
	}

	.card-desc {
		font-size: var(--text-tiny);
		color: var(--color-text-muted);
		text-align: center;
	}

	/* Responsive */
	@media (max-width: 400px) {
		.options-grid {
			grid-template-columns: 1fr;
		}

		.compact-dropdown {
			right: 0;
			left: auto;
		}
	}
</style>
