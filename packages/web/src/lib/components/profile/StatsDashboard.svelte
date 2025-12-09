<script lang="ts">
/**
 * StatsDashboard - Player statistics display component
 *
 * Displays games played, wins, losses, win rate, and Glicko-2 rating.
 * Supports loading and empty states.
 *
 * Design: Neo-Brutalist with hard borders, tabular numbers for stats
 */

import type { Profile } from '$lib/supabase/profiles';
import type { PlayerStats } from '$lib/supabase/stats';
import { calculateDecisionQuality, calculateWinRate } from '$lib/supabase/stats';

interface Props {
	/** Player statistics data (null for loading/empty state) */
	stats: PlayerStats | null;
	/** User profile for rating data (optional) */
	profile?: Profile | null;
	/** Whether data is currently loading */
	loading?: boolean;
	/** Additional CSS classes */
	class?: string;
}

let { stats, profile = null, loading = false, class: className = '' }: Props = $props();

// Derived statistics
const winRate = $derived(stats ? calculateWinRate(stats) : 0);
const decisionQuality = $derived(stats ? calculateDecisionQuality(stats) : 0);
const losses = $derived(stats ? stats.games_completed - stats.games_won : 0);

// Rating data comes from profile, not stats
const skillRating = $derived(profile?.skill_rating ?? 1500);
const ratingDeviation = $derived(profile?.rating_deviation ?? 350);
const ratingVolatility = $derived(profile?.rating_volatility ?? 0.06);
const hasRatingData = $derived(profile !== null);

/**
 * Format rating with deviation indicator
 * Glicko-2 rating with uncertainty band
 */
function formatRating(rating: number, deviation: number): string {
	return `${Math.round(rating)} ± ${Math.round(deviation)}`;
}

/**
 * Get rating tier based on skill rating
 */
function getRatingTier(rating: number): { label: string; color: string } {
	if (rating >= 2000) return { label: 'Master', color: 'var(--color-accent)' };
	if (rating >= 1800) return { label: 'Expert', color: 'var(--color-success)' };
	if (rating >= 1600) return { label: 'Advanced', color: '#3B82F6' };
	if (rating >= 1400) return { label: 'Intermediate', color: 'var(--color-text)' };
	return { label: 'Beginner', color: 'var(--color-text-muted)' };
}

const ratingTier = $derived(hasRatingData ? getRatingTier(skillRating) : null);
</script>

