<script lang="ts">
/**
 * AudioSettingsPanel
 *
 * Settings panel for audio and haptic preferences.
 * Displays volume sliders, mute toggle, and haptics toggle.
 */

import { audioStore } from '$lib/stores/audio.svelte';
import { isHapticsSupported } from '$lib/utils/haptics';

interface Props {
	/** Callback when panel is closed */
	onClose?: () => void;
	/** Whether to show in compact mode (just icons) */
	compact?: boolean;
}

let { onClose, compact = false }: Props = $props();

// Haptic support check
const hapticsSupported = isHapticsSupported();

// Volume category labels
const VOLUME_CATEGORIES = [
	{ key: 'dice' as const, label: 'Dice', icon: '🎲' },
	{ key: 'score' as const, label: 'Scoring', icon: '🎯' },
	{ key: 'ui' as const, label: 'UI', icon: '🔔' },
	{ key: 'system' as const, label: 'System', icon: '💬' },
] as const;

// Volume slider handlers
function handleMasterVolume(e: Event) {
	const target = e.target as HTMLInputElement;
	audioStore.setMasterVolume(parseFloat(target.value));
}

function handleCategoryVolume(category: 'dice' | 'ui' | 'score' | 'system', e: Event) {
	const target = e.target as HTMLInputElement;
	audioStore.setCategoryVolume(category, parseFloat(target.value));
}

function handleMuteToggle() {
	audioStore.toggleMute();
}

function handleHapticsToggle() {
	audioStore.toggleHaptics();
}

function handleReset() {
	audioStore.resetToDefaults();
}

// Test sound playback
async function handleTestSound() {
	await audioStore.play('scorePositive');
}
</script>

