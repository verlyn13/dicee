use crate::scoring;
use crate::types::{Category, CategoryProbability, Dice, ProbabilityResult};

/// Calculate probabilities and expected values for all categories
/// given current dice state and which dice are kept
pub fn calculate_all(dice: &Dice, kept: &[bool; 5], rolls_remaining: u8) -> ProbabilityResult {
    // If no rolls remaining, just return current scores with 100% probability
    if rolls_remaining == 0 {
        return calculate_current(dice);
    }

    // Count how many dice will be rerolled
    let reroll_count = kept.iter().filter(|&&k| !k).count();

    if reroll_count == 0 {
        // All dice kept, no change possible
        return calculate_current(dice);
    }

    // For MVP: single-roll enumeration (rolls_remaining = 1)
    // Multi-roll DP is deferred to post-MVP
    if rolls_remaining == 1 {
        calculate_single_roll(dice, kept, reroll_count)
    } else {
        // For MVP, treat multiple rolls as single roll (simplified)
        // TODO: Implement proper multi-roll expected value calculation
        calculate_single_roll(dice, kept, reroll_count)
    }
}

/// Calculate probabilities assuming exactly one more roll
fn calculate_single_roll(dice: &Dice, kept: &[bool; 5], reroll_count: usize) -> ProbabilityResult {
    // Total possible outcomes: 6^reroll_count
    let total_outcomes = 6_usize.pow(reroll_count as u32);

    // Accumulate scores for each category across all outcomes
    let mut category_totals: Vec<(u64, u64)> = vec![(0, 0); 13]; // (sum of scores, count of valid)

    // Enumerate all possible reroll outcomes
    for outcome_idx in 0..total_outcomes {
        let new_dice = generate_outcome(dice, kept, outcome_idx, reroll_count);

        for (cat_idx, &cat) in Category::all().iter().enumerate() {
            let result = scoring::score(&new_dice, cat);
            category_totals[cat_idx].0 += result.score as u64;
            if result.valid {
                category_totals[cat_idx].1 += 1;
            }
        }
    }

    // Convert to probabilities and expected values
    let categories: Vec<CategoryProbability> = Category::all()
        .iter()
        .enumerate()
        .map(|(idx, &cat)| {
            let (score_sum, valid_count) = category_totals[idx];
            let current = scoring::score(dice, cat);

            CategoryProbability {
                category: cat,
                probability: valid_count as f64 / total_outcomes as f64,
                expected_value: score_sum as f64 / total_outcomes as f64,
                current_score: current.score,
            }
        })
        .collect();

    // Find best category by expected value
    let (best_idx, best_ev) = categories
        .iter()
        .enumerate()
        .max_by(|(_, a), (_, b)| {
            a.expected_value
                .partial_cmp(&b.expected_value)
                .unwrap_or(std::cmp::Ordering::Equal)
        })
        .map(|(idx, cat)| (idx, cat.expected_value))
        .unwrap_or((12, 0.0)); // Default to Chance

    ProbabilityResult {
        categories,
        best_category: Category::all()[best_idx],
        best_ev,
    }
}

/// Calculate current state (no rolls remaining)
fn calculate_current(dice: &Dice) -> ProbabilityResult {
    let categories: Vec<CategoryProbability> = Category::all()
        .iter()
        .map(|&cat| {
            let result = scoring::score(dice, cat);
            CategoryProbability {
                category: cat,
                probability: if result.valid { 1.0 } else { 0.0 },
                expected_value: result.score as f64,
                current_score: result.score,
            }
        })
        .collect();

    let (best_idx, best_ev) = categories
        .iter()
        .enumerate()
        .max_by(|(_, a), (_, b)| {
            a.expected_value
                .partial_cmp(&b.expected_value)
                .unwrap_or(std::cmp::Ordering::Equal)
        })
        .map(|(idx, cat)| (idx, cat.expected_value))
        .unwrap_or((12, 0.0));

    ProbabilityResult {
        categories,
        best_category: Category::all()[best_idx],
        best_ev,
    }
}

/// Generate a specific dice outcome given the reroll index
fn generate_outcome(dice: &Dice, kept: &[bool; 5], outcome_idx: usize, reroll_count: usize) -> Dice {
    let mut result = *dice;
    let mut idx = outcome_idx;
    let mut reroll_pos = 0;

    for i in 0..5 {
        if !kept[i] {
            // Convert outcome_idx to base-6 digit for this position
            let die_value = if reroll_pos < reroll_count {
                let digit = idx % 6;
                idx /= 6;
                (digit + 1) as u8
            } else {
                1 // Should never happen
            };
            result[i] = die_value;
            reroll_pos += 1;
        }
    }

    result
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_all_kept_returns_current() {
        let dice: Dice = [5, 5, 5, 5, 5];
        let kept = [true, true, true, true, true];

        let result = calculate_all(&dice, &kept, 1);
        assert_eq!(result.best_category, Category::Yahtzee);
        assert_eq!(result.best_ev, 50.0);
    }

    #[test]
    fn test_yahtzee_probability() {
        // If we have 4 fives and reroll 1 die, probability of Yahtzee is 1/6
        let dice: Dice = [5, 5, 5, 5, 1];
        let kept = [true, true, true, true, false];

        let result = calculate_all(&dice, &kept, 1);

        let yahtzee_prob = result
            .categories
            .iter()
            .find(|c| c.category == Category::Yahtzee)
            .unwrap();

        // Should be close to 1/6 ≈ 0.1667
        assert!((yahtzee_prob.probability - 1.0 / 6.0).abs() < 0.001);
    }

    #[test]
    fn test_generate_outcome() {
        let dice: Dice = [1, 1, 1, 1, 1];
        let kept = [true, false, true, false, true];

        // outcome_idx = 0 means (1, 1) for the two rerolled dice
        let result = generate_outcome(&dice, &kept, 0, 2);
        assert_eq!(result, [1, 1, 1, 1, 1]);

        // outcome_idx = 7 = 1*6 + 1 means (2, 2) for the two rerolled dice
        let result = generate_outcome(&dice, &kept, 7, 2);
        assert_eq!(result, [1, 2, 1, 2, 1]);
    }

    #[test]
    fn test_expected_value_upper_section() {
        // Rerolling all 5 dice, expected value for Ones should be ~2.5 (5 * 1/6 * 1)
        let dice: Dice = [1, 1, 1, 1, 1];
        let kept = [false, false, false, false, false];

        let result = calculate_all(&dice, &kept, 1);

        let ones_ev = result
            .categories
            .iter()
            .find(|c| c.category == Category::Ones)
            .unwrap()
            .expected_value;

        // E[ones] = sum of (count_of_ones * 1) across all outcomes / total outcomes
        // Each die has 1/6 chance of being 1, so expected count is 5/6 ≈ 0.833
        assert!((ones_ev - 5.0 / 6.0).abs() < 0.001);
    }
}
