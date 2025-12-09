<script lang="ts">
/**
 * GalleryPointsPanel
 *
 * Displays gallery points earned by a spectator during a game.
 * Shows points breakdown by category with visual indicators.
 */

import { spectatorService } from '$lib/services/spectatorService.svelte';

interface Props {
	/** Whether to show detailed breakdown */
	showBreakdown?: boolean;
	/** Compact mode for sidebar */
	compact?: boolean;
}

let { showBreakdown = true, compact = false }: Props = $props();

// Derived state from service
const galleryPoints = $derived(spectatorService.galleryPoints);
const totalPoints = $derived(spectatorService.totalGalleryPoints);
const predictionPoints = $derived(spectatorService.predictionPointsThisGame);
const socialPoints = $derived(spectatorService.socialPointsThisGame);
const backingPoints = $derived(spectatorService.backingPointsThisGame);

// Point category configs
const categories = [
	{
		key: 'predictions',
		label: 'Predictions',
		emoji: '🎯',
		color: '#10b981', // emerald
		getPoints: () => predictionPoints,
	},
	{
		key: 'social',
		label: 'Social',
		emoji: '💬',
		color: '#8b5cf6', // violet
		getPoints: () => socialPoints,
	},
	{
		key: 'backing',
		label: 'Backing',
		emoji: '📣',
		color: '#f59e0b', // amber
		getPoints: () => backingPoints,
	},
] as const;

// Animation for points change
let animatingPoints = $state(false);
let previousTotal = $state(0);

$effect(() => {
	if (totalPoints > previousTotal && previousTotal > 0) {
		animatingPoints = true;
		setTimeout(() => {
			animatingPoints = false;
		}, 600);
	}
	previousTotal = totalPoints;
});
</script>

