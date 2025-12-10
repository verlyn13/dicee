<script lang="ts">
/**
 * SettingsPanel
 *
 * Main settings panel for audio and haptic preferences.
 * v1 scope: Master volume, mute toggle, haptics toggle, reset to defaults.
 *
 * Uses prop injection pattern to avoid layer violations.
 */

import { isHapticsSupported } from '$lib/utils/haptics';

interface Props {
	/** Current master volume (0-100) */
	masterVolume: number;
	/** Whether audio is muted */
	muted: boolean;
	/** Whether haptics are enabled */
	hapticsEnabled: boolean;
	/** Callback when master volume changes */
	onVolumeChange: (volume: number) => void;
	/** Callback when mute state changes */
	onMuteChange: (muted: boolean) => void;
	/** Callback when haptics state changes */
	onHapticsChange: (enabled: boolean) => void;
	/** Callback to reset to defaults */
	onReset: () => void;
	/** Callback when panel is closed */
	onClose: () => void;
}

let {
	masterVolume,
	muted,
	hapticsEnabled,
	onVolumeChange,
	onMuteChange,
	onHapticsChange,
	onReset,
	onClose,
}: Props = $props();

// Haptic support check
const hapticsSupported = isHapticsSupported();

// Handlers
function handleVolumeInput(e: Event) {
	const target = e.target as HTMLInputElement;
	onVolumeChange(parseInt(target.value, 10));
}

function handleMuteToggle() {
	onMuteChange(!muted);
}

function handleHapticsToggle() {
	onHapticsChange(!hapticsEnabled);
}

function handleReset() {
	onReset();
}

function handleKeydown(e: KeyboardEvent) {
	if (e.key === 'Escape') {
		onClose();
	}
}
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="settings-panel" role="dialog" aria-label="Settings" aria-modal="true">
	<header class="panel-header">
		<h3 class="panel-title">
			<span class="title-icon">⚙️</span>
			Settings
		</h3>
		<button class="close-btn" onclick={onClose} aria-label="Close settings">×</button>
	</header>

	<div class="panel-content">
		<!-- Sound Section -->
		<div class="control-group">
			<h4 class="group-title">🔊 Sound</h4>

			<!-- Master Volume -->
			<div class="volume-slider">
				<label for="master-volume">
					<span class="slider-label">Master</span>
					<span class="slider-value">{masterVolume}%</span>
				</label>
				<input
					id="master-volume"
					type="range"
					min="0"
					max="100"
					step="5"
					value={masterVolume}
					oninput={handleVolumeInput}
					disabled={muted}
					aria-label="Master volume"
				/>
			</div>

			<!-- Mute Toggle -->
			<button
				class="toggle-btn"
				class:active={!muted}
				onclick={handleMuteToggle}
				aria-pressed={!muted}
			>
				<span class="toggle-icon">{muted ? '🔇' : '🔊'}</span>
				<span class="toggle-label">{muted ? 'Muted' : 'Sound On'}</span>
			</button>
		</div>

		<!-- Haptics Section -->
		<div class="control-group">
			<h4 class="group-title">📳 Haptics</h4>

			<button
				class="toggle-btn"
				class:active={hapticsEnabled}
				onclick={handleHapticsToggle}
				disabled={!hapticsSupported}
				aria-pressed={hapticsEnabled}
			>
				<span class="toggle-icon">📳</span>
				<span class="toggle-label">{hapticsEnabled ? 'Enabled' : 'Disabled'}</span>
			</button>

			{#if !hapticsSupported}
				<span class="support-note">Not supported on this device</span>
			{/if}
		</div>

		<!-- Reset Section -->
		<div class="control-group reset-section">
			<button class="reset-btn" onclick={handleReset}>
				<span class="reset-icon">↺</span>
				Reset to Defaults
			</button>
		</div>
	</div>
</div>

<style>
	.settings-panel {
		background: var(--color-surface);
		border: var(--border-thin);
		border-radius: var(--radius-md);
		min-width: 280px;
		max-width: 320px;
		box-shadow: var(--shadow-lg);
	}

	.panel-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: var(--space-2) var(--space-3);
		border-bottom: var(--border-thin);
	}

	.panel-title {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		font-size: var(--text-h4);
		font-weight: var(--weight-bold);
		margin: 0;
	}

	.title-icon {
		font-size: var(--text-h3);
	}

	.close-btn {
		padding: var(--space-1);
		background: none;
		border: none;
		font-size: var(--text-h3);
		color: var(--color-text-muted);
		cursor: pointer;
		line-height: 1;
	}

	.close-btn:hover {
		color: var(--color-text);
	}

	.panel-content {
		padding: var(--space-3);
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
	}

	/* Control Groups */
	.control-group {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.group-title {
		font-size: var(--text-small);
		font-weight: var(--weight-semibold);
		color: var(--color-text-muted);
		margin: 0;
	}

	/* Volume Slider */
	.volume-slider {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
	}

	.volume-slider label {
		display: flex;
		align-items: center;
		justify-content: space-between;
		font-size: var(--text-small);
	}

	.slider-label {
		font-weight: var(--weight-medium);
	}

	.slider-value {
		font-family: var(--font-mono);
		font-size: var(--text-tiny);
		color: var(--color-text-muted);
		min-width: 3em;
		text-align: right;
	}

	.volume-slider input[type='range'] {
		width: 100%;
		height: 6px;
		appearance: none;
		background: var(--color-border);
		border-radius: 3px;
		cursor: pointer;
	}

	.volume-slider input[type='range']::-webkit-slider-thumb {
		appearance: none;
		width: 18px;
		height: 18px;
		background: var(--color-accent);
		border-radius: 50%;
		cursor: pointer;
		transition: transform var(--transition-fast);
	}

	.volume-slider input[type='range']::-webkit-slider-thumb:hover {
		transform: scale(1.1);
	}

	.volume-slider input[type='range']::-moz-range-thumb {
		width: 18px;
		height: 18px;
		background: var(--color-accent);
		border: none;
		border-radius: 50%;
		cursor: pointer;
	}

	.volume-slider input[type='range']:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	/* Toggle Button */
	.toggle-btn {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-2) var(--space-3);
		background: var(--color-background);
		border: var(--border-thin);
		border-radius: var(--radius-sm);
		cursor: pointer;
		transition: all var(--transition-fast);
	}

	.toggle-btn:hover:not(:disabled) {
		border-color: var(--color-accent);
	}

	.toggle-btn.active {
		background: color-mix(in srgb, var(--color-accent) 15%, transparent);
		border-color: var(--color-accent);
	}

	.toggle-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.toggle-icon {
		font-size: var(--text-h4);
	}

	.toggle-label {
		font-weight: var(--weight-semibold);
	}

	/* Support Note */
	.support-note {
		font-size: var(--text-tiny);
		color: var(--color-text-muted);
		font-style: italic;
	}

	/* Reset Section */
	.reset-section {
		padding-top: var(--space-2);
		border-top: var(--border-thin);
	}

	.reset-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-2);
		padding: var(--space-2) var(--space-3);
		background: none;
		border: var(--border-thin);
		border-radius: var(--radius-sm);
		color: var(--color-text-muted);
		font-size: var(--text-small);
		cursor: pointer;
		transition: all var(--transition-fast);
		width: 100%;
	}

	.reset-btn:hover {
		border-color: var(--color-warning);
		color: var(--color-warning);
	}

	.reset-icon {
		font-size: var(--text-base);
	}

	/* Responsive */
	@media (max-width: 480px) {
		.settings-panel {
			min-width: 100%;
			border-radius: 0;
		}
	}
</style>
