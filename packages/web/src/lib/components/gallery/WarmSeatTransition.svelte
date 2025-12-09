<!--
  WarmSeatTransition.svelte - Overlay shown during spectator-to-player transition

  Features:
  - Countdown timer
  - Shows who is transitioning
  - Shows who is staying
  - Animation and visual feedback
-->
<script lang="ts">
import { spectatorService } from '$lib/services/spectatorService.svelte';
import { haptic } from '$lib/utils/haptics';

// Get transition state
const transition = $derived(spectatorService.warmSeatTransition);
const isTransitioning = $derived(spectatorService.isTransitioning);

// Calculate countdown
const countdown = $derived(() => {
	if (!transition) return 0;
	const elapsed = (Date.now() - transition.startedAt) / 1000;
	return Math.max(0, Math.ceil(transition.countdownSeconds - elapsed));
});

// Effect for haptic on transition start
$effect(() => {
	if (isTransitioning) {
		haptic('medium');
	}
});
</script>

{#if transition}
	<div
		class="warm-seat-overlay"
		class:is-me={isTransitioning}
		role="dialog"
		aria-modal="true"
		aria-label="Game starting soon"
	>
		<div class="transition-card">
			<!-- Countdown -->
			<div class="countdown-section">
				<div class="countdown-number" aria-live="polite">
					{countdown()}
				</div>
				<div class="countdown-label">
					{#if isTransitioning}
						Get ready to play!
					{:else}
						Next game starting...
					{/if}
				</div>
			</div>

			<!-- Transitioning players -->
			{#if transition.transitioningUsers.length > 0}
				<div class="players-section">
					<h4 class="section-title">Joining as Players</h4>
					<div class="player-list">
						{#each transition.transitioningUsers as user (user.userId)}
							<div class="player-entry joining" class:is-me={isTransitioning && transition.transitioningUsers.some(u => u.fromPosition === 1)}>
								<span class="player-badge">+</span>
								<span class="player-name">{user.displayName}</span>
								<span class="from-position">from #{user.fromPosition}</span>
							</div>
						{/each}
					</div>
				</div>
			{/if}

			<!-- Staying players -->
			{#if transition.stayingPlayers.length > 0}
				<div class="players-section">
					<h4 class="section-title">Current Players</h4>
					<div class="player-list">
						{#each transition.stayingPlayers as player (player.userId)}
							<div class="player-entry staying">
								<span class="player-name">{player.displayName}</span>
							</div>
						{/each}
					</div>
				</div>
			{/if}

			<!-- Call to action for transitioning user -->
			{#if isTransitioning}
				<div class="cta-section">
					<p class="cta-text">
						You made it off the bench! Time to show what you've got.
					</p>
				</div>
			{/if}
		</div>
	</div>
{/if}

<style>
	.warm-seat-overlay {
		position: fixed;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(0, 0, 0, 0.8);
		z-index: 100;
		animation: fadeIn 0.3s ease;
	}

	.warm-seat-overlay.is-me {
		background: rgba(16, 185, 129, 0.15);
	}

	@keyframes fadeIn {
		from { opacity: 0; }
		to { opacity: 1; }
	}

	.transition-card {
		background: var(--color-surface-1, #0f0f1a);
		border: 1px solid var(--color-border, #333);
		border-radius: 0.75rem;
		padding: 1.5rem;
		max-width: 400px;
		width: 90%;
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
		animation: slideUp 0.3s ease;
	}

	@keyframes slideUp {
		from {
			opacity: 0;
			transform: translateY(20px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	.is-me .transition-card {
		border-color: var(--color-success, #10b981);
		box-shadow: 0 0 30px rgba(16, 185, 129, 0.3);
	}

	.countdown-section {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.5rem;
	}

	.countdown-number {
		font-size: 4rem;
		font-weight: 700;
		color: var(--color-primary, #6366f1);
		line-height: 1;
		animation: pulse 1s ease infinite;
	}

	.is-me .countdown-number {
		color: var(--color-success, #10b981);
	}

	@keyframes pulse {
		0%, 100% { transform: scale(1); }
		50% { transform: scale(1.05); }
	}

	.countdown-label {
		font-size: 1rem;
		color: var(--color-text-secondary, #a0a0a0);
	}

	.is-me .countdown-label {
		color: var(--color-success, #10b981);
		font-weight: 600;
	}

	.players-section {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.section-title {
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--color-text-tertiary, #666);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		margin: 0;
	}

	.player-list {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
	}

	.player-entry {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 0.75rem;
		background: var(--color-surface-2, #1a1a2e);
		border-radius: 0.375rem;
		font-size: 0.875rem;
	}

	.player-entry.joining {
		background: var(--color-success-alpha, rgba(16, 185, 129, 0.1));
		border: 1px solid var(--color-success-alpha, rgba(16, 185, 129, 0.3));
	}

	.player-entry.joining.is-me {
		background: var(--color-success-alpha, rgba(16, 185, 129, 0.2));
		border-color: var(--color-success, #10b981);
	}

	.player-badge {
		width: 1.25rem;
		height: 1.25rem;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--color-success, #10b981);
		color: white;
		border-radius: 50%;
		font-size: 0.75rem;
		font-weight: 700;
	}

	.player-name {
		flex: 1;
		color: var(--color-text-primary, #fff);
	}

	.from-position {
		font-size: 0.75rem;
		color: var(--color-text-tertiary, #666);
	}

	.cta-section {
		text-align: center;
		padding: 0.75rem;
		background: var(--color-success-alpha, rgba(16, 185, 129, 0.1));
		border-radius: 0.375rem;
	}

	.cta-text {
		margin: 0;
		font-size: 0.875rem;
		color: var(--color-success, #10b981);
	}

	/* Reduced motion */
	@media (prefers-reduced-motion: reduce) {
		.warm-seat-overlay,
		.transition-card {
			animation: none;
		}

		.countdown-number {
			animation: none;
		}
	}
</style>
