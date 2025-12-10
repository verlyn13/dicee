# ADR-004: WASM API Versioning Policy

**Project:** Dicee — Statistical Engine Upgrade (M1-M4)
**ADR Status:** Accepted
**Version:** 1.1
**Date:** December 5, 2025
**Authors:** Engineering Team
**Reviewers:** Approved via implementation

---

## Document Status & Versioning

| Version | Date | Changes | Status |
|---------|------|---------|--------|
| 1.0 | 2025-12-05 | Initial ADR | Superseded |
| 1.1 | 2025-12-05 | Phase 5a implemented, status Accepted | Current |

**Related Documents:**
- ADR-001: Canonical Configuration Model (prerequisite)
- ADR-002: Transition Probability Strategy (prerequisite)
- ADR-003: Solver Algorithm Selection (prerequisite)
- RFC-001: Statistical Engine Architecture
- Workflow: `.claude/workflows/dicee-m1-m4.yaml` (DICEE-011, DICEE-012)

---

## Abstract

This ADR documents the decision to use an **additive migration strategy** for the WASM API, adding new solver-based exports while maintaining full backward compatibility with existing exports during a deprecation period.

---

## Context

### Current WASM API (MVP)

The existing engine exposes 4 WASM functions:

```typescript
// Current API (lib.rs lines 68-122)
score_category(dice: Uint8Array, category: number): ScoringResult
calculate_probabilities(dice: Uint8Array, kept: Uint8Array, rolls: number): ProbabilityResult
score_all_categories(dice: Uint8Array): ScoringResult[]
get_categories(): CategoryInfo[]
```

**Characteristics:**
- Uses ordered dice arrays `[u8; 5]`
- Position-based keep mask `[bool; 5]`
- Returns probability distributions, not optimal decisions
- No concept of available categories (full scorecard assumed)

### New Capability: Solver API

With the completion of Phase 4, the engine now supports:

- **Canonical configurations**: 252 unordered states (ADR-001)
- **Transition probabilities**: Precomputed matrix (ADR-002)
- **Optimal decisions**: Backward induction solver (ADR-003)

The solver provides:
```rust
pub struct TurnAnalysis {
    pub state: TurnState,
    pub available: CategorySet,
    pub category_values: Vec<CategoryValue>,
    pub best_immediate: Option<(Category, u8)>,
    pub continue_value: f64,
    pub optimal_keep: KeepPattern,
    pub recommendation: Action,  // Score or Reroll
    pub expected_value: f64,
}
```

### Problem Statement

The frontend currently uses `calculate_probabilities()` but needs:
1. Optimal keep recommendations (which dice to keep)
2. Stop/continue decisions (score now vs. reroll)
3. Category-specific expected values
4. Support for partial scorecards (unavailable categories)

**Question:** How do we expose the new solver capabilities while maintaining compatibility with the existing frontend?

---

## Decision

**We will use an additive migration strategy with controlled deprecation.**

### Phase 5a: Add New Exports (Additive Only)

Add new WASM functions WITHOUT modifying or removing existing ones:

```rust
// NEW: Primary solver interface
#[wasm_bindgen]
pub fn analyze_turn(
    dice: &[u8],              // [u8; 5] dice values
    rolls_remaining: u8,       // 0, 1, or 2
    available_categories: u16, // Bitmask of available categories
) -> Result<JsValue, JsValue>

// NEW: Enhanced scoring with expected values
#[wasm_bindgen]
pub fn score_with_ev(
    dice: &[u8],
    rolls_remaining: u8,
    available_categories: u16,
) -> Result<JsValue, JsValue>
```

### Return Type: TurnAnalysisJs

```typescript
interface TurnAnalysisJs {
    // Recommended action
    action: 'score' | 'reroll';

    // If action === 'score'
    recommended_category?: number;  // Category index (0-12)
    category_score?: number;        // Immediate score

    // If action === 'reroll'
    keep_pattern?: number[];        // [count_1s, count_2s, ..., count_6s]
    keep_explanation?: string;      // Human-readable explanation

    // Always present
    expected_value: number;         // EV of optimal play

    // Category analysis (all available categories)
    categories: CategoryAnalysisJs[];
}

interface CategoryAnalysisJs {
    category: number;           // Category index
    immediate_score: number;    // Score if scored now
    is_valid: boolean;          // Meets category requirements
    expected_value: number;     // EV if we optimize for this category
}
```

### Bitmask Convention for Available Categories

```
Bit 0:  Ones           (0x0001)
Bit 1:  Twos           (0x0002)
Bit 2:  Threes         (0x0004)
Bit 3:  Fours          (0x0008)
Bit 4:  Fives          (0x0010)
Bit 5:  Sixes          (0x0020)
Bit 6:  ThreeOfAKind   (0x0040)
Bit 7:  FourOfAKind    (0x0080)
Bit 8:  FullHouse      (0x0100)
Bit 9:  SmallStraight  (0x0200)
Bit 10: LargeStraight  (0x0400)
Bit 11: Dicee        (0x0800)
Bit 12: Chance         (0x1000)

All categories: 0x1FFF (8191)
```

