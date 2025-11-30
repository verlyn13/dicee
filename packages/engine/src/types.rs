use serde::{Deserialize, Serialize};

/// Five dice, each value 1-6
pub type Dice = [u8; 5];

/// Validate and convert a slice to Dice
pub fn parse_dice(slice: &[u8]) -> Result<Dice, &'static str> {
    if slice.len() != 5 {
        return Err("dice must be exactly 5 values");
    }

    let mut dice = [0u8; 5];
    for (i, &val) in slice.iter().enumerate() {
        if val < 1 || val > 6 {
            return Err("each die must be 1-6");
        }
        dice[i] = val;
    }
    Ok(dice)
}

/// All 13 Yahtzee scoring categories
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[repr(u8)]
pub enum Category {
    // Upper section
    Ones = 0,
    Twos = 1,
    Threes = 2,
    Fours = 3,
    Fives = 4,
    Sixes = 5,
    // Lower section
    ThreeOfAKind = 6,
    FourOfAKind = 7,
    FullHouse = 8,
    SmallStraight = 9,
    LargeStraight = 10,
    Yahtzee = 11,
    Chance = 12,
}

impl Category {
    pub fn all() -> &'static [Category; 13] {
        &[
            Category::Ones,
            Category::Twos,
            Category::Threes,
            Category::Fours,
            Category::Fives,
            Category::Sixes,
            Category::ThreeOfAKind,
            Category::FourOfAKind,
            Category::FullHouse,
            Category::SmallStraight,
            Category::LargeStraight,
            Category::Yahtzee,
            Category::Chance,
        ]
    }

    pub fn name(&self) -> &'static str {
        match self {
            Category::Ones => "Ones",
            Category::Twos => "Twos",
            Category::Threes => "Threes",
            Category::Fours => "Fours",
            Category::Fives => "Fives",
            Category::Sixes => "Sixes",
            Category::ThreeOfAKind => "Three of a Kind",
            Category::FourOfAKind => "Four of a Kind",
            Category::FullHouse => "Full House",
            Category::SmallStraight => "Small Straight",
            Category::LargeStraight => "Large Straight",
            Category::Yahtzee => "Yahtzee",
            Category::Chance => "Chance",
        }
    }

    pub fn is_upper(&self) -> bool {
        (*self as u8) < 6
    }
}

impl TryFrom<u8> for Category {
    type Error = String;

    fn try_from(value: u8) -> Result<Self, Self::Error> {
        match value {
            0 => Ok(Category::Ones),
            1 => Ok(Category::Twos),
            2 => Ok(Category::Threes),
            3 => Ok(Category::Fours),
            4 => Ok(Category::Fives),
            5 => Ok(Category::Sixes),
            6 => Ok(Category::ThreeOfAKind),
            7 => Ok(Category::FourOfAKind),
            8 => Ok(Category::FullHouse),
            9 => Ok(Category::SmallStraight),
            10 => Ok(Category::LargeStraight),
            11 => Ok(Category::Yahtzee),
            12 => Ok(Category::Chance),
            _ => Err(format!("invalid category: {}", value)),
        }
    }
}

/// Result of scoring dice in a category
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScoringResult {
    pub category: Category,
    pub score: u16,
    pub valid: bool,
}

/// Probability and expected value for a category
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CategoryProbability {
    pub category: Category,
    pub probability: f64,
    pub expected_value: f64,
    pub current_score: u16,
}

/// Full probability analysis result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProbabilityResult {
    pub categories: Vec<CategoryProbability>,
    pub best_category: Category,
    pub best_ev: f64,
}
