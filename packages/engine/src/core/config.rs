//! Canonical dice configuration representation (Layer 0).
//!
//! This module provides the foundational [`DiceConfig`] type that represents
//! dice as an unordered multiset of face values. This reduces the state space
//! from 7776 ordered outcomes to 252 canonical configurations.
//!
//! # Mathematical Background
//!
//! The number of configurations is given by the "stars and bars" formula:
//! C(6 + 5 - 1, 5) = C(10, 5) = 252
//!
//! Each configuration has a *multiplicity* — the number of ordered dice arrangements
//! that produce it. For example, [1,1,2,3,4] has multiplicity 5!/2! = 60, while
//! [1,1,1,1,1] has multiplicity 5!/5! = 1.
//!
//! The sum of all multiplicities equals 6^5 = 7776.

use std::fmt;

use serde::{Deserialize, Serialize};

use super::error::DiceeError;
use crate::{Dice, Result};

// =============================================================================
// CONFIGURATION INDEX
// =============================================================================

/// A validated index into the space of 252 canonical dice configurations.
///
/// This is a newtype wrapper around `u8` that guarantees the value is in [0, 252).
#[derive(Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
#[repr(transparent)]
pub struct ConfigIndex(u8);

impl ConfigIndex {
    /// The total number of canonical configurations.
    pub const COUNT: usize = 252;

    /// Creates a new `ConfigIndex` from a raw value, returning an error if out of range.
    #[inline]
    pub const fn new(index: u8) -> Result<Self> {
        if index < 252 {
            Ok(Self(index))
        } else {
            Err(DiceeError::InvalidConfigIndex(index))
        }
    }

    /// Creates a `ConfigIndex` without validation.
    ///
    /// # Safety
    ///
    /// The caller must ensure `index < 252`.
    #[inline]
    pub const unsafe fn new_unchecked(index: u8) -> Self {
        debug_assert!(index < 252);
        Self(index)
    }

    /// Returns the raw index value.
    #[inline]
    pub const fn get(self) -> u8 {
        self.0
    }

    /// Returns the raw index as usize for array indexing.
    #[inline]
    pub const fn as_usize(self) -> usize {
        self.0 as usize
    }

    /// Iterator over all valid configuration indices.
    #[inline]
    pub fn iter_all() -> impl Iterator<Item = Self> + ExactSizeIterator {
        (0..252).map(|i| Self(i))
    }
}

impl fmt::Debug for ConfigIndex {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "ConfigIndex({})", self.0)
    }
}

impl fmt::Display for ConfigIndex {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.0)
    }
}

// =============================================================================
// DICE CONFIGURATION
// =============================================================================

/// A canonical (unordered) representation of 5 dice.
///
/// Stored as counts of each face value: `counts[i]` = number of dice showing face `i+1`.
///
/// # Invariants
///
/// - `counts.iter().sum() == 5`
/// - All counts are in [0, 5]
///
/// # Examples
///
/// ```rust
/// use dicee_engine::core::DiceConfig;
///
/// // Dice showing [1, 3, 3, 4, 6]
/// let config = DiceConfig::from_dice(&[1, 3, 3, 4, 6]);
///
/// // Counts: one 1, zero 2s, two 3s, one 4, zero 5s, one 6
/// assert_eq!(config.count(1), 1);
/// assert_eq!(config.count(3), 2);
/// assert_eq!(config.count(5), 0);
/// ```
#[derive(Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct DiceConfig {
    /// Count of dice showing each face value.
    /// Index 0 = count of 1s, index 5 = count of 6s.
    counts: [u8; 6],
}

impl DiceConfig {
    /// A configuration with all zeros (invalid, but useful as a starting point).
    pub const ZERO: Self = Self { counts: [0; 6] };

    /// Creates a configuration from raw counts.
    ///
    /// Returns an error if the counts don't sum to 5 or contain invalid values.
    pub fn from_counts(counts: [u8; 6]) -> Result<Self> {
        let sum: u8 = counts.iter().sum();
        if sum != 5 {
            return Err(DiceeError::InvalidDieValue {
                value: sum,
                position: 0,
            });
        }
        Ok(Self { counts })
    }

    /// Creates a configuration from counts without validation.
    ///
    /// # Safety
    ///
    /// The caller must ensure the counts sum to 5.
    #[inline]
    pub const unsafe fn from_counts_unchecked(counts: [u8; 6]) -> Self {
        debug_assert!(counts[0] + counts[1] + counts[2] + counts[3] + counts[4] + counts[5] == 5);
        Self { counts }
    }

    /// Creates a configuration from an ordered dice array.
    ///
    /// This is the primary way to create a `DiceConfig` from user input.
    pub fn from_dice(dice: &Dice) -> Self {
        let mut counts = [0u8; 6];
        for &d in dice {
            debug_assert!((1..=6).contains(&d), "Die value must be 1-6");
            counts[(d - 1) as usize] += 1;
        }
        Self { counts }
    }

