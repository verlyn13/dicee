/**
 * Game State Management
 * Orchestrates dice, scorecard, and turn flow
 * Integrates with WASM probability engine for scoring and analysis
 */

import { createServiceLogger } from '$lib/utils/logger';
import { analyzeTurnOptimal } from '../services/engine.js';
import type {
	Category,
	CategoryAnalysis,
	DecisionFeedback,
	DecisionQuality,
	DiceArray,
	GameStatus,
	KeptMask,
	StatsProfile,
	TurnAnalysis,
	TurnPhase,
} from '../types.js';
import { DiceState } from './dice.svelte.js';

const log = createServiceLogger('GameStore');

import { ScorecardState } from './scorecard.svelte.js';

// =============================================================================
// Decision History Types
// =============================================================================

export interface RollRecord {
	/** Roll number (1-3) */
	rollNumber: number;
	/** Dice values after roll */
	dice: DiceArray;
	/** Which dice were kept for the next roll */
	kept: KeptMask;
	/** Was this the optimal hold? */
	wasOptimalHold: boolean;
	/** Optimal keep pattern (if different) */
	optimalKeepPattern?: [number, number, number, number, number, number];
	/** EV of the chosen hold */
	chosenEV: number;
	/** EV of the optimal hold */
	optimalEV: number;
}

export interface TurnDecision {
	/** Category scored */
	category: Category;
	/** Points earned */
	score: number;
	/** Optimal category */
	optimalCategory: Category;
	/** Optimal score */
	optimalScore: number;
	/** EV difference (loss) */
	evDifference: number;
	/** Was this the optimal choice? */
	wasOptimal: boolean;
}

export interface TurnRecord {
	/** Turn number (1-13) */
	turnNumber: number;
	/** Roll history for this turn */
	rolls: RollRecord[];
	/** Final scoring decision */
	decision: TurnDecision;
	/** Turn duration in ms */
	durationMs: number;
}

export interface GameSummary {
	/** Total turns played */
	totalTurns: number;
	/** Final score */
	finalScore: number;
	/** Optimal decisions count */
	optimalDecisions: number;
	/** Total decisions */
	totalDecisions: number;
	/** Decision efficiency (0-1) */
	efficiency: number;
	/** Total EV lost from suboptimal plays */
	totalEVLoss: number;
	/** Average EV loss per turn */
	avgEVLoss: number;
	/** Optimal holds count */
	optimalHolds: number;
	/** Total holds */
	totalHolds: number;
	/** Hold efficiency (0-1) */
	holdEfficiency: number;
	/** Game duration in ms */
	gameDurationMs: number;
}

// =============================================================================
// Constants
// =============================================================================

const MAX_ROLLS_PER_TURN = 3;
const MAX_TURNS = 13;

// =============================================================================
// Decision Quality Calculation
// =============================================================================

