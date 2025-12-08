/**
 * Coach Mode Store
 *
 * Manages coach mode state for guided gameplay assistance.
 * Persists user preferences to localStorage.
 *
 * Coach Levels:
 * - off: No statistical display or suggestions
 * - hints: EV display only, player figures out optimal holds
 * - coach: Full suggestions with explanations
 * - training: Warns before suboptimal plays (pre-confirmation modal)
 */

import type { Category, KeepRecommendation } from '$lib/types.js';

// =============================================================================
// Types
// =============================================================================

export type CoachLevel = 'off' | 'hints' | 'coach' | 'training';

export interface CoachPreferences {
	/** Current coach level */
	level: CoachLevel;
	/** Show probability ribbon */
	showProbabilities: boolean;
	/** Highlight optimal category */
	highlightOptimal: boolean;
	/** Show EV delta on categories */
	showEVDelta: boolean;
	/** Animate suggested dice */
	animateSuggestions: boolean;
}

export interface CoachFeedback {
	/** Type of feedback */
	type: 'optimal' | 'suboptimal' | 'warning' | 'info';
	/** Feedback message */
	message: string;
	/** Category involved (if scoring) */
	category?: Category;
	/** Keep recommendation (if rerolling) */
	keepRecommendation?: KeepRecommendation;
	/** EV loss from suboptimal play */
	evLoss?: number;
}

export interface PendingDecision {
	/** Type of decision */
	type: 'score' | 'reroll';
	/** Category being scored */
	category?: Category;
	/** Is this the optimal choice? */
	isOptimal: boolean;
	/** EV of the chosen action */
	chosenEV: number;
	/** EV of the optimal action */
	optimalEV: number;
	/** Explanation of why optimal is better */
	explanation?: string;
}

// =============================================================================
// Constants
// =============================================================================

const STORAGE_KEY = 'dicee_coach_preferences';

const DEFAULT_PREFERENCES: CoachPreferences = {
	level: 'hints',
	showProbabilities: true,
	highlightOptimal: true,
	showEVDelta: true,
	animateSuggestions: true,
};

/** Coach level descriptions for UI */
export const COACH_LEVEL_INFO: Record<
	CoachLevel,
	{ label: string; description: string; icon: string }
> = {
	off: {
		label: 'Off',
		description: 'No assistance - play by intuition',
		icon: '🎲',
	},
	hints: {
		label: 'Hints',
		description: 'Shows EV values, you decide the strategy',
		icon: '💡',
	},
	coach: {
		label: 'Coach',
		description: 'Full suggestions with explanations',
		icon: '🎯',
	},
	training: {
		label: 'Training',
		description: 'Warns before suboptimal plays',
		icon: '🏋️',
	},
};

// =============================================================================
// Store Implementation
// =============================================================================

class CoachStore {
	// Preferences (persisted)
	#preferences = $state<CoachPreferences>(DEFAULT_PREFERENCES);

	// Runtime state
	#lastFeedback = $state<CoachFeedback | null>(null);
	#pendingDecision = $state<PendingDecision | null>(null);
	#showConfirmModal = $state(false);
	#initialized = $state(false);

	// ==========================================================================
	// Derived State
	// ==========================================================================