    /// Creates a configuration from an ordered dice array with validation.
    pub fn try_from_dice(dice: &Dice) -> Result<Self> {
        crate::validate_dice(dice)?;
        Ok(Self::from_dice(dice))
    }

    /// Returns the count of dice showing the given face value.
    ///
    /// # Panics
    ///
    /// Panics if `face` is not in [1, 6].
    #[inline]
    pub const fn count(&self, face: u8) -> u8 {
        debug_assert!(face >= 1 && face <= 6, "Face must be 1-6");
        self.counts[(face - 1) as usize]
    }

    /// Returns the raw counts array.
    #[inline]
    pub const fn counts(&self) -> &[u8; 6] {
        &self.counts
    }

    /// Computes the multiplicity: how many ordered dice produce this configuration.
    ///
    /// Formula: 5! / (n₁! × n₂! × ... × n₆!)
    pub fn multiplicity(&self) -> u32 {
        // 5! = 120
        let mut result = 120u32;
        for &c in &self.counts {
            result /= FACTORIALS[c as usize];
        }
        result
    }

    /// Returns the sum of all dice values.
    #[inline]
    pub fn sum(&self) -> u8 {
        self.counts[0]
            + 2 * self.counts[1]
            + 3 * self.counts[2]
            + 4 * self.counts[3]
            + 5 * self.counts[4]
            + 6 * self.counts[5]
    }

    /// Returns the maximum count of any single face value.
    #[inline]
    pub fn max_count(&self) -> u8 {
        *self.counts.iter().max().unwrap_or(&0)
    }

    /// Returns the face value (1-6) with the maximum count, or the highest if tied.
    pub fn mode_face(&self) -> u8 {
        let mut best_face = 6u8;
        let mut best_count = self.counts[5];
        for face in (1..=5).rev() {
            if self.counts[face - 1] >= best_count {
                best_count = self.counts[face - 1];
                best_face = face as u8;
            }
        }
        best_face
    }

    /// Returns true if all 5 dice show the same face (Yahtzee).
    #[inline]
    pub fn is_yahtzee(&self) -> bool {
        self.max_count() == 5
    }

    /// Returns true if the configuration contains a full house (3 of one, 2 of another).
    pub fn is_full_house(&self) -> bool {
        let mut has_three = false;
        let mut has_two = false;
        for &c in &self.counts {
            if c == 3 {
                has_three = true;
            } else if c == 2 {
                has_two = true;
            }
        }
        has_three && has_two
    }

    /// Converts this configuration to its canonical index.
    ///
    /// Uses combinatorial ranking based on stars-and-bars enumeration.
    pub fn to_index(&self) -> ConfigIndex {
        // We enumerate configurations in lexicographic order of counts.
        // This could be optimized with a precomputed lookup table.
        let mut index = 0u8;
        for config in Self::iter_all() {
            if config == *self {
                return ConfigIndex(index);
            }
            index += 1;
        }
        unreachable!("All valid configurations should be enumerable");
    }

    /// Creates a configuration from its canonical index.
    pub fn from_index(index: ConfigIndex) -> Self {
        ALL_CONFIGS[index.as_usize()]
    }

    /// Iterator over all 252 canonical configurations.
    pub fn iter_all() -> impl Iterator<Item = Self> + ExactSizeIterator {
        ALL_CONFIGS.iter().copied()
    }

    /// Produces a canonical ordered dice representation.
    ///
    /// The result is sorted in ascending order.
    pub fn to_dice(&self) -> Dice {
        let mut dice = [0u8; 5];
        let mut pos = 0;
        for face in 1..=6 {
            for _ in 0..self.count(face) {
                dice[pos] = face;
                pos += 1;
            }
        }
        dice
    }

    /// Returns the number of distinct face values present.
    pub fn distinct_faces(&self) -> u8 {
        self.counts.iter().filter(|&&c| c > 0).count() as u8
    }
}

impl fmt::Debug for DiceConfig {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "DiceConfig({:?})", self.to_dice())
    }
}

impl fmt::Display for DiceConfig {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let dice = self.to_dice();
        write!(
            f,
            "[{}, {}, {}, {}, {}]",
            dice[0], dice[1], dice[2], dice[3], dice[4]
        )
    }
}

// =============================================================================
// CONSTANTS
// =============================================================================

/// Factorial lookup table for n! where n ∈ [0, 5].
const FACTORIALS: [u32; 6] = [1, 1, 2, 6, 24, 120];

/// All 252 canonical configurations, precomputed.
///
/// Enumerated in lexicographic order by counts array.
pub static ALL_CONFIGS: [DiceConfig; 252] = generate_all_configs();

/// All multiplicities, indexed by configuration index.
pub static CONFIG_MULTIPLICITIES: [u32; 252] = generate_multiplicities();

