use crate::types::{Category, Dice, ScoringResult};

/// Count occurrences of each die value (1-6)
fn count_dice(dice: &Dice) -> [u8; 6] {
    let mut counts = [0u8; 6];
    for &d in dice {
        counts[(d - 1) as usize] += 1;
    }
    counts
}

/// Sum of all dice
fn sum_dice(dice: &Dice) -> u16 {
    dice.iter().map(|&d| d as u16).sum()
}

/// Score dice for a specific category
pub fn score(dice: &Dice, category: Category) -> ScoringResult {
    let counts = count_dice(dice);
    let total = sum_dice(dice);

    let (score, valid) = match category {
        // Upper section: sum of specific face value
        Category::Ones => {
            let s = counts[0] as u16;
            (s, true)
        }
        Category::Twos => {
            let s = counts[1] as u16 * 2;
            (s, true)
        }
        Category::Threes => {
            let s = counts[2] as u16 * 3;
            (s, true)
        }
        Category::Fours => {
            let s = counts[3] as u16 * 4;
            (s, true)
        }
        Category::Fives => {
            let s = counts[4] as u16 * 5;
            (s, true)
        }
        Category::Sixes => {
            let s = counts[5] as u16 * 6;
            (s, true)
        }

        // Three of a kind: at least 3 of same value
        Category::ThreeOfAKind => {
            let has_three = counts.iter().any(|&c| c >= 3);
            if has_three {
                (total, true)
            } else {
                (0, false)
            }
        }

        // Four of a kind: at least 4 of same value
        Category::FourOfAKind => {
            let has_four = counts.iter().any(|&c| c >= 4);
            if has_four {
                (total, true)
            } else {
                (0, false)
            }
        }

        // Full house: 3 of one + 2 of another
        Category::FullHouse => {
            let has_three = counts.contains(&3);
            let has_two = counts.contains(&2);
            if has_three && has_two {
                (25, true)
            } else {
                (0, false)
            }
        }

        // Small straight: 4 consecutive values
        Category::SmallStraight => {
            // Check for 1-2-3-4, 2-3-4-5, or 3-4-5-6
            let seq_1234 = counts[0] >= 1 && counts[1] >= 1 && counts[2] >= 1 && counts[3] >= 1;
            let seq_2345 = counts[1] >= 1 && counts[2] >= 1 && counts[3] >= 1 && counts[4] >= 1;
            let seq_3456 = counts[2] >= 1 && counts[3] >= 1 && counts[4] >= 1 && counts[5] >= 1;
            if seq_1234 || seq_2345 || seq_3456 {
                (30, true)
            } else {
                (0, false)
            }
        }

        // Large straight: 5 consecutive values
        Category::LargeStraight => {
            // Check for 1-2-3-4-5 or 2-3-4-5-6
            let has_large = (counts[0] == 1
                && counts[1] == 1
                && counts[2] == 1
                && counts[3] == 1
                && counts[4] == 1)
                || (counts[1] == 1
                    && counts[2] == 1
                    && counts[3] == 1
                    && counts[4] == 1
                    && counts[5] == 1);
            if has_large {
                (40, true)
            } else {
                (0, false)
            }
        }

        // Yahtzee: all 5 dice the same
        Category::Yahtzee => {
            let has_five = counts.contains(&5);
            if has_five {
                (50, true)
            } else {
                (0, false)
            }
        }

        // Chance: sum of all dice (always valid)
        Category::Chance => (total, true),
    };

    ScoringResult {
        category,
        score,
        valid,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_upper_section() {
        let dice: Dice = [1, 1, 2, 3, 4];
        assert_eq!(score(&dice, Category::Ones).score, 2);
        assert_eq!(score(&dice, Category::Twos).score, 2);
        assert_eq!(score(&dice, Category::Threes).score, 3);
        assert_eq!(score(&dice, Category::Fours).score, 4);
        assert_eq!(score(&dice, Category::Fives).score, 0);
        assert_eq!(score(&dice, Category::Sixes).score, 0);
    }

    #[test]
    fn test_three_of_a_kind() {
        let yes: Dice = [3, 3, 3, 2, 1];
        let no: Dice = [1, 2, 3, 4, 5];

        let result = score(&yes, Category::ThreeOfAKind);
        assert!(result.valid);
        assert_eq!(result.score, 12);

        let result = score(&no, Category::ThreeOfAKind);
        assert!(!result.valid);
        assert_eq!(result.score, 0);
    }

    #[test]
    fn test_four_of_a_kind() {
        let yes: Dice = [4, 4, 4, 4, 2];
        let no: Dice = [4, 4, 4, 2, 2];

        let result = score(&yes, Category::FourOfAKind);
        assert!(result.valid);
        assert_eq!(result.score, 18);

        let result = score(&no, Category::FourOfAKind);
        assert!(!result.valid);
    }

    #[test]
    fn test_full_house() {
        let yes: Dice = [3, 3, 3, 2, 2];
        let no: Dice = [3, 3, 3, 3, 2];

        let result = score(&yes, Category::FullHouse);
        assert!(result.valid);
        assert_eq!(result.score, 25);

        let result = score(&no, Category::FullHouse);
        assert!(!result.valid);
    }

    #[test]
    fn test_small_straight() {
        let yes1: Dice = [1, 2, 3, 4, 6];
        let yes2: Dice = [2, 3, 4, 5, 5];
        let yes3: Dice = [1, 3, 4, 5, 6];
        let no: Dice = [1, 2, 3, 5, 6];

        assert!(score(&yes1, Category::SmallStraight).valid);
        assert!(score(&yes2, Category::SmallStraight).valid);
        assert!(score(&yes3, Category::SmallStraight).valid);
        assert!(!score(&no, Category::SmallStraight).valid);
    }

    #[test]
    fn test_large_straight() {
        let yes1: Dice = [1, 2, 3, 4, 5];
        let yes2: Dice = [2, 3, 4, 5, 6];
        let no: Dice = [1, 2, 3, 4, 6];

        let result = score(&yes1, Category::LargeStraight);
        assert!(result.valid);
        assert_eq!(result.score, 40);

        assert!(score(&yes2, Category::LargeStraight).valid);
        assert!(!score(&no, Category::LargeStraight).valid);
    }

    #[test]
    fn test_yahtzee() {
        let yes: Dice = [5, 5, 5, 5, 5];
        let no: Dice = [5, 5, 5, 5, 4];

        let result = score(&yes, Category::Yahtzee);
        assert!(result.valid);
        assert_eq!(result.score, 50);

        assert!(!score(&no, Category::Yahtzee).valid);
    }

    #[test]
    fn test_chance() {
        let dice: Dice = [1, 2, 3, 4, 5];
        let result = score(&dice, Category::Chance);
        assert!(result.valid);
        assert_eq!(result.score, 15);
    }
}
