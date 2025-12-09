//! Scoring categories and category sets.
//!
//! Dicee has 13 scoring categories, divided into upper and lower sections.
//! This module provides the [`Category`] enum and an efficient [`CategorySet`]
//! bitmask for tracking which categories are available.

use std::fmt;

use serde::{Deserialize, Serialize};

// =============================================================================
// CATEGORY ENUM
// =============================================================================

/// The 13 Dicee scoring categories.
#[derive(Clone, Copy, PartialEq, Eq, Hash, Debug, Serialize, Deserialize)]
#[repr(u8)]
pub enum Category {
    // Upper section (sum of matching dice)
    /// Sum of all 1s
    Ones = 0,
    /// Sum of all 2s
    Twos = 1,
    /// Sum of all 3s
    Threes = 2,
    /// Sum of all 4s
    Fours = 3,
    /// Sum of all 5s
    Fives = 4,
    /// Sum of all 6s
    Sixes = 5,

    // Lower section
    /// Sum of all dice if at least 3 match
    ThreeOfAKind = 6,
    /// Sum of all dice if at least 4 match
    FourOfAKind = 7,
    /// 25 points for 3 of one kind + 2 of another
    FullHouse = 8,
    /// 30 points for 4 consecutive values
    SmallStraight = 9,
    /// 40 points for 5 consecutive values
    LargeStraight = 10,
    /// 50 points for 5 of a kind
    Dicee = 11,
    /// Sum of all dice (always valid)
    Chance = 12,
}

impl Category {
    /// Total number of categories.
    pub const COUNT: usize = 13;

    /// All categories in order.
    pub const ALL: [Category; 13] = [
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
        Category::Dicee,
        Category::Chance,
    ];

    /// Upper section categories.
    pub const UPPER: [Category; 6] = [
        Category::Ones,
        Category::Twos,
        Category::Threes,
        Category::Fours,
        Category::Fives,
        Category::Sixes,
    ];

    /// Lower section categories.
    pub const LOWER: [Category; 7] = [
        Category::ThreeOfAKind,
        Category::FourOfAKind,
        Category::FullHouse,
        Category::SmallStraight,
        Category::LargeStraight,
        Category::Dicee,
        Category::Chance,
    ];

    /// Returns the category index (0-12).
    #[inline]
    pub const fn index(self) -> usize {
        self as usize
    }

    /// Creates a category from its index.
    ///
    /// Returns `None` if the index is out of range.
    #[inline]
    pub const fn from_index(index: usize) -> Option<Self> {
        if index < 13 {
            Some(Self::ALL[index])
        } else {
            None
        }
    }

    /// Returns true if this is an upper section category.
    #[inline]
    pub const fn is_upper(self) -> bool {
        (self as u8) < 6
    }

    /// Returns true if this is a lower section category.
    #[inline]
    pub const fn is_lower(self) -> bool {
        (self as u8) >= 6
    }

    /// Returns the target face value for upper section categories.
    ///
    /// Returns `None` for lower section categories.
    #[inline]
    pub const fn upper_face(self) -> Option<u8> {
        if self.is_upper() {
            Some((self as u8) + 1)
        } else {
            None
        }
    }

    /// Returns the fixed score for this category, if applicable.
    ///
    /// - Full House: 25
    /// - Small Straight: 30
    /// - Large Straight: 40
    /// - Dicee: 50
    /// - Others: None (score depends on dice)
    #[inline]
    pub const fn fixed_score(self) -> Option<u8> {
        match self {
            Category::FullHouse => Some(25),
            Category::SmallStraight => Some(30),
            Category::LargeStraight => Some(40),
            Category::Dicee => Some(50),
            _ => None,
        }
    }

    /// Returns the bit mask for this category in a `CategorySet`.
    #[inline]
    pub const fn mask(self) -> u16 {
        1u16 << (self as u8)
    }

    /// Iterator over all categories.
    #[inline]
    pub fn iter_all() -> impl Iterator<Item = Self> + ExactSizeIterator {
        Self::ALL.iter().copied()
    }
}

