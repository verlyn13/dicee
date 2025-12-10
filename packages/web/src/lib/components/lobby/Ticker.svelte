<script lang="ts">
/**
 * Ticker - LED-matrix style scrolling event ticker
 *
 * Shows recent events with priority highlighting:
 * - HIGH: dicee alerts, jackpots (flash animation)
 * - MEDIUM: game won, room fills (bright)
 * - LOW: joins, room created (standard)
 *
 * Pauses on hover/touch for readability.
 */
import { lobby, type TickerEvent } from '$lib/stores/lobby.svelte';

let isPaused = $state(false);

// Event priority for visual treatment
const EVENT_PRIORITY: Record<TickerEvent['type'], 'high' | 'medium' | 'low'> = {
	jackpot: 'high',
	game_won: 'medium',
	room_created: 'low',
	join: 'low',
};

// Format with personality
function formatEvent(event: TickerEvent): string {
	const msg = event.message.toUpperCase();

	// Add flair based on type
	switch (event.type) {
		case 'jackpot':
			return `🎯 DICEE! ${msg} 🎯`;
		case 'game_won':
			return `🏆 ${msg}`;
		case 'room_created':
			return `🎲 ${msg}`;
		case 'join':
			return `👋 ${msg}`;
		default:
			return msg;
	}
}

// Has high-priority event?
const hasHighPriority = $derived(lobby.ticker.some((e) => EVENT_PRIORITY[e.type] === 'high'));

// Format ticker events into display segments
const tickerSegments = $derived(
	lobby.ticker.length > 0
		? lobby.ticker.map((e) => ({
				text: formatEvent(e),
				priority: EVENT_PRIORITY[e.type],
			}))
		: [{ text: 'WELCOME TO THE LOBBY // CREATE OR JOIN A GAME', priority: 'low' as const }],
);

// Full ticker text for seamless scroll
const tickerText = $derived(tickerSegments.map((s) => s.text).join(' // '));
</script>

<div
	class="ticker"
	class:highlight={hasHighPriority}
	role="marquee"
	aria-live="polite"
	onmouseenter={() => (isPaused = true)}
	onmouseleave={() => (isPaused = false)}
	ontouchstart={() => (isPaused = true)}
	ontouchend={() => (isPaused = false)}
>
	<div class="ticker-led"></div>
	<div class="ticker-content" class:paused={isPaused}>
		<!-- Duplicate for seamless loop -->
		<span class="ticker-text">{tickerText} //&nbsp;</span>
		<span class="ticker-text" aria-hidden="true">{tickerText} //&nbsp;</span>
	</div>
</div>

<style>
	.ticker {
		position: relative;
		height: 2rem;
		background: var(--lobby-ticker-bg, #0a0a0a);
		color: var(--lobby-ticker-fg, #22ff22);
		overflow: hidden;
		border-bottom: var(--border-medium);
	}

	/* LED indicator dot */
	.ticker-led {
		position: absolute;
		left: var(--space-2);
		top: 50%;
		transform: translateY(-50%);
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--lobby-ticker-fg, #22ff22);
		box-shadow: 0 0 4px var(--lobby-ticker-fg, #22ff22);
		animation: led-blink 2s ease-in-out infinite;
		z-index: 1;
	}

	@keyframes led-blink {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.4;
		}
	}

	.ticker-content {
		display: flex;
		white-space: nowrap;
		font-family: var(--font-mono);
		font-size: var(--text-tiny);
		font-weight: var(--weight-semibold);
		line-height: 2rem;
		padding-left: var(--space-6);
		animation: scroll 25s linear infinite;
		letter-spacing: 0.05em;
		text-shadow: 0 0 8px currentColor;
	}

	.ticker-content.paused {
		animation-play-state: paused;
	}

	.ticker-text {
		text-transform: uppercase;
	}

	/* High-priority highlight state */
	.ticker.highlight {
		animation: ticker-flash 0.5s ease-out;
	}

	.ticker.highlight .ticker-led {
		background: var(--color-warning, #ffaa00);
		box-shadow: 0 0 8px var(--color-warning, #ffaa00);
		animation: led-flash 0.3s ease-out infinite;
	}

	@keyframes ticker-flash {
		0%,
		100% {
			background: var(--lobby-ticker-bg, #0a0a0a);
		}
		50% {
			background: rgba(34, 255, 34, 0.1);
		}
	}

	@keyframes led-flash {
		0%,
		100% {
			opacity: 1;
			transform: translateY(-50%) scale(1);
		}
		50% {
			opacity: 0.8;
			transform: translateY(-50%) scale(1.3);
		}
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

		.ticker-led {
			animation: none;
		}

		.ticker.highlight .ticker-led {
			animation: none;
		}
	}
</style>
