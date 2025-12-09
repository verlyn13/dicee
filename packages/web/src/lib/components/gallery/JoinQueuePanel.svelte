<!--
  JoinQueuePanel.svelte - Queue UI for spectators to join next game

  Features:
  - Show current queue with positions
  - Join/Leave queue buttons
  - Position indicator with "will get spot" status
  - Estimated wait time
  - Visual feedback for queue changes
-->
<script lang="ts">
import { type JoinQueueEntry, spectatorService } from '$lib/services/spectatorService.svelte';
import { haptic } from '$lib/utils/haptics';

interface Props {
	/** Whether to show in compact mode */
	compact?: boolean;
	/** Callback when queue action is taken */
	onQueueAction?: (action: 'join' | 'leave') => void;
}

let { compact = false, onQueueAction }: Props = $props();

// Derived state from service
const isInQueue = $derived(spectatorService.isInQueue);
const myPosition = $derived(spectatorService.myQueuePosition);
const willGetSpot = $derived(spectatorService.willGetSpot);
const queuedSpectators = $derived(spectatorService.queuedSpectators);
const availableSpots = $derived(spectatorService.availableSpots);
const estimatedWait = $derived(spectatorService.estimatedWaitTime);
const canJoin = $derived(spectatorService.canJoinQueue);
const isConnected = $derived(spectatorService.isConnected);

// Format wait time
function formatWaitTime(ms: number | null): string {
	if (ms === null) return 'Waiting for game to start...';
	const minutes = Math.ceil(ms / 60000);
	if (minutes < 1) return 'Starting soon!';
	if (minutes === 1) return '~1 minute';
	return `~${minutes} minutes`;
}

// Format queue position message
function getPositionMessage(position: number, willGet: boolean): string {
	if (willGet) {
		return position === 1 ? "You're next!" : `Position #${position} - You'll get in!`;
	}
	return `Position #${position} - Waiting for spot`;
}

function handleJoinQueue() {
	haptic('light');
	spectatorService.joinQueue();
	onQueueAction?.('join');
}

function handleLeaveQueue() {
	haptic('light');
	spectatorService.leaveQueue();
	onQueueAction?.('leave');
}

function handleKeyDown(event: KeyboardEvent, action: 'join' | 'leave') {
	if (event.key === 'Enter' || event.key === ' ') {
		event.preventDefault();
		if (action === 'join') handleJoinQueue();
		else handleLeaveQueue();
	}
}
</script>

