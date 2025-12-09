<script lang="ts">
/**
 * GalleryLeaderboard
 *
 * Displays the weekly gallery leaderboard showing top spectators.
 * Fetches data from the gallery_leaderboard_weekly view.
 */

import Avatar from '$lib/components/ui/Avatar.svelte';

/** Leaderboard entry from database */
interface LeaderboardEntry {
	rank: number;
	userId: string;
	displayName: string;
	avatarSeed: string | null;
	totalPoints: number;
	predictionAccuracy: number;
	winPickRatio: string;
	achievementCount: number;
}

interface Props {
	/** Leaderboard entries to display */
	entries: LeaderboardEntry[];
	/** Current user's ID for highlighting */
	currentUserId?: string;
	/** Loading state */
	isLoading?: boolean;
	/** Compact mode for sidebar */
	compact?: boolean;
	/** Max entries to show (0 = all) */
	maxEntries?: number;
}

let {
	entries,
	currentUserId,
	isLoading = false,
	compact = false,
	maxEntries = 10,
}: Props = $props();

// Filter entries based on maxEntries
const displayEntries = $derived(maxEntries > 0 ? entries.slice(0, maxEntries) : entries);

// Rank styling
function getRankStyle(rank: number): { emoji: string; class: string } {
	switch (rank) {
		case 1:
			return { emoji: '🥇', class: 'gold' };
		case 2:
			return { emoji: '🥈', class: 'silver' };
		case 3:
			return { emoji: '🥉', class: 'bronze' };
		default:
			return { emoji: '', class: '' };
	}
}
</script>

