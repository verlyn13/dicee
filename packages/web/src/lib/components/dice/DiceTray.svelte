<script lang="ts">
import { audioStore } from '$lib/stores/audio.svelte';
import type { DiceArray, KeepRecommendation, KeptMask } from '$lib/types.js';
import { haptic } from '$lib/utils/haptics';
import Die from './Die.svelte';

interface Props {
	dice: DiceArray;
	kept: KeptMask;
	rollsRemaining: number;
	canRoll: boolean;
	canKeep: boolean;
	rolling?: boolean;
	/** Whether dice have been rolled this turn (false = show pre-roll state) */
	hasRolled?: boolean;
	/** Keep recommendation from the engine for showing suggestions */
	keepSuggestion?: KeepRecommendation;
	/** Current EV before any action */
	currentEV?: number;
	/** Show suggestions tooltip on roll button */
	showSuggestions?: boolean;
	onRoll: () => void;
	onToggleKeep: (index: number) => void;
	onKeepAll?: () => void;
	onReleaseAll?: () => void;
}

let {
	dice,
	kept,
	rollsRemaining,
	canRoll,
	canKeep,
	rolling = false,
	hasRolled = true,
	keepSuggestion,
	currentEV = 0,
	showSuggestions = false,
	onRoll,
	onToggleKeep,
	onKeepAll,
	onReleaseAll,
}: Props = $props();

// Pre-roll state: dice haven't been rolled yet this turn
const showPreRollState = $derived(!hasRolled && rollsRemaining === 3);

const isFirstRoll = $derived(rollsRemaining === 3);
const isFinalRoll = $derived(rollsRemaining === 0);
const keptCount = $derived(kept.filter(Boolean).length);

// Die faces for display
const DIE_FACES = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'] as const;

// Suggestion display state
let showTooltip = $state(false);

// Format keep pattern as dice faces
const suggestionDice = $derived.by(() => {
	if (!keepSuggestion) return '';
	const pattern = keepSuggestion.keepPattern;
	const faces: string[] = [];
	for (let i = 0; i < 6; i++) {
		for (let j = 0; j < pattern[i]; j++) {
			faces.push(DIE_FACES[i]);
		}
	}
	return faces.join('');
});

// Check if there's a meaningful suggestion to show
const hasSuggestion = $derived(
	showSuggestions && keepSuggestion && !isFirstRoll && !isFinalRoll && rollsRemaining > 0,
);

// Calculate suggested dice indices for highlighting
const suggestedKeepIndices = $derived.by(() => {
	if (!keepSuggestion) return new Set<number>();
	const pattern = keepSuggestion.keepPattern;
	const indices = new Set<number>();

	// Match pattern to actual dice - for each face value, find matching dice
	const remaining = [...pattern] as number[];
	for (let i = 0; i < dice.length; i++) {
		const faceIndex = dice[i] - 1; // Convert 1-6 to 0-5
		if (remaining[faceIndex] > 0) {
			indices.add(i);
			remaining[faceIndex]--;
		}
	}
	return indices;
});

// Format EV change
function formatEVChange(from: number, to: number): string {
	const delta = to - from;
	const sign = delta >= 0 ? '+' : '';
	return `${from.toFixed(1)} → ${to.toFixed(1)} (${sign}${delta.toFixed(1)})`;
}

// Track landing state for animation
let wasRolling = $state(false);
let landing = $state(false);

$effect(() => {
	if (wasRolling && !rolling) {
		// Just finished rolling - trigger landing animation
		landing = true;
		haptic('medium');
		// Play dice landing sounds
		const unkeptCount = kept.filter((k) => !k).length;
		audioStore.playDiceLand(unkeptCount || 5);
		const timeout = setTimeout(() => {
			landing = false;
		}, 300);
		return () => clearTimeout(timeout);
	}
	wasRolling = rolling;
});

function handleRoll() {
	if (canRoll) {
		haptic('roll');
		audioStore.playDiceRoll();
		onRoll();
	}
}
</script>

