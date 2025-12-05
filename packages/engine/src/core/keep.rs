//! Keep patterns and partial dice states (Layer 1).
//!
//! This module represents the decision of which dice to keep during a reroll.
//! A [`KeepPattern`] specifies how many dice of each face value to keep,
//! and a [`PartialDice`] represents the state after deciding what to keep.
//!
//! # Mathematical Background
//!
//! In position-based Yahtzee, there are 2^5 = 32 possible keep masks.
//! However, many masks are equivalent when considered as face-value counts.
//! For example, keeping positions {0, 2} when both show 3 is equivalent
//! to keeping positions {0, 3} if those show 3.
//!
//! By working with keep *patterns* (counts per face) instead of position masks,
//! we reduce the decision space and enable efficient probability computation.

use std::fmt;

use serde::{Deserialize, Serialize};

use super::config::DiceConfig;
use super::error::DiceeError;
use crate::Result;

// =============================================================================
// KEEP PATTERN
// =============================================================================

/// A pattern specifying how many dice of each face value to keep.
///
/// # Invariants
///
/// For a `KeepPattern` to be valid for a given `DiceConfig`:
/// - `kept[i] <= config.count(i+1)` for all i
/// - `kept.iter().sum() <= 5`
///
/// # Examples
///
/// ```rust
/// use dicee_engine::core::{DiceConfig, KeepPattern};
///
/// let config = DiceConfig::from_dice(&[3, 3, 3, 4, 5]);
///
/// // Keep all three 3s
/// let pattern = KeepPattern::from_counts([0, 0, 3, 0, 0, 0]).unwrap();
/// assert!(pattern.is_valid_for(&config));
///
/// // Can't keep four 3s when only three exist
/// let invalid = KeepPattern::from_counts([0, 0, 4, 0, 0, 0]).unwrap();
/// assert!(!invalid.is_valid_for(&config));
/// ```
#[derive(Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct KeepPattern {
    /// Count of dice to keep for each face value.
    kept: [u8; 6],
}

impl KeepPattern {
    /// Keep nothing (reroll all 5 dice).
    pub const KEEP_NONE: Self = Self { kept: [0; 6] };

    /// Keep everything (reroll nothing).
    pub const KEEP_ALL: Self = Self {
        kept: [5, 0, 0, 0, 0, 0],
    }; // Placeholder, must match config

    /// Creates a keep pattern from raw counts.
    ///
    /// Returns an error if total kept exceeds 5.
    pub fn from_counts(kept: [u8; 6]) -> Result<Self> {
        let total: u8 = kept.iter().sum();
        if total > 5 {
            return Err(DiceeError::InvalidKeepPattern {
                face: 0,
                requested: total,
                available: 5,
            });
        }
        Ok(Self { kept })
    }

    /// Creates a keep pattern that keeps all dice matching the configuration.
    pub fn keep_all(config: &DiceConfig) -> Self {
        Self {
            kept: *config.counts(),
        }
    }

    /// Returns the count of dice to keep for a given face value.
    #[inline]
    pub const fn count(&self, face: u8) -> u8 {
        self.kept[(face - 1) as usize]
    }

    /// Returns the raw kept counts array.
    #[inline]
    pub const fn counts(&self) -> &[u8; 6] {
        &self.kept
    }

    /// Returns the total number of dice to keep.
    #[inline]
    pub fn total_kept(&self) -> u8 {
        self.kept.iter().sum()
    }

    /// Returns the number of dice to reroll.
    #[inline]
    pub fn dice_to_roll(&self) -> u8 {
        5 - self.total_kept()
    }

    /// Checks if this pattern is valid for a given configuration.
    ///
    /// A pattern is valid if we don't try to keep more dice of any face
    /// than are actually present.
    pub fn is_valid_for(&self, config: &DiceConfig) -> bool {
        for face in 1..=6 {
            if self.count(face) > config.count(face) {
                return false;
            }
        }
        true
    }

    /// Validates this pattern against a configuration, returning an error if invalid.
    pub fn validate_for(&self, config: &DiceConfig) -> Result<()> {
        for face in 1..=6 {
            let requested = self.count(face);
            let available = config.count(face);
            if requested > available {
                return Err(DiceeError::InvalidKeepPattern {
                    face,
                    requested,
                    available,
                });
            }
        }
        Ok(())
    }

