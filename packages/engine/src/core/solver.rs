//! Dynamic programming solver for single-turn optimization (Layer 2).
//!
//! This module implements backward induction to find the optimal keep strategy
//! within a single turn. The Bellman equation is:
//!
//! V(D, r, C) = max( max_{c∈C} s(D,c), max_K Σ_{D'} P(D'|K) × V(D', r-1, C) )
//!
//! where:
//! - D is the current configuration
//! - r is rolls remaining
//! - C is the set of available categories
//! - s(D,c) is the score for config D in category c
//! - K is a keep pattern
//! - P(D'|K) is the transition probability

use std::collections::HashMap;

use crate::core::category::{Category, CategorySet};
use crate::core::config::{ConfigIndex, DiceConfig};
use crate::core::keep::{KeepPattern, PartialDice};
use crate::core::turn::{Action, CategoryValue, TurnAnalysis, TurnState};
use crate::scoring::rules::score;
use crate::transition::table::TRANSITION_TABLE;

// =============================================================================
// CACHE KEY
// =============================================================================

/// Key for memoization cache.
#[derive(Clone, Copy, PartialEq, Eq, Hash)]
struct CacheKey {
    config_index: ConfigIndex,
    rolls_remaining: u8,
    available: CategorySet,
}

impl CacheKey {
    fn new(config: &DiceConfig, rolls_remaining: u8, available: &CategorySet) -> Self {
        Self {
            config_index: config.to_index(),
            rolls_remaining,
            available: *available,
        }
    }
}

// =============================================================================
// SOLVER
// =============================================================================

/// Dynamic programming solver for single-turn optimization.
///
/// Computes the optimal keep strategy and expected value for any turn state.
/// Uses memoization to avoid redundant computations.
///
/// # Example
///
/// ```rust,no_run
/// use dicee_engine::core::{DiceConfig, TurnState, CategorySet};
/// use dicee_engine::core::solver::TurnSolver;
///
/// let solver = TurnSolver::new();
///
/// let config = DiceConfig::from_dice(&[3, 3, 3, 4, 5]);
/// let state = TurnState::new(config, 2);
/// let available = CategorySet::all();
///
/// let analysis = solver.analyze(&state, &available);
/// println!("Recommendation: {:?}", analysis.recommendation);
/// println!("Expected value: {:.2}", analysis.expected_value);
/// ```
pub struct TurnSolver {
    /// Memoization cache for expected values.
    cache: HashMap<CacheKey, f64>,
}

impl TurnSolver {
    /// Creates a new solver with an empty cache.
    pub fn new() -> Self {
        Self {
            cache: HashMap::new(),
        }
    }

    /// Creates a solver with a preallocated cache.
    pub fn with_capacity(capacity: usize) -> Self {
        Self {
            cache: HashMap::with_capacity(capacity),
        }
    }

    /// Clears the memoization cache.
    pub fn clear_cache(&mut self) {
        self.cache.clear();
    }

    /// Returns the number of cached entries.
    pub fn cache_size(&self) -> usize {
        self.cache.len()
    }

    /// Computes complete analysis for a turn state.
    pub fn analyze(&self, state: &TurnState, available: &CategorySet) -> TurnAnalysis {
        if available.is_empty() {
            // No categories available - shouldn't happen in normal play
            return TurnAnalysis {
                state: *state,
                available: *available,
                category_values: Vec::new(),
                best_immediate: None,
                continue_value: 0.0,
                optimal_keep: KeepPattern::KEEP_NONE,
                recommendation: Action::score(Category::Chance), // Fallback
                expected_value: 0.0,
            };
        }

        // Compute immediate score for each available category
        let category_values: Vec<CategoryValue> = available
            .iter()
            .map(|cat| {
                let result = score(&state.config, cat);
                CategoryValue {
                    category: cat,
                    immediate_score: result.score,
                    is_valid: result.valid,
                    expected_value: if state.rolls_remaining > 0 {
                        self.category_ev(&state.config, state.rolls_remaining, cat)
                    } else {
                        result.score as f64
                    },
                }
            })
            .collect();

        // Find best immediate score
        let best_immediate = category_values
            .iter()
            .max_by_key(|cv| cv.immediate_score)
            .map(|cv| (cv.category, cv.immediate_score));

        // Compute optimal continuation if rerolls available
        let (continue_value, optimal_keep) = if state.can_reroll() {
            self.best_keep(&state.config, state.rolls_remaining, available)
        } else {
            (
                best_immediate.map(|(_, s)| s as f64).unwrap_or(0.0),
                KeepPattern::keep_all(&state.config),
            )
        };

        // Determine recommendation
        let best_immediate_value = best_immediate.map(|(_, s)| s as f64).unwrap_or(0.0);

        let (recommendation, expected_value) =
            if state.can_reroll() && continue_value > best_immediate_value {
                (Action::reroll(optimal_keep), continue_value)
            } else {
                let best_cat = best_immediate.map(|(c, _)| c).unwrap_or(Category::Chance);
                (Action::score(best_cat), best_immediate_value)
            };

        TurnAnalysis {
            state: *state,
            available: *available,
            category_values,
            best_immediate,
            continue_value,
            optimal_keep,
            recommendation,
            expected_value,
        }
    }

