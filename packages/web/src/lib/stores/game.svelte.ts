/**
 * Game State Management
 * Orchestrates dice, scorecard, and turn flow
 */

import type {
	Category,
	CategoryProbability,
	DecisionFeedback,
	DecisionQuality,
	DiceArray,
	GameStatus,
	ProbabilityAnalysis,
	StatsProfile,
	TurnPhase,
} from '../types.js';
import { DiceState } from './dice.svelte.js';
import { ScorecardState } from './scorecard.svelte.js';

// =============================================================================
// Constants
// =============================================================================

const MAX_ROLLS_PER_TURN = 3;
const MAX_TURNS = 13;

// =============================================================================
// Decision Quality Calculation
// =============================================================================

function calculateDecisionQuality(
	evDifference: number,
	optimalEV: number,
): DecisionQuality {
	if (evDifference === 0) return 'optimal';
	const percentLoss = optimalEV > 0 ? evDifference / optimalEV : 0;
	if (percentLoss <= 0.05) return 'excellent';
	if (percentLoss <= 0.1) return 'good';
	if (percentLoss <= 0.2) return 'acceptable';
	if (percentLoss <= 0.5) return 'suboptimal';
	return 'poor';
}

// =============================================================================
// Game State Class
// =============================================================================

export class GameState {
	// Sub-states
	readonly dice = new DiceState();
	readonly scorecard = new ScorecardState();

	// Game flow state
	#status = $state<GameStatus>('idle');
	#turnNumber = $state(0); // 0 = not started, 1-13 = active turns
	#rollNumber = $state(0); // 0 = pre-roll, 1-3 = roll count
	#phase = $state<TurnPhase>('pre_roll');

	// Timestamps
	#gameStartedAt = $state<number | null>(null);
	#gameCompletedAt = $state<number | null>(null);
	#turnStartedAt = $state<number | null>(null);

	// Probability analysis (from WASM)
	#currentAnalysis = $state<ProbabilityAnalysis | null>(null);

	// User preferences
	#statsProfile = $state<StatsProfile>('intermediate');
	#statsEnabled = $state(true);

	// Last decision feedback
	#lastDecision = $state<DecisionFeedback | null>(null);