<div class="dice-tray" data-rolling={rolling} data-pre-roll={showPreRollState}>
	<div class="tray-surface">
		<!-- Dice Grid -->
		<div class="dice-grid" class:pre-roll={showPreRollState}>
			{#if showPreRollState}
				<!-- Pre-roll: Show placeholder dice -->
				{#each [0, 1, 2, 3, 4] as i}
					<div class="die-placeholder" aria-hidden="true">
						<span class="placeholder-icon">?</span>
					</div>
				{/each}
			{:else}
				{#each dice as value, i}
					<Die
						{value}
						kept={kept[i]}
						disabled={!canKeep}
						{rolling}
						{landing}
						suggested={hasSuggestion && suggestedKeepIndices.has(i)}
						index={i}
						totalDice={dice.length}
						onclick={() => canKeep && onToggleKeep(i)}
					/>
				{/each}
			{/if}
		</div>

		<!-- Roll Button with Suggestion Tooltip -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="roll-container"
			role="group"
			onmouseenter={() => (showTooltip = true)}
			onmouseleave={() => (showTooltip = false)}
			onfocusin={() => (showTooltip = true)}
			onfocusout={() => (showTooltip = false)}
		>
			{#if hasSuggestion && showTooltip && keepSuggestion}
				<div class="suggestion-tooltip" role="tooltip">
					<span class="tooltip-label">Suggested:</span>
					<span class="tooltip-dice">{suggestionDice || 'Roll all'}</span>
					<span class="tooltip-ev">EV: {formatEVChange(currentEV, keepSuggestion.expectedValue)}</span>
				</div>
			{/if}
			<button class="roll-btn" class:rolling class:start-turn={showPreRollState} onclick={handleRoll} disabled={!canRoll}>
			{#if rolling}
				ROLLING...
			{:else if showPreRollState}
				🎲 START YOUR TURN
			{:else if isFirstRoll}
				ROLL DICE
			{:else if isFinalRoll}
				NO ROLLS LEFT
			{:else}
				REROLL ({rollsRemaining})
			{/if}
			</button>
		</div>

		<!-- Quick Actions -->
		{#if canKeep && !isFirstRoll}
			<div class="quick-actions">
				<button
					class="quick-btn"
					onclick={() => {
						audioStore.play('buttonClick');
						onKeepAll?.();
					}}
					disabled={keptCount === 5}
				>
					Keep All
				</button>
				<button
					class="quick-btn"
					onclick={() => {
						audioStore.play('buttonClick');
						onReleaseAll?.();
					}}
					disabled={keptCount === 0}
				>
					Release All
				</button>
			</div>
		{/if}
	</div>

	<!-- Roll Counter -->
	<div class="roll-counter" aria-live="polite">
		<span class="counter-label">Rolls:</span>
		<div class="counter-pips" role="img" aria-label="{rollsRemaining} rolls remaining">
			{#each [0, 1, 2] as i}
				<span
					class="counter-pip"
					class:used={i < 3 - rollsRemaining}
					aria-hidden="true"
				></span>
			{/each}
		</div>
	</div>
</div>

<style>
	.dice-tray {
		background: linear-gradient(
			135deg,
			var(--color-felt) 0%,
			var(--color-felt-light) 100%
		);
		border: var(--border-thick);
		padding: var(--space-3);
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.tray-surface {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-3);
	}

	/* Dice Grid - 5 across on desktop, 3+2 on mobile */
	.dice-grid {
		display: flex;
		justify-content: center;
		gap: var(--space-3);
		padding-bottom: var(--space-2);
	}

	.dice-grid.pre-roll {
		opacity: 0.7;
	}

	/* Placeholder dice for pre-roll state */
	.die-placeholder {
		width: 56px;
		height: 56px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--color-surface);
		border: var(--border-thick);
		border-style: dashed;
		opacity: 0.6;
	}

	.placeholder-icon {
		font-size: var(--text-h2);
		font-weight: var(--weight-bold);
		color: var(--color-text-muted);
	}

	@media (max-width: 480px) {
		.dice-grid {
			display: grid;
			grid-template-columns: repeat(3, auto);
			gap: var(--space-2);
		}

		.die-placeholder {
			width: 48px;
			height: 48px;
		}
	}

	/* Roll Container with Tooltip */
	.roll-container {
		position: relative;
		width: 100%;
		max-width: 300px;
	}

	.suggestion-tooltip {
		position: absolute;
		bottom: 100%;
		left: 50%;
		transform: translateX(-50%);
		margin-bottom: var(--space-2);
		padding: var(--space-2) var(--space-3);
		background: var(--color-surface);
		border: var(--border-medium);
		white-space: nowrap;
		z-index: 10;
		animation: tooltip-appear 0.15s ease-out;
	}

	.suggestion-tooltip::after {
		content: '';
		position: absolute;
		top: 100%;
		left: 50%;
		transform: translateX(-50%);
		border: 6px solid transparent;
		border-top-color: var(--color-text);
	}

	@keyframes tooltip-appear {
		from {
			opacity: 0;
			transform: translateX(-50%) translateY(4px);
		}
		to {
			opacity: 1;
			transform: translateX(-50%) translateY(0);
		}
	}

	.tooltip-label {
		font-size: var(--text-small);
		font-weight: var(--weight-semibold);
		color: var(--color-text-muted);
		margin-right: var(--space-1);
	}

	.tooltip-dice {
		font-size: var(--text-h3);
		letter-spacing: -0.05em;
		margin-right: var(--space-2);
	}

	.tooltip-ev {
		font-size: var(--text-small);
		font-family: var(--font-mono);
		color: var(--color-success);
	}

	/* Roll Button */
	.roll-btn {
		width: 100%;
		padding: var(--space-2) var(--space-4);
		font-size: var(--text-body);
		font-weight: var(--weight-bold);
		text-transform: uppercase;
		letter-spacing: var(--tracking-wide);
		background: var(--color-accent);
		border: var(--border-thick);
		transition:
			transform var(--transition-fast),
			background var(--transition-fast);
	}

	.roll-btn:hover:not(:disabled) {
		background: var(--color-accent-dark);
		transform: translateY(-2px);
	}

	.roll-btn:active:not(:disabled) {
		transform: translateY(0);
	}

	.roll-btn:disabled {
		background: var(--color-disabled);
		cursor: not-allowed;
	}

	.roll-btn.rolling {
		animation: pulse 0.3s ease-in-out infinite alternate;
	}

	/* Start turn button - more prominent */
	.roll-btn.start-turn {
		background: var(--color-success, #22c55e);
		color: white;
		font-size: var(--text-h3);
		padding: var(--space-3) var(--space-4);
		animation: attention-pulse 1.5s ease-in-out infinite;
		border: 3px solid var(--color-text);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
	}

	.roll-btn.start-turn:hover:not(:disabled) {
		background: var(--color-success-dark, #16a34a);
		animation: none;
		transform: translateY(-2px);
		box-shadow: 0 6px 16px rgba(0, 0, 0, 0.4);
	}

	.roll-btn.start-turn:disabled {
		background: var(--color-disabled, #6b7280);
		color: var(--color-text-muted, #9ca3af);
		animation: none;
		box-shadow: none;
		cursor: not-allowed;
	}

	@keyframes attention-pulse {
		0%, 100% {
			transform: scale(1);
			box-shadow: 0 0 0 0 var(--color-primary);
		}
		50% {
			transform: scale(1.02);
			box-shadow: 0 0 0 8px transparent;
		}
	}

	@keyframes pulse {
		from {
			transform: scale(1);
			opacity: 0.9;
		}
		to {
			transform: scale(1.02);
			opacity: 1;
		}
	}

	/* Quick Actions */
	.quick-actions {
		display: flex;
		gap: var(--space-2);
		width: 100%;
		max-width: 300px;
	}

	.quick-btn {
		flex: 1;
		padding: var(--space-1) var(--space-2);
		font-size: var(--text-small);
		font-weight: var(--weight-semibold);
		text-transform: uppercase;
		letter-spacing: var(--tracking-wide);
		background: transparent;
		border: var(--border-thin);
		color: var(--color-surface);
		transition: background var(--transition-fast);
	}

	.quick-btn:hover:not(:disabled) {
		background: rgba(255, 255, 255, 0.1);
	}

	.quick-btn:disabled {
		opacity: 0.4;
	}

	/* Roll Counter */
	.roll-counter {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-2);
		padding-top: var(--space-2);
		border-top: 1px solid rgba(255, 255, 255, 0.2);
	}

	.counter-label {
		font-size: var(--text-small);
		font-weight: var(--weight-semibold);
		color: var(--color-surface);
		text-transform: uppercase;
		letter-spacing: var(--tracking-wide);
	}

	.counter-pips {
		display: flex;
		gap: var(--space-1);
	}

	.counter-pip {
		width: 12px;
		height: 12px;
		background: var(--color-accent);
		border: 2px solid var(--color-surface);
		transition: background var(--transition-fast);
	}

	.counter-pip.used {
		background: transparent;
	}
</style>
