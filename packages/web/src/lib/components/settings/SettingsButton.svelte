<script lang="ts">
/**
 * SettingsButton
 *
 * Gear icon button that triggers the settings panel.
 * Designed to be placed in the header/HUD.
 */

interface Props {
	/** Callback when button is clicked */
	onclick: () => void;
	/** Whether settings panel is currently open */
	isOpen?: boolean;
}

let { onclick, isOpen = false }: Props = $props();
</script>

<button
	class="settings-button"
	class:active={isOpen}
	{onclick}
	aria-label="Open settings"
	aria-expanded={isOpen}
	title="Settings"
>
	<span class="icon">⚙️</span>
</button>

<style>
	.settings-button {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 36px;
		height: 36px;
		background: var(--color-surface);
		border: var(--border-thin);
		border-radius: var(--radius-sm);
		cursor: pointer;
		transition: all var(--transition-fast);
	}

	.settings-button:hover {
		background: var(--color-background);
		border-color: var(--color-accent);
	}

	.settings-button.active {
		background: color-mix(in srgb, var(--color-accent) 15%, transparent);
		border-color: var(--color-accent);
	}

	.icon {
		font-size: var(--text-h4);
		transition: transform var(--transition-normal);
	}

	.settings-button:hover .icon {
		transform: rotate(30deg);
	}

	.settings-button.active .icon {
		transform: rotate(90deg);
	}
</style>