    /// Iterates over all valid keep patterns for a given configuration.
    ///
    /// For a configuration with counts [n₀, n₁, ..., n₅], this generates
    /// all patterns where kept[i] ∈ [0, nᵢ].
    pub fn iter_valid_for(config: &DiceConfig) -> impl Iterator<Item = Self> {
        KeepPatternIterator::new(config)
    }

    /// Returns the number of valid keep patterns for a configuration.
    ///
    /// This is ∏(nᵢ + 1) where nᵢ is the count of face i.
    pub fn count_valid_for(config: &DiceConfig) -> usize {
        config.counts().iter().map(|&c| (c + 1) as usize).product()
    }
}

impl fmt::Debug for KeepPattern {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "KeepPattern({:?})", self.kept)
    }
}

impl fmt::Display for KeepPattern {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let mut parts = Vec::new();
        for face in 1..=6 {
            let c = self.count(face);
            if c > 0 {
                parts.push(format!("{}x{}", c, face));
            }
        }
        if parts.is_empty() {
            write!(f, "keep none")
        } else {
            write!(f, "keep {}", parts.join(", "))
        }
    }
}

// =============================================================================
// KEEP PATTERN ITERATOR
// =============================================================================

/// Iterator over all valid keep patterns for a configuration.
struct KeepPatternIterator {
    /// Maximum count for each face (from the config).
    max_counts: [u8; 6],
    /// Current keep counts being iterated.
    current: [u8; 6],
    /// Whether we've finished iteration.
    done: bool,
}

impl KeepPatternIterator {
    fn new(config: &DiceConfig) -> Self {
        Self {
            max_counts: *config.counts(),
            current: [0; 6],
            done: false,
        }
    }
}

impl Iterator for KeepPatternIterator {
    type Item = KeepPattern;

    fn next(&mut self) -> Option<Self::Item> {
        if self.done {
            return None;
        }

        let result = KeepPattern { kept: self.current };

        // Increment like a mixed-radix counter
        let mut carry = true;
        for i in 0..6 {
            if carry {
                if self.current[i] < self.max_counts[i] {
                    self.current[i] += 1;
                    carry = false;
                } else {
                    self.current[i] = 0;
                }
            }
        }

        if carry {
            // Overflow means we've enumerated everything
            self.done = true;
        }

        Some(result)
    }

    fn size_hint(&self) -> (usize, Option<usize>) {
        if self.done {
            (0, Some(0))
        } else {
            // This is an upper bound; we don't track exact remaining count
            let total: usize = self.max_counts.iter().map(|&c| (c + 1) as usize).product();
            (0, Some(total))
        }
    }
}

// =============================================================================
// PARTIAL DICE
// =============================================================================

/// The state after deciding which dice to keep.
///
/// This represents "kept dice" + "number of dice to roll" — the input
/// to the transition probability calculation.
///
/// # Examples
///
/// ```rust
/// use dicee_engine::core::{DiceConfig, KeepPattern, PartialDice};
///
/// let config = DiceConfig::from_dice(&[2, 2, 3, 4, 4]);
/// let keep = KeepPattern::from_counts([0, 2, 0, 2, 0, 0]).unwrap(); // Keep 2s and 4s
///
/// let partial = PartialDice::new(config, keep).unwrap();
/// assert_eq!(partial.dice_to_roll(), 1); // Roll 1 die (the 3)
/// ```
#[derive(Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct PartialDice {
    /// The dice we're keeping.
    kept: KeepPattern,
}

impl PartialDice {
    /// Creates a new partial dice state.
    ///
    /// Returns an error if the keep pattern is invalid for the configuration.
    pub fn new(config: DiceConfig, keep: KeepPattern) -> Result<Self> {
        keep.validate_for(&config)?;
        Ok(Self { kept: keep })
    }

    /// Creates a partial dice state without validation.
    ///
    /// # Safety
    ///
    /// The caller must ensure `keep.is_valid_for(&config)`.
    pub const unsafe fn new_unchecked(keep: KeepPattern) -> Self {
        Self { kept: keep }
    }

    /// Creates a partial dice state representing keeping nothing (full reroll).
    pub const fn keep_none() -> Self {
        Self {
            kept: KeepPattern::KEEP_NONE,
        }
    }

    /// Creates a partial dice state representing keeping everything (no reroll).
    pub fn keep_all(config: &DiceConfig) -> Self {
        Self {
            kept: KeepPattern::keep_all(config),
        }
    }