/// Generate all configurations at compile time.
const fn generate_all_configs() -> [DiceConfig; 252] {
    let mut configs = [DiceConfig::ZERO; 252];
    let mut idx = 0;

    // Enumerate all ways to distribute 5 dice across 6 faces
    let mut c0 = 0u8;
    while c0 <= 5 {
        let mut c1 = 0u8;
        while c1 <= 5 - c0 {
            let mut c2 = 0u8;
            while c2 <= 5 - c0 - c1 {
                let mut c3 = 0u8;
                while c3 <= 5 - c0 - c1 - c2 {
                    let mut c4 = 0u8;
                    while c4 <= 5 - c0 - c1 - c2 - c3 {
                        let c5 = 5 - c0 - c1 - c2 - c3 - c4;
                        configs[idx] = DiceConfig {
                            counts: [c0, c1, c2, c3, c4, c5],
                        };
                        idx += 1;
                        c4 += 1;
                    }
                    c3 += 1;
                }
                c2 += 1;
            }
            c1 += 1;
        }
        c0 += 1;
    }

    configs
}

/// Generate multiplicities at compile time.
const fn generate_multiplicities() -> [u32; 252] {
    let mut mults = [0u32; 252];
    let configs = generate_all_configs();

    let mut i = 0;
    while i < 252 {
        let c = &configs[i].counts;
        // 5! / (c0! * c1! * c2! * c3! * c4! * c5!)
        let mut result = 120u32; // 5!
        let mut j = 0;
        while j < 6 {
            result /= FACTORIALS[c[j] as usize];
            j += 1;
        }
        mults[i] = result;
        i += 1;
    }

    mults
}

// =============================================================================
// TESTS
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_config_count() {
        assert_eq!(ALL_CONFIGS.len(), 252);
    }

    #[test]
    fn test_multiplicity_sum() {
        let total: u32 = CONFIG_MULTIPLICITIES.iter().sum();
        assert_eq!(total, 7776); // 6^5
    }

    #[test]
    fn test_from_dice_and_back() {
        let dice: Dice = [1, 3, 3, 4, 6];
        let config = DiceConfig::from_dice(&dice);
        let canonical = config.to_dice();
        // Should be sorted
        assert_eq!(canonical, [1, 3, 3, 4, 6]);
    }

    #[test]
    fn test_yahtzee_detection() {
        let yahtzee = DiceConfig::from_dice(&[3, 3, 3, 3, 3]);
        assert!(yahtzee.is_yahtzee());
        assert_eq!(yahtzee.multiplicity(), 1);

        let not_yahtzee = DiceConfig::from_dice(&[3, 3, 3, 3, 4]);
        assert!(!not_yahtzee.is_yahtzee());
    }

    #[test]
    fn test_full_house_detection() {
        let fh = DiceConfig::from_dice(&[2, 2, 5, 5, 5]);
        assert!(fh.is_full_house());

        let not_fh = DiceConfig::from_dice(&[2, 2, 5, 5, 6]);
        assert!(!not_fh.is_full_house());
    }

    #[test]
    fn test_index_roundtrip() {
        for config in DiceConfig::iter_all() {
            let index = config.to_index();
            let recovered = DiceConfig::from_index(index);
            assert_eq!(config, recovered);
        }
    }

    #[test]
    fn test_sum() {
        let config = DiceConfig::from_dice(&[1, 2, 3, 4, 5]);
        assert_eq!(config.sum(), 15);

        let all_sixes = DiceConfig::from_dice(&[6, 6, 6, 6, 6]);
        assert_eq!(all_sixes.sum(), 30);
    }

    #[test]
    fn test_specific_multiplicities() {
        // All same: 5!/5! = 1
        let yahtzee = DiceConfig::from_dice(&[4, 4, 4, 4, 4]);
        assert_eq!(yahtzee.multiplicity(), 1);

        // All different: 5!/1!^5 = 120
        let all_diff = DiceConfig::from_dice(&[1, 2, 3, 4, 5]);
        assert_eq!(all_diff.multiplicity(), 120);

        // Pair: 5!/(2!*1!*1!*1!) = 60
        let pair = DiceConfig::from_dice(&[1, 1, 2, 3, 4]);
        assert_eq!(pair.multiplicity(), 60);
    }
}

#[cfg(test)]
mod proptests {
    use super::*;
    use proptest::prelude::*;

    prop_compose! {
        fn arbitrary_dice()(
            d1 in 1u8..=6,
            d2 in 1u8..=6,
            d3 in 1u8..=6,
            d4 in 1u8..=6,
            d5 in 1u8..=6,
        ) -> Dice {
            [d1, d2, d3, d4, d5]
        }
    }

    proptest! {
        #[test]
        fn prop_config_sum_invariant(dice in arbitrary_dice()) {
            let config = DiceConfig::from_dice(&dice);
            let count_sum: u8 = config.counts().iter().sum();
            prop_assert_eq!(count_sum, 5);
        }

        #[test]
        fn prop_dice_sum_matches(dice in arbitrary_dice()) {
            let config = DiceConfig::from_dice(&dice);
            let direct_sum: u8 = dice.iter().sum();
            prop_assert_eq!(config.sum(), direct_sum);
        }

        #[test]
        fn prop_index_in_range(dice in arbitrary_dice()) {
            let config = DiceConfig::from_dice(&dice);
            let index = config.to_index();
            prop_assert!(index.get() < 252);
        }
    }
}