{#if compact}
	<!-- Compact mode: just mute button -->
	<button
		class="mute-button"
		class:muted={audioStore.isMuted}
		onclick={handleMuteToggle}
		aria-label={audioStore.isMuted ? 'Unmute audio' : 'Mute audio'}
		title={audioStore.isMuted ? 'Unmute' : 'Mute'}
	>
		{#if audioStore.isMuted}
			<span class="icon">🔇</span>
		{:else if audioStore.masterVolume > 0.5}
			<span class="icon">🔊</span>
		{:else if audioStore.masterVolume > 0}
			<span class="icon">🔉</span>
		{:else}
			<span class="icon">🔈</span>
		{/if}
	</button>
{:else}
	<!-- Full settings panel -->
	<div class="audio-settings-panel" role="dialog" aria-label="Audio Settings">
		<header class="panel-header">
			<h3 class="panel-title">
				<span class="title-icon">🔊</span>
				Audio Settings
			</h3>
			{#if onClose}
				<button class="close-btn" onclick={onClose} aria-label="Close settings">×</button>
			{/if}
		</header>

		<div class="panel-content">
			<!-- Master Controls -->
			<div class="control-group master-controls">
				<div class="mute-row">
					<button
						class="toggle-btn"
						class:active={!audioStore.isMuted}
						onclick={handleMuteToggle}
						aria-pressed={!audioStore.isMuted}
					>
						<span class="toggle-icon">{audioStore.isMuted ? '🔇' : '🔊'}</span>
						<span class="toggle-label">{audioStore.isMuted ? 'Muted' : 'Sound On'}</span>
					</button>

					<button class="test-btn" onclick={handleTestSound} disabled={audioStore.isMuted}>
						Test
					</button>
				</div>

				<div class="volume-slider master">
					<label for="master-volume">
						<span class="slider-label">Master</span>
						<span class="slider-value">{Math.round(audioStore.masterVolume * 100)}%</span>
					</label>
					<input
						id="master-volume"
						type="range"
						min="0"
						max="1"
						step="0.05"
						value={audioStore.masterVolume}
						oninput={handleMasterVolume}
						disabled={audioStore.isMuted}
						aria-label="Master volume"
					/>
				</div>
			</div>

			<!-- Category Volumes -->
			<div class="control-group category-controls">
				<h4 class="group-title">Category Volumes</h4>
				{#each VOLUME_CATEGORIES as { key, label, icon }}
					<div class="volume-slider">
						<label for="volume-{key}">
							<span class="slider-icon">{icon}</span>
							<span class="slider-label">{label}</span>
							<span class="slider-value">
								{Math.round(audioStore.preferences[`${key}Volume`] * 100)}%
							</span>
						</label>
						<input
							id="volume-{key}"
							type="range"
							min="0"
							max="1"
							step="0.05"
							value={audioStore.preferences[`${key}Volume`]}
							oninput={(e) => handleCategoryVolume(key, e)}
							disabled={audioStore.isMuted}
							aria-label="{label} volume"
						/>
					</div>
				{/each}
			</div>

			<!-- Haptics (Android only) -->
			<div class="control-group haptics-controls">
				<div class="haptics-row">
					<button
						class="toggle-btn"
						class:active={audioStore.hapticsEnabled}
						onclick={handleHapticsToggle}
						disabled={!hapticsSupported}
						aria-pressed={audioStore.hapticsEnabled}
					>
						<span class="toggle-icon">📳</span>
						<span class="toggle-label">Haptics</span>
					</button>
					{#if !hapticsSupported}
						<span class="haptics-note">Not supported on this device</span>
					{/if}
				</div>
			</div>

			<!-- Reset -->
			<div class="control-group reset-controls">
				<button class="reset-btn" onclick={handleReset}>Reset to Defaults</button>
			</div>
		</div>
	</div>
{/if}

<style>
	/* Compact Mode Mute Button */
	.mute-button {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 36px;
		height: 36px;
		background: var(--color-surface);
		border: var(--border-thin);
		border-radius: 4px;
		cursor: pointer;
		transition:
			background var(--transition-fast),
			opacity var(--transition-fast);
	}

	.mute-button:hover {
		background: var(--color-background);
	}

	.mute-button.muted {
		opacity: 0.6;
	}

	.mute-button .icon {
		font-size: var(--text-h4);
	}

	/* Full Panel */
	.audio-settings-panel {
		background: var(--color-surface);
		border: var(--border-thin);
		min-width: 280px;
		max-width: 360px;
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
		gap: var(--space-3);
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
		text-transform: uppercase;
		letter-spacing: var(--tracking-wide);
		margin: 0;
	}

	/* Master Controls */
	.mute-row {
		display: flex;
		gap: var(--space-2);
		align-items: center;
	}

	.toggle-btn {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-2) var(--space-3);
		background: var(--color-background);
		border: var(--border-thin);
		cursor: pointer;
		transition: all var(--transition-fast);
		flex: 1;
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

	.test-btn {
		padding: var(--space-2) var(--space-3);
		background: var(--color-accent);
		border: none;
		color: var(--color-background);
		font-weight: var(--weight-semibold);
		cursor: pointer;
		transition: background var(--transition-fast);
	}

	.test-btn:hover:not(:disabled) {
		background: var(--color-accent-dark);
	}

	.test-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	/* Volume Sliders */
	.volume-slider {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
	}

	.volume-slider.master {
		margin-top: var(--space-2);
	}

	.volume-slider label {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		font-size: var(--text-small);
	}

	.slider-icon {
		width: 1.5em;
		text-align: center;
	}

	.slider-label {
		flex: 1;
	}

	.slider-value {
		font-family: var(--font-mono);
		font-size: var(--text-tiny);
		color: var(--color-text-muted);
		min-width: 3.5em;
		text-align: right;
	}

	.volume-slider input[type='range'] {
		width: 100%;
		height: 4px;
		appearance: none;
		background: var(--color-border);
		border-radius: 2px;
		cursor: pointer;
	}

	.volume-slider input[type='range']::-webkit-slider-thumb {
		appearance: none;
		width: 16px;
		height: 16px;
		background: var(--color-accent);
		border-radius: 50%;
		cursor: pointer;
	}

	.volume-slider input[type='range']::-moz-range-thumb {
		width: 16px;
		height: 16px;
		background: var(--color-accent);
		border: none;
		border-radius: 50%;
		cursor: pointer;
	}

	.volume-slider input[type='range']:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.volume-slider input[type='range']:disabled::-webkit-slider-thumb {
		cursor: not-allowed;
	}

	.volume-slider input[type='range']:disabled::-moz-range-thumb {
		cursor: not-allowed;
	}

	/* Haptics */
	.haptics-row {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}

	.haptics-note {
		font-size: var(--text-tiny);
		color: var(--color-text-muted);
		font-style: italic;
	}

	/* Reset */
	.reset-btn {
		padding: var(--space-2) var(--space-3);
		background: none;
		border: var(--border-thin);
		color: var(--color-text-muted);
		font-size: var(--text-small);
		cursor: pointer;
		transition: all var(--transition-fast);
	}

	.reset-btn:hover {
		border-color: var(--color-error);
		color: var(--color-error);
	}

	/* Category Controls Separator */
	.category-controls {
		padding-top: var(--space-2);
		border-top: var(--border-thin);
	}

	/* Responsive */
	@media (max-width: 480px) {
		.audio-settings-panel {
			min-width: 100%;
		}
	}
</style>