    /// Returns the keep pattern.
    #[inline]
    pub const fn keep_pattern(&self) -> &KeepPattern {
        &self.kept
    }

    /// Returns the number of dice to reroll.
    #[inline]
    pub fn dice_to_roll(&self) -> u8 {
        self.kept.dice_to_roll()
    }

    /// Returns the count of kept dice showing a given face.
    #[inline]
    pub const fn kept_count(&self, face: u8) -> u8 {
        self.kept.count(face)
    }

    /// Returns the kept counts array.
    #[inline]
    pub const fn kept_counts(&self) -> &[u8; 6] {
        self.kept.counts()
    }

    /// Returns true if this represents keeping all dice (no reroll).
    #[inline]
    pub fn is_complete(&self) -> bool {
        self.kept.total_kept() == 5
    }

    /// Computes the configuration that results from keeping these dice
    /// and adding the given rolled dice counts.
    ///
    /// # Panics
    ///
    /// Panics if `rolled` doesn't sum to `self.dice_to_roll()`.
    pub fn combine_with_roll(&self, rolled: &[u8; 6]) -> DiceConfig {
        let rolled_sum: u8 = rolled.iter().sum();
        debug_assert_eq!(
            rolled_sum,
            self.dice_to_roll(),
            "Rolled dice count mismatch"
        );

        let mut counts = *self.kept.counts();
        for i in 0..6 {
            counts[i] += rolled[i];
        }

        unsafe { DiceConfig::from_counts_unchecked(counts) }
    }
}

impl fmt::Debug for PartialDice {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(
            f,
            "PartialDice {{ kept: {:?}, to_roll: {} }}",
            self.kept,
            self.dice_to_roll()
        )
    }
}

impl fmt::Display for PartialDice {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}, roll {}", self.kept, self.dice_to_roll())
    }
}

// =============================================================================
// TESTS
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_keep_none() {
        let keep = KeepPattern::KEEP_NONE;
        assert_eq!(keep.total_kept(), 0);
        assert_eq!(keep.dice_to_roll(), 5);
    }

    #[test]
    fn test_valid_keep_pattern() {
        let config = DiceConfig::from_dice(&[3, 3, 3, 4, 5]);
        let keep = KeepPattern::from_counts([0, 0, 3, 0, 0, 0]).unwrap();

        assert!(keep.is_valid_for(&config));
        assert_eq!(keep.total_kept(), 3);
        assert_eq!(keep.dice_to_roll(), 2);
    }

    #[test]
    fn test_invalid_keep_pattern() {
        let config = DiceConfig::from_dice(&[3, 3, 3, 4, 5]);
        let keep = KeepPattern::from_counts([0, 0, 4, 0, 0, 0]).unwrap();

        assert!(!keep.is_valid_for(&config));
    }

    #[test]
    fn test_keep_pattern_iteration() {
        // Config: [1, 2, 3, 3, 5] => counts = [1, 1, 2, 0, 1, 0]
        let config = DiceConfig::from_dice(&[1, 2, 3, 3, 5]);

        let patterns: Vec<_> = KeepPattern::iter_valid_for(&config).collect();

        // Valid patterns: (1+1) * (1+1) * (2+1) * (0+1) * (1+1) * (0+1) = 2*2*3*1*2*1 = 24
        let expected = KeepPattern::count_valid_for(&config);
        assert_eq!(patterns.len(), expected);
    }

    #[test]
    fn test_partial_dice_combine() {
        let config = DiceConfig::from_dice(&[2, 2, 3, 4, 4]);
        let keep = KeepPattern::from_counts([0, 2, 0, 2, 0, 0]).unwrap();
        let partial = PartialDice::new(config, keep).unwrap();

        // Roll 1 die, say we get a 6
        let rolled = [0u8, 0, 0, 0, 0, 1]; // one 6
        let result = partial.combine_with_roll(&rolled);

        // Should have: two 2s, two 4s, one 6
        assert_eq!(result.count(2), 2);
        assert_eq!(result.count(4), 2);
        assert_eq!(result.count(6), 1);
        assert_eq!(result.sum(), 2 + 2 + 4 + 4 + 6);
    }

    #[test]
    fn test_keep_all() {
        let config = DiceConfig::from_dice(&[1, 2, 3, 4, 5]);
        let keep = KeepPattern::keep_all(&config);
        let partial = PartialDice::new(config, keep).unwrap();

        assert!(partial.is_complete());
        assert_eq!(partial.dice_to_roll(), 0);
    }
}
