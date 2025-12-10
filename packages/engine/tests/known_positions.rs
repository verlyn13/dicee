//! Known position tests for the Dicee solver.
//!
//! These tests validate that the solver produces optimal decisions for
//! well-documented dice game positions from the literature.
//!
//! References:
//! - Woodward, "The Mathematics of Dicee" (2009) - mathematical foundations
//! - Optimal strategy guides for 5-dice games

use dicee_engine::core::category::{Category, CategorySet};
use dicee_engine::core::config::DiceConfig;
use dicee_engine::core::solver::TurnSolver;
use dicee_engine::core::turn::{Action, TurnState};

/// Helper to create a turn state from dice array.
fn state(dice: [u8; 5], rolls: u8) -> TurnState {
    TurnState::from_dice(&dice, rolls)
}

// =============================================================================
// DICEE POSITIONS - Must always score immediately
// =============================================================================

#[test]
fn test_dicee_with_dicee_available() {
    // [5,5,5,5,5] with Dicee available: MUST score 50 immediately
    let solver = TurnSolver::new();
    let state = state([5, 5, 5, 5, 5], 2);
    let available = CategorySet::all();

    let analysis = solver.analyze(&state, &available);

    assert!(
        analysis.recommendation.is_score(),
        "Should recommend scoring"
    );
    if let Action::Score { category } = analysis.recommendation {
        assert_eq!(category, Category::Dicee, "Should score Dicee");
    }
    assert!(
        (analysis.expected_value - 50.0).abs() < 0.01,
        "EV should be 50"
    );
}

#[test]
fn test_dicee_ones() {
    // [1,1,1,1,1] - Dicee with all ones
    let solver = TurnSolver::new();
    let state = state([1, 1, 1, 1, 1], 2);
    let available = CategorySet::all();

    let analysis = solver.analyze(&state, &available);

    assert!(analysis.recommendation.is_score());
    if let Action::Score { category } = analysis.recommendation {
        assert_eq!(category, Category::Dicee);
    }
}

#[test]
fn test_dicee_sixes() {
    // [6,6,6,6,6] - Dicee with all sixes
    let solver = TurnSolver::new();
    let state = state([6, 6, 6, 6, 6], 2);
    let available = CategorySet::all();

    let analysis = solver.analyze(&state, &available);

    assert!(analysis.recommendation.is_score());
    if let Action::Score { category } = analysis.recommendation {
        assert_eq!(category, Category::Dicee);
    }
}

// =============================================================================
// LARGE STRAIGHT POSITIONS
// =============================================================================

#[test]
fn test_large_straight_1_to_5() {
    // [1,2,3,4,5] - Large straight (40 points)
    let solver = TurnSolver::new();
    let state = state([1, 2, 3, 4, 5], 2);
    let available = CategorySet::all();

    let analysis = solver.analyze(&state, &available);

    // Find the large straight score
    let ls_score = analysis
        .category_values
        .iter()
        .find(|cv| cv.category == Category::LargeStraight)
        .map(|cv| cv.immediate_score)
        .unwrap();

    assert_eq!(ls_score, 40, "Large straight should score 40");
}

#[test]
fn test_large_straight_2_to_6() {
    // [2,3,4,5,6] - Large straight (40 points)
    let solver = TurnSolver::new();
    let state = state([2, 3, 4, 5, 6], 2);
    let available = CategorySet::all();

    let analysis = solver.analyze(&state, &available);

    let ls_score = analysis
        .category_values
        .iter()
        .find(|cv| cv.category == Category::LargeStraight)
        .map(|cv| cv.immediate_score)
        .unwrap();

    assert_eq!(ls_score, 40);
}

// =============================================================================
// FOUR OF A KIND POSITIONS - Should reroll for Dicee
// =============================================================================

#[test]
fn test_four_of_kind_reroll_for_dicee() {
    // [3,3,3,3,1] with Dicee available and 2 rolls remaining
    // Optimal: keep the 3s, reroll the 1 hoping for Dicee
    let solver = TurnSolver::new();
    let state = state([3, 3, 3, 3, 1], 2);

    // Only Dicee available - should definitely try for it
    let available = CategorySet::new().with(Category::Dicee);

    let analysis = solver.analyze(&state, &available);

    // With 2 rolls and only Dicee available, rerolling has higher EV
    // Probability of hitting Dicee from 4-of-a-kind is ~11% per roll
    assert!(
        analysis.recommendation.is_reroll(),
        "Should reroll when chasing Dicee"
    );
}

#[test]
fn test_four_of_kind_all_categories() {
    // [4,4,4,4,2] with all categories available
    // This is a trickier decision - FourOfAKind scores 18, Dicee would be 50
    let solver = TurnSolver::new();
    let state = state([4, 4, 4, 4, 2], 2);
    let available = CategorySet::all();

    let analysis = solver.analyze(&state, &available);

    // The optimal play depends on EV calculations
    // Immediate FourOfAKind = 18, but EV of rerolling might be higher
    // Just verify the solver makes a decision
    assert!(analysis.expected_value > 18.0 - 0.01);
}

// =============================================================================
// FULL HOUSE POSITIONS
// =============================================================================

#[test]
fn test_full_house() {
    // [3,3,3,5,5] - Full house (25 points)
    let solver = TurnSolver::new();
    let state = state([3, 3, 3, 5, 5], 2);
    let available = CategorySet::all();

    let analysis = solver.analyze(&state, &available);

    let fh_score = analysis
        .category_values
        .iter()
        .find(|cv| cv.category == Category::FullHouse)
        .map(|cv| cv.immediate_score)
        .unwrap();

    assert_eq!(fh_score, 25, "Full house should score 25");

    // Also verify three of a kind score
    let tok_score = analysis
        .category_values
        .iter()
        .find(|cv| cv.category == Category::ThreeOfAKind)
        .map(|cv| cv.immediate_score)
        .unwrap();

    assert_eq!(tok_score, 19, "Three of a kind should score 19");
}

