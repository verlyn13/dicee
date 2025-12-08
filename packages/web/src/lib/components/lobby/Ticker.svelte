<script lang="ts">
/**
 * Ticker - Scrolling event ticker for lobby activity
 *
 * Shows recent events: joins, room creations, wins.
 * Pauses on hover/touch for readability.
 */
import { lobby } from '$lib/stores/lobby.svelte';

let isPaused = $state(false);

// Format ticker events into display string
const tickerText = $derived(
	lobby.ticker.length > 0
		? lobby.ticker.map((e) => e.message.toUpperCase()).join(' // ')
		: 'WELCOME TO THE LOBBY // CREATE OR JOIN A GAME',
);
</script>

<div
	class="ticker"
	role="marquee"
	aria-live="polite"
	onmouseenter={() => (isPaused = true)}
	onmouseleave={() => (isPaused = false)}
	ontouchstart={() => (isPaused = true)}
	ontouchend={() => (isPaused = false)}
>
	<div class="ticker-content" class:paused={isPaused}>
		<!-- Duplicate for seamless loop -->
		<span>{tickerText} //&nbsp;</span>
		<span aria-hidden="true">{tickerText} //&nbsp;</span>
	</div>
</div>

<style>
	.ticker {
		height: 2rem;
		background: var(--lobby-ticker-bg);
		color: var(--lobby-ticker-fg);
		overflow: hidden;
		border-bottom: var(--border-medium);
	}

	.ticker-content {
		display: flex;
		white-space: nowrap;
		font-family: var(--font-mono);
		font-size: var(--text-tiny);
		font-weight: var(--weight-semibold);
		line-height: 2rem;
		animation: scroll 20s linear infinite;
	}

	.ticker-content.paused {
		animation-play-state: paused;
	}

	@keyframes scroll {
		0% {
			transform: translateX(0);
		}
		100% {
			transform: translateX(-50%);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.ticker-content {
			animation: none;
		}
	}
</style>