<div class="gallery-leaderboard" class:compact>
	<header class="leaderboard-header">
		<h3 class="leaderboard-title">
			<span class="title-icon">👁</span>
			Weekly Gallery Leaders
		</h3>
	</header>

	{#if isLoading}
		<div class="loading-state">
			<div class="loading-spinner"></div>
			<span>Loading leaderboard...</span>
		</div>
	{:else if displayEntries.length === 0}
		<div class="empty-state">
			<span class="empty-icon">🏆</span>
			<p>No gallery activity this week yet!</p>
			<p class="empty-hint">Watch games and make predictions to earn points</p>
		</div>
	{:else}
		<div class="leaderboard-list">
			{#each displayEntries as entry (entry.userId)}
				{@const rankStyle = getRankStyle(entry.rank)}
				<div
					class="leaderboard-entry"
					class:current-user={entry.userId === currentUserId}
					class:top-three={entry.rank <= 3}
				>
					<div class="rank {rankStyle.class}">
						{#if rankStyle.emoji}
							<span class="rank-emoji">{rankStyle.emoji}</span>
						{:else}
							<span class="rank-number">#{entry.rank}</span>
						{/if}
					</div>

					<div class="user-info">
						<Avatar
							seed={entry.avatarSeed ?? entry.userId}
							size={compact ? 'sm' : 'md'}
						/>
						<span class="user-name">{entry.displayName}</span>
						{#if entry.userId === currentUserId}
							<span class="you-badge">You</span>
						{/if}
					</div>

					<div class="stats">
						<div class="points">
							<span class="points-value">{entry.totalPoints}</span>
							<span class="points-label">pts</span>
						</div>

						{#if !compact}
							<div class="stat-badges">
								{#if entry.predictionAccuracy > 0}
									<span class="stat-badge accuracy" title="Prediction accuracy">
										🎯 {entry.predictionAccuracy}%
									</span>
								{/if}
								{#if entry.winPickRatio !== '0/0'}
									<span class="stat-badge picks" title="Win pick ratio">
										📣 {entry.winPickRatio}
									</span>
								{/if}
								{#if entry.achievementCount > 0}
									<span class="stat-badge achievements" title="Achievements">
										🏅 {entry.achievementCount}
									</span>
								{/if}
							</div>
						{/if}
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>

<style>
.gallery-leaderboard {
	background: var(--surface-2, #1e1e2e);
	border-radius: 12px;
	padding: 1rem;
	border: 1px solid var(--border, #313244);
}

.gallery-leaderboard.compact {
	padding: 0.75rem;
}

.leaderboard-header {
	margin-bottom: 0.75rem;
}

.leaderboard-title {
	display: flex;
	align-items: center;
	gap: 0.5rem;
	font-size: 0.875rem;
	font-weight: 600;
	color: var(--text-1, #cdd6f4);
	margin: 0;
}

.compact .leaderboard-title {
	font-size: 0.75rem;
}

.title-icon {
	font-size: 1rem;
}

.loading-state {
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	gap: 0.5rem;
	padding: 2rem;
	color: var(--text-2, #a6adc8);
	font-size: 0.875rem;
}

.loading-spinner {
	width: 24px;
	height: 24px;
	border: 2px solid var(--border, #313244);
	border-top-color: #10b981;
	border-radius: 50%;
	animation: spin 1s linear infinite;
}

@keyframes spin {
	to {
		transform: rotate(360deg);
	}
}

.empty-state {
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	padding: 2rem 1rem;
	text-align: center;
}

.empty-icon {
	font-size: 2rem;
	margin-bottom: 0.5rem;
}

.empty-state p {
	margin: 0;
	color: var(--text-2, #a6adc8);
	font-size: 0.875rem;
}

.empty-hint {
	font-size: 0.75rem !important;
	margin-top: 0.25rem !important;
}

.leaderboard-list {
	display: flex;
	flex-direction: column;
	gap: 0.5rem;
}

.leaderboard-entry {
	display: flex;
	align-items: center;
	gap: 0.75rem;
	padding: 0.5rem;
	background: var(--surface-1, #11111b);
	border-radius: 8px;
	transition: background 0.2s;
}

.compact .leaderboard-entry {
	padding: 0.375rem;
	gap: 0.5rem;
}

.leaderboard-entry:hover {
	background: var(--surface-3, #313244);
}

.leaderboard-entry.current-user {
	background: rgba(16, 185, 129, 0.1);
	border: 1px solid rgba(16, 185, 129, 0.3);
}

.leaderboard-entry.top-three {
	border: 1px solid var(--border, #313244);
}

.leaderboard-entry.top-three.current-user {
	border-color: rgba(16, 185, 129, 0.5);
}

.rank {
	min-width: 28px;
	text-align: center;
}

.rank-emoji {
	font-size: 1.25rem;
}

.compact .rank-emoji {
	font-size: 1rem;
}

.rank-number {
	font-size: 0.75rem;
	font-weight: 600;
	color: var(--text-2, #a6adc8);
}

.rank.gold .rank-number {
	color: #fbbf24;
}

.rank.silver .rank-number {
	color: #9ca3af;
}

.rank.bronze .rank-number {
	color: #d97706;
}

.user-info {
	display: flex;
	align-items: center;
	gap: 0.5rem;
	flex: 1;
	min-width: 0;
}

.user-name {
	font-size: 0.875rem;
	font-weight: 500;
	color: var(--text-1, #cdd6f4);
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

.compact .user-name {
	font-size: 0.75rem;
}

.you-badge {
	font-size: 0.625rem;
	font-weight: 600;
	padding: 0.125rem 0.375rem;
	background: #10b981;
	color: white;
	border-radius: 10px;
	text-transform: uppercase;
	letter-spacing: 0.025em;
}

.stats {
	display: flex;
	flex-direction: column;
	align-items: flex-end;
	gap: 0.25rem;
}

.points {
	display: flex;
	align-items: baseline;
	gap: 0.125rem;
}

.points-value {
	font-size: 1rem;
	font-weight: 700;
	color: #10b981;
}

.compact .points-value {
	font-size: 0.875rem;
}

.points-label {
	font-size: 0.625rem;
	color: var(--text-2, #a6adc8);
}

.stat-badges {
	display: flex;
	gap: 0.375rem;
}

.stat-badge {
	font-size: 0.625rem;
	padding: 0.125rem 0.25rem;
	background: var(--surface-2, #1e1e2e);
	border-radius: 4px;
	color: var(--text-2, #a6adc8);
}

.stat-badge.accuracy {
	color: #10b981;
}

.stat-badge.picks {
	color: #f59e0b;
}

.stat-badge.achievements {
	color: #8b5cf6;
}
</style>