// =============================================================================
// STRAIGHT DRAW POSITIONS
// =============================================================================

#[test]
fn test_straight_draw_missing_5() {
    // [1,2,3,4,6] - Small straight, one die away from large
    let solver = TurnSolver::new();
    let state = state([1, 2, 3, 4, 6], 1);

    // Only LargeStraight available
    let available = CategorySet::new().with(Category::LargeStraight);

    let analysis = solver.analyze(&state, &available);

    // With 1 roll and only Large Straight available, should reroll the 6
    // Chance of hitting: 1/6 ≈ 16.7%
    assert!(
        analysis.recommendation.is_reroll(),
        "Should reroll when drawing to large straight"
    );

    // Expected value should be about 40 * 1/6 ≈ 6.67
    assert!(
        analysis.expected_value > 5.0 && analysis.expected_value < 8.0,
        "EV should be around 6.67"
    );
}

#[test]
fn test_open_ended_straight_draw() {
    // [2,3,4,5,5] - Can complete with 1 or 6
    let solver = TurnSolver::new();
    let state = state([2, 3, 4, 5, 5], 1);
    let available = CategorySet::new().with(Category::LargeStraight);

    let analysis = solver.analyze(&state, &available);

    // Chance of hitting: 2/6 ≈ 33.3%
    // EV ≈ 40 * 2/6 ≈ 13.33
    assert!(
        analysis.expected_value > 10.0 && analysis.expected_value < 16.0,
        "EV should be around 13.33"
    );
}

// =============================================================================
// MUST SCORE POSITIONS (0 rolls remaining)
// =============================================================================

#[test]
fn test_must_score_no_rolls() {
    // [1,2,3,4,6] with 0 rolls - must score, cannot reroll
    let solver = TurnSolver::new();
    let state = state([1, 2, 3, 4, 6], 0);
    let available = CategorySet::all();

    let analysis = solver.analyze(&state, &available);

    assert!(
        analysis.recommendation.is_score(),
        "Must score when no rolls remaining"
    );

    // Small straight is the best option (30 points)
    if let Action::Score { category } = analysis.recommendation {
        assert_eq!(
            category,
            Category::SmallStraight,
            "Should score small straight"
        );
    }
}

#[test]
fn test_must_score_junk_roll() {
    // [1,1,3,5,6] with 0 rolls - no patterns, best is Chance (16)
    let solver = TurnSolver::new();
    let state = state([1, 1, 3, 5, 6], 0);

    // Only Chance and upper section available
    let available = CategorySet::new()
        .with(Category::Ones)
        .with(Category::Chance);

    let analysis = solver.analyze(&state, &available);

    assert!(analysis.recommendation.is_score());
    if let Action::Score { category } = analysis.recommendation {
        assert_eq!(category, Category::Chance, "Should score Chance for 16");
    }
}

// =============================================================================
// EV MONOTONICITY - More rolls = higher or equal EV
// =============================================================================

#[test]
fn test_ev_increases_with_rolls() {
    // For any position, EV should not decrease with more rolls
    let solver = TurnSolver::new();
    let config = DiceConfig::from_dice(&[1, 2, 3, 4, 6]);
    let available = CategorySet::all();

    let ev0 = solver.expected_value(&config, 0, &available);
    let ev1 = solver.expected_value(&config, 1, &available);
    let ev2 = solver.expected_value(&config, 2, &available);

    assert!(ev1 >= ev0 - 0.001, "EV with 1 roll >= EV with 0 rolls");
    assert!(ev2 >= ev1 - 0.001, "EV with 2 rolls >= EV with 1 roll");
}

#[test]
fn test_ev_increases_random_position() {
    // Another position for EV monotonicity
    let solver = TurnSolver::new();
    let config = DiceConfig::from_dice(&[2, 2, 4, 5, 6]);
    let available = CategorySet::all();

    let ev0 = solver.expected_value(&config, 0, &available);
    let ev1 = solver.expected_value(&config, 1, &available);
    let ev2 = solver.expected_value(&config, 2, &available);

    assert!(ev1 >= ev0 - 0.001);
    assert!(ev2 >= ev1 - 0.001);
}

// =============================================================================
// BOUNDARY CONDITIONS
// =============================================================================

#[test]
fn test_empty_category_set() {
    // Edge case: no categories available (shouldn't happen in real play)
    let solver = TurnSolver::new();
    let state = state([1, 2, 3, 4, 5], 2);
    let available = CategorySet::EMPTY;

    let analysis = solver.analyze(&state, &available);

    assert_eq!(analysis.expected_value, 0.0);
    assert!(analysis.category_values.is_empty());
}

#[test]
fn test_single_category_only_ones() {
    // Only Ones available with [1,1,1,2,3]
    let solver = TurnSolver::new();
    let state = state([1, 1, 1, 2, 3], 2);
    let available = CategorySet::new().with(Category::Ones);

    let analysis = solver.analyze(&state, &available);

    // Immediate score is 3, might reroll to get more 1s
    let ones_score = analysis
        .category_values
        .iter()
        .find(|cv| cv.category == Category::Ones)
        .map(|cv| cv.immediate_score)
        .unwrap();

    assert_eq!(ones_score, 3, "Three 1s should score 3");
}
