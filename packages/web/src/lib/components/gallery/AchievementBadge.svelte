<script lang="ts">
/**
 * AchievementBadge
 *
 * Displays a gallery achievement with its emoji, name, and unlock state.
 * Can show progress toward unlocking or unlocked state.
 */

import type { GalleryAchievement } from '$lib/services/spectatorService.svelte';

interface Props {
	/** Achievement to display */
	achievement: GalleryAchievement;
	/** Show as newly unlocked (with animation) */
	isNew?: boolean;
	/** Compact display mode */
	compact?: boolean;
}

let { achievement, isNew = false, compact = false }: Props = $props();

// Calculate progress percentage
const progressPercent = $derived(
	achievement.progress !== undefined && achievement.threshold > 0
		? Math.min(100, Math.round((achievement.progress / achievement.threshold) * 100))
		: achievement.unlocked
			? 100
			: 0,
);

// Format unlock time
const unlockDate = $derived(
	achievement.unlockedAt ? new Date(achievement.unlockedAt).toLocaleDateString() : null,
);
</script>

<div
	class="achievement-badge"
	class:unlocked={achievement.unlocked}
	class:new={isNew}
	class:compact
	title={achievement.description}
>
	<div class="badge-icon" class:locked={!achievement.unlocked}>
		<span class="emoji">{achievement.emoji}</span>
		{#if !achievement.unlocked && achievement.progress !== undefined}
			<div class="progress-ring">
				<svg viewBox="0 0 36 36" class="progress-svg">
					<circle
						class="progress-bg"
						cx="18"
						cy="18"
						r="16"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
					/>
					<circle
						class="progress-fill"
						cx="18"
						cy="18"
						r="16"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-dasharray="{progressPercent}, 100"
						stroke-linecap="round"
					/>
				</svg>
			</div>
		{/if}
	</div>

	{#if !compact}
		<div class="badge-info">
			<span class="badge-name">{achievement.name}</span>
			{#if achievement.unlocked}
				{#if unlockDate}
					<span class="unlock-date">Earned {unlockDate}</span>
				{:else}
					<span class="unlock-date">Unlocked!</span>
				{/if}
			{:else if achievement.progress !== undefined}
				<span class="progress-text">
					{achievement.progress}/{achievement.threshold}
				</span>
			{:else}
				<span class="badge-desc">{achievement.description}</span>
			{/if}
		</div>
	{/if}
</div>

<style>
.achievement-badge {
	display: flex;
	align-items: center;
	gap: 0.75rem;
	padding: 0.75rem;
	background: var(--surface-2, #1e1e2e);
	border-radius: 12px;
	border: 1px solid var(--border, #313244);
	transition: transform 0.2s, box-shadow 0.2s;
}

.achievement-badge.compact {
	padding: 0.5rem;
	gap: 0.5rem;
}

.achievement-badge.unlocked {
	border-color: #fbbf24;
	background: linear-gradient(135deg, rgba(251, 191, 36, 0.1) 0%, transparent 100%);
}

.achievement-badge.new {
	animation: badge-unlock 0.6s ease-out;
	box-shadow: 0 0 30px rgba(251, 191, 36, 0.4);
}

@keyframes badge-unlock {
	0% {
		transform: scale(0.8);
		opacity: 0;
	}
	50% {
		transform: scale(1.1);
	}
	100% {
		transform: scale(1);
		opacity: 1;
	}
}

.badge-icon {
	position: relative;
	width: 48px;
	height: 48px;
	display: flex;
	align-items: center;
	justify-content: center;
	border-radius: 50%;
	background: var(--surface-1, #11111b);
}

.compact .badge-icon {
	width: 36px;
	height: 36px;
}

.badge-icon.locked {
	filter: grayscale(0.8);
	opacity: 0.6;
}

.emoji {
	font-size: 1.5rem;
	line-height: 1;
}

.compact .emoji {
	font-size: 1.125rem;
}

.progress-ring {
	position: absolute;
	inset: -2px;
}

.progress-svg {
	width: 100%;
	height: 100%;
	transform: rotate(-90deg);
}

.progress-bg {
	color: var(--border, #313244);
}

.progress-fill {
	color: #10b981;
	transition: stroke-dasharray 0.3s ease;
}

.badge-info {
	display: flex;
	flex-direction: column;
	gap: 0.125rem;
	flex: 1;
	min-width: 0;
}

.badge-name {
	font-size: 0.875rem;
	font-weight: 600;
	color: var(--text-1, #cdd6f4);
}

.compact .badge-name {
	font-size: 0.75rem;
}

.badge-desc {
	font-size: 0.75rem;
	color: var(--text-2, #a6adc8);
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

.unlock-date {
	font-size: 0.75rem;
	color: #fbbf24;
}

.progress-text {
	font-size: 0.75rem;
	color: var(--text-2, #a6adc8);
}

/* Hover effect for unlocked */
.achievement-badge.unlocked:hover {
	transform: translateY(-2px);
	box-shadow: 0 4px 20px rgba(251, 191, 36, 0.2);
}
</style>