    /// Computes the expected value for a specific configuration, rolls remaining, and category.
    ///
    /// This answers: "If I continue optimally and eventually score in this category,
    /// what's my expected score?"
    pub fn category_ev(&self, config: &DiceConfig, rolls: u8, category: Category) -> f64 {
        if rolls == 0 {
            return score(config, category).score as f64;
        }

        // For a single category, we can compute EV directly
        // by finding the best keep pattern that maximizes EV for this category
        let (ev, _) = self.best_keep_for_category(config, rolls, category);
        ev
    }

    /// Computes the expected value of a turn state (max over all available categories).
    pub fn expected_value(&self, config: &DiceConfig, rolls: u8, available: &CategorySet) -> f64 {
        if available.is_empty() {
            return 0.0;
        }

        if rolls == 0 {
            // Must score now: return best immediate score
            return available
                .iter()
                .map(|cat| score(config, cat).score)
                .max()
                .unwrap_or(0) as f64;
        }

        // Check cache
        let key = CacheKey::new(config, rolls, available);
        if let Some(&ev) = self.cache.get(&key) {
            return ev;
        }

        // Compute: max over scoring now vs rerolling
        let immediate_best = available
            .iter()
            .map(|cat| score(config, cat).score)
            .max()
            .unwrap_or(0) as f64;

        let (reroll_ev, _) = self.best_keep(config, rolls, available);

        immediate_best.max(reroll_ev)
    }

    /// Finds the best keep pattern and its expected value.
    ///
    /// Returns (expected_value, optimal_keep_pattern).
    fn best_keep(
        &self,
        config: &DiceConfig,
        rolls: u8,
        available: &CategorySet,
    ) -> (f64, KeepPattern) {
        if rolls == 0 {
            return (
                self.expected_value(config, 0, available),
                KeepPattern::keep_all(config),
            );
        }

        let mut best_ev = f64::NEG_INFINITY;
        let mut best_keep = KeepPattern::KEEP_NONE;

        for keep in KeepPattern::iter_valid_for(config) {
            let partial = unsafe { PartialDice::new_unchecked(keep) };

            // Compute expected value over all reachable configs
            let ev = TRANSITION_TABLE.expected_value(&partial, |next_config| {
                self.expected_value(next_config, rolls - 1, available)
            });

            if ev > best_ev {
                best_ev = ev;
                best_keep = keep;
            }
        }

        (best_ev, best_keep)
    }

    /// Finds the best keep pattern for a specific category.
    #[allow(clippy::only_used_in_recursion)]
    fn best_keep_for_category(
        &self,
        config: &DiceConfig,
        rolls: u8,
        category: Category,
    ) -> (f64, KeepPattern) {
        if rolls == 0 {
            return (
                score(config, category).score as f64,
                KeepPattern::keep_all(config),
            );
        }

        let mut best_ev = f64::NEG_INFINITY;
        let mut best_keep = KeepPattern::KEEP_NONE;

        for keep in KeepPattern::iter_valid_for(config) {
            let partial = unsafe { PartialDice::new_unchecked(keep) };

            // Compute expected value for this category over all reachable configs
            let ev = TRANSITION_TABLE.expected_value(&partial, |next_config| {
                if rolls == 1 {
                    score(next_config, category).score as f64
                } else {
                    self.best_keep_for_category(next_config, rolls - 1, category)
                        .0
                }
            });

            if ev > best_ev {
                best_ev = ev;
                best_keep = keep;
            }
        }

        (best_ev, best_keep)
    }
}