<div class="join-queue-panel" class:compact role="region" aria-label="Join queue">
	<div class="panel-header">
		<h3 class="panel-title">Next Game Queue</h3>
		{#if availableSpots > 0}
			<span class="spots-badge">{availableSpots} spot{availableSpots === 1 ? '' : 's'} available</span>
		{:else}
			<span class="spots-badge full">Full</span>
		{/if}
	</div>

	{#if !isConnected}
		<div class="disconnected-notice">
			Connecting to room...
		</div>
	{:else if isInQueue}
		<!-- In queue state -->
		<div class="in-queue-status" class:will-get={willGetSpot}>
			<div class="position-indicator">
				<span class="position-number">#{myPosition}</span>
				<span class="position-label">
					{getPositionMessage(myPosition ?? 0, willGetSpot)}
				</span>
			</div>

			{#if estimatedWait !== null}
				<div class="wait-time">
					{formatWaitTime(estimatedWait)}
				</div>
			{/if}

			<button
				type="button"
				class="queue-btn leave"
				onclick={handleLeaveQueue}
				onkeydown={(e) => handleKeyDown(e, 'leave')}
				aria-label="Leave queue"
			>
				Leave Queue
			</button>
		</div>
	{:else}
		<!-- Not in queue state -->
		<div class="join-prompt">
			<p class="join-text">
				{#if queuedSpectators.length === 0}
					Be the first in line for the next game!
				{:else}
					{queuedSpectators.length} spectator{queuedSpectators.length === 1 ? '' : 's'} waiting
				{/if}
			</p>

			<button
				type="button"
				class="queue-btn join"
				onclick={handleJoinQueue}
				onkeydown={(e) => handleKeyDown(e, 'join')}
				disabled={!canJoin}
				aria-label="Join queue"
			>
				Join Queue
			</button>
		</div>
	{/if}

	<!-- Queue list (if not compact) -->
	{#if !compact && queuedSpectators.length > 0}
		<div class="queue-list" role="list" aria-label="Queue members">
			{#each queuedSpectators as entry (entry.userId)}
				{@const isMe = entry.position === myPosition}
				{@const getsSpot = entry.position <= availableSpots}
				<div
					class="queue-entry"
					class:is-me={isMe}
					class:gets-spot={getsSpot}
					role="listitem"
				>
					<span class="entry-position">#{entry.position}</span>
					<span class="entry-name">{entry.displayName}</span>
					{#if getsSpot}
						<span class="entry-status">Will play</span>
					{/if}
				</div>
			{/each}
		</div>
	{/if}
</div>

<style>
	.join-queue-panel {
		background: var(--color-surface-1, #0f0f1a);
		border: 1px solid var(--color-border, #333);
		border-radius: 0.5rem;
		padding: 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.join-queue-panel.compact {
		padding: 0.75rem;
		gap: 0.5rem;
	}

	.panel-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
	}

	.panel-title {
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--color-text-primary, #fff);
		margin: 0;
	}

	.spots-badge {
		font-size: 0.75rem;
		padding: 0.125rem 0.5rem;
		background: var(--color-success-alpha, rgba(16, 185, 129, 0.15));
		color: var(--color-success, #10b981);
		border-radius: 9999px;
	}

	.spots-badge.full {
		background: var(--color-warning-alpha, rgba(245, 158, 11, 0.15));
		color: var(--color-warning, #f59e0b);
	}

	.disconnected-notice {
		text-align: center;
		padding: 0.75rem;
		color: var(--color-text-tertiary, #666);
		font-size: 0.875rem;
	}

	.in-queue-status {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.5rem;
		padding: 0.75rem;
		background: var(--color-surface-2, #1a1a2e);
		border-radius: 0.375rem;
	}

	.in-queue-status.will-get {
		background: var(--color-success-alpha, rgba(16, 185, 129, 0.1));
		border: 1px solid var(--color-success-alpha, rgba(16, 185, 129, 0.3));
	}

	.position-indicator {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.25rem;
	}

	.position-number {
		font-size: 1.5rem;
		font-weight: 700;
		color: var(--color-primary, #6366f1);
	}

	.will-get .position-number {
		color: var(--color-success, #10b981);
	}

	.position-label {
		font-size: 0.875rem;
		color: var(--color-text-secondary, #a0a0a0);
	}

	.wait-time {
		font-size: 0.75rem;
		color: var(--color-text-tertiary, #666);
	}

	.join-prompt {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.75rem;
		text-align: center;
	}

	.join-text {
		font-size: 0.875rem;
		color: var(--color-text-secondary, #a0a0a0);
		margin: 0;
	}

	.queue-btn {
		padding: 0.5rem 1rem;
		font-size: 0.875rem;
		font-weight: 500;
		border: none;
		border-radius: 0.375rem;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.queue-btn.join {
		background: var(--color-primary, #6366f1);
		color: white;
	}

	.queue-btn.join:hover:not(:disabled) {
		background: var(--color-primary-hover, #5355d1);
	}

	.queue-btn.join:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.queue-btn.leave {
		background: var(--color-surface-3, #2a2a3e);
		color: var(--color-text-secondary, #a0a0a0);
	}

	.queue-btn.leave:hover {
		background: var(--color-surface-4, #3a3a4e);
		color: var(--color-text-primary, #fff);
	}

	.queue-list {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		margin-top: 0.5rem;
		padding-top: 0.5rem;
		border-top: 1px solid var(--color-border, #333);
	}

	.queue-entry {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.375rem 0.5rem;
		border-radius: 0.25rem;
		font-size: 0.75rem;
	}

	.queue-entry.is-me {
		background: var(--color-primary-alpha, rgba(99, 102, 241, 0.1));
	}

	.queue-entry.gets-spot {
		background: var(--color-success-alpha, rgba(16, 185, 129, 0.1));
	}

	.entry-position {
		font-weight: 600;
		color: var(--color-text-secondary, #a0a0a0);
		min-width: 1.5rem;
	}

	.entry-name {
		flex: 1;
		color: var(--color-text-primary, #fff);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.is-me .entry-name {
		font-weight: 600;
	}

	.entry-status {
		font-size: 0.625rem;
		padding: 0.125rem 0.375rem;
		background: var(--color-success-alpha, rgba(16, 185, 129, 0.2));
		color: var(--color-success, #10b981);
		border-radius: 9999px;
	}

	/* Touch-friendly on mobile */
	@media (max-width: 768px) {
		.queue-btn {
			padding: 0.625rem 1.25rem;
			font-size: 1rem;
		}
	}

	/* Reduced motion */
	@media (prefers-reduced-motion: reduce) {
		.queue-btn {
			transition: none;
		}
	}
</style>
