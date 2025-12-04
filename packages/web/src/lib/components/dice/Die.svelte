<script lang="ts">
import type { DieValue } from '$lib/types.js';

interface Props {
	value: DieValue;
	kept?: boolean;
	disabled?: boolean;
	rolling?: boolean;
	onclick?: () => void;
}

let { value, kept = false, disabled = false, rolling = false, onclick }: Props = $props();
</script>

<button
	class="die"
	class:kept
	class:rolling
	{disabled}
	{onclick}
	aria-label="Die showing {value}, {kept ? 'held' : 'not held'}"
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

	.die.rolling {
		animation: roll 0.1s ease-in-out infinite;
	}

	@keyframes roll {
		0%,
		100% {
			transform: rotate(-3deg);
		}
		50% {
			transform: rotate(3deg);
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