impl Default for TurnSolver {
    fn default() -> Self {
        Self::new()
    }
}

// =============================================================================
// CONVENIENCE FUNCTIONS
// =============================================================================

/// Analyzes a turn state using a fresh solver.
///
/// For repeated analyses, prefer creating a `TurnSolver` and reusing it.
pub fn analyze_turn(state: &TurnState, available: &CategorySet) -> TurnAnalysis {
    let solver = TurnSolver::new();
    solver.analyze(state, available)
}

/// Quick expected value computation for a turn state.
pub fn quick_ev(dice: &[u8; 5], rolls: u8, available: &CategorySet) -> f64 {
    let solver = TurnSolver::new();
    let config = DiceConfig::from_dice(dice);
    solver.expected_value(&config, rolls, available)
}

// =============================================================================
// TESTS
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_dicee_immediate_score() {
        let solver = TurnSolver::new();

        // Dicee with Dicee available should score 50
        let config = DiceConfig::from_dice(&[4, 4, 4, 4, 4]);
        let state = TurnState::new(config, 2);
        let available = CategorySet::all();

        let analysis = solver.analyze(&state, &available);

        // Should recommend scoring Dicee
        assert!(analysis.recommendation.is_score());
        if let Action::Score { category } = analysis.recommendation {
            assert_eq!(category, Category::Dicee);
        }
        assert!((analysis.expected_value - 50.0).abs() < 0.01);
    }

    #[test]
    fn test_large_straight_immediate() {
        let solver = TurnSolver::new();

        let config = DiceConfig::from_dice(&[1, 2, 3, 4, 5]);
        let state = TurnState::new(config, 2);
        let available = CategorySet::all();

        let analysis = solver.analyze(&state, &available);

        // Large straight scores 40 - likely the best immediate score
        let ls_value = analysis
            .category_values
            .iter()
            .find(|cv| cv.category == Category::LargeStraight)
            .unwrap();
        assert_eq!(ls_value.immediate_score, 40);
    }

    #[test]
    fn test_ev_monotonic_in_rolls() {
        let solver = TurnSolver::new();

        let config = DiceConfig::from_dice(&[1, 2, 3, 4, 6]);
        let available = CategorySet::all();

        let ev0 = solver.expected_value(&config, 0, &available);
        let ev1 = solver.expected_value(&config, 1, &available);
        let ev2 = solver.expected_value(&config, 2, &available);

        // More rolls should mean higher or equal EV
        assert!(ev1 >= ev0 - 0.01);
        assert!(ev2 >= ev1 - 0.01);
    }

    #[test]
    fn test_must_score_no_reroll() {
        let solver = TurnSolver::new();

        let config = DiceConfig::from_dice(&[1, 1, 1, 2, 3]);
        let state = TurnState::new(config, 0); // No rolls left
        let available = CategorySet::all();

        let analysis = solver.analyze(&state, &available);

        // Must score, not reroll
        assert!(analysis.recommendation.is_score());
    }

    #[test]
    fn test_single_category_available() {
        let solver = TurnSolver::new();

        let config = DiceConfig::from_dice(&[2, 2, 2, 4, 5]);
        let state = TurnState::new(config, 1);

        // Only Twos available
        let available = CategorySet::new().with(Category::Twos);

        let analysis = solver.analyze(&state, &available);

        // Should score Twos = 6
        if let Action::Score { category } = analysis.recommendation {
            assert_eq!(category, Category::Twos);
        } else {
            // If rerolling, the EV should still be for Twos
            assert!(analysis.continue_value > 0.0);
        }
    }

    #[test]
    fn test_solver_reuse() {
        let solver = TurnSolver::new();

        let config1 = DiceConfig::from_dice(&[1, 2, 3, 4, 5]);
        let config2 = DiceConfig::from_dice(&[6, 6, 6, 6, 6]);
        let available = CategorySet::all();

        let state1 = TurnState::new(config1, 1);
        let state2 = TurnState::new(config2, 1);

        // Both analyses should work
        let analysis1 = solver.analyze(&state1, &available);
        let analysis2 = solver.analyze(&state2, &available);

        assert!(analysis1.expected_value > 0.0);
        assert!(analysis2.expected_value > 0.0);
    }
}
