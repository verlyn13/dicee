<script lang="ts">
/**
 * EmptyRooms - Empty state when no rooms are available
 *
 * Encourages users to create the first game.
 */
import { goto } from '$app/navigation';

function handleCreateRoom() {
	// Generate room code and navigate
	const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
	let code = '';
	for (let i = 0; i < 6; i++) {
		code += chars[Math.floor(Math.random() * chars.length)];
	}
	goto(`/games/dicee/room/${code}`);
}
</script>

<div class="empty-state">
	<div class="icon">[~]</div>
	<h3>No Open Rooms</h3>
	<p>Be the first to create a game.</p>
	<button class="create-cta" onclick={handleCreateRoom}>
		Create Room +
	</button>
</div>

<style>
	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: var(--space-5) var(--space-3);
		text-align: center;
		border: 3px dashed var(--color-border);
		background: repeating-linear-gradient(
			45deg,
			var(--color-surface),
			var(--color-surface) 10px,
			var(--color-background) 10px,
			var(--color-background) 20px
		);
	}

	.icon {
		font-family: var(--font-mono);
		font-size: var(--text-display);
		font-weight: var(--weight-black);
		margin-bottom: var(--space-2);
		animation: pulse 2s ease-in-out infinite;
	}

	@keyframes pulse {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.5;
		}
	}

	h3 {
		font-weight: var(--weight-black);
		text-transform: uppercase;
		margin-bottom: var(--space-1);
	}

	p {
		color: var(--color-signal-muted);
		margin-bottom: var(--space-3);
	}

	.create-cta {
		padding: var(--space-2) var(--space-4);
		background: var(--color-text);
		color: var(--color-surface);
		border: none;
		font-weight: var(--weight-bold);
		text-transform: uppercase;
		cursor: pointer;
		box-shadow: var(--lobby-card-shadow);
		transition:
			background var(--transition-fast),
			color var(--transition-fast);
	}

	.create-cta:hover {
		background: var(--color-accent);
		color: var(--color-text);
	}

	@media (prefers-reduced-motion: reduce) {
		.icon {
			animation: none;
		}
	}
</style>
