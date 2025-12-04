<script lang="ts">
import type { StatsProfile } from '$lib/types.js';

interface Props {
	enabled: boolean;
	profile: StatsProfile;
	onToggle: () => void;
	onProfileChange: (profile: StatsProfile) => void;
}

let { enabled, profile, onToggle, onProfileChange }: Props = $props();

const profiles: { value: StatsProfile; label: string; description: string }[] = [
	{
		value: 'beginner',
		label: 'Beginner',
		description: 'Simple guidance without numbers',
	},
	{
		value: 'intermediate',
		label: 'Intermediate',
		description: 'Probabilities and expected values',
	},
	{
		value: 'expert',
		label: 'Expert',
		description: 'Full analysis tools',
	},
];

let showDropdown = $state(false);

function selectProfile(newProfile: StatsProfile) {
	onProfileChange(newProfile);
	showDropdown = false;
}
</script>

<div class="stats-control">
	<!-- Toggle Button -->
	<button
		class="stats-toggle"
		class:enabled
		onclick={onToggle}
		aria-pressed={enabled}
		aria-label="Toggle statistics display"
	>
		<div class="toggle-track">
			<div class="toggle-thumb"></div>
		</div>
		<span class="toggle-label">
			Stats: {enabled ? 'ON' : 'OFF'}
		</span>
	</button>

	<!-- Profile Selector -->
	{#if enabled}
		<div class="profile-selector">
			<button
				class="profile-button"
				onclick={() => (showDropdown = !showDropdown)}
				aria-expanded={showDropdown}
				aria-haspopup="menu"
			>
				<span class="profile-current">{profile}</span>
				<span class="dropdown-arrow">{showDropdown ? '▲' : '▼'}</span>
			</button>

			{#if showDropdown}
				<div class="profile-dropdown" role="menu" aria-label="Stats profile options">
					{#each profiles as p}
						<button
							class="profile-option"
							class:selected={profile === p.value}
							onclick={() => selectProfile(p.value)}
							role="menuitem"
							aria-current={profile === p.value ? 'true' : undefined}
						>
							<span class="option-label">{p.label}</span>
							<span class="option-description">{p.description}</span>
						</button>
					{/each}
				</div>
			{/if}
		</div>
	{/if}
</div>

<style>
	.stats-control {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}

	/* Toggle */
	.stats-toggle {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-1) var(--space-2);
		background: var(--color-surface);
		border: var(--border-medium);
		cursor: pointer;
		transition:
			border-color var(--transition-fast),
			background var(--transition-fast);
	}

	.stats-toggle:hover {
		border-color: var(--color-accent);
	}

	.stats-toggle.enabled {
		background: var(--color-accent-light);
		border-color: var(--color-accent);
	}

	.toggle-track {
		position: relative;
		width: 40px;
		height: 20px;
		background: var(--color-disabled);
		border: var(--border-thin);
		transition: background var(--transition-fast);
	}

	.stats-toggle.enabled .toggle-track {
		background: var(--color-accent);
	}

	.toggle-thumb {
		position: absolute;
		top: 2px;
		left: 2px;
		width: 14px;
		height: 14px;
		background: var(--color-surface);
		border: var(--border-thin);
		transition: transform var(--transition-fast);
	}

	.stats-toggle.enabled .toggle-thumb {
		transform: translateX(20px);
	}

	.toggle-label {
		font-size: var(--text-small);
		font-weight: var(--weight-semibold);
		text-transform: uppercase;
		letter-spacing: var(--tracking-wide);
	}

	/* Profile Selector */
	.profile-selector {
		position: relative;
	}

	.profile-button {
		display: flex;
		align-items: center;
		gap: var(--space-1);
		padding: var(--space-1) var(--space-2);
		background: var(--color-surface);
		border: var(--border-thin);
		font-size: var(--text-small);
		text-transform: capitalize;
		cursor: pointer;
		transition:
			border-color var(--transition-fast),
			background var(--transition-fast);
	}

	.profile-button:hover {
		border-color: var(--color-accent);
		background: var(--color-accent-light);
	}

	.profile-current {
		font-weight: var(--weight-semibold);
	}

	.dropdown-arrow {
		font-size: var(--text-tiny);
		color: var(--color-text-muted);
	}

	/* Dropdown */
	.profile-dropdown {
		position: absolute;
		top: 100%;
		left: 0;
		right: 0;
		min-width: 200px;
		background: var(--color-surface);
		border: var(--border-medium);
		z-index: var(--z-tooltip);
		margin-top: 4px;
	}

	.profile-option {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		width: 100%;
		padding: var(--space-2);
		background: none;
		border: none;
		border-bottom: var(--border-thin);
		text-align: left;
		cursor: pointer;
		transition: background var(--transition-fast);
	}

	.profile-option:last-child {
		border-bottom: none;
	}

	.profile-option:hover {
		background: var(--color-accent-light);
	}

	.profile-option.selected {
		background: var(--color-accent);
	}

	.option-label {
		font-weight: var(--weight-semibold);
		font-size: var(--text-small);
		text-transform: capitalize;
	}

	.option-description {
		font-size: var(--text-tiny);
		color: var(--color-text-muted);
		margin-top: 2px;
	}

	.profile-option.selected .option-description {
		color: var(--color-text);
	}

	/* Responsive */
	@media (max-width: 480px) {
		.stats-control {
			flex-direction: column;
			align-items: stretch;
		}

		.profile-dropdown {
			left: auto;
			right: 0;
		}
	}
</style>
