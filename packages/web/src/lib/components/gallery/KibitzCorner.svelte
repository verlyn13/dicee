<!--
  KibitzCorner.svelte - Spectator Kibitz Panel

  The Gallery's "peanut gallery" - spectators vote on what they think
  the current player should do. Non-binding, just for fun!

  Features:
  - Tab-based voting: Category, Keep Pattern, Action
  - Real-time vote aggregation with percentages
  - Leading option highlighting
  - Your current vote indicator
-->
<script lang="ts">
import {
	type KibitzOption,
	type KibitzVoteType,
	spectatorService,
} from '$lib/services/spectatorService.svelte';
import KibitzVote from './KibitzVote.svelte';

interface Props {
	/** Available categories for voting (from game state) */
	availableCategories?: string[];
	/** Current dice for keep pattern suggestions */
	currentDice?: number[];
	/** Whether player can still roll */
	canRoll?: boolean;
}

let { availableCategories = [], currentDice = [], canRoll = true }: Props = $props();

// Local state
let activeTab: KibitzVoteType = $state('category');

// Derived from service
const kibitzState = $derived(spectatorService.kibitzState);
const myVote = $derived(spectatorService.myKibitzVote);
const canVote = $derived(spectatorService.canKibitz);
const currentTurn = $derived(spectatorService.currentTurn);

// Tab options
const tabs: { type: KibitzVoteType; label: string; icon: string }[] = [
	{ type: 'category', label: 'Score', icon: '🎯' },
	{ type: 'keep', label: 'Keep', icon: '🎲' },
	{ type: 'action', label: 'Action', icon: '⚡' },
];

// Get options for current tab
const currentOptions = $derived(() => {
	if (!kibitzState) return [];
	switch (activeTab) {
		case 'category':
			return kibitzState.categoryOptions;
		case 'keep':
			return kibitzState.keepOptions;
		case 'action':
			return kibitzState.actionOptions;
	}
});

// Generate category options if none exist
const categoryOptionsToShow = $derived(() => {
	const existing = currentOptions();
	if (activeTab !== 'category') return existing;

	// Merge existing with available categories
	const existingIds = new Set(existing.map((o) => o.optionId));
	const additional: KibitzOption[] = availableCategories
		.filter((c) => !existingIds.has(c))
		.map((c) => ({
			optionId: c,
			label: formatCategoryLabel(c),
			voteCount: 0,
			percentage: 0,
			voterPreview: [],
		}));

	return [...existing, ...additional];
});

// Generate keep pattern options based on current dice
const keepOptionsToShow = $derived(() => {
	const existing = currentOptions();
	if (activeTab !== 'keep' || currentDice.length === 0) return existing;

	// Common keep patterns (top 5 by popularity)
	const commonPatterns = [
		{ pattern: 31, label: 'Keep all' },
		{ pattern: 0, label: 'Keep none' },
	];

	// Add patterns based on dice values (keep matching values)
	const valuePatterns = generateKeepPatterns(currentDice);

	const existingIds = new Set(existing.map((o) => o.optionId));
	const additional: KibitzOption[] = [...commonPatterns, ...valuePatterns]
		.filter((p) => !existingIds.has(p.pattern.toString()))
		.map((p) => ({
			optionId: p.pattern.toString(),
			label: p.label,
			voteCount: 0,
			percentage: 0,
			voterPreview: [],
		}));

	return [...existing, ...additional].slice(0, 6); // Limit to 6 options
});

// Action options (roll or score)
const actionOptionsToShow = $derived(() => {
	const existing = currentOptions();
	if (activeTab !== 'action') return existing;

	const options: KibitzOption[] = [
		{
			optionId: 'roll',
			label: canRoll ? 'Roll again!' : 'Roll (no rolls left)',
			voteCount: existing.find((o) => o.optionId === 'roll')?.voteCount ?? 0,
			percentage: existing.find((o) => o.optionId === 'roll')?.percentage ?? 0,
			voterPreview: existing.find((o) => o.optionId === 'roll')?.voterPreview ?? [],
		},
		{
			optionId: 'score',
			label: 'Score now!',
			voteCount: existing.find((o) => o.optionId === 'score')?.voteCount ?? 0,
			percentage: existing.find((o) => o.optionId === 'score')?.percentage ?? 0,
			voterPreview: existing.find((o) => o.optionId === 'score')?.voterPreview ?? [],
		},
	];

	return options;
});