### Phase 5b-5d: Frontend Migration

1. **Feature Flag** (`VITE_ENABLE_NEW_ENGINE`)
   - Default: `false` (use old API)
   - Enables gradual rollout and A/B testing

2. **TypeScript Bridge Updates** (`packages/web/src/lib/engine.ts`)
   - Add `analyzeTurn()` wrapper function
   - Add type definitions for new return types
   - Maintain backward-compatible `calculateProbabilities()` wrapper

3. **Game Store Updates** (`packages/web/src/lib/stores/game.svelte.ts`)
   - Add reactive state for `TurnAnalysis`
   - Display keep recommendations in UI
   - Handle stop/continue decisions

### Deprecation Timeline

| Phase | Action | Timeline |
|-------|--------|----------|
| 5a | Add new exports | Immediate |
| 5b-5d | Frontend migration | 1-2 weeks |
| 6 | Mark old API deprecated | After frontend complete |
| 8 | Remove deprecated exports | 6 weeks after deprecation |

**Deprecation Markers:**
```rust
#[wasm_bindgen]
#[deprecated(since = "0.2.0", note = "Use analyze_turn instead")]
pub fn calculate_probabilities(...) -> Result<JsValue, JsValue> {
    // Log warning once per session
    // ... existing implementation
}
```

---

## Consequences

### Positive

1. **Zero-downtime migration**: Frontend continues working during transition
2. **Feature-flagged rollout**: Can A/B test new solver recommendations
3. **Incremental adoption**: Teams can migrate at their own pace
4. **Testable**: Both old and new APIs can run in parallel for validation

### Negative

1. **Temporary API bloat**: 6 exports during transition period (4 old + 2 new)
2. **Dual maintenance**: Must maintain both code paths until cleanup
3. **WASM size increase**: ~10-15KB additional for new exports

### Neutral

1. **Documentation overhead**: Must document both APIs during transition
2. **Test complexity**: Need tests for both API paths
3. **Frontend complexity**: Branching logic based on feature flag

---

## Alternatives Considered

### Alternative 1: Breaking Change (Replace API)

**Approach:** Remove old exports, add new ones. Version bump to 1.0.0.

**Pros:**
- Clean API surface
- No deprecation complexity
- Smaller WASM binary

**Cons:**
- Requires coordinated release (engine + frontend)
- Risk of production outage if misaligned
- Cannot A/B test new functionality

**Why rejected:** Risk of deployment failures outweighs simplicity benefits.

### Alternative 2: Dual APIs Forever

**Approach:** Maintain both old and new APIs indefinitely.

**Pros:**
- Maximum compatibility
- No migration pressure

**Cons:**
- Permanent maintenance burden
- Confusing API surface
- Larger WASM binary forever

**Why rejected:** Unnecessary complexity; clean deprecation is achievable.

### Alternative 3: Versioned Endpoints

**Approach:** Use `v1_calculate_probabilities()`, `v2_analyze_turn()` naming.

**Pros:**
- Explicit version in function name
- Can maintain multiple versions

**Cons:**
- Verbose function names
- Still need deprecation strategy
- JavaScript naming conventions prefer camelCase

**Why rejected:** Adds complexity without meaningful benefit over deprecation.

---

## Implementation Details

### New WASM Export Signatures

```rust
// lib.rs additions (Phase 5a)

use crate::core::category::CategorySet;
use crate::core::solver::TurnSolver;
use crate::core::turn::TurnState;

/// Analyze the current turn and return optimal strategy.
///
/// # Arguments
/// * `dice` - Array of 5 dice values (1-6)
/// * `rolls_remaining` - Number of rerolls left (0, 1, or 2)
/// * `available_categories` - Bitmask of available categories (0x1FFF = all)
///
/// # Returns
/// JSON-serialized TurnAnalysis with recommendation and expected values.
#[wasm_bindgen]
pub fn analyze_turn(
    dice: &[u8],
    rolls_remaining: u8,
    available_categories: u16,
) -> std::result::Result<JsValue, JsValue> {
    let dice = parse_dice(dice).map_err(JsValue::from_str)?;

    if rolls_remaining > 2 {
        return Err(JsValue::from_str("rolls_remaining must be 0, 1, or 2"));
    }

    let config = DiceConfig::from_dice(&dice);
    let state = TurnState::new(config, rolls_remaining);
    let available = CategorySet::from_bits(available_categories);

    let solver = TurnSolver::new();
    let analysis = solver.analyze(&state, &available);

    // Convert to JS-friendly format
    let js_analysis = TurnAnalysisJs::from(analysis);

    serde_wasm_bindgen::to_value(&js_analysis)
        .map_err(|e| JsValue::from_str(&e.to_string()))
}
```