impl fmt::Display for Category {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let name = match self {
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
            Category::Dicee => "Dicee",
            Category::Chance => "Chance",
        };
        write!(f, "{name}")
    }
}

// =============================================================================
// CATEGORY SET
// =============================================================================

/// A set of categories represented as a bitmask.
///
/// Uses a 16-bit integer where bit i represents category i.
/// This allows O(1) membership testing and efficient iteration.
///
/// # Examples
///
/// ```rust
/// use dicee_engine::core::category::{Category, CategorySet};
///
/// let mut available = CategorySet::all();
/// assert!(available.contains(Category::Dicee));
///
/// available.remove(Category::Dicee);
/// assert!(!available.contains(Category::Dicee));
/// assert_eq!(available.len(), 12);
/// ```
#[derive(Clone, Copy, PartialEq, Eq, Hash, Default, Serialize, Deserialize)]
#[repr(transparent)]
pub struct CategorySet {
    bits: u16,
}

impl CategorySet {
    /// The bitmask for all 13 categories.
    const ALL_MASK: u16 = (1u16 << 13) - 1; // 0x1FFF

    /// An empty set with no categories.
    pub const EMPTY: Self = Self { bits: 0 };

    /// Creates an empty category set.
    #[inline]
    pub const fn new() -> Self {
        Self::EMPTY
    }

    /// Creates a set containing all 13 categories.
    #[inline]
    pub const fn all() -> Self {
        Self {
            bits: Self::ALL_MASK,
        }
    }

    /// Creates a set containing only upper section categories.
    #[inline]
    pub const fn upper_only() -> Self {
        Self {
            bits: 0b0000_0011_1111,
        }
    }

    /// Creates a set containing only lower section categories.
    #[inline]
    pub const fn lower_only() -> Self {
        Self {
            bits: 0b0001_1111_1100_0000,
        }
    }

    /// Creates a category set from a raw bitmask.
    ///
    /// Only the lower 13 bits are used.
    #[inline]
    pub const fn from_bits(bits: u16) -> Self {
        Self {
            bits: bits & Self::ALL_MASK,
        }
    }

    /// Returns the raw bitmask.
    #[inline]
    pub const fn bits(self) -> u16 {
        self.bits
    }

    /// Returns the number of categories in the set.
    #[inline]
    pub const fn len(self) -> usize {
        self.bits.count_ones() as usize
    }

    /// Returns true if the set is empty.
    #[inline]
    pub const fn is_empty(self) -> bool {
        self.bits == 0
    }

    /// Returns true if the set contains all 13 categories.
    #[inline]
    pub const fn is_full(self) -> bool {
        self.bits == Self::ALL_MASK
    }

    /// Returns true if the set contains the given category.
    #[inline]
    pub const fn contains(self, category: Category) -> bool {
        (self.bits & category.mask()) != 0
    }

    /// Adds a category to the set.
    #[inline]
    pub fn insert(&mut self, category: Category) {
        self.bits |= category.mask();
    }

    /// Removes a category from the set.
    #[inline]
    pub fn remove(&mut self, category: Category) {
        self.bits &= !category.mask();
    }

    /// Returns a new set with the category added.
    #[inline]
    pub const fn with(self, category: Category) -> Self {
        Self {
            bits: self.bits | category.mask(),
        }
    }

    /// Returns a new set with the category removed.
    #[inline]
    pub const fn without(self, category: Category) -> Self {
        Self {
            bits: self.bits & !category.mask(),
        }
    }

    /// Returns the union of two sets.
    #[inline]
    pub const fn union(self, other: Self) -> Self {
        Self {
            bits: self.bits | other.bits,
        }
    }

    /// Returns the intersection of two sets.
    #[inline]
    pub const fn intersection(self, other: Self) -> Self {
        Self {
            bits: self.bits & other.bits,
        }
    }

    /// Returns the complement (all categories not in this set).
    #[inline]
    pub const fn complement(self) -> Self {
        Self {
            bits: (!self.bits) & Self::ALL_MASK,
        }
    }