// Get the right options based on active tab
const displayOptions = $derived(() => {
	switch (activeTab) {
		case 'category':
			return categoryOptionsToShow();
		case 'keep':
			return keepOptionsToShow();
		case 'action':
			return actionOptionsToShow();
	}
});

// Is this option my current vote?
function isMyVote(optionId: string): boolean {
	if (!myVote) return false;
	if (myVote.voteType !== activeTab) return false;
	switch (activeTab) {
		case 'category':
			return myVote.category === optionId;
		case 'keep':
			return myVote.keepPattern?.toString() === optionId;
		case 'action':
			return myVote.action === optionId;
	}
}

// Handle vote
function handleVote(optionId: string) {
	if (!canVote || !currentTurn) return;

	switch (activeTab) {
		case 'category':
			spectatorService.kibitzCategory(currentTurn.playerId, optionId);
			break;
		case 'keep':
			spectatorService.kibitzKeep(currentTurn.playerId, parseInt(optionId, 10));
			break;
		case 'action':
			spectatorService.kibitzAction(currentTurn.playerId, optionId as 'roll' | 'score');
			break;
	}
}

// Format category label
function formatCategoryLabel(category: string): string {
	return category
		.split('_')
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
		.join(' ');
}

// Generate keep patterns based on dice values
function generateKeepPatterns(dice: number[]): { pattern: number; label: string }[] {
	const patterns: { pattern: number; label: string }[] = [];
	const valueCounts = new Map<number, number[]>();

	// Group dice indices by value
	dice.forEach((value, index) => {
		const existing = valueCounts.get(value) ?? [];
		existing.push(index);
		valueCounts.set(value, existing);
	});

	// Create patterns for each value group
	for (const [value, indices] of valueCounts) {
		if (indices.length >= 2) {
			const pattern = indices.reduce((acc, idx) => acc | (1 << idx), 0);
			patterns.push({
				pattern,
				label: `Keep ${indices.length} ${getDieFace(value)}s`,
			});
		}
	}

	return patterns;
}

// Get die face emoji
function getDieFace(value: number): string {
	const faces = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
	return faces[value] ?? value.toString();
}
</script>