	/** Current coach level */
	level = $derived(this.#preferences.level);

	/** Whether coach mode is active (not off) */
	isActive = $derived(this.#preferences.level !== 'off');

	/** Whether to show probability ribbon */
	showProbabilities = $derived(this.#preferences.showProbabilities && this.isActive);

	/** Whether to highlight optimal category */
	highlightOptimal = $derived(this.#preferences.highlightOptimal && this.isActive);

	/** Whether to show EV delta on categories */
	showEVDelta = $derived(this.#preferences.showEVDelta && this.isActive);

	/** Whether to animate dice suggestions */
	animateSuggestions = $derived(
		this.#preferences.animateSuggestions && this.#preferences.level === 'coach',
	);

	/** Whether to show full suggestions (coach or training mode) */
	showSuggestions = $derived(
		this.#preferences.level === 'coach' || this.#preferences.level === 'training',
	);

	/** Whether training mode confirmation is required */
	requiresConfirmation = $derived(this.#preferences.level === 'training');

	/** Last feedback message */
	lastFeedback = $derived(this.#lastFeedback);

	/** Pending decision awaiting confirmation */
	pendingDecision = $derived(this.#pendingDecision);

	/** Whether confirmation modal should be shown */
	showConfirmModal = $derived(this.#showConfirmModal);

	/** Full preferences object */
	preferences = $derived(this.#preferences);

	/** Whether store is initialized */
	initialized = $derived(this.#initialized);

	// ==========================================================================
	// Public Methods
	// ==========================================================================

	/**
	 * Initialize store from localStorage
	 */
	init(): void {
		if (this.#initialized) return;
		this.#preferences = loadPreferences();
		this.#initialized = true;
	}

	/**
	 * Set coach level
	 */
	setLevel(level: CoachLevel): void {
		this.#preferences = { ...this.#preferences, level };
		savePreferences(this.#preferences);
	}

	/**
	 * Update preferences
	 */
	updatePreferences(updates: Partial<CoachPreferences>): void {
		this.#preferences = { ...this.#preferences, ...updates };
		savePreferences(this.#preferences);
	}

	/**
	 * Reset to defaults
	 */
	resetToDefaults(): void {
		this.#preferences = { ...DEFAULT_PREFERENCES };
		savePreferences(this.#preferences);
	}

	/**
	 * Set feedback message
	 */
	setFeedback(feedback: CoachFeedback | null): void {
		this.#lastFeedback = feedback;
	}

	/**
	 * Clear feedback
	 */
	clearFeedback(): void {
		this.#lastFeedback = null;
	}

	/**
	 * Request confirmation for a decision (training mode)
	 * Returns true if decision should proceed, false if blocked
	 */
	requestConfirmation(decision: PendingDecision): boolean {
		// If not training mode or decision is optimal, allow immediately
		if (this.#preferences.level !== 'training' || decision.isOptimal) {
			return true;
		}

		// Block and show confirmation modal
		this.#pendingDecision = decision;
		this.#showConfirmModal = true;
		return false;
	}

	/**
	 * Confirm pending decision (proceed anyway)
	 */
	confirmDecision(): void {
		this.#pendingDecision = null;
		this.#showConfirmModal = false;
	}

	/**
	 * Cancel pending decision
	 */
	cancelDecision(): void {
		this.#pendingDecision = null;
		this.#showConfirmModal = false;
	}

	/**
	 * Generate feedback for a scoring decision
	 */
	generateScoringFeedback(
		chosenCategory: Category,
		chosenScore: number,
		optimalCategory: Category,
		optimalScore: number,
		chosenEV: number,
		optimalEV: number,
	): CoachFeedback {
		const isOptimal = chosenCategory === optimalCategory;
		const evLoss = optimalEV - chosenEV;

		if (isOptimal) {
			return {
				type: 'optimal',
				message: `Great choice! ${chosenCategory} for ${chosenScore} is optimal.`,
				category: chosenCategory,
			};
		}

		return {
			type: 'suboptimal',
			message: `${optimalCategory} (${optimalScore}) would have been ${evLoss.toFixed(1)} EV better.`,
			category: chosenCategory,
			evLoss,
		};
	}

	// ==========================================================================
	// Testing Helpers
	// ==========================================================================

	/** Testing utilities - only use in tests */
	__testing = {
		reset: () => {
			this.#preferences = { ...DEFAULT_PREFERENCES };
			this.#lastFeedback = null;
			this.#pendingDecision = null;
			this.#showConfirmModal = false;
			this.#initialized = false;
		},
		setPreferences: (prefs: CoachPreferences) => {
			this.#preferences = prefs;
		},
	};
}

// =============================================================================
// Persistence Helpers
// =============================================================================

function loadPreferences(): CoachPreferences {
	if (typeof window === 'undefined') return DEFAULT_PREFERENCES;

	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (stored) {
			return { ...DEFAULT_PREFERENCES, ...JSON.parse(stored) };
		}
	} catch {
		// Ignore localStorage errors
	}

	return DEFAULT_PREFERENCES;
}

function savePreferences(prefs: CoachPreferences): void {
	if (typeof window === 'undefined') return;

	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
	} catch {
		// Ignore localStorage errors
	}
}

// =============================================================================
// Export Singleton
// =============================================================================

export const coach = new CoachStore();
