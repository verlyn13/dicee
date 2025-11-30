<script lang="ts">
	import { onMount } from 'svelte';
	import {
		initEngine,
		rollDice,
		rerollDice,
		scoreAllCategories,
		calculateProbabilities,
		CATEGORIES,
		type ScoringResult,
		type ProbabilityResult
	} from '$lib/engine';

	let dice = $state<number[]>([1, 1, 1, 1, 1]);
	let kept = $state<boolean[]>([false, false, false, false, false]);
	let rollsRemaining = $state(3);
	let scores = $state<ScoringResult[]>([]);
	let probabilities = $state<ProbabilityResult | null>(null);
	let ready = $state(false);
	let showStats = $state(true);

	onMount(async () => {
		await initEngine();
		ready = true;
		roll();
	});

	function roll() {
		if (rollsRemaining <= 0) return;

		if (rollsRemaining === 3) {
			dice = rollDice();
			kept = [false, false, false, false, false];
		} else {
			dice = rerollDice(dice, kept);
		}

		rollsRemaining--;
		updateAnalysis();
	}

	function toggleKeep(index: number) {
		if (rollsRemaining === 3 || rollsRemaining === 0) return;
		kept[index] = !kept[index];
		updateAnalysis();
	}

	function updateAnalysis() {
		scores = scoreAllCategories(dice);
		probabilities = calculateProbabilities(dice, kept, rollsRemaining);
	}

	function newTurn() {
		rollsRemaining = 3;
		kept = [false, false, false, false, false];
		roll();
	}

	function formatPercent(n: number): string {
		return (n * 100).toFixed(1) + '%';
	}

	function formatEV(n: number): string {
		return n.toFixed(1);
	}

	function getCategoryName(cat: string): string {
		const names: Record<string, string> = {
			Ones: 'Ones',
			Twos: 'Twos',
			Threes: 'Threes',
			Fours: 'Fours',
			Fives: 'Fives',
			Sixes: 'Sixes',
			ThreeOfAKind: '3 of a Kind',
			FourOfAKind: '4 of a Kind',
			FullHouse: 'Full House',
			SmallStraight: 'Sm Straight',
			LargeStraight: 'Lg Straight',
			Yahtzee: 'Yahtzee',
			Chance: 'Chance'
		};
		return names[cat] || cat;
	}

	function getHeatColor(ev: number, maxEv: number): string {
		if (maxEv === 0) return 'var(--heat-0)';
		const intensity = ev / maxEv;
		if (intensity > 0.9) return 'var(--heat-best)';
		if (intensity > 0.7) return 'var(--heat-good)';
		if (intensity > 0.4) return 'var(--heat-mid)';
		return 'var(--heat-low)';
	}
</script>

<svelte:head>
	<title>Dicee - Probability Engine</title>
</svelte:head>

