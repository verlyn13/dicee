<script lang="ts">
/**
 * CartridgeStack - Container for room cartridges
 *
 * Displays rooms as a stack of cartridges with:
 * - Visual stacking (overlapping shadows)
 * - Status-based sorting (waiting → playing → finished)
 * - Entry/exit transitions
 * - Empty state handling
 */

import { flip } from 'svelte/animate';
import { fly } from 'svelte/transition';
import type { RoomInfo } from '$lib/stores/lobby.svelte';
import RoomCartridge from './RoomCartridge.svelte';

interface Props {
	/** Rooms to display */
	rooms: RoomInfo[];
	/** Optional callback when join button clicked */
	onJoin?: (roomCode: string) => void;
	/** Optional callback for join request */
	onRequestJoin?: (roomCode: string) => void;
	/** Message to show when no rooms */
	emptyMessage?: string;
}

let {
	rooms,
	onJoin,
	onRequestJoin,
	emptyMessage = 'No games available. Create one!',
}: Props = $props();

// Sort rooms: waiting first, then playing, then finished
// Within each status, sort by most recently updated
const sortedRooms = $derived(
	[...rooms].sort((a, b) => {
		const statusOrder = { waiting: 0, playing: 1, finished: 2 };
		const statusDiff = statusOrder[a.status] - statusOrder[b.status];
		if (statusDiff !== 0) return statusDiff;
		return b.updatedAt - a.updatedAt;
	}),
);

const hasRooms = $derived(rooms.length > 0);
</script>

<div
	class="stack-container"
	role="list"
	aria-label="Available game rooms"
>
	{#if hasRooms}
		<div class="stack">
			{#each sortedRooms as room, index (room.code)}
				<div
					class="stack-item"
					role="listitem"
					animate:flip={{ duration: 300 }}
					in:fly={{ y: -20, duration: 250, delay: index * 50 }}
					out:fly={{ x: -100, duration: 200 }}
				>
					<RoomCartridge
						{room}
						{index}
						{onJoin}
						{onRequestJoin}
					/>
				</div>
			{/each}
		</div>
	{:else}
		<div class="empty-state" role="status">
			<span class="empty-icon">🎲</span>
			<p class="empty-message">{emptyMessage}</p>
		</div>
	{/if}
</div>

<style>
	.stack-container {
		width: 100%;
		min-height: 200px;
	}

	.stack {
		display: flex;
		flex-direction: column;
		gap: var(--cartridge-gap, -2px);
	}

	.stack-item {
		/* Stacking context for shadows */
		position: relative;
		z-index: 1;
	}

	/* Later items appear on top visually */
	.stack-item:nth-child(1) { z-index: 10; }
	.stack-item:nth-child(2) { z-index: 9; }
	.stack-item:nth-child(3) { z-index: 8; }
	.stack-item:nth-child(4) { z-index: 7; }
	.stack-item:nth-child(5) { z-index: 6; }
	.stack-item:nth-child(n+6) { z-index: 5; }

	/* Hovered items come to front */
	.stack-item:hover,
	.stack-item:focus-within {
		z-index: 20;
	}

	/* Empty state */
	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: var(--space-2);

		min-height: 200px;
		padding: var(--space-4);

		border: 3px dashed var(--color-border);
		background: var(--color-surface);

		text-align: center;
	}

	.empty-icon {
		font-size: 3rem;
		opacity: 0.5;
	}

	.empty-message {
		margin: 0;
		font-size: var(--text-base);
		font-weight: var(--weight-semibold);
		color: var(--color-signal-muted);
		text-transform: uppercase;
		letter-spacing: var(--tracking-wide);
	}

	/* Reduced motion */
	@media (prefers-reduced-motion: reduce) {
		.stack-item {
			animation: none;
		}
	}
</style>