	// Derived values
	readonly isGameActive = $derived(
		this.#status === 'rolling' ||
			this.#status === 'keeping' ||
			this.#status === 'scoring',
	);
	readonly isGameOver = $derived(this.#status === 'completed');
	readonly canRoll = $derived(
		this.isGameActive &&
			this.#rollNumber < MAX_ROLLS_PER_TURN &&
			this.#phase !== 'scored',
	);
	readonly canScore = $derived(
		this.isGameActive && this.#rollNumber > 0 && this.#phase !== 'scored',
	);
	readonly rollsRemaining = $derived(MAX_ROLLS_PER_TURN - this.#rollNumber);
	readonly turnsRemaining = $derived(MAX_TURNS - this.#turnNumber);
	readonly isFirstRoll = $derived(this.#rollNumber === 0);
	readonly isFinalRoll = $derived(this.#rollNumber === MAX_ROLLS_PER_TURN);

	// Getters
	get status(): GameStatus {
		return this.#status;
	}

	get turnNumber(): number {
		return this.#turnNumber;
	}

	get rollNumber(): number {
		return this.#rollNumber;
	}

	get phase(): TurnPhase {
		return this.#phase;
	}

	get currentAnalysis(): ProbabilityAnalysis | null {
		return this.#currentAnalysis;
	}

	get statsProfile(): StatsProfile {
		return this.#statsProfile;
	}

	get statsEnabled(): boolean {
		return this.#statsEnabled;
	}

	get lastDecision(): DecisionFeedback | null {
		return this.#lastDecision;
	}

	get gameStartedAt(): number | null {
		return this.#gameStartedAt;
	}

	get gameCompletedAt(): number | null {
		return this.#gameCompletedAt;
	}

	// ==========================================================================
	// Game Flow Actions
	// ==========================================================================

	startGame(): void {
		if (this.#status !== 'idle' && this.#status !== 'completed') {
			console.warn('Cannot start game: already in progress');
			return;
		}

		// Reset all state
		this.dice.reset();
		this.scorecard.reset();

		this.#status = 'rolling';
		this.#turnNumber = 1;
		this.#rollNumber = 0;
		this.#phase = 'pre_roll';
		this.#gameStartedAt = Date.now();
		this.#gameCompletedAt = null;
		this.#turnStartedAt = Date.now();
		this.#currentAnalysis = null;
		this.#lastDecision = null;
	}

	roll(): DiceArray | null {
		if (!this.canRoll) {
			console.warn('Cannot roll: no rolls remaining or game not active');
			return null;
		}

		// First roll of turn: release all dice
		if (this.#rollNumber === 0) {
			this.dice.releaseAll();
		}

		const result = this.dice.roll();
		this.#rollNumber++;
		this.#phase = 'deciding';
		this.#status = 'keeping';

		// Clear previous analysis
		this.#currentAnalysis = null;

		return result;
	}

	async rollAnimated(durationMs: number = 500): Promise<DiceArray | null> {
		if (!this.canRoll) {
			return null;
		}

		if (this.#rollNumber === 0) {
			this.dice.releaseAll();
		}

		this.#status = 'rolling';
		const result = await this.dice.rollAnimated(durationMs);
		this.#rollNumber++;
		this.#phase = 'deciding';
		this.#status = 'keeping';
		this.#currentAnalysis = null;

		return result;
	}

	score(category: Category): DecisionFeedback | null {
		if (!this.canScore) {
			console.warn('Cannot score: no roll yet or already scored this turn');
			return null;
		}

		if (!this.scorecard.isAvailable(category)) {
			console.warn(`Category ${category} already scored`);
			return null;
		}

		// Get the score from WASM engine (will be wired in next step)
		// For now, calculate potential score
		const potentialScore = this.#getPotentialScore(category);

		// Calculate decision quality
		const feedback = this.#evaluateDecision(category, potentialScore);

		// Apply score
		this.scorecard.setScore(category, potentialScore);
		this.#lastDecision = feedback;
		this.#phase = 'scored';

		// Check for game completion
		if (this.scorecard.isComplete) {
			this.#completeGame();
		} else {
			// Advance to next turn
			this.#advanceTurn();
		}

		return feedback;
	}

	// ==========================================================================
	// Probability Analysis
	// ==========================================================================

	setAnalysis(analysis: ProbabilityAnalysis): void {
		this.#currentAnalysis = analysis;
	}

	getCategoryAnalysis(category: Category): CategoryProbability | null {
		if (!this.#currentAnalysis) return null;
		return (
			this.#currentAnalysis.categories.find((c) => c.category === category) ??
			null
		);
	}

	// ==========================================================================
	// User Preferences
	// ==========================================================================

	setStatsProfile(profile: StatsProfile): void {
		this.#statsProfile = profile;
	}

	setStatsEnabled(enabled: boolean): void {
		this.#statsEnabled = enabled;
	}

	toggleStats(): void {
		this.#statsEnabled = !this.#statsEnabled;
	}

	// ==========================================================================
	// Private Helpers
	// ==========================================================================

	#advanceTurn(): void {
		this.#turnNumber++;
		this.#rollNumber = 0;
		this.#phase = 'pre_roll';
		this.#turnStartedAt = Date.now();
		this.#status = 'rolling';
		this.dice.releaseAll();
		this.#currentAnalysis = null;
	}

	#completeGame(): void {
		this.#status = 'completed';
		this.#phase = 'scored';
		this.#gameCompletedAt = Date.now();
	}

	#getPotentialScore(category: Category): number {
		// This will be replaced with WASM scoring
		// For now, use simple calculation
		const values = this.dice.values;
		const counts = [0, 0, 0, 0, 0, 0];
		for (const v of values) {
			counts[v - 1]++;
		}
		const sum = values.reduce((a, b) => a + b, 0);

		switch (category) {
			case 'Ones':
				return counts[0] * 1;
			case 'Twos':
				return counts[1] * 2;
			case 'Threes':
				return counts[2] * 3;
			case 'Fours':
				return counts[3] * 4;
			case 'Fives':
				return counts[4] * 5;
			case 'Sixes':
				return counts[5] * 6;
			case 'ThreeOfAKind':
				return counts.some((c) => c >= 3) ? sum : 0;
			case 'FourOfAKind':
				return counts.some((c) => c >= 4) ? sum : 0;
			case 'FullHouse':
				return counts.includes(3) && counts.includes(2) ? 25 : 0;
			case 'SmallStraight': {
				const has1234 =
					counts[0] >= 1 && counts[1] >= 1 && counts[2] >= 1 && counts[3] >= 1;
				const has2345 =
					counts[1] >= 1 && counts[2] >= 1 && counts[3] >= 1 && counts[4] >= 1;
				const has3456 =
					counts[2] >= 1 && counts[3] >= 1 && counts[4] >= 1 && counts[5] >= 1;
				return has1234 || has2345 || has3456 ? 30 : 0;
			}
			case 'LargeStraight': {
				const has12345 =
					counts[0] === 1 &&
					counts[1] === 1 &&
					counts[2] === 1 &&
					counts[3] === 1 &&
					counts[4] === 1;
				const has23456 =
					counts[1] === 1 &&
					counts[2] === 1 &&
					counts[3] === 1 &&
					counts[4] === 1 &&
					counts[5] === 1;
				return has12345 || has23456 ? 40 : 0;
			}
			case 'Yahtzee':
				return counts.includes(5) ? 50 : 0;
			case 'Chance':
				return sum;
			default:
				return 0;
		}
	}

	#evaluateDecision(
		chosenCategory: Category,
		points: number,
	): DecisionFeedback {
		// Find optimal choice
		let optimalCategory: Category = chosenCategory;
		let optimalPoints = points;

		for (const cat of this.scorecard.categoriesRemaining) {
			const catPoints = this.#getPotentialScore(cat);
			if (catPoints > optimalPoints) {
				optimalPoints = catPoints;
				optimalCategory = cat;
			}
		}

		const evDifference = optimalPoints - points;
		const quality = calculateDecisionQuality(evDifference, optimalPoints);

		return {
			quality,
			chosenCategory,
			optimalCategory,
			pointsEarned: points,
			optimalPoints,
			evDifference,
		};
	}

	// ==========================================================================
	// Reset
	// ==========================================================================

	reset(): void {
		this.dice.reset();
		this.scorecard.reset();
		this.#status = 'idle';
		this.#turnNumber = 0;
		this.#rollNumber = 0;
		this.#phase = 'pre_roll';
		this.#gameStartedAt = null;
		this.#gameCompletedAt = null;
		this.#turnStartedAt = null;
		this.#currentAnalysis = null;
		this.#lastDecision = null;
	}
}

// =============================================================================
// Singleton Instance
// =============================================================================

export const game = new GameState();
