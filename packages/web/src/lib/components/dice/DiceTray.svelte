<script lang="ts">
import type { DiceArray, KeptMask } from '$lib/types.js';
import Die from './Die.svelte';

interface Props {
	dice: DiceArray;
	kept: KeptMask;
	rollsRemaining: number;
	canRoll: boolean;
	canKeep: boolean;
	rolling?: boolean;
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
	onRoll,
	onToggleKeep,
	onKeepAll,
	onReleaseAll,
}: Props = $props();

const isFirstRoll = $derived(rollsRemaining === 3);
const isFinalRoll = $derived(rollsRemaining === 0);
const keptCount = $derived(kept.filter(Boolean).length);
</script>

<div class="dice-tray" data-rolling={rolling}>
	<div class="tray-surface">
		<!-- Dice Grid -->
		<div class="dice-grid">
			{#each dice as value, i}
				<Die
					{value}
					kept={kept[i]}
					disabled={!canKeep}
					{rolling}
					onclick={() => canKeep && onToggleKeep(i)}
				/>
			{/each}
		</div>

		<!-- Roll Button -->
		<button class="roll-btn" onclick={onRoll} disabled={!canRoll}>
			{#if rolling}
				ROLLING...
			{:else if isFirstRoll}
				ROLL DICE
			{:else if isFinalRoll}
				NO ROLLS LEFT
			{:else}
				REROLL ({rollsRemaining})
			{/if}
		</button>

		<!-- Quick Actions -->
		{#if canKeep && !isFirstRoll}
			<div class="quick-actions">
				<button
					class="quick-btn"
					onclick={onKeepAll}
					disabled={keptCount === 5}
				>
					Keep All
				</button>
				<button
					class="quick-btn"
					onclick={onReleaseAll}
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

	@media (max-width: 480px) {
		.dice-grid {
			display: grid;
			grid-template-columns: repeat(3, auto);
			gap: var(--space-2);
		}
	}

	/* Roll Button */
	.roll-btn {
		width: 100%;
		max-width: 300px;
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
