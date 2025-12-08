<script lang="ts">
import type { DieValue } from '$lib/types.js';
import { haptic } from '$lib/utils/haptics';

interface Props {
	value: DieValue;
	kept?: boolean;
	disabled?: boolean;
	rolling?: boolean;
	/** Whether the die just landed (triggers land animation) */
	landing?: boolean;
	/** Whether this die is suggested to keep (coach mode highlight) */
	suggested?: boolean;
	onclick?: () => void;
}

let {
	value,
	kept = false,
	disabled = false,
	rolling = false,
	landing = false,
	suggested = false,
	onclick,
}: Props = $props();

// Track previous value for animation
let previousValue = $state(value);
let showValueChange = $state(false);

$effect(() => {
	if (value !== previousValue && !rolling) {
		showValueChange = true;
		previousValue = value;
		// Reset after animation
		const timeout = setTimeout(() => {
			showValueChange = false;
		}, 300);
		return () => clearTimeout(timeout);
	}
});

function handleClick() {
	if (!disabled && onclick) {
		haptic('light');
		onclick();
	}
}
</script>

<button
	class="die"
	class:kept
	class:rolling
	class:landing
	class:suggested
	class:value-changed={showValueChange}
	{disabled}
	onclick={handleClick}
	aria-label="Die showing {value}, {kept ? 'held' : 'not held'}{suggested ? ', suggested to keep' : ''}"
	aria-pressed={kept}
>
	<div class="face" data-value={value}>
		{#if value === 1}
			<span class="pip center"></span>
		{:else if value === 2}
			<span class="pip top-right"></span>
			<span class="pip bottom-left"></span>
		{:else if value === 3}
			<span class="pip top-right"></span>
			<span class="pip center"></span>
			<span class="pip bottom-left"></span>
		{:else if value === 4}
			<span class="pip top-left"></span>
			<span class="pip top-right"></span>
			<span class="pip bottom-left"></span>
			<span class="pip bottom-right"></span>
		{:else if value === 5}
			<span class="pip top-left"></span>
			<span class="pip top-right"></span>
			<span class="pip center"></span>
			<span class="pip bottom-left"></span>
			<span class="pip bottom-right"></span>
		{:else if value === 6}
			<span class="pip top-left"></span>
			<span class="pip top-right"></span>
			<span class="pip middle-left"></span>
			<span class="pip middle-right"></span>
			<span class="pip bottom-left"></span>
			<span class="pip bottom-right"></span>
		{/if}
	</div>

	{#if kept}
		<span class="keep-badge">HELD</span>
	{/if}
</button>

<style>
	.die {
		position: relative;
		width: var(--die-size, 60px);
		height: var(--die-size, 60px);
		background: var(--color-surface);
		border: var(--border-thick);
		cursor: pointer;
		transition:
			transform var(--transition-fast),
			background var(--transition-fast),
			border-color var(--transition-fast),
			box-shadow var(--transition-fast);
	}

	.die:hover:not(:disabled) {
		transform: translateY(-4px);
		border-width: 3px;
	}

	.die:active:not(:disabled) {
		transform: translateY(-2px);
	}

	.die:disabled {
		cursor: default;
		opacity: 0.7;
	}

	.die.kept {
		background: var(--color-accent);
		border-color: var(--color-accent-dark);
		transform: translateY(-8px);
		box-shadow: 0 8px 0 var(--color-border);
	}

	.die.kept:hover:not(:disabled) {
		transform: translateY(-8px);
	}

	/* Suggested state (coach mode) */
	.die.suggested:not(.kept) {
		border-color: var(--color-success);
		box-shadow:
			0 0 0 2px var(--color-success),
			0 0 8px color-mix(in srgb, var(--color-success) 50%, transparent);
		animation: suggestion-pulse 1.5s ease-in-out infinite;
	}

	@keyframes suggestion-pulse {
		0%,
		100% {
			box-shadow:
				0 0 0 2px var(--color-success),
				0 0 8px color-mix(in srgb, var(--color-success) 50%, transparent);
		}
		50% {
			box-shadow:
				0 0 0 3px var(--color-success),
				0 0 16px color-mix(in srgb, var(--color-success) 70%, transparent);
		}
	}

	.die.rolling {
		animation: roll 0.08s ease-in-out infinite;
		filter: blur(0.5px);
	}

	.die.landing {
		animation: land 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
	}

	.die.value-changed .face {
		animation: pop 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
	}

	@keyframes roll {
		0% {
			transform: rotate(-4deg) translateY(-2px);
		}
		25% {
			transform: rotate(4deg) translateY(1px);
		}
		50% {
			transform: rotate(-3deg) translateY(-1px);
		}
		75% {
			transform: rotate(3deg) translateY(2px);
		}
		100% {
			transform: rotate(-4deg) translateY(-2px);
		}
	}

	@keyframes land {
		0% {
			transform: scale(1.1) rotate(5deg);
		}
		50% {
			transform: scale(0.95) rotate(-2deg);
		}
		100% {
			transform: scale(1) rotate(0deg);
		}
	}

	@keyframes pop {
		0% {
			transform: scale(0.8);
			opacity: 0.5;
		}
		50% {
			transform: scale(1.1);
		}
		100% {
			transform: scale(1);
			opacity: 1;
		}
	}

	/* Die Face with Pips */
	.face {
		position: relative;
		width: 100%;
		height: 100%;
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		grid-template-rows: repeat(3, 1fr);
		padding: 6px;
	}

	/* Pips */
	.pip {
		width: 10px;
		height: 10px;
		background: var(--color-border);
		border-radius: 50%;
		position: absolute;
	}

	/* Pip positions using grid areas */
	.pip.top-left {
		top: 8px;
		left: 8px;
	}
	.pip.top-right {
		top: 8px;
		right: 8px;
	}
	.pip.middle-left {
		top: 50%;
		left: 8px;
		transform: translateY(-50%);
	}
	.pip.middle-right {
		top: 50%;
		right: 8px;
		transform: translateY(-50%);
	}
	.pip.bottom-left {
		bottom: 8px;
		left: 8px;
	}
	.pip.bottom-right {
		bottom: 8px;
		right: 8px;
	}
	.pip.center {
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
	}

	/* Keep Badge */
	.keep-badge {
		position: absolute;
		bottom: -22px;
		left: 50%;
		transform: translateX(-50%);
		font-size: var(--text-micro);
		font-weight: var(--weight-bold);
		background: var(--color-text);
		color: var(--color-surface);
		padding: 2px 6px;
		white-space: nowrap;
		letter-spacing: var(--tracking-wide);
	}

	/* Responsive */
	@media (max-width: 480px) {
		.die {
			width: var(--die-size-mobile, 50px);
			height: var(--die-size-mobile, 50px);
		}

		.pip {
			width: 8px;
			height: 8px;
		}

		.pip.top-left {
			top: 6px;
			left: 6px;
		}
		.pip.top-right {
			top: 6px;
			right: 6px;
		}
		.pip.middle-left {
			left: 6px;
		}
		.pip.middle-right {
			right: 6px;
		}
		.pip.bottom-left {
			bottom: 6px;
			left: 6px;
		}
		.pip.bottom-right {
			bottom: 6px;
			right: 6px;
		}

		.keep-badge {
			font-size: 8px;
			bottom: -18px;
		}
	}
</style>