### TypeScript Integration

```typescript
// packages/web/src/lib/engine.ts additions

export interface TurnAnalysis {
    action: 'score' | 'reroll';
    recommendedCategory?: Category;
    categoryScore?: number;
    keepPattern?: number[];  // [0,0,3,0,2,0] = keep three 3s and two 5s
    keepExplanation?: string;
    expectedValue: number;
    categories: CategoryAnalysis[];
}

export interface CategoryAnalysis {
    category: Category;
    immediateScore: number;
    isValid: boolean;
    expectedValue: number;
}

export async function analyzeTurn(
    dice: DiceArray,
    rollsRemaining: number,
    availableCategories: Category[]
): Promise<TurnAnalysis> {
    await ensureEngineInitialized();

    const bitmask = categoriesToBitmask(availableCategories);
    const result = analyze_turn(
        new Uint8Array(dice),
        rollsRemaining,
        bitmask
    );

    return parseTurnAnalysis(result);
}

function categoriesToBitmask(categories: Category[]): number {
    return categories.reduce((mask, cat) => mask | (1 << categoryIndex(cat)), 0);
}
```

---

## Validation Requirements

### Unit Tests (Rust)

```rust
#[test]
fn test_analyze_turn_wasm_export() {
    // Dicee with all categories available
    let result = analyze_turn(&[5,5,5,5,5], 2, 0x1FFF);
    assert!(result.is_ok());

    // Parse and validate recommendation is to score Dicee
}

#[test]
fn test_available_categories_bitmask() {
    // Only Dicee available
    let result = analyze_turn(&[3,3,3,3,1], 2, 0x0800);
    // Should recommend rerolling for Dicee
}

#[test]
fn test_invalid_inputs() {
    // Invalid dice value
    assert!(analyze_turn(&[7,1,1,1,1], 2, 0x1FFF).is_err());

    // Invalid rolls remaining
    assert!(analyze_turn(&[1,1,1,1,1], 3, 0x1FFF).is_err());
}
```

### Integration Tests (TypeScript)

```typescript
describe('analyzeTurn', () => {
    it('recommends scoring Dicee when available', async () => {
        const analysis = await analyzeTurn([5,5,5,5,5], 2, ALL_CATEGORIES);
        expect(analysis.action).toBe('score');
        expect(analysis.recommendedCategory).toBe('Dicee');
    });

    it('recommends rerolling with partial straight', async () => {
        const analysis = await analyzeTurn([1,2,3,4,6], 1, ['LargeStraight']);
        expect(analysis.action).toBe('reroll');
        expect(analysis.keepPattern).toEqual([1,1,1,1,0,0]); // Keep 1-4
    });
});
```

### Performance Benchmarks

| Metric | Target | Rationale |
|--------|--------|-----------|
| `analyze_turn` cold call | <50ms | First call initializes solver |
| `analyze_turn` warm call | <10ms | Cached transition table |
| WASM binary size delta | <20KB | Acceptable for new functionality |

---

## Migration Checklist

### Phase 5a (DICEE-012)
- [ ] Add `analyze_turn()` WASM export
- [ ] Add `TurnAnalysisJs` serialization struct
- [ ] Add input validation (dice values, rolls, bitmask)
- [ ] Add WASM-specific tests
- [ ] Verify WASM builds: `wasm-pack build --target web`
- [ ] Measure binary size delta

### Phase 5b (DICEE-013)
- [ ] Add feature flag `VITE_ENABLE_NEW_ENGINE`
- [ ] Add TypeScript type definitions
- [ ] Add `analyzeTurn()` wrapper function
- [ ] Add bitmask conversion utilities
- [ ] Test both API modes pass

### Phase 5c (DICEE-014)
- [ ] Update game store with analysis state
- [ ] Add keep recommendation UI component
- [ ] Integrate stop/continue decision flow
- [ ] Update all 15 critical frontend files

### Phase 5d (DICEE-015)
- [ ] Add deprecation warnings to old exports
- [ ] Update documentation
- [ ] Set removal timeline in changelog

---

## Decision Record

| Date | Author | Decision |
|------|--------|----------|
| 2025-12-05 | Engineering | ADR Proposed |
| 2025-12-05 | Engineering | Phase 5a implemented: `analyze_turn` WASM export added |

**Status:** Accepted. Phase 5a implementation complete with 110 passing tests.

---

## Questions for Review

1. **Deprecation timeline**: Is 6 weeks after marking deprecated sufficient, or should we extend?

2. **Feature flag scope**: Should the feature flag be per-function or global for all new APIs?

3. **Keep pattern format**: Should we return position-based `[bool; 5]` for compatibility, or face-count `[u8; 6]` for efficiency?

4. **Error handling**: Should WASM errors return structured JSON or string messages?
