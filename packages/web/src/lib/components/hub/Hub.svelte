<script lang="ts">
/**
 * Hub - Main landing grid layout
 *
 * Mobile-first 2x2 grid that expands to 4-column on desktop.
 * Contains: HeroGame (primary), AuthStatusCard, LobbyGate, NewsDev
 *
 * Grid Layout:
 * Mobile (< 768px):        Desktop (>= 768px):
 * ┌─────────────────┐     ┌─────────┬─────┬─────┐
 * │    HeroGame     │     │         │  B  │  C  │
 * │   (2 col × 2)   │     │    A    ├─────┴─────┤
 * ├────────┬────────┤     │         │     D     │
 * │   B    │   C    │     └─────────┴───────────┘
 * ├────────┴────────┤
 * │       D         │
 * └─────────────────┘
 */

import AuthStatusCard from './AuthStatusCard.svelte';
import HeroGame from './HeroGame.svelte';
import LobbyGate from './LobbyGate.svelte';
import NewsDev from './NewsDev.svelte';
</script>

<div class="hub">
	<div class="hub-grid">
		<!-- Slot A: Hero Game - Primary Entry (2×2) -->
		<div class="slot-hero">
			<HeroGame />
		</div>

		<!-- Slot B: Auth/Profile Status (1×1) -->
		<div class="slot-auth">
			<AuthStatusCard />
		</div>

		<!-- Slot C: Lobby Gate (1×1) -->
		<div class="slot-lobby">
			<LobbyGate />
		</div>

		<!-- Slot D: News/Dev (2×1 mobile, 1×2 desktop) -->
		<div class="slot-news">
			<NewsDev />
		</div>
	</div>
</div>

<style>
	.hub {
		min-height: 100vh;
		/* biome-ignore lint/suspicious/noDuplicateProperties: svh fallback */
		min-height: 100svh;
		padding: var(--space-2);
		background: var(--color-background);
		display: flex;
		flex-direction: column;
		/* Prevent pinch-zoom that corrupts iOS viewport */
		touch-action: manipulation;
	}

	.hub-grid {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		grid-template-rows: 2fr 1fr 1fr;
		gap: var(--space-2);
		flex: 1;
		max-height: calc(100svh - var(--space-4));
	}

	/* Slot A: Hero - spans 2 columns, takes 2fr of height */
	.slot-hero {
		grid-column: span 2;
		grid-row: span 1;
		min-height: 200px;
	}

	/* Slot B: Auth - single cell */
	.slot-auth {
		grid-column: span 1;
		grid-row: span 1;
		min-height: 120px;
	}

	/* Slot C: Lobby - single cell */
	.slot-lobby {
		grid-column: span 1;
		grid-row: span 1;
		min-height: 120px;
	}

	/* Slot D: News - spans 2 columns on mobile */
	.slot-news {
		grid-column: span 2;
		grid-row: span 1;
		min-height: 100px;
	}

	/* Tablet layout (640px+) */
	@media (min-width: 640px) {
		.hub {
			padding: var(--space-3);
		}

		.hub-grid {
			grid-template-rows: 2fr 1fr;
			max-height: calc(100svh - var(--space-6));
		}

		.slot-hero {
			min-height: 280px;
		}

		.slot-auth,
		.slot-lobby {
			min-height: 140px;
		}

		.slot-news {
			min-height: 140px;
		}
	}

	/* Desktop layout (768px+) */
	@media (min-width: 768px) {
		.hub-grid {
			grid-template-columns: 2fr 1fr 1fr;
			grid-template-rows: 1fr 1fr;
			max-width: 56rem;
			margin: 0 auto;
			gap: var(--space-3);
		}

		/* Hero: 2×2 (first column, both rows) */
		.slot-hero {
			grid-column: 1;
			grid-row: span 2;
			min-height: unset;
		}

		/* Auth: top right */
		.slot-auth {
			grid-column: 2;
			grid-row: 1;
			min-height: unset;
		}

		/* Lobby: top far right */
		.slot-lobby {
			grid-column: 3;
			grid-row: 1;
			min-height: unset;
		}

		/* News: bottom right, spans 2 columns */
		.slot-news {
			grid-column: 2 / 4;
			grid-row: 2;
			min-height: unset;
		}
	}

	/* Large desktop (1024px+) */
	@media (min-width: 1024px) {
		.hub-grid {
			max-width: 64rem;
			min-height: 500px;
			max-height: 600px;
		}
	}
</style>