<div class="stats-dashboard {className}" class:loading>
	{#if loading}
		<!-- Loading State -->
		<div class="loading-state">
			<div class="loading-spinner" aria-hidden="true"></div>
			<p class="loading-text">Loading stats...</p>
		</div>
	{:else if !stats}
		<!-- Empty State -->
		<div class="empty-state">
			<span class="empty-icon" aria-hidden="true">📊</span>
			<p class="empty-title">No Stats Yet</p>
			<p class="empty-text">Play some games to start tracking your progress!</p>
		</div>
	{:else}
		<!-- Stats Grid -->
		<div class="stats-grid">
			<!-- Games Overview -->
			<div class="stat-card stat-card--primary">
				<h3 class="stat-label">Games Played</h3>
				<p class="stat-value stat-value--large">{stats.games_played}</p>
				<p class="stat-detail">{stats.games_completed} completed</p>
			</div>

			<!-- Win/Loss -->
			<div class="stat-card">
				<h3 class="stat-label">Record</h3>
				<p class="stat-value">
					<span class="wins">{stats.games_won}W</span>
					<span class="separator">-</span>
					<span class="losses">{losses}L</span>
				</p>
				<p class="stat-detail">{winRate.toFixed(1)}% win rate</p>
			</div>

			<!-- Rating -->
			<div class="stat-card stat-card--rating">
				<h3 class="stat-label">Rating</h3>
				<p class="stat-value">{Math.round(skillRating)}</p>
				{#if ratingTier}
					<p class="stat-detail" style="color: {ratingTier.color}">
						{ratingTier.label}
					</p>
				{/if}
			</div>

			<!-- Best Score -->
			<div class="stat-card">
				<h3 class="stat-label">Best Score</h3>
				<p class="stat-value">{stats.best_score}</p>
				<p class="stat-detail">avg: {stats.avg_score.toFixed(0)}</p>
			</div>
		</div>

		<!-- Detailed Stats -->
		<div class="detailed-stats">
			<h3 class="section-title">Performance</h3>
			
			<!-- Decision Quality Bar -->
			<div class="progress-stat">
				<div class="progress-header">
					<span class="progress-label">Decision Quality</span>
					<span class="progress-value">{decisionQuality.toFixed(1)}%</span>
				</div>
				<div class="progress-bar">
					<div 
						class="progress-fill progress-fill--quality" 
						style="width: {Math.min(decisionQuality, 100)}%"
					></div>
				</div>
				<p class="progress-detail">
					{stats.optimal_decisions} / {stats.total_decisions} optimal decisions
				</p>
			</div>

			<!-- Win Rate Bar -->
			<div class="progress-stat">
				<div class="progress-header">
					<span class="progress-label">Win Rate</span>
					<span class="progress-value">{winRate.toFixed(1)}%</span>
				</div>
				<div class="progress-bar">
					<div 
						class="progress-fill progress-fill--wins" 
						style="width: {Math.min(winRate, 100)}%"
					></div>
				</div>
			</div>

			<!-- Achievements Row -->
			<div class="achievements-row">
				<div class="achievement">
					<span class="achievement-value">{stats.dicees_rolled}</span>
					<span class="achievement-label">Dicees</span>
				</div>
				<div class="achievement">
					<span class="achievement-value">{stats.bonus_dicees}</span>
					<span class="achievement-label">Bonus Dicees</span>
				</div>
				<div class="achievement">
					<span class="achievement-value">{stats.upper_bonuses}</span>
					<span class="achievement-label">Upper Bonuses</span>
				</div>
			</div>
		</div>

		<!-- Rating Details (Collapsible) -->
		{#if hasRatingData}
			<details class="rating-details">
				<summary class="rating-summary">Rating Details</summary>
				<div class="rating-content">
					<div class="rating-row">
						<span class="rating-label">Skill Rating</span>
						<span class="rating-value">{formatRating(skillRating, ratingDeviation)}</span>
					</div>
					<div class="rating-row">
						<span class="rating-label">Rating Deviation</span>
						<span class="rating-value">{ratingDeviation.toFixed(1)}</span>
					</div>
					<div class="rating-row">
						<span class="rating-label">Volatility</span>
						<span class="rating-value">{ratingVolatility.toFixed(4)}</span>
					</div>
					<p class="rating-hint">
						Lower deviation = more confident rating. Play more games to reduce uncertainty.
					</p>
				</div>
			</details>
		{/if}
	{/if}
</div>

<style>
	.stats-dashboard {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		width: 100%;
	}

	/* Loading State */
	.loading-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: var(--space-2);
		padding: var(--space-5);
		border: var(--border-medium);
		background: var(--color-surface);
	}

	.loading-spinner {
		width: 32px;
		height: 32px;
		border: 3px solid var(--color-border);
		border-top-color: var(--color-accent);
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.loading-text {
		font-size: var(--text-body);
		color: var(--color-text-muted);
	}

	/* Empty State */
	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: var(--space-1);
		padding: var(--space-5);
		border: var(--border-medium);
		background: var(--color-surface);
		text-align: center;
	}

	.empty-icon {
		font-size: 48px;
	}

	.empty-title {
		font-size: var(--text-h3);
		font-weight: var(--weight-semibold);
		color: var(--color-text);
		margin: 0;
	}

	.empty-text {
		font-size: var(--text-body);
		color: var(--color-text-muted);
		margin: 0;
	}

	/* Stats Grid */
	.stats-grid {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: var(--space-2);
	}

	@media (min-width: 768px) {
		.stats-grid {
			grid-template-columns: repeat(4, 1fr);
		}
	}

	/* Stat Cards */
	.stat-card {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: var(--space-1);
		padding: var(--space-2);
		border: var(--border-medium);
		background: var(--color-surface);
		text-align: center;
		min-height: 100px;
	}

	.stat-card--primary {
		background: var(--color-border);
		color: var(--color-surface);
	}

	.stat-card--primary .stat-label,
	.stat-card--primary .stat-detail {
		color: var(--color-surface);
		opacity: 0.8;
	}

	.stat-card--rating {
		background: var(--color-accent-light);
	}

	.stat-label {
		font-size: var(--text-small);
		font-weight: var(--weight-medium);
		color: var(--color-text-muted);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		margin: 0;
	}

	.stat-value {
		font-size: var(--text-h2);
		font-weight: var(--weight-bold);
		font-variant-numeric: tabular-nums;
		color: var(--color-text);
		margin: 0;
		line-height: 1;
	}

	.stat-card--primary .stat-value {
		color: var(--color-surface);
	}

	.stat-value--large {
		font-size: var(--text-display);
	}

	.stat-detail {
		font-size: var(--text-small);
		color: var(--color-text-muted);
		margin: 0;
	}

	/* Win/Loss colors */
	.wins {
		color: var(--color-success);
	}

	.losses {
		color: var(--color-danger);
	}

	.separator {
		color: var(--color-text-muted);
		margin: 0 var(--space-1);
	}

	/* Detailed Stats Section */
	.detailed-stats {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		padding: var(--space-3);
		border: var(--border-medium);
		background: var(--color-surface);
	}

	.section-title {
		font-size: var(--text-body);
		font-weight: var(--weight-semibold);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--color-text);
		margin: 0 0 var(--space-1) 0;
		padding-bottom: var(--space-1);
		border-bottom: var(--border-thin);
	}

	/* Progress Stats */
	.progress-stat {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
	}

	.progress-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.progress-label {
		font-size: var(--text-body);
		color: var(--color-text);
	}

	.progress-value {
		font-size: var(--text-body);
		font-weight: var(--weight-semibold);
		font-variant-numeric: tabular-nums;
		color: var(--color-text);
	}

	.progress-bar {
		height: 12px;
		background: var(--color-background);
		border: var(--border-thin);
		overflow: hidden;
	}

	.progress-fill {
		height: 100%;
		transition: width var(--transition-medium);
	}

	.progress-fill--quality {
		background: var(--color-accent);
	}

	.progress-fill--wins {
		background: var(--color-success);
	}

	.progress-detail {
		font-size: var(--text-small);
		color: var(--color-text-muted);
		margin: 0;
	}

	/* Achievements Row */
	.achievements-row {
		display: flex;
		justify-content: space-around;
		gap: var(--space-2);
		padding-top: var(--space-2);
		border-top: var(--border-thin);
	}

	.achievement {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 2px;
	}

	.achievement-value {
		font-size: var(--text-h3);
		font-weight: var(--weight-bold);
		font-variant-numeric: tabular-nums;
		color: var(--color-text);
	}

	.achievement-label {
		font-size: var(--text-tiny);
		color: var(--color-text-muted);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	/* Rating Details */
	.rating-details {
		border: var(--border-medium);
		background: var(--color-surface);
	}

	.rating-summary {
		padding: var(--space-2);
		font-size: var(--text-body);
		font-weight: var(--weight-medium);
		cursor: pointer;
		user-select: none;
	}

	.rating-summary:hover {
		background: var(--color-background);
	}

	.rating-content {
		padding: var(--space-2);
		border-top: var(--border-thin);
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
	}

	.rating-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.rating-label {
		font-size: var(--text-body);
		color: var(--color-text-muted);
	}

	.rating-value {
		font-size: var(--text-body);
		font-weight: var(--weight-medium);
		font-variant-numeric: tabular-nums;
		color: var(--color-text);
	}

	.rating-hint {
		font-size: var(--text-small);
		color: var(--color-text-muted);
		margin: var(--space-1) 0 0 0;
		font-style: italic;
	}

	/* Loading overlay effect */
	.stats-dashboard.loading {
		opacity: 0.7;
		pointer-events: none;
	}
</style>
