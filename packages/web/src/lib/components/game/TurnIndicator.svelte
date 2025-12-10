<script lang="ts">
/**
 * TurnIndicator Component
 *
 * Shows the current player's turn with avatar and name.
 * Highlights when it's the local player's turn.
 * Includes turn transition and AFK warning animations.
 */

import { audioStore } from '$lib/stores/audio.svelte';
import type { PlayerGameState } from '$lib/types/multiplayer';
import { haptic } from '$lib/utils/haptics';

interface Props {
	/** Current player whose turn it is */
	currentPlayer: PlayerGameState | null;
	/** Whether it's the local player's turn */
	isMyTurn: boolean;
	/** Current round number (1-13) */
	roundNumber: number;
	/** Total number of players */
	totalPlayers: number;
	/** AFK warning seconds remaining (null if no warning) */
	afkWarning: number | null;
}

let { currentPlayer, isMyTurn, roundNumber, totalPlayers, afkWarning }: Props = $props();

// Track turn changes for animation
let previousPlayerId = $state<string | null>(null);
let showTurnTransition = $state(false);

$effect(() => {
	const currentId = currentPlayer?.id ?? null;
	if (currentId && currentId !== previousPlayerId) {
		showTurnTransition = true;
		if (isMyTurn) {
			haptic('medium');
		}
		// Play turn change sound
		audioStore.playTurnChange();
		const timeout = setTimeout(() => {
			showTurnTransition = false;
		}, 500);
		previousPlayerId = currentId;
		return () => clearTimeout(timeout);
	}
});

// AFK warning feedback (haptic + audio)
let lastWarningSecond = $state<number | null>(null);
$effect(() => {
	if (afkWarning !== null && afkWarning <= 10 && isMyTurn) {
		// Only trigger once per second to avoid spam
		if (lastWarningSecond !== afkWarning) {
			lastWarningSecond = afkWarning;
			haptic('error');
			audioStore.play('timerWarning');
		}
	} else {
		lastWarningSecond = null;
	}
});

const avatarUrl = $derived(
	currentPlayer
		? `https://api.dicebear.com/7.x/bottts-neutral/svg?seed=${currentPlayer.avatarSeed}`
		: null,
);

const displayName = $derived(currentPlayer?.displayName ?? 'Unknown');
const turnLabel = $derived(isMyTurn ? '🎯 YOUR TURN' : `⏳ ${displayName}'s Turn`);
const turnSubtext = $derived(isMyTurn ? 'Click START YOUR TURN below' : 'Please wait...');

// Dice state for preview
const hasRolled = $derived(
	currentPlayer?.currentDice !== null && currentPlayer?.currentDice !== undefined,
);
const dicePreview = $derived(currentPlayer?.currentDice ?? null);
const keptDice = $derived(currentPlayer?.keptDice ?? null);
const rollsRemaining = $derived(currentPlayer?.rollsRemaining ?? 0);

// Dice face emojis for visual preview
const dieEmoji: Record<number, string> = {
	1: '⚀',
	2: '⚁',
	3: '⚂',
	4: '⚃',
	5: '⚄',
	6: '⚅',
};
</script>

<div
	class="turn-indicator"
	class:my-turn={isMyTurn}
	class:afk-warning={afkWarning !== null}
	class:turn-transition={showTurnTransition}
