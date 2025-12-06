<script lang="ts">
/**
 * MultiplayerScorecard Component
 *
 * Simplified scorecard for multiplayer games.
 * Shows scores and available categories for scoring.
 */
import type { Category, DiceArray, Scorecard } from '$lib/types/multiplayer';

interface Props {
	/** Player's scorecard */
	scorecard: Scorecard | null;
	/** Current dice (for calculating potential scores) */
	currentDice: DiceArray | null;
	/** Whether the player can score (their turn, dice rolled) */
	canScore: boolean;
	/** Callback when a category is selected */
	onScore: (category: Category) => void;
}

let { scorecard, currentDice, canScore, onScore }: Props = $props();

// Category definitions
const UPPER_CATEGORIES: { key: Category; label: string; value: number }[] = [
	{ key: 'ones', label: 'Ones', value: 1 },
	{ key: 'twos', label: 'Twos', value: 2 },
	{ key: 'threes', label: 'Threes', value: 3 },
	{ key: 'fours', label: 'Fours', value: 4 },
	{ key: 'fives', label: 'Fives', value: 5 },
	{ key: 'sixes', label: 'Sixes', value: 6 },
];

const LOWER_CATEGORIES: { key: Category; label: string; description: string }[] = [
	{ key: 'threeOfAKind', label: '3 of a Kind', description: 'Sum all dice' },
	{ key: 'fourOfAKind', label: '4 of a Kind', description: 'Sum all dice' },
	{ key: 'fullHouse', label: 'Full House', description: '25 pts' },
	{ key: 'smallStraight', label: 'Sm Straight', description: '30 pts' },
	{ key: 'largeStraight', label: 'Lg Straight', description: '40 pts' },
	{ key: 'yahtzee', label: 'Yahtzee', description: '50 pts' },
	{ key: 'chance', label: 'Chance', description: 'Sum all dice' },
];

// Calculate potential score for a category
function calculatePotential(category: Category): number {
	if (!currentDice) return 0;

	const counts = [0, 0, 0, 0, 0, 0];
	let sum = 0;
	for (const die of currentDice) {
		counts[die - 1]++;
		sum += die;
	}

	const maxCount = Math.max(...counts);
	const sortedDice = [...currentDice].sort((a, b) => a - b);

	switch (category) {
		case 'ones':
			return counts[0] * 1;
		case 'twos':
			return counts[1] * 2;
		case 'threes':
			return counts[2] * 3;
		case 'fours':
			return counts[3] * 4;
		case 'fives':
			return counts[4] * 5;
		case 'sixes':
			return counts[5] * 6;
		case 'threeOfAKind':
			return maxCount >= 3 ? sum : 0;
		case 'fourOfAKind':
			return maxCount >= 4 ? sum : 0;
		case 'fullHouse': {
			const hasThree = counts.includes(3);
			const hasTwo = counts.includes(2);
			return hasThree && hasTwo ? 25 : 0;
		}
		case 'smallStraight': {
			const str = sortedDice.join('');
			return str.includes('1234') || str.includes('2345') || str.includes('3456') ? 30 : 0;
		}
		case 'largeStraight': {
			const str = sortedDice.join('');
			return str === '12345' || str === '23456' ? 40 : 0;
		}
		case 'yahtzee':
			return maxCount === 5 ? 50 : 0;
		case 'chance':
			return sum;
		default:
			return 0;
	}
}

// Check if a category is available
function isAvailable(category: Category): boolean {
	if (!scorecard) return false;
	return scorecard[category] === null;
}

// Get the score for a category
function getScore(category: Category): number | null {
	if (!scorecard) return null;
	return scorecard[category];
}

// Calculate upper section sum
const upperSum = $derived(() => {
	if (!scorecard) return 0;
	return (
		(scorecard.ones ?? 0) +
		(scorecard.twos ?? 0) +
		(scorecard.threes ?? 0) +
		(scorecard.fours ?? 0) +
		(scorecard.fives ?? 0) +
		(scorecard.sixes ?? 0)
	);
});

const upperBonus = $derived(scorecard?.upperBonus ?? 0);
const yahtzeeBonus = $derived(scorecard?.yahtzeeBonus ?? 0);

// Calculate total
const totalScore = $derived(() => {
	if (!scorecard) return 0;
	let total = 0;
	for (const cat of UPPER_CATEGORIES) {
		total += scorecard[cat.key] ?? 0;
	}
	for (const cat of LOWER_CATEGORIES) {
		total += scorecard[cat.key] ?? 0;
	}
	total += scorecard.upperBonus;
	total += scorecard.yahtzeeBonus;
	return total;
});
</script>