{#if !ready}
	<div class="loading">Loading engine...</div>
{:else}
	<main>
		<header>
			<h1>DICEE</h1>
			<p class="tagline">Educational Probability Platform</p>
		</header>

		<section class="dice-tray">
			<div class="dice-container">
				{#each dice as die, i}
					<button
						class="die"
						class:kept={kept[i]}
						onclick={() => toggleKeep(i)}
						disabled={rollsRemaining === 3 || rollsRemaining === 0}
					>
						<span class="pip">{die}</span>
						{#if kept[i]}
							<span class="keep-badge">KEEP</span>
						{/if}
					</button>
				{/each}
			</div>

			<div class="controls">
				<button class="roll-btn" onclick={roll} disabled={rollsRemaining === 0}>
					{rollsRemaining === 3 ? 'ROLL' : `REROLL (${rollsRemaining})`}
				</button>
				{#if rollsRemaining === 0}
					<button class="new-turn-btn" onclick={newTurn}>NEW TURN</button>
				{/if}
			</div>

			<label class="stats-toggle">
				<input type="checkbox" bind:checked={showStats} />
				Show Statistics
			</label>
		</section>

		<section class="scorecard">
			<h2>SCORECARD</h2>
			<div class="categories">
				{#each scores as score, i}
					{@const prob = probabilities?.categories[i]}
					{@const isBest = probabilities?.best_category === score.category}
					<div
						class="category"
						class:best={isBest}
						style="--heat: {getHeatColor(prob?.expected_value ?? 0, probabilities?.best_ev ?? 1)}"
					>
						<span class="cat-name">{getCategoryName(score.category)}</span>
						<span class="cat-score">{score.score}</span>
						{#if showStats && prob}
							<span class="cat-ev">EV: {formatEV(prob.expected_value)}</span>
							<span class="cat-prob">{formatPercent(prob.probability)}</span>
						{/if}
						{#if isBest}
							<span class="best-badge">BEST</span>
						{/if}
						<div class="heat-bar" style="width: {((prob?.expected_value ?? 0) / (probabilities?.best_ev || 1)) * 100}%"></div>
					</div>
				{/each}
			</div>
		</section>
	</main>
{/if}

<style>
	:root {
		--bg: #f5f5f0;
		--fg: #1a1a1a;
		--border: #000;
		--accent: #ffd700;
		--heat-best: #ffd700;
		--heat-good: #ffeb80;
		--heat-mid: #fff4bf;
		--heat-low: #fffae6;
		--heat-0: transparent;
	}

	:global(body) {
		margin: 0;
		padding: 0;
		font-family: 'IBM Plex Mono', 'Courier New', monospace;
		background: var(--bg);
		color: var(--fg);
	}

	.loading {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 100vh;
		font-size: 1.5rem;
	}

	main {
		max-width: 800px;
		margin: 0 auto;
		padding: 2rem 1rem;
	}

	header {
		text-align: center;
		margin-bottom: 2rem;
		border: 3px solid var(--border);
		padding: 1rem;
	}

	h1 {
		margin: 0;
		font-size: 3rem;
		font-weight: 900;
		letter-spacing: 0.2em;
	}

	.tagline {
		margin: 0.5rem 0 0;
		font-size: 0.875rem;
		text-transform: uppercase;
		letter-spacing: 0.1em;
	}

	.dice-tray {
		border: 3px solid var(--border);
		padding: 1.5rem;
		margin-bottom: 2rem;
	}

	.dice-container {
		display: flex;
		justify-content: center;
		gap: 1rem;
		margin-bottom: 1.5rem;
	}

	.die {
		width: 60px;
		height: 60px;
		border: 3px solid var(--border);
		background: white;
		font-size: 2rem;
		font-weight: bold;
		cursor: pointer;
		position: relative;
		transition: transform 0.1s;
	}

	.die:hover:not(:disabled) {
		transform: translateY(-4px);
	}

	.die:disabled {
		cursor: default;
		opacity: 0.7;
	}

	.die.kept {
		background: var(--accent);
		transform: translateY(-8px);
		box-shadow: 0 8px 0 var(--border);
	}

	.pip {
		font-family: inherit;
	}

	.keep-badge {
		position: absolute;
		bottom: -20px;
		left: 50%;
		transform: translateX(-50%);
		font-size: 0.625rem;
		font-weight: bold;
		background: var(--fg);
		color: var(--bg);
		padding: 2px 4px;
	}

	.controls {
		display: flex;
		justify-content: center;
		gap: 1rem;
		margin-bottom: 1rem;
	}

	.roll-btn,
	.new-turn-btn {
		padding: 0.75rem 2rem;
		font-size: 1rem;
		font-weight: bold;
		text-transform: uppercase;
		border: 3px solid var(--border);
		cursor: pointer;
		font-family: inherit;
	}

	.roll-btn {
		background: var(--accent);
	}

	.roll-btn:disabled {
		background: #ccc;
		cursor: not-allowed;
	}

	.new-turn-btn {
		background: white;
	}

	.stats-toggle {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		font-size: 0.875rem;
		cursor: pointer;
	}

	.scorecard {
		border: 3px solid var(--border);
		padding: 1.5rem;
	}

	h2 {
		margin: 0 0 1rem;
		font-size: 1.25rem;
		font-weight: 900;
		letter-spacing: 0.1em;
	}

	.categories {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.category {
		display: grid;
		grid-template-columns: 1fr auto auto auto auto;
		gap: 1rem;
		align-items: center;
		padding: 0.5rem;
		border: 2px solid var(--border);
		position: relative;
		overflow: hidden;
		background: white;
	}

	.category.best {
		border-color: var(--accent);
		border-width: 3px;
	}

	.heat-bar {
		position: absolute;
		left: 0;
		top: 0;
		height: 100%;
		background: var(--heat);
		z-index: 0;
		transition: width 0.3s ease;
	}

	.cat-name,
	.cat-score,
	.cat-ev,
	.cat-prob,
	.best-badge {
		position: relative;
		z-index: 1;
	}

	.cat-name {
		font-weight: bold;
	}

	.cat-score {
		font-weight: bold;
		min-width: 3ch;
		text-align: right;
	}

	.cat-ev,
	.cat-prob {
		font-size: 0.75rem;
		color: #666;
		min-width: 6ch;
		text-align: right;
	}

	.best-badge {
		background: var(--accent);
		padding: 2px 6px;
		font-size: 0.625rem;
		font-weight: bold;
	}

	@media (max-width: 600px) {
		.dice-container {
			gap: 0.5rem;
		}

		.die {
			width: 50px;
			height: 50px;
			font-size: 1.5rem;
		}

		.category {
			grid-template-columns: 1fr auto auto;
		}

		.cat-ev,
		.cat-prob {
			display: none;
		}
	}
</style>