>
	<div class="indicator-content">
		<!-- Avatar -->
		{#if avatarUrl}
			<div class="avatar-container">
				<img src={avatarUrl} alt="{displayName}'s avatar" class="avatar" />
				{#if currentPlayer?.connectionStatus === 'away'}
					<span class="status-badge away" title="Away">⏳</span>
				{:else if currentPlayer?.connectionStatus === 'disconnected'}
					<span class="status-badge disconnected" title="Disconnected">⚠</span>
				{/if}
			</div>
		{/if}

		<!-- Turn Info -->
		<div class="turn-info">
			<span class="turn-label">{turnLabel}</span>
			<span class="turn-subtext">{turnSubtext}</span>
			<span class="round-info">Round {roundNumber}/13</span>
		</div>

		<!-- AFK Warning -->
		{#if afkWarning !== null}
			<div class="afk-timer">
				<span class="afk-seconds">{afkWarning}s</span>
			</div>
		{/if}
	</div>

	<!-- Dice Preview (shows current player's dice state) -->
	{#if hasRolled && dicePreview}
		<div class="dice-preview">
			<div class="dice-preview-grid">
				{#each dicePreview as die, i}
					<span
						class="preview-die"
						class:kept={keptDice?.[i]}
						title={keptDice?.[i] ? 'Kept' : 'Rolling'}
					>
						{dieEmoji[die] ?? '?'}
					</span>
				{/each}
			</div>
			<span class="preview-rolls">
				{rollsRemaining} rolls left
			</span>
		</div>
	{/if}

	<!-- Player count indicator -->
	<div class="player-count">
		<span class="count-label">{totalPlayers} Players</span>
	</div>
</div>

<style>
	.turn-indicator {
		background: var(--color-surface);
		border: var(--border-thick);
		padding: var(--space-2);
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
	}

	.turn-indicator.my-turn {
		background: var(--color-accent-light);
		border-color: var(--color-accent-dark);
	}

	.turn-indicator.afk-warning {
		animation: pulse-warning 0.5s ease-in-out infinite;
	}

	.turn-indicator.turn-transition {
		animation: turn-change 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
	}

	.turn-indicator.my-turn.turn-transition {
		animation: my-turn-start 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
	}

	@keyframes pulse-warning {
		0%,
		100% {
			background: var(--color-surface);
			border-color: var(--color-border);
		}
		50% {
			background: var(--color-warning);
			border-color: var(--color-danger);
		}
	}

	@keyframes turn-change {
		0% {
			transform: scale(0.95);
			opacity: 0.7;
		}
		50% {
			transform: scale(1.02);
		}
		100% {
			transform: scale(1);
			opacity: 1;
		}
	}

	@keyframes my-turn-start {
		0% {
			transform: scale(0.9);
			box-shadow: 0 0 0 0 var(--color-accent);
		}
		50% {
			transform: scale(1.05);
			box-shadow: 0 0 0 8px transparent;
		}
		100% {
			transform: scale(1);
			box-shadow: var(--shadow-brutal);
		}
	}

	.indicator-content {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}

	.avatar-container {
		position: relative;
		flex-shrink: 0;
	}

	.avatar {
		width: 48px;
		height: 48px;
		border: var(--border-medium);
		background: var(--color-background);
	}

	.status-badge {
		position: absolute;
		bottom: -4px;
		right: -4px;
		width: 20px;
		height: 20px;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 12px;
		border: 2px solid var(--color-border);
		background: var(--color-surface);
	}

	.status-badge.away {
		background: var(--color-warning);
	}

	.status-badge.disconnected {
		background: var(--color-danger);
		color: white;
	}

	.turn-info {
		display: flex;
		flex-direction: column;
		flex: 1;
		min-width: 0;
	}

	.turn-label {
		font-size: var(--text-body);
		font-weight: var(--weight-bold);
		text-transform: uppercase;
		letter-spacing: var(--tracking-wide);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.my-turn .turn-label {
		color: var(--color-accent-dark);
	}

	.turn-subtext {
		font-size: var(--text-small);
		color: var(--color-text-muted);
		font-style: italic;
	}

	.my-turn .turn-subtext {
		color: var(--color-accent-dark);
		font-weight: var(--weight-semibold);
		font-style: normal;
	}

	.round-info {
		font-size: var(--text-small);
		color: var(--color-text-muted);
		font-family: var(--font-mono);
	}

	.afk-timer {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 48px;
		height: 48px;
		background: var(--color-danger);
		border: var(--border-medium);
	}

	.afk-seconds {
		font-size: var(--text-body);
		font-weight: var(--weight-black);
		font-family: var(--font-mono);
		color: white;
	}

	.player-count {
		display: flex;
		justify-content: flex-end;
		padding-top: var(--space-1);
		border-top: var(--border-thin);
	}

	.count-label {
		font-size: var(--text-tiny);
		color: var(--color-text-muted);
		text-transform: uppercase;
		letter-spacing: var(--tracking-wide);
	}

	/* Dice Preview Styles */
	.dice-preview {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2);
		padding: var(--space-1) var(--space-2);
		margin-top: var(--space-1);
		background: var(--color-background);
		border: var(--border-thin);
	}

	.dice-preview-grid {
		display: flex;
		gap: 2px;
	}

	.preview-die {
		font-size: var(--text-h3);
		line-height: 1;
		opacity: 0.6;
		transition: all var(--transition-fast);
	}

	.preview-die.kept {
		opacity: 1;
		transform: scale(1.1);
		filter: drop-shadow(0 0 2px var(--color-accent));
	}

	.preview-rolls {
		font-size: var(--text-tiny);
		font-weight: var(--weight-semibold);
		color: var(--color-text-muted);
		text-transform: uppercase;
		letter-spacing: var(--tracking-wide);
	}
</style>