function calculateDecisionQuality(evDifference: number, optimalEV: number): DecisionQuality {
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

	// Turn analysis (from M1-M4 solver)
	#currentAnalysis = $state<TurnAnalysis | null>(null);

	// Cached WASM scores for current dice
	#cachedScores = $state<Map<Category, number>>(new Map());
	#scoresLoading = $state(false);

	// User preferences
	#statsProfile = $state<StatsProfile>('intermediate');
	#statsEnabled = $state(true);

	// Last decision feedback
	#lastDecision = $state<DecisionFeedback | null>(null);

	// Decision history tracking
	#turnHistory = $state<TurnRecord[]>([]);
	#currentTurnRolls = $state<RollRecord[]>([]);

	// Derived values
	readonly isGameActive = $derived(
		this.#status === 'rolling' || this.#status === 'keeping' || this.#status === 'scoring',
	);
	readonly isGameOver = $derived(this.#status === 'completed');
	readonly canRoll = $derived(
		this.isGameActive && this.#rollNumber < MAX_ROLLS_PER_TURN && this.#phase !== 'scored',
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

	get currentAnalysis(): TurnAnalysis | null {
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

	get turnStartedAt(): number | null {
		return this.#turnStartedAt;
	}

	get scoresLoading(): boolean {
		return this.#scoresLoading;
	}

	get cachedScores(): Map<Category, number> {
		return this.#cachedScores;
	}

	get turnHistory(): TurnRecord[] {
		return this.#turnHistory;
	}

	get currentTurnRolls(): RollRecord[] {
		return this.#currentTurnRolls;
	}

	/**
	 * Get game summary statistics
	 */
	get gameSummary(): GameSummary | null {
		if (this.#turnHistory.length === 0) return null;

		let optimalDecisions = 0;
		let totalEVLoss = 0;
		let optimalHolds = 0;
		let totalHolds = 0;

		for (const turn of this.#turnHistory) {
			if (turn.decision.wasOptimal) optimalDecisions++;
			totalEVLoss += turn.decision.evDifference;

			for (const roll of turn.rolls) {
				totalHolds++;
				if (roll.wasOptimalHold) optimalHolds++;
			}
		}

		const totalTurns = this.#turnHistory.length;
		const gameDurationMs =
			this.#gameCompletedAt && this.#gameStartedAt
				? this.#gameCompletedAt - this.#gameStartedAt
				: 0;

		return {
			totalTurns,
			finalScore: this.scorecard.grandTotal,
			optimalDecisions,
			totalDecisions: totalTurns,
			efficiency: totalTurns > 0 ? optimalDecisions / totalTurns : 0,
			totalEVLoss,
			avgEVLoss: totalTurns > 0 ? totalEVLoss / totalTurns : 0,
			optimalHolds,
			totalHolds,
			holdEfficiency: totalHolds > 0 ? optimalHolds / totalHolds : 0,
			gameDurationMs,
		};
	}

	/**
	 * Get the potential score for a category from cache or fallback
	 */
	getPotentialScore(category: Category): number {
		// Use cached WASM score if available
		const cached = this.#cachedScores.get(category);
		if (cached !== undefined) {
			return cached;
		}
		// Fallback to local calculation
		return this.#getPotentialScoreFallback(category);
	}

	// ==========================================================================
	// Game Flow Actions
	// ==========================================================================

	startGame(): void {
		if (this.#status !== 'idle' && this.#status !== 'completed') {
			log.warn('Cannot start game: already in progress');
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
		this.#cachedScores = new Map();
		this.#scoresLoading = false;

		// Reset history
		this.#turnHistory = [];
		this.#currentTurnRolls = [];
	}

	roll(): DiceArray | null {
		if (!this.canRoll) {
			log.warn('Cannot roll: no rolls remaining or game not active');
			return null;
		}

		// Record previous roll's keep decision (if not first roll)
		if (this.#rollNumber > 0 && this.#currentAnalysis) {
			this.#recordRollHistory();
		}

		// First roll of turn: release all dice
		if (this.#rollNumber === 0) {
			this.dice.releaseAll();
			this.#currentTurnRolls = [];
		}

		const result = this.dice.roll();
		this.#rollNumber++;
		this.#phase = 'deciding';
		this.#status = 'keeping';

		// Clear previous analysis and scores
		this.#currentAnalysis = null;
		this.#cachedScores = new Map();

		// Trigger async score refresh
		this.refreshScores();

		return result;
	}

	/**
	 * Refresh analysis from M1-M4 solver.
	 * Called automatically after each roll.
	 * Updates both scores and analysis in one call.
	 */
	async refreshScores(): Promise<void> {
		if (this.#rollNumber === 0) return;

		this.#scoresLoading = true;
		try {
			const analysis = await analyzeTurnOptimal(
				this.dice.values,
				this.rollsRemaining,
				this.scorecard.categoriesRemaining,
			);

			// Update cached scores from analysis
			const newScores = new Map<Category, number>();
			for (const cat of analysis.categories) {
				newScores.set(cat.category, cat.immediateScore);
			}
			this.#cachedScores = newScores;

			// Also store the full analysis
			this.#currentAnalysis = analysis;
		} catch (err) {
			log.warn('WASM analysis failed, using fallback', { error: err });
			// Scores will use fallback calculation
		} finally {
			this.#scoresLoading = false;
		}
	}

	/**
	 * Refresh analysis from M1-M4 solver.
	 * Alias for refreshScores() since new API provides both in one call.
	 */
	async refreshAnalysis(): Promise<void> {
		return this.refreshScores();
	}

	async rollAnimated(durationMs: number = 500): Promise<DiceArray | null> {
		if (!this.canRoll) {
			return null;
		}

		// Record previous roll's keep decision (if not first roll)
		if (this.#rollNumber > 0 && this.#currentAnalysis) {
			this.#recordRollHistory();
		}

		if (this.#rollNumber === 0) {
			this.dice.releaseAll();
			this.#currentTurnRolls = [];
		}

		this.#status = 'rolling';
		const result = await this.dice.rollAnimated(durationMs);
		this.#rollNumber++;
		this.#phase = 'deciding';
		this.#status = 'keeping';

		// Clear previous analysis and scores
		this.#currentAnalysis = null;
		this.#cachedScores = new Map();

		// Trigger async score refresh
		this.refreshScores();

		return result;
	}

	score(category: Category): DecisionFeedback | null {
		if (!this.canScore) {
			log.warn('Cannot score: no roll yet or already scored this turn');
			return null;
		}

		if (!this.scorecard.isAvailable(category)) {
			log.warn('Category already scored', { category });
			return null;
		}

		// Record final roll history before scoring
		if (this.#currentAnalysis) {
			this.#recordRollHistory();
		}

		// Get score from WASM cache or fallback
		const potentialScore = this.getPotentialScore(category);

		// Calculate decision quality
		const feedback = this.#evaluateDecision(category, potentialScore);

		// Record turn in history
		this.#recordTurnHistory(category, potentialScore, feedback);

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
	// Turn Analysis
	// ==========================================================================

	setAnalysis(analysis: TurnAnalysis): void {
		this.#currentAnalysis = analysis;
	}

	getCategoryAnalysis(category: Category): CategoryAnalysis | null {
		if (!this.#currentAnalysis) return null;
		return this.#currentAnalysis.categories.find((c) => c.category === category) ?? null;
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

	/**
	 * Record the current roll's keep decision to history
	 */
	#recordRollHistory(): void {
		const keepRec = this.#currentAnalysis?.keepRecommendation;
		const keptMask = this.dice.kept;

		// Determine if the current hold matches the optimal
		let wasOptimalHold = true;
		let optimalKeepPattern: [number, number, number, number, number, number] | undefined;

		if (keepRec) {
			// Convert current kept dice to pattern for comparison
			const currentPattern = this.#keptMaskToPattern(this.dice.values, keptMask);
			wasOptimalHold = this.#patternsMatch(currentPattern, keepRec.keepPattern);
			if (!wasOptimalHold) {
				optimalKeepPattern = keepRec.keepPattern;
			}
		}

		const rollRecord: RollRecord = {
			rollNumber: this.#rollNumber,
			dice: [...this.dice.values] as DiceArray,
			kept: [...keptMask] as KeptMask,
			wasOptimalHold,
			optimalKeepPattern,
			chosenEV: this.#currentAnalysis?.expectedValue ?? 0,
			optimalEV: keepRec?.expectedValue ?? this.#currentAnalysis?.expectedValue ?? 0,
		};

		this.#currentTurnRolls = [...this.#currentTurnRolls, rollRecord];
	}

	/**
	 * Record the completed turn to history
	 */
	#recordTurnHistory(category: Category, score: number, feedback: DecisionFeedback): void {
		const turnRecord: TurnRecord = {
			turnNumber: this.#turnNumber,
			rolls: [...this.#currentTurnRolls],
			decision: {
				category,
				score,
				optimalCategory: feedback.optimalCategory,
				optimalScore: feedback.optimalPoints,
				evDifference: feedback.evDifference,
				wasOptimal: feedback.quality === 'optimal',
			},
			durationMs: this.#turnStartedAt ? Date.now() - this.#turnStartedAt : 0,
		};

		this.#turnHistory = [...this.#turnHistory, turnRecord];
		this.#currentTurnRolls = [];
	}

	/**
	 * Convert kept mask and dice values to a keep pattern [count_1s, ..., count_6s]
	 */
	#keptMaskToPattern(
		dice: DiceArray,
		kept: KeptMask,
	): [number, number, number, number, number, number] {
		const pattern: [number, number, number, number, number, number] = [0, 0, 0, 0, 0, 0];
		for (let i = 0; i < 5; i++) {
			if (kept[i]) {
				pattern[dice[i] - 1]++;
			}
		}
		return pattern;
	}

	/**
	 * Check if two keep patterns match
	 */
	#patternsMatch(
		a: [number, number, number, number, number, number],
		b: [number, number, number, number, number, number],
	): boolean {
		for (let i = 0; i < 6; i++) {
			if (a[i] !== b[i]) return false;
		}
		return true;
	}

	/** Count occurrences of each die value (1-6) */
	#getDiceCounts(values: number[]): number[] {
		const counts = [0, 0, 0, 0, 0, 0];
		for (const v of values) {
			counts[v - 1]++;
		}
		return counts;
	}

	/** Check if dice form a small straight (4 consecutive) */
	#isSmallStraight(counts: number[]): boolean {
		const has1234 = counts[0] >= 1 && counts[1] >= 1 && counts[2] >= 1 && counts[3] >= 1;
		const has2345 = counts[1] >= 1 && counts[2] >= 1 && counts[3] >= 1 && counts[4] >= 1;
		const has3456 = counts[2] >= 1 && counts[3] >= 1 && counts[4] >= 1 && counts[5] >= 1;
		return has1234 || has2345 || has3456;
	}

	/** Check if dice form a large straight (5 consecutive) */
	#isLargeStraight(counts: number[]): boolean {
		const has12345 =
			counts[0] === 1 && counts[1] === 1 && counts[2] === 1 && counts[3] === 1 && counts[4] === 1;
		const has23456 =
			counts[1] === 1 && counts[2] === 1 && counts[3] === 1 && counts[4] === 1 && counts[5] === 1;
		return has12345 || has23456;
	}

	#getPotentialScoreFallback(category: Category): number {
		// Fallback scoring when WASM is not available
		// Used for initial render before WASM loads
		const values = this.dice.values;
		const counts = this.#getDiceCounts(values);
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
			case 'SmallStraight':
				return this.#isSmallStraight(counts) ? 30 : 0;
			case 'LargeStraight':
				return this.#isLargeStraight(counts) ? 40 : 0;
			case 'Dicee':
				return counts.includes(5) ? 50 : 0;
			case 'Chance':
				return sum;
			default:
				return 0;
		}
	}

	#evaluateDecision(chosenCategory: Category, points: number): DecisionFeedback {
		// Find optimal choice using cached WASM scores or fallback
		let optimalCategory: Category = chosenCategory;
		let optimalPoints = points;

		for (const cat of this.scorecard.categoriesRemaining) {
			const catPoints = this.getPotentialScore(cat);
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
		this.#cachedScores = new Map();
		this.#scoresLoading = false;
		this.#turnHistory = [];
		this.#currentTurnRolls = [];
	}
}

// =============================================================================
// Singleton Instance
// =============================================================================

export const game = new GameState();