<div class="gallery-points-panel" class:compact>
	<header class="panel-header">
		<h3 class="panel-title">
			<span class="title-icon">🏆</span>
			{compact ? 'Points' : 'Gallery Points'}
		</h3>
		<div class="total-points" class:animating={animatingPoints}>
			<span class="points-value">{totalPoints}</span>
			<span class="points-label">pts</span>
		</div>
	</header>

	{#if showBreakdown && galleryPoints}
		<div class="breakdown">
			{#each categories as cat}
				{@const points = cat.getPoints()}
				{#if points > 0 || !compact}
					<div class="category" style="--cat-color: {cat.color}">
						<span class="category-icon">{cat.emoji}</span>
						<span class="category-label">{cat.label}</span>
						<span class="category-points">+{points}</span>
					</div>
				{/if}
			{/each}
		</div>

		{#if !compact && galleryPoints}
			<div class="detailed-breakdown">
				<details>
					<summary>Details</summary>
					<div class="details-content">
						{#if galleryPoints.predictions.correct > 0}
							<div class="detail-row">
								<span>Correct predictions</span>
								<span>+{galleryPoints.predictions.correct}</span>
							</div>
						{/if}
						{#if galleryPoints.predictions.streakBonus > 0}
							<div class="detail-row">
								<span>Streak bonus</span>
								<span>+{galleryPoints.predictions.streakBonus}</span>
							</div>
						{/if}
						{#if galleryPoints.predictions.exactScore > 0}
							<div class="detail-row">
								<span>Exact score predictions</span>
								<span>+{galleryPoints.predictions.exactScore}</span>
							</div>
						{/if}
						{#if galleryPoints.social.reactionsGiven > 0}
							<div class="detail-row">
								<span>Reactions given</span>
								<span>+{galleryPoints.social.reactionsGiven}</span>
							</div>
						{/if}
						{#if galleryPoints.social.kibitzVotes > 0}
							<div class="detail-row">
								<span>Kibitz votes (majority)</span>
								<span>+{galleryPoints.social.kibitzVotes}</span>
							</div>
						{/if}
						{#if galleryPoints.social.chatMessages > 0}
							<div class="detail-row">
								<span>Chat messages</span>
								<span>+{galleryPoints.social.chatMessages}</span>
							</div>
						{/if}
						{#if galleryPoints.backing.backedWinner > 0}
							<div class="detail-row">
								<span>Backed the winner</span>
								<span>+{galleryPoints.backing.backedWinner}</span>
							</div>
						{/if}
						{#if galleryPoints.backing.loyaltyBonus > 0}
							<div class="detail-row">
								<span>Loyalty bonus</span>
								<span>+{galleryPoints.backing.loyaltyBonus}</span>
							</div>
						{/if}
					</div>
				</details>
			</div>
		{/if}
	{:else if !galleryPoints}
		<div class="empty-state">
			<p>Earn points by making predictions, sending reactions, and cheering!</p>
		</div>
	{/if}
</div>

<style>
.gallery-points-panel {
	background: var(--surface-2, #1e1e2e);
	border-radius: 12px;
	padding: 1rem;
	border: 1px solid var(--border, #313244);
}

.gallery-points-panel.compact {
	padding: 0.75rem;
}

.panel-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	margin-bottom: 0.75rem;
}

.panel-title {
	display: flex;
	align-items: center;
	gap: 0.5rem;
	font-size: 0.875rem;
	font-weight: 600;
	color: var(--text-1, #cdd6f4);
	margin: 0;
}

.compact .panel-title {
	font-size: 0.75rem;
}

.title-icon {
	font-size: 1rem;
}

.compact .title-icon {
	font-size: 0.875rem;
}

.total-points {
	display: flex;
	align-items: baseline;
	gap: 0.25rem;
	padding: 0.25rem 0.75rem;
	background: linear-gradient(135deg, #10b981 0%, #059669 100%);
	border-radius: 20px;
	transition: transform 0.2s, box-shadow 0.2s;
}

.total-points.animating {
	transform: scale(1.1);
	box-shadow: 0 0 20px rgba(16, 185, 129, 0.5);
}

.points-value {
	font-size: 1.25rem;
	font-weight: 700;
	color: white;
}

.compact .points-value {
	font-size: 1rem;
}

.points-label {
	font-size: 0.75rem;
	color: rgba(255, 255, 255, 0.8);
}

.breakdown {
	display: flex;
	flex-direction: column;
	gap: 0.5rem;
}

.category {
	display: flex;
	align-items: center;
	gap: 0.5rem;
	padding: 0.5rem;
	background: var(--surface-1, #11111b);
	border-radius: 8px;
	border-left: 3px solid var(--cat-color);
}

.compact .category {
	padding: 0.375rem;
}

.category-icon {
	font-size: 1rem;
}

.compact .category-icon {
	font-size: 0.875rem;
}

.category-label {
	flex: 1;
	font-size: 0.75rem;
	color: var(--text-2, #a6adc8);
}

.category-points {
	font-size: 0.875rem;
	font-weight: 600;
	color: var(--cat-color);
}

.compact .category-points {
	font-size: 0.75rem;
}

.detailed-breakdown {
	margin-top: 0.75rem;
}

.detailed-breakdown details {
	font-size: 0.75rem;
}

.detailed-breakdown summary {
	cursor: pointer;
	color: var(--text-2, #a6adc8);
	padding: 0.25rem 0;
}

.detailed-breakdown summary:hover {
	color: var(--text-1, #cdd6f4);
}

.details-content {
	padding: 0.5rem;
	background: var(--surface-1, #11111b);
	border-radius: 6px;
	margin-top: 0.5rem;
}

.detail-row {
	display: flex;
	justify-content: space-between;
	padding: 0.25rem 0;
	color: var(--text-2, #a6adc8);
}

.detail-row span:last-child {
	color: #10b981;
	font-weight: 500;
}

.empty-state {
	padding: 0.75rem;
	text-align: center;
	color: var(--text-2, #a6adc8);
	font-size: 0.75rem;
}

.empty-state p {
	margin: 0;
}
</style>