<div class="kibitz-corner" role="region" aria-label="Kibitz voting panel">
	<header class="kibitz-header">
		<h3 class="kibitz-title">
			<span class="kibitz-icon">💬</span>
			Kibitz Corner
		</h3>
		{#if kibitzState}
			<span class="vote-total">{kibitzState.totalVotes} vote{kibitzState.totalVotes !== 1 ? 's' : ''}</span>
		{/if}
	</header>

	{#if !currentTurn}
		<div class="kibitz-empty">
			<p>Waiting for a turn to start...</p>
		</div>
	{:else}
		<!-- Tab navigation -->
		<div class="kibitz-tabs" role="tablist" aria-label="Vote type">
			{#each tabs as tab}
				<button
					type="button"
					role="tab"
					class="kibitz-tab"
					class:active={activeTab === tab.type}
					aria-selected={activeTab === tab.type}
					onclick={() => (activeTab = tab.type)}
				>
					<span class="tab-icon">{tab.icon}</span>
					<span class="tab-label">{tab.label}</span>
				</button>
			{/each}
		</div>

		<!-- Vote options -->
		<div class="kibitz-options" role="tabpanel" aria-label={`${activeTab} voting options`}>
			{#if displayOptions().length === 0}
				<p class="no-options">No options available</p>
			{:else}
				{#each displayOptions() as option, index (option.optionId)}
					<KibitzVote
						{option}
						isSelected={isMyVote(option.optionId)}
						isLeading={index === 0 && option.voteCount > 0}
						onVote={handleVote}
						disabled={!canVote}
					/>
				{/each}
			{/if}
		</div>

		<!-- Current vote indicator -->
		{#if myVote}
			<div class="my-vote-indicator">
				<span class="my-vote-label">Your vote:</span>
				<span class="my-vote-value">
					{#if myVote.voteType === 'category'}
						{formatCategoryLabel(myVote.category ?? '')}
					{:else if myVote.voteType === 'keep'}
						{myVote.keepPattern === 31 ? 'Keep all' : myVote.keepPattern === 0 ? 'Keep none' : `Pattern ${myVote.keepPattern}`}
					{:else}
						{myVote.action === 'roll' ? 'Roll again!' : 'Score now!'}
					{/if}
				</span>
				<button type="button" class="clear-vote-btn" onclick={() => spectatorService.clearKibitz()}>
					Clear
				</button>
			</div>
		{/if}
	{/if}
</div>

<style>
	.kibitz-corner {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		padding: 0.875rem;
		background: var(--color-surface-1, #0f0f1a);
		border: 1px solid var(--color-border, #333);
		border-radius: 0.75rem;
	}

	.kibitz-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.kibitz-title {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin: 0;
		font-size: 0.9375rem;
		font-weight: 600;
		color: var(--color-text, #f0f0f0);
	}

	.kibitz-icon {
		font-size: 1.125rem;
	}

	.vote-total {
		font-size: 0.75rem;
		color: var(--color-text-secondary, #a0a0a0);
		padding: 0.25rem 0.5rem;
		background: var(--color-surface-2, #1a1a2e);
		border-radius: 0.25rem;
	}

	.kibitz-empty {
		padding: 1.5rem;
		text-align: center;
		color: var(--color-text-secondary, #a0a0a0);
		font-size: 0.875rem;
	}

	.kibitz-tabs {
		display: flex;
		gap: 0.25rem;
		padding: 0.25rem;
		background: var(--color-surface-2, #1a1a2e);
		border-radius: 0.5rem;
	}

	.kibitz-tab {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.375rem;
		padding: 0.5rem;
		background: transparent;
		border: none;
		border-radius: 0.375rem;
		cursor: pointer;
		transition: all 0.15s ease;
		color: var(--color-text-secondary, #a0a0a0);
	}

	.kibitz-tab:hover {
		background: var(--color-surface-3, #242444);
		color: var(--color-text, #f0f0f0);
	}

	.kibitz-tab.active {
		background: var(--color-primary, #6366f1);
		color: white;
	}

	.tab-icon {
		font-size: 1rem;
	}

	.tab-label {
		font-size: 0.8125rem;
		font-weight: 500;
	}

	.kibitz-options {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		max-height: 280px;
		overflow-y: auto;
	}

	.no-options {
		text-align: center;
		color: var(--color-text-tertiary, #666);
		font-size: 0.875rem;
		padding: 1rem;
	}

	.my-vote-indicator {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 0.75rem;
		background: var(--color-primary-alpha, rgba(99, 102, 241, 0.1));
		border: 1px solid var(--color-primary, #6366f1);
		border-radius: 0.5rem;
		font-size: 0.8125rem;
	}

	.my-vote-label {
		color: var(--color-text-secondary, #a0a0a0);
	}

	.my-vote-value {
		flex: 1;
		color: var(--color-primary, #6366f1);
		font-weight: 500;
	}

	.clear-vote-btn {
		padding: 0.25rem 0.5rem;
		background: transparent;
		border: 1px solid var(--color-border, #333);
		border-radius: 0.25rem;
		color: var(--color-text-secondary, #a0a0a0);
		font-size: 0.75rem;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.clear-vote-btn:hover {
		background: var(--color-surface-3, #242444);
		color: var(--color-text, #f0f0f0);
	}
</style>