    /// Iterates over categories in the set.
    #[inline]
    pub fn iter(self) -> CategorySetIter {
        CategorySetIter { bits: self.bits }
    }
}

impl fmt::Debug for CategorySet {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "CategorySet({:013b})", self.bits)
    }
}

impl fmt::Display for CategorySet {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{{")?;
        let mut first = true;
        for cat in self.iter() {
            if !first {
                write!(f, ", ")?;
            }
            write!(f, "{cat}")?;
            first = false;
        }
        write!(f, "}}")
    }
}

impl FromIterator<Category> for CategorySet {
    fn from_iter<I: IntoIterator<Item = Category>>(iter: I) -> Self {
        let mut set = Self::EMPTY;
        for cat in iter {
            set.insert(cat);
        }
        set
    }
}

impl IntoIterator for CategorySet {
    type Item = Category;
    type IntoIter = CategorySetIter;

    fn into_iter(self) -> Self::IntoIter {
        self.iter()
    }
}

// =============================================================================
// CATEGORY SET ITERATOR
// =============================================================================

/// Iterator over categories in a `CategorySet`.
#[derive(Clone, Debug)]
pub struct CategorySetIter {
    bits: u16,
}

impl Iterator for CategorySetIter {
    type Item = Category;

    fn next(&mut self) -> Option<Self::Item> {
        if self.bits == 0 {
            return None;
        }

        // Find the lowest set bit
        let index = self.bits.trailing_zeros() as usize;
        // Clear that bit
        self.bits &= self.bits - 1;

        Category::from_index(index)
    }

    fn size_hint(&self) -> (usize, Option<usize>) {
        let count = self.bits.count_ones() as usize;
        (count, Some(count))
    }
}

impl ExactSizeIterator for CategorySetIter {}

// =============================================================================
// TESTS
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_category_count() {
        assert_eq!(Category::COUNT, 13);
        assert_eq!(Category::ALL.len(), 13);
    }

    #[test]
    fn test_category_sections() {
        for cat in Category::UPPER {
            assert!(cat.is_upper());
            assert!(!cat.is_lower());
            assert!(cat.upper_face().is_some());
        }

        for cat in Category::LOWER {
            assert!(!cat.is_upper());
            assert!(cat.is_lower());
            assert!(cat.upper_face().is_none());
        }
    }

    #[test]
    fn test_fixed_scores() {
        assert_eq!(Category::FullHouse.fixed_score(), Some(25));
        assert_eq!(Category::SmallStraight.fixed_score(), Some(30));
        assert_eq!(Category::LargeStraight.fixed_score(), Some(40));
        assert_eq!(Category::Dicee.fixed_score(), Some(50));
        assert_eq!(Category::Chance.fixed_score(), None);
        assert_eq!(Category::Ones.fixed_score(), None);
    }

    #[test]
    fn test_category_set_all() {
        let all = CategorySet::all();
        assert_eq!(all.len(), 13);
        assert!(all.is_full());

        for cat in Category::ALL {
            assert!(all.contains(cat));
        }
    }

    #[test]
    fn test_category_set_operations() {
        let mut set = CategorySet::new();
        assert!(set.is_empty());

        set.insert(Category::Dicee);
        assert!(set.contains(Category::Dicee));
        assert_eq!(set.len(), 1);

        set.remove(Category::Dicee);
        assert!(!set.contains(Category::Dicee));
        assert!(set.is_empty());
    }

    #[test]
    fn test_category_set_iteration() {
        let set = CategorySet::all();
        let collected: Vec<_> = set.iter().collect();
        assert_eq!(collected.len(), 13);
    }

    #[test]
    fn test_category_set_complement() {
        let upper = CategorySet::upper_only();
        let lower = upper.complement();

        for cat in Category::UPPER {
            assert!(upper.contains(cat));
            assert!(!lower.contains(cat));
        }

        for cat in Category::LOWER {
            assert!(!upper.contains(cat));
            assert!(lower.contains(cat));
        }
    }
}