<div class="multiplayer-scorecard">
	<header class="scorecard-header">
		<h3 class="header-title">Scorecard</h3>
	</header>

	<!-- Upper Section -->
	<section class="section">
		<div class="section-label">Upper</div>
		<div class="categories">
			{#each UPPER_CATEGORIES as cat (cat.key)}
				{@const score = getScore(cat.key)}
				{@const available = isAvailable(cat.key)}
				{@const potential = available && currentDice ? calculatePotential(cat.key) : null}
				<button
					class="category-row"
					class:available
					class:scored={score !== null}
					class:can-score={canScore && available}
					disabled={!canScore || !available}
					onclick={() => available && canScore && onScore(cat.key)}
				>
					<span class="category-label">{cat.label}</span>
					<span class="category-score">
						{#if score !== null}
							{score}
						{:else if potential !== null}
							<span class="potential">{potential}</span>
						{:else}
							—
						{/if}
					</span>
				</button>
			{/each}
		</div>

		<!-- Upper Bonus -->
		<div class="bonus-row">
			<span class="bonus-label">Bonus (63+)</span>
			<span class="bonus-value" class:achieved={upperBonus > 0}>
				{upperBonus > 0 ? '+35' : `${upperSum()}/63`}
			</span>
		</div>
	</section>

	<!-- Lower Section -->
	<section class="section">
		<div class="section-label">Lower</div>
		<div class="categories">
			{#each LOWER_CATEGORIES as cat (cat.key)}
				{@const score = getScore(cat.key)}
				{@const available = isAvailable(cat.key)}
				{@const potential = available && currentDice ? calculatePotential(cat.key) : null}
				<button
					class="category-row"
					class:available
					class:scored={score !== null}
					class:can-score={canScore && available}
					disabled={!canScore || !available}
					onclick={() => available && canScore && onScore(cat.key)}
				>
					<span class="category-label">{cat.label}</span>
					<span class="category-score">
						{#if score !== null}
							{score}
						{:else if potential !== null}
							<span class="potential">{potential}</span>
						{:else}
							—
						{/if}
					</span>
				</button>
			{/each}
		</div>

		<!-- Yahtzee Bonus -->
		{#if yahtzeeBonus > 0}
			<div class="bonus-row yahtzee-bonus">
				<span class="bonus-label">Yahtzee Bonus</span>
				<span class="bonus-value achieved">+{yahtzeeBonus}</span>
			</div>
		{/if}
	</section>

	<!-- Total -->
	<div class="total-row">
		<span class="total-label">Total</span>
		<span class="total-value">{totalScore()}</span>
	</div>
</div>

<style>
	.multiplayer-scorecard {
		background: var(--color-surface);
		border: var(--border-thick);
		display: flex;
		flex-direction: column;
	}

	.scorecard-header {
		padding: var(--space-1) var(--space-2);
		border-bottom: var(--border-medium);
		background: var(--color-background);
	}

	.header-title {
		margin: 0;
		font-size: var(--text-small);
		font-weight: var(--weight-bold);
		text-transform: uppercase;
		letter-spacing: var(--tracking-wider);
	}

	.section {
		padding: var(--space-1);
		border-bottom: var(--border-medium);
	}

	.section:last-of-type {
		border-bottom: none;
	}

	.section-label {
		font-size: var(--text-tiny);
		font-weight: var(--weight-bold);
		text-transform: uppercase;
		letter-spacing: var(--tracking-wider);
		color: var(--color-text-muted);
		padding: var(--space-1);
	}

	.categories {
		display: flex;
		flex-direction: column;
	}

	.category-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: var(--space-1) var(--space-2);
		background: transparent;
		border: none;
		border-bottom: 1px solid var(--color-background);
		cursor: default;
		text-align: left;
		font-family: inherit;
		font-size: var(--text-small);
		transition: background var(--transition-fast);
	}

	.category-row:last-child {
		border-bottom: none;
	}

	.category-row.scored {
		color: var(--color-text-muted);
	}

	.category-row.available {
		cursor: pointer;
	}

	.category-row.can-score:hover {
		background: var(--color-accent-light);
	}

	.category-row.can-score:active {
		background: var(--color-accent);
	}

	.category-row:disabled {
		cursor: not-allowed;
	}

	.category-label {
		font-weight: var(--weight-medium);
	}

	.category-score {
		font-family: var(--font-mono);
		font-weight: var(--weight-bold);
		font-variant-numeric: tabular-nums;
		min-width: 32px;
		text-align: right;
	}

	.potential {
		color: var(--color-accent-dark);
	}

	.bonus-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: var(--space-1) var(--space-2);
		background: var(--color-background);
		margin-top: var(--space-1);
	}

	.bonus-label {
		font-size: var(--text-tiny);
		font-weight: var(--weight-semibold);
		text-transform: uppercase;
	}

	.bonus-value {
		font-family: var(--font-mono);
		font-size: var(--text-small);
		font-weight: var(--weight-bold);
	}

	.bonus-value.achieved {
		color: var(--color-success);
	}

	.yahtzee-bonus {
		background: var(--color-success);
		color: white;
	}

	.yahtzee-bonus .bonus-value {
		color: white;
	}

	.total-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: var(--space-2);
		background: var(--color-accent);
		border-top: var(--border-thick);
	}

	.total-label {
		font-size: var(--text-body);
		font-weight: var(--weight-black);
		text-transform: uppercase;
		letter-spacing: var(--tracking-wider);
	}

	.total-value {
		font-family: var(--font-mono);
		font-size: var(--text-h3);
		font-weight: var(--weight-black);
		font-variant-numeric: tabular-nums;
	}
</style>
