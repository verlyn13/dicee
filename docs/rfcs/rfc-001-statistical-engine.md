# RFC-001: Statistical Engine Architecture
**Project:** Dicee — Educational Probability Platform  
**RFC Status:** Draft → Review → Accepted  
**Version:** 2.0  
**Date:** October 25, 2025  
**Authors:** Engineering Team  
**Reviewers:** TBD

---

## Document Status & Versioning

| Version | Date | Changes | Status |
|---------|------|---------|--------|
| 1.0 | 2025-10-25 | Initial architecture draft | Superseded |
| 2.0 | 2025-10-25 | RFC format, service contracts, math spec, API tables | Current |

**Related RFCs:**
- RFC-002: Educational Alignment & Curriculum Integration (TBD)
- RFC-003: Data Contracts & Event Schema (TBD)
- RFC-004: Frontend-Backend Integration Contract (TBD)
- RFC-005: Adaptive Learning Model Specification (TBD)

---

## Abstract

This RFC specifies the architecture, algorithms, and implementation plan for the **Dicee Statistical Engine**, the mathematical core that transforms Dicee from a casual dice game into an educational instrument for teaching probability, expected value, and optimal decision-making. The engine provides real-time probabilistic analysis with <100ms latency, adaptive complexity scaling for learners from middle school to advanced, and mathematically guaranteed correctness.

**Key Innovation:** Event-sourced statistical observability pipeline that captures every micro-decision, enabling unprecedented insight into probabilistic thinking development.

---

## M1-M4 Implementation Scope

> **IMPORTANT**: This RFC describes the full v2.0 target architecture. The current M1-M4 implementation focuses exclusively on the **client-side WASM probability engine** with local solver capabilities. Backend services are planned for later phases.

### What M1-M4 Implements (Current Scope)

| Layer | Component | M1-M4 Status | Description |
|-------|-----------|--------------|-------------|
| Layer 0 | `DiceConfig` | ✅ Implemented | 252 canonical configurations (ADR-001) |
| Layer 1 | `TransitionTable` | ✅ Implemented | Precomputed transition probabilities (ADR-002) |
| Layer 2 | `TurnSolver` | ✅ Implemented | Memoized backward induction solver (ADR-003) |
| Layer 3 | WASM API | ✅ Phase 5a Complete | `analyze_turn()` export with solver integration (ADR-004) |
| - | Frontend | ⏳ Phase 5b Pending | Feature-flagged migration to new API |

### What M1-M4 Does NOT Implement (Deferred)

| Component | Status | Notes |
|-----------|--------|-------|
| API Gateway (Bun) | 🚫 Deferred | v2.0 - Backend orchestration |
| Decision Analyzer Service | 🚫 Deferred | Replaced by local WASM solver |
| Monte Carlo Simulator | 🚫 Deferred | v2.0 - Validation service |
| Learning Tracker | 🚫 Deferred | v2.0 - Skill assessment |
| PostgreSQL Event Store | 🚫 Deferred | v2.0 - Analytics storage |
| Redis Caching | 🚫 Deferred | v2.0 - Server-side cache |

### Architectural Rationale

**Why WASM-Only for M1-M4:**

1. **Zero-latency calculations**: All probability and solver computations run client-side (<20ms P95)
2. **No infrastructure complexity**: No servers to deploy, monitor, or scale
3. **Offline capable**: Engine works without network connectivity
4. **Reduced costs**: No server costs during MVP validation phase
5. **Iteration speed**: Faster development without backend coordination

**Future Architecture (v2.0+):**

The full architecture described in Section 2 (hybrid microservices) becomes relevant when:
- Multi-player synchronization requires server authority
- Learning analytics need persistent storage
- Monte Carlo validation needs GPU acceleration
- Cross-player skill comparisons are introduced

### Related ADRs

- **ADR-001**: Canonical Configuration Model (252 configs) — Accepted
- **ADR-002**: Transition Probability Strategy (lazy precomputation) — Accepted
- **ADR-003**: Solver Algorithm Selection (backward induction) — Accepted
- **ADR-004**: WASM API Versioning Policy (additive migration) — Accepted
- **ADR-005**: Property-Based Testing Requirements — Planned (Phase 6)

### Workflow Reference

Implementation tasks are tracked in `.claude/workflows/dicee-m1-m4.yaml` with 28 machine-readable task specifications (DICEE-001 through DICEE-028).

---

## Table of Contents

1. [Motivation & Design Goals](#1-motivation--design-goals)
2. [System Architecture](#2-system-architecture)
3. [Service Contracts & Boundaries](#3-service-contracts--boundaries)
4. [Domain Mathematics Specification](#4-domain-mathematics-specification)
5. [API Specification](#5-api-specification)
6. [Core Data Models](#6-core-data-models)
7. [Algorithms & Complexity Analysis](#7-algorithms--complexity-analysis)
8. [Data Validation & Correctness Guarantees](#8-data-validation--correctness-guarantees)
9. [Performance & Scalability](#9-performance--scalability)
10. [Security & Fair Play](#10-security--fair-play)
11. [Testing & Validation Strategy](#11-testing--validation-strategy)
12. [Implementation Roadmap](#12-implementation-roadmap)
13. [Sample Execution Trace](#13-sample-execution-trace)
14. [Research References](#14-research-references)
15. [Appendices](#15-appendices)

---

## 1. Motivation & Design Goals

### 1.1 Problem Statement

Existing probability education tools suffer from three critical weaknesses:

1. **Abstraction Gap** — Probability is taught through abstract examples (coin flips, urns) that don't engage learners emotionally or strategically
2. **Passive Learning** — Students observe probabilities but don't make consequential decisions based on them
3. **No Feedback Loop** — Learners cannot measure their probabilistic reasoning quality or track improvement

**Dicee's Solution:** Transform Dicee (a familiar, engaging game) into a statistical laboratory where every decision generates immediate, measurable feedback on probabilistic thinking quality.

### 1.2 Design Principles

**Principle 1: Educational Transparency**  
Every statistical calculation must be explainable, traceable, and verifiable. No "black box" recommendations.

**Principle 2: Performance as Pedagogy**  
Statistical feedback must feel instantaneous (<100ms) to maintain flow state and enable rapid experimentation.

**Principle 3: Progressive Complexity**  
Statistical presentation adapts from simple percentages (beginner) to mathematical proofs (expert) based on demonstrated mastery.

**Principle 4: Correctness Over Approximation**  
When exact calculation is feasible, use exact methods. Monte Carlo is for validation and edge cases, not primary computation.

**Principle 5: Observable Learning**  
Every decision generates rich telemetry enabling unprecedented insight into probabilistic reasoning development.

### 1.3 Non-Goals

This system explicitly **does not**:
- Teach Dicee rules (assumed prerequisite)
- Provide general statistics education (focused on decision-making)
- Support real-money gambling (educational only)
- Replace human teachers (augmentation, not replacement)

### 1.4 Success Criteria

**Technical:**
- P95 latency <100ms for all probability calculations
- >99.9% accuracy vs. theoretical values
- Zero critical correctness bugs in production

**Educational:**
- Average player decision quality improves >15% over 20 games
- >60% of beginners achieve optimal play after 10 games
- >70% of players view post-game statistical analysis

---

## 2. System Architecture

### 2.1 High-Level Architecture

The Statistical Engine employs a **hybrid microservices architecture** with three computational tiers:

```
┌──────────────────────────────────────────────────────────────────┐
│                    Client (Browser / Mobile)                      │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │         Probability Engine (WASM)                          │  │
│  │  • Exact single-roll probabilities                         │  │
│  │  • Lookup table (70K pre-computed states)                  │  │
│  │  • Zero network latency                                    │  │
│  │  • Runs at 60fps during UI interactions                   │  │
│  └────────────────────────────────────────────────────────────┘  │
│                            ↕                                      │
└────────────────────────────┼───────────────────────────────────────┘
                             │ WebSocket / REST
┌────────────────────────────┼───────────────────────────────────────┐
│                    API Gateway (Bun)                              │
│  • Request routing                                                │
│  • Rate limiting (100 req/s per user)                            │
│  • Response caching (Redis)                                       │
│  • Failure orchestration                                          │
└────────────────────────────┬───────────────────────────────────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
┌───────▼──────────┐  ┌──────▼──────────┐  ┌────▼──────────────┐
│ Decision Analyzer│  │ Monte Carlo     │  │ Learning Tracker  │
│ (Bun/TypeScript) │  │ Simulator       │  │ (Python/FastAPI)  │
│                  │  │ (Python/Numba)  │  │                   │
│ • EV calculation │  │ • 100K+ sims    │  │ • Skill profiling │
│ • Optimal moves  │  │ • GPU-accel     │  │ • Progress track  │
│ • Recommendations│  │ • Validation    │  │ • Adaptivity      │
│ • Real-time      │  │ • Background    │  │ • Eventually      │
│   (<50ms)        │  │   (200-500ms)   │  │   consistent      │
└──────────────────┘  └─────────────────┘  └───────────────────┘
        │                    │                    │
        └────────────────────┼────────────────────┘
                             │
                ┌────────────▼────────────┐
                │    Event Store          │
                │  PostgreSQL 16 + Redis  │
                │                         │
                │  • Game events (append) │
                │  • Stats cache (TTL)    │
                │  • Materialized views   │
                └─────────────────────────┘
```

### 2.2 Architectural Rationale

**Why Hybrid (Client + Server)?**
- **Client-side WASM:** Zero-latency for 90% of common calculations
- **Server-side Services:** Heavy computation, cross-player analytics, data persistence

**Why Microservices?**
- **Independent scaling:** Monte Carlo needs more CPU, Learning Tracker more memory
- **Technology specialization:** Rust for speed, Python for scientific computing
- **Failure isolation:** One service failing doesn't crash entire system

**Why Event Sourcing?**
- **Temporal queries:** "Show me all games where player chose suboptimally"
- **Replay capability:** Debug decision recommendations by replaying game state
- **Analytics foundation:** Every decision point captured for learning science research

### 2.3 Data Flow Diagram

**Critical Path (Real-Time Calculation):**

```
User rolls dice
    ↓
Frontend captures: [5,5,5,2,6]
    ↓
WASM Engine: Calculate P(categories)
    ├─→ Cache hit? Return in 3ms
    └─→ Cache miss? Compute in 15ms
    ↓
Display probabilities in UI
    ↓
User hovers "Full House"
    ↓
Decision Analyzer: Calculate EV
    ├─→ Simple state? Return in 8ms
    └─→ Complex state? Query Monte Carlo (200ms, show loading)
    ↓
Display recommendation
    ↓
User scores category
    ↓
Write ScoreDecisionEvent
    ↓
Learning Tracker: Update skill profile (async, 50ms)
    ↓
Return feedback: "Optimal decision! +0.2 EV vs expected"
```

**Total Latency Budget:**
- WASM calculation: 15ms (P95)
- Network RTT: 20ms (P95)
- Decision Analyzer: 30ms (P95)
- Database write: 10ms (P95)
- **Total: 75ms** (within 100ms SLA)

---

## 3. Service Contracts & Boundaries

### 3.1 Probability Engine (WASM/Rust)

**Purpose:** Ultra-fast exact probability calculations for common game states

**Guarantees:**
- ✅ Calculations are mathematically exact (not approximations)
- ✅ Deterministic: same input always produces same output
- ✅ Results always sum to ≤1.0 (probability axioms)
- ✅ Latency <20ms (P95) for any single calculation

**Refuses To:**
- ❌ Handle states requiring >10M enumeration iterations
- ❌ Persist data (stateless computation only)
- ❌ Perform Monte Carlo simulation (different service)

**Dependencies:**
- None (fully self-contained)

**Failure Modes:**
- **Invalid input** → Returns error immediately (no fallback)
- **WASM module load failure** → Frontend falls back to server-side Decision Analyzer
- **Out of memory** → Cannot occur (max stack size: 1MB for 5-dice calculation)

**API Surface:**

```typescript
interface ProbabilityEngineWASM {
  // Primary calculation method
  calculateProbabilities(
    dice: Uint8Array,        // [1-6, 1-6, 1-6, 1-6, 1-6]
    keptMask: Uint8Array,    // [0/1, 0/1, 0/1, 0/1, 0/1]
    rollsLeft: number        // 0-3
  ): ProbabilityVector | Error;
  
  // Lookup table query (fast path)
  lookupProbabilities(
    stateKey: string
  ): ProbabilityVector | null;
  
  // Cache statistics
  getCacheStats(): {
    size: number;
    hitRate: number;
    coverage: number;
  };
}
```

**Service Contract:**

| Input Constraint | Behavior |
|------------------|----------|
| dice.length ≠ 5 | Reject with ValidationError |
| dice[i] ∉ [1,6] | Reject with ValidationError |
| keptMask.length ≠ 5 | Reject with ValidationError |
| rollsLeft ∉ [0,3] | Reject with ValidationError |
| Valid inputs | Return ProbabilityVector in <20ms |

---

### 3.2 Decision Analyzer (Bun/TypeScript)

**Purpose:** Real-time expected value calculation and decision recommendations

**Guarantees:**
- ✅ Provides optimal (highest EV) decision recommendation
- ✅ Includes human-readable reasoning for recommendation
- ✅ Returns alternative strategies with EV differences
- ✅ Latency <100ms (P95) including explanation generation

**Refuses To:**
- ❌ Return recommendations without EV calculation
- ❌ Suggest illegal moves (already-used categories)
- ❌ Generate explanations longer than 200 chars (UX constraint)

**Dependencies:**
- Probability Engine (WASM) for base probabilities
- Monte Carlo Simulator (optional, for validation)
- Redis (for memoization cache)

**Failure Modes:**
- **Probability Engine unavailable** → Falls back to pre-computed heuristics
- **Redis cache miss** → Compute fresh (slower but correct)
- **Monte Carlo timeout** → Return best-effort EV estimate
- **LLM explanation failure** → Return template explanation

**Fallback Cascade:**

```
Decision Analyzer
    ↓ (fails)
Cached EV lookup
    ↓ (cache miss)
Monte Carlo estimation (500ms timeout)
    ↓ (timeout)
Heuristic-based recommendation
    ↓ (all else fails)
"Unable to provide recommendation"
```

**API Surface:**

```typescript
interface DecisionAnalyzer {
  // Calculate EV for all available actions
  calculateEV(
    gameState: GameState
  ): Promise<EVComparison>;
  
  // Get optimal decision with reasoning
  getRecommendation(
    gameState: GameState,
    explanationDepth: 'simple' | 'detailed' | 'expert'
  ): Promise<DecisionRecommendation>;
  
  // Evaluate user's decision quality
  evaluateDecision(
    gameState: GameState,
    chosenAction: Action
  ): Promise<DecisionQualityScore>;
}
```

---

### 3.3 Monte Carlo Simulator (Python/Numba)

**Purpose:** Heavy-duty statistical simulation for validation and edge cases

**Guarantees:**
- ✅ Results converge to theoretical values within specified confidence level
- ✅ Parallelized across all CPU cores
- ✅ Deterministic given same random seed
- ✅ Configurable iteration count (10K - 10M)

**Refuses To:**
- ❌ Run simulations with <1,000 iterations (statistically meaningless)
- ❌ Block critical path (async only)
- ❌ Consume >80% CPU (resource limit)

**Dependencies:**
- NumPy, Numba JIT compiler
- Optional: CUDA for GPU acceleration

**Failure Modes:**
- **Numba compilation failure** → Falls back to pure Python (slower)
- **Out of memory** → Reduces batch size automatically
- **Timeout (>5s)** → Returns partial results with warning

**API Surface:**

```python
class MonteCarloSimulator:
    def simulate(
        self,
        scenario: GameState,
        target_category: str,
        iterations: int = 100_000,
        confidence_level: float = 0.95
    ) -> SimulationResult:
        """
        Run Monte Carlo simulation
        
        Returns:
            SimulationResult with:
            - probability: float
            - confidence_interval: (lower, upper)
            - actual_iterations: int (may be less if timeout)
        """
```

---

### 3.4 Learning Tracker (Python/FastAPI)

**Purpose:** Track player skill progression and adapt statistical presentation

**Guarantees:**
- ✅ Skill ratings converge within 20 games
- ✅ Detects error patterns with >80% accuracy
- ✅ Eventually consistent (async updates acceptable)
- ✅ Privacy-preserving (no PII in analytics)

**Refuses To:**
- ❌ Block real-time gameplay (async only)
- ❌ Change skill rating mid-game (stability)
- ❌ Share individual player data cross-account

**Dependencies:**
- PostgreSQL (persistent storage)
- Redis (skill profile cache)
- scikit-learn (skill classification)

**Failure Modes:**
- **Database unavailable** → Queues updates in Redis
- **Skill calculation error** → Uses last known rating
- **Cache miss** → Queries database (slower)

**API Surface:**

```python
class LearningTracker:
    async def record_decision(
        self,
        player_id: str,
        decision_event: DecisionEvent
    ) -> None:
        """Record decision for skill assessment (async)"""
    
    async def get_skill_profile(
        self,
        player_id: str
    ) -> PlayerSkillProfile:
        """Get current skill profile (cached)"""
    
    async def update_skill_rating(
        self,
        player_id: str,
        game_id: str
    ) -> SkillUpdate:
        """Recalculate skill after game completion"""
```

---

### 3.5 Event Store (PostgreSQL + Redis)

**Purpose:** Durable persistence and caching layer

**Guarantees:**
- ✅ All events stored durably (append-only)
- ✅ Point-in-time queries supported
- ✅ Write latency <10ms (P95)
- ✅ Read latency <5ms (P95) for cached data

**Refuses To:**
- ❌ Allow event deletion (immutability)
- ❌ Serve real-time queries from cold storage
- ❌ Cache sensitive data in Redis

**Dependencies:**
- PostgreSQL 16 (primary storage)
- Redis/Valkey (cache + session state)
- pg_cron (materialized view refresh)

**Failure Modes:**
- **Postgres unavailable** → Queues writes in Redis, reject reads
- **Redis unavailable** → Direct to Postgres (slower)
- **Disk full** → Reject writes, alert immediately

---

## 4. Domain Mathematics Specification

### 4.1 Probability Space Definition

**Sample Space (Ω):**  
The set of all possible dice outcomes for a 5-dice roll:

```
Ω = {1,2,3,4,5,6}^5
|Ω| = 6^5 = 7,776 possible outcomes
```

**Events:**  
Measurable subsets of Ω corresponding to Dicee categories

**Probability Measure (P):**  
For fair dice, uniform distribution over Ω:

```
P(outcome) = 1/7776  for all outcomes ∈ Ω
P(event E) = |E| / 7776
```

**Assumptions:**
1. All dice are independent
2. All dice are fair (P(face) = 1/6)
3. Dice are distinguishable (order matters for counting)

### 4.2 Category Definitions (Formal)

**Upper Section (Ones through Sixes):**

```
Ones(d₁,d₂,d₃,d₄,d₅) = Σ[i=1 to 5] 1(dᵢ = 1)
Score = count(1s) × 1

Similarly for 2s-6s with different target values.
```

**Three of a Kind:**

```
ThreeOfKind(dice) = ∃v ∈ {1..6}: count(dice, v) ≥ 3
Score = Σ dice if condition holds, else 0
```

**Four of a Kind:**

```
FourOfKind(dice) = ∃v ∈ {1..6}: count(dice, v) ≥ 4
Score = Σ dice if condition holds, else 0
```

**Full House:**

```
FullHouse(dice) = ∃a,b ∈ {1..6}: a≠b ∧ count(dice,a)=3 ∧ count(dice,b)=2
Score = 25 if condition holds, else 0
```

**Small Straight:**

```
SmallStraight(dice) = ∃sequence ∈ {{1,2,3,4}, {2,3,4,5}, {3,4,5,6}}:
                       sequence ⊆ set(dice)
Score = 30 if condition holds, else 0
```

**Large Straight:**

```
LargeStraight(dice) = set(dice) ∈ {{1,2,3,4,5}, {2,3,4,5,6}}
Score = 40 if condition holds, else 0
```

**Dicee:**

```
Dicee(dice) = ∃v ∈ {1..6}: ∀i ∈ {1..5}: dᵢ = v
Score = 50 if condition holds, else 0
```

**Chance:**

```
Chance(dice) = Σ dice
Score = sum of all dice (always valid)
```

### 4.3 Probability Calculation (Exact Method)

**Single-Roll Probability:**

For a roll with `k` dice to reroll:

```
P(category | dice, keep_mask) = 
    |{outcomes where category achieved}| / 6^k

where k = count(keep_mask = False)
```

**Combinatorial Counting:**

Number of ways to roll specific dice values:

```
Ways(counts) = n! / (c₁! × c₂! × ... × c₆!)

where:
  n = total dice
  cᵢ = count of dice showing value i
```

**Example:** Ways to roll [3,3,3,5,6]

```
Ways = 5! / (3! × 1! × 1!) = 120 / 6 = 20
```

### 4.4 Expected Value Recurrence Relation

**Bellman Equation for Dicee:**

```
V*(state) = max(
    max{Score(cat) | cat ∈ Available},           // Terminal action
    max{EV(reroll strategy) | strategy ∈ Keeps}  // Continue action
)

where:
  EV(reroll strategy) = Σ P(outcome) × V*(new_state(outcome))
```

**Base Case:**

```
V*(state with rolls=0) = max{Score(cat) | cat ∈ Available}
```

**Optimal Policy:**

```
π*(state) = argmax{V*(action) | action ∈ Actions}
```

### 4.5 Confidence Intervals (Monte Carlo)

For `n` simulations with success count `k`:

```
p̂ = k/n  (empirical probability)

Standard error: SE = √(p̂(1-p̂)/n)

95% CI: [p̂ - 1.96×SE, p̂ + 1.96×SE]
```

**Required samples for ±1% accuracy:**

```
n ≥ (1.96/0.01)² × p(1-p) ≈ 38,416 for p=0.5 (worst case)
```

### 4.6 Decision Quality Metric

**EV Difference:**

```
Δ_EV = EV(action_chosen) - EV(action_optimal)

Always: Δ_EV ≤ 0 (optimal has highest EV by definition)
```

**Cumulative Skill Score:**

```
Skill(player) = -1 × mean{Δ_EV(decision_i) | i=1..N}

Higher is better (closer to 0 means more optimal)
```

### 4.7 Invariants & Axioms

**Probability Axioms:**
1. `0 ≤ P(E) ≤ 1` for all events E
2. `P(Ω) = 1` (something must happen)
3. `P(A ∪ B) = P(A) + P(B)` if A and B are mutually exclusive

**Dicee-Specific Invariants:**
1. All category scores are non-negative integers
2. Upper section max: 5 × 6 = 30 per category
3. Upper section bonus: 35 if total ≥ 63
4. Grand total is sum of all scored categories + bonuses
5. Exactly 13 decisions per game (one per category)

**Computation Invariants:**
1. EV monotonicity: `EV(state, rolls=k+1) ≥ EV(state, rolls=k)`
2. Probability sum: `Σ P(category) ≤ 1.0` (categories may overlap)
3. Cache consistency: Cached values match fresh calculations

---

## 5. API Specification

### 5.1 REST API Endpoints

**Base URL:** `https://api.dicee.app/v1`

| Method | Endpoint | Purpose | Latency SLA | Auth |
|--------|----------|---------|-------------|------|
| GET | `/probabilities` | Get probability vector | <50ms | No |
| POST | `/decision` | Get optimal decision | <100ms | No |
| POST | `/evaluate` | Grade player decision | <50ms | No |
| POST | `/simulate` | Run Monte Carlo | <500ms | No |
| GET | `/game/{id}/state` | Get game state | <20ms | Yes |
| POST | `/game/{id}/roll` | Record roll event | <30ms | Yes |
| POST | `/game/{id}/score` | Record score event | <50ms | Yes |
| GET | `/player/{id}/profile` | Get skill profile | <100ms | Yes |
| GET | `/game/{id}/report` | Get game report | <5s | Yes |

### 5.2 Endpoint Specifications

#### POST `/v1/probabilities`

**Request Schema:**

```typescript
{
  "dice": [5, 5, 5, 2, 6],           // Current dice state
  "keptMask": [true, true, true, false, false],
  "rollsRemaining": 1,
  "availableCategories": ["full_house", "fives", "chance"]
}
```

**Response Schema (Success):**

```typescript
{
  "status": "success",
  "computationTime": 12,  // milliseconds
  "method": "exact",       // "exact" | "monte_carlo" | "cached"
  "probabilities": {
    "full_house": {
      "value": 0.1667,
      "asPercentage": "16.7%",
      "asFraction": "1/6",
      "confidence": 1.0,   // 1.0 = exact, <1.0 = estimated
      "isAchievable": true
    },
    "fives": {
      "value": 1.0,
      "asPercentage": "100%",
      "asFraction": "1/1",
      "confidence": 1.0,
      "isAchievable": true
    },
    "chance": {
      "value": 1.0,
      "asPercentage": "100%",
      "confidence": 1.0,
      "isAchievable": true
    }
  },
  "cacheHit": false,
  "traceId": "uuid-v4"
}
```

**Response Schema (Error):**

```typescript
{
  "status": "error",
  "errorCode": "INVALID_DICE_STATE",
  "message": "Dice must contain exactly 5 values between 1-6",
  "traceId": "uuid-v4"
}
```

**Error Codes:**
- `INVALID_DICE_STATE` — Malformed dice input
- `INVALID_KEPT_MASK` — kept_mask length ≠ 5
- `COMPUTATION_TIMEOUT` — Exceeded 100ms deadline
- `SERVICE_UNAVAILABLE` — Backend services down

---

#### POST `/v1/decision`

**Request Schema:**

```typescript
{
  "gameState": {
    "dice": [5, 5, 5, 2, 6],
    "rollsRemaining": 1,
    "availableCategories": ["full_house", "fives", "chance"],
    "currentScore": 145
  },
  "explanationDepth": "detailed"  // "simple" | "detailed" | "expert"
}
```

**Response Schema:**

```typescript
{
  "status": "success",
  "recommendation": {
    "action": "score",
    "category": "fives",
    "expectedValue": 15.0,
    "confidence": "high",
    "reasoning": "Guaranteed 15 points. Rerolling risks losing value for uncertain Full House gain.",
    "alternatives": [
      {
        "category": "full_house",
        "expectedValue": 11.67,  // 25 × 0.1667 + 0 × 0.8333
        "evDifference": -3.33,
        "reasoning": "Only 16.7% chance (1/6) of achieving full house"
      },
      {
        "category": "chance",
        "expectedValue": 28.0,
        "evDifference": 13.0,
        "reasoning": "Optimal choice: guaranteed maximum points"
      }
    ]
  },
  "computationTime": 45,
  "traceId": "uuid-v4"
}
```

---

#### POST `/v1/evaluate`

**Request Schema:**

```typescript
{
  "gameState": {
    "dice": [5, 5, 5, 2, 6],
    "rollsRemaining": 0,
    "availableCategories": ["full_house", "fives", "chance"]
  },
  "chosenCategory": "fives",
  "pointsEarned": 15,
  "timeToDecision": 3500  // milliseconds
}
```

**Response Schema:**

```typescript
{
  "status": "success",
  "evaluation": {
    "quality": "suboptimal",  // "optimal" | "excellent" | "good" | "acceptable" | "suboptimal" | "poor"
    "evDifference": -13.0,
    "optimalCategory": "chance",
    "optimalEV": 28.0,
    "chosenEV": 15.0,
    "feedback": "You chose Fives (15 pts) but Chance would have scored 28 pts. Consider using Chance for high-value mixed dice.",
    "missedPoints": 13,
    "learningTip": "Chance is most valuable when you have high dice values with no clear category fit."
  },
  "traceId": "uuid-v4"
}
```

---

### 5.3 WASM Module API

**Module:** `@dicee/probability-engine` (npm package)

```typescript
import init, { ProbabilityEngine } from '@dicee/probability-engine';

// Initialize WASM module (async, one-time)
await init();

const engine = new ProbabilityEngine();

// Calculate probabilities
const result = engine.calculate_probabilities(
  new Uint8Array([5, 5, 5, 2, 6]),      // dice
  new Uint8Array([1, 1, 1, 0, 0]),      // kept (1=true, 0=false)
  1                                      // rolls remaining
);

// Result is JSON string
const probabilities = JSON.parse(result);
```

**Module Size:** ~150KB gzipped

**Browser Support:**
- Chrome/Edge 91+
- Firefox 89+
- Safari 15+
- iOS Safari 15+

---

### 5.4 WebSocket Protocol (Real-Time Updates)

**Connection:** `wss://api.dicee.app/v1/game/{gameId}`

**Client → Server Messages:**

```typescript
// Join game
{
  "type": "join",
  "playerId": "uuid",
  "token": "jwt-token"
}

// Roll dice
{
  "type": "roll",
  "keptMask": [true, false, false, true, false]
}

// Score category
{
  "type": "score",
  "category": "full_house"
}

// Request hint
{
  "type": "request_hint",
  "explanationDepth": "detailed"
}
```

**Server → Client Messages:**

```typescript
// Game state update
{
  "type": "state_update",
  "gameState": { /* full game state */ },
  "timestamp": 1698765432000
}

// Roll result
{
  "type": "roll_result",
  "dice": [3, 3, 5, 5, 6],
  "rollNumber": 2,
  "probabilities": { /* computed probabilities */ }
}

// Turn changed
{
  "type": "turn_changed",
  "newPlayerId": "uuid",
  "playerName": "Alice"
}

// Hint delivered
{
  "type": "hint",
  "recommendation": { /* decision recommendation */ }
}

// Error
{
  "type": "error",
  "code": "INVALID_ACTION",
  "message": "Not your turn"
}
```

---

## 6. Core Data Models

### 6.1 Event Schema

All events follow this base structure:

```typescript
interface BaseGameEvent {
  // Event identity
  id: string;                    // UUID v4
  eventType: string;              // Specific event type
  eventVersion: string;           // "1.0.0" (schema version)
  timestamp: number;              // Unix epoch milliseconds
  
  // Event correlation
  traceId: string;                // For request tracing
  causalChain: string[];          // Parent event IDs
  
  // Game context
  gameId: string;
  playerId: string;
  turnNumber: number;             // 1-13
  rollNumber: number;             // 1-3
  
  // Execution metadata
  computationTime?: number;       // ms
  serviceName?: string;           // Which service generated this
}
```

**Specific Event Types:**

```typescript
// Roll event
interface RollEvent extends BaseGameEvent {
  eventType: "roll";
  diceResult: [number, number, number, number, number];
  keptMask: [boolean, boolean, boolean, boolean, boolean];
  
  // Pre-roll context
  preRollDice?: [number, number, number, number, number];
  intentSignal?: "exploring" | "targeting_category" | "conservative";
  
  // Computed statistics
  probabilities: ProbabilityVector;
  recommendations: DecisionRecommendation[];
}

// Score decision event
interface ScoreDecisionEvent extends BaseGameEvent {
  eventType: "score";
  chosenCategory: DiceeCategory;
  pointsEarned: number;
  
  // Decision quality
  expectedValue: number;
  optimalCategory: DiceeCategory;
  optimalEV: number;
  evDifference: number;
  decisionQuality: "optimal" | "excellent" | "good" | "acceptable" | "suboptimal" | "poor";
  
  // Behavioral telemetry
  timeToDecision: number;           // ms from roll to score
  categoriesConsidered: string[];   // Hover sequence
  backtrackCount: number;           // Changes of mind
  hintRequested: boolean;
}

// Hover event (UI telemetry)
interface HoverEvent extends BaseGameEvent {
  eventType: "hover";
  categoryHovered: DiceeCategory;
  hoverDuration: number;            // ms
  
  // Contextual calculation
  wouldScore: number;
  currentEV: number;
  isOptimal: boolean;
}

// Prediction event (engagement mechanic)
interface PredictionEvent extends BaseGameEvent {
  eventType: "prediction";
  predictedCategory: DiceeCategory;
  predictedProbability: number;
  actualProbability: number;
  accuracyDelta: number;            // For reward calculation
}
```

### 6.2 Game State Model

```typescript
interface GameState {
  gameId: string;
  status: "waiting" | "active" | "completed" | "abandoned";
  
  // Players
  players: PlayerState[];
  currentPlayerId: string;
  turnOrder: string[];
  
  // Current turn state
  currentTurn: number;              // 1-13
  currentRoll: number;              // 1-3
  currentDice: [number, number, number, number, number];
  keptDice: [boolean, boolean, boolean, boolean, boolean];
  
  // Game history
  events: BaseGameEvent[];          // Full event log
  
  // Timestamps
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
}

interface PlayerState {
  playerId: string;
  displayName: string;
  
  // Scorecard
  scorecard: {
    ones?: number;
    twos?: number;
    threes?: number;
    fours?: number;
    fives?: number;
    sixes?: number;
    upperBonus?: number;            // 35 if upper ≥ 63
    threeOfKind?: number;
    fourOfKind?: number;
    fullHouse?: number;
    smallStraight?: number;
    largeStraight?: number;
    dicee?: number;
    chance?: number;
    diceeBonus?: number;          // 100 per additional Dicee
  };
  
  // Computed totals
  upperTotal: number;
  lowerTotal: number;
  grandTotal: number;
  
  // Available categories (not yet scored)
  availableCategories: Set<DiceeCategory>;
}
```

### 6.3 Probability Vector Model

```typescript
interface ProbabilityVector {
  // Per-category probabilities
  categories: Record<DiceeCategory, ProbabilityMetric>;
  
  // Metadata
  computationMethod: "exact" | "monte_carlo" | "hybrid" | "cached";
  computationTime: number;          // ms
  confidence: number;               // 0.0-1.0 (1.0 = exact)
  cacheHit: boolean;
  
  // Validation
  checksumValid: boolean;           // Σ P ≤ 1.0
  invariantsSatisfied: boolean;
}

interface ProbabilityMetric {
  // Probability values
  value: number;                    // 0.0-1.0
  confidenceInterval?: [number, number];  // [lower, upper] for Monte Carlo
  sampleSize?: number;              // For Monte Carlo
  
  // Multiple representations
  asPercentage: string;             // "23.5%"
  asOdds: string;                   // "1 in 4.3"
  asFraction?: string;              // "5/21" (exact only)
  
  // Decision support
  isAchievable: boolean;
  recommendKeep?: number[];         // Dice indices [0-4]
  
  // Validation
  calculationMethod: string;
  lastComputed: number;             // timestamp
}
```

---

## 7. Algorithms & Complexity Analysis

### 7.1 Single-Roll Exact Probability

**Algorithm:** Combinatorial enumeration

```typescript
function calculateSingleRollProbability(
  currentDice: number[],
  keptMask: boolean[],
  category: DiceeCategory
): Probability {
  const diceToRoll = keptMask.filter(k => !k).length;
  const totalOutcomes = Math.pow(6, diceToRoll);
  
  let favorableOutcomes = 0;
  
  // Enumerate all 6^k possible outcomes
  for (let outcome = 0; outcome < totalOutcomes; outcome++) {
    const newDice = applyReroll(currentDice, keptMask, outcome);
    if (achievesCategory(newDice, category)) {
      favorableOutcomes++;
    }
  }
  
  return {
    value: favorableOutcomes / totalOutcomes,
    numerator: favorableOutcomes,
    denominator: totalOutcomes,
    method: 'exact'
  };
}
```

**Complexity Analysis:**

| Dice to Roll | Iterations | Time (Rust) | Time (JS) |
|--------------|-----------|-------------|-----------|
| 0 | 1 | <1ms | <1ms |
| 1 | 6 | <1ms | <1ms |
| 2 | 36 | <1ms | <1ms |
| 3 | 216 | 1-2ms | 2-3ms |
| 4 | 1,296 | 5-8ms | 10-15ms |
| 5 | 7,776 | 15-20ms | 30-40ms |

**Space Complexity:** O(1) — constant memory

**Optimization:** Pre-compute all 7,776 five-dice states during initialization

---

### 7.2 Multi-Roll Dynamic Programming

**Algorithm:** Recursive EV with memoization

```typescript
function calculateOptimalEV(
  state: GameState,
  cache: Map<string, number>
): number {
  // Base case
  if (state.rollsRemaining === 0) {
    return Math.max(...state.availableCategories.map(
      cat => scoreCategory(state.dice, cat)
    ));
  }
  
  // Check cache
  const key = stateKey(state);
  if (cache.has(key)) {
    return cache.get(key)!;
  }
  
  // Try all keep strategies (32 combinations)
  let bestEV = 0;
  for (const keepMask of generateKeepStrategies()) {
    const rerollEV = calculateRerollEV(state, keepMask, cache);
    bestEV = Math.max(bestEV, rerollEV);
  }
  
  // Also consider scoring now
  const scoreNowEV = calculateTerminalEV(state);
  const optimalEV = Math.max(bestEV, scoreNowEV);
  
  cache.set(key, optimalEV);
  return optimalEV;
}
```

**Complexity Analysis:**

Let:
- `n` = number of available categories (max 13)
- `r` = rolls remaining (max 3)
- `d` = distinct dice states (≈7,776)

**Without Memoization:**
```
T(n, r) = 32 × 6^5 × T(n, r-1)  [recursive calls]
        = O(32^r × 6^5) ≈ O(32^3 × 7776) ≈ 250 million operations
```

**With Memoization:**
```
States to compute = d × 2^n × r
                  ≈ 7776 × 8192 × 3
                  ≈ 190 million states (worst case)

Practical: ~10,000 states visited per game
Time: O(10,000 × 32) ≈ 320K operations → ~50ms
```

**Space Complexity:** O(d × 2^n × r) ≈ 190MB worst case, ~1MB typical

**Optimization:** 
- Symmetry reduction: [1,2,3,3,5] ≡ [3,3,1,2,5]
- Category pruning: Don't consider impossible categories
- Iterative deepening: Compute EV for r=0, then r=1, etc.

---

### 7.3 Monte Carlo Simulation

**Algorithm:** Parallel sampling with Numba

```python
@jit(nopython=True, parallel=True)
def monte_carlo_simulate(
    current_dice: np.ndarray,
    kept_mask: np.ndarray,
    target_category: str,
    n_simulations: int
) -> float:
    success_count = 0
    
    # Parallel loop over CPU cores
    for i in prange(n_simulations):
        outcome = current_dice.copy()
        
        # Simulate reroll
        for j in range(5):
            if not kept_mask[j]:
                outcome[j] = np.random.randint(1, 7)
        
        # Check category achievement
        if check_category_numba(outcome, target_category):
            success_count += 1
    
    return success_count / n_simulations
```

**Complexity Analysis:**

| Iterations | Time (Numba) | Time (Python) | Confidence Interval |
|------------|--------------|---------------|---------------------|
| 1,000 | 2ms | 50ms | ±3.1% |
| 10,000 | 15ms | 500ms | ±1.0% |
| 100,000 | 120ms | 5s | ±0.3% |
| 1,000,000 | 1.2s | 50s | ±0.1% |

**Parallelization Speedup:**

| Cores | Speedup | Time (100K) |
|-------|---------|-------------|
| 1 | 1.0× | 120ms |
| 4 | 3.8× | 32ms |
| 8 | 7.2× | 17ms |
| 16 | 13.5× | 9ms |

**GPU Acceleration (Optional):**
- CUDA kernel: ~2ms for 1M iterations
- Requires NVIDIA GPU with CUDA 11+
- 60× speedup vs. single-core CPU

---

### 7.4 Algorithm Complexity Summary

| Algorithm | Time Complexity | Space Complexity | Typical Runtime |
|-----------|----------------|------------------|-----------------|
| Single-roll probability | O(6^k) | O(1) | 15ms |
| Multi-roll EV (memoized) | O(d × 2^n × r) | O(d × 2^n × r) | 50ms |
| Monte Carlo (100K) | O(n × 5) | O(1) | 120ms |
| Category scoring | O(1) | O(1) | <1ms |
| Optimal strategy lookup | O(1) | O(d × 2^n) | 3ms |
| Game state validation | O(1) | O(1) | <1ms |

**Where:**
- k = dice to roll (0-5)
- d = distinct dice states (≈7,776)
- n = available categories (max 13)
- r = rolls remaining (0-3)

---

## 8. Data Validation & Correctness Guarantees

### 8.1 Input Validation Rules

**Dice State Validation:**

```typescript
function validateDiceState(dice: unknown): dice is number[] {
  if (!Array.isArray(dice)) return false;
  if (dice.length !== 5) return false;
  return dice.every(d => Number.isInteger(d) && d >= 1 && d <= 6);
}
```

**Invariant Checks:**

```typescript
class ProbabilityValidator {
  static validateProbabilityVector(pv: ProbabilityVector): void {
    // Rule 1: All probabilities in [0, 1]
    for (const [category, metric] of Object.entries(pv.categories)) {
      if (metric.value < 0 || metric.value > 1) {
        throw new ValidationError(
          `Probability for ${category} outside [0,1]: ${metric.value}`
        );
      }
    }
    
    // Rule 2: Sum of mutually exclusive categories ≤ 1
    // (Note: categories can overlap, so total sum may exceed 1)
    
    // Rule 3: Confidence intervals are valid
    for (const metric of Object.values(pv.categories)) {
      if (metric.confidenceInterval) {
        const [lower, upper] = metric.confidenceInterval;
        if (lower < 0 || upper > 1 || lower > upper) {
          throw new ValidationError(
            `Invalid confidence interval: [${lower}, ${upper}]`
          );
        }
      }
    }
    
    // Rule 4: If confidence < 1.0, must be Monte Carlo
    if (pv.confidence < 1.0 && pv.computationMethod === 'exact') {
      throw new ValidationError(
        'Exact computation must have confidence = 1.0'
      );
    }
  }
}
```

### 8.2 EV Monotonicity Guarantee

**Theorem:** Expected value is monotonically increasing with more rolls remaining.

```
EV(state, rolls=k+1) ≥ EV(state, rolls=k)  for all k ∈ [0,2]
```

**Proof:** With an additional roll, the player has all previous options (score now) plus new options (reroll). The optimal strategy with k+1 rolls can always choose the same action as with k rolls, so EV cannot decrease.

**Validation:**

```typescript
function validateEVMonotonicity(
  state: GameState,
  ev0: number,
  ev1: number
): void {
  if (ev1 < ev0 - 0.01) {  // Allow 0.01 rounding tolerance
    throw new InvariantViolation(
      `EV monotonicity violated: EV(r=1)=${ev1} < EV(r=0)=${ev0}`
    );
  }
}
```

### 8.3 Score Range Validation

```typescript
const CATEGORY_CONSTRAINTS: Record<DiceeCategory, [number, number]> = {
  ones: [0, 5],              // Min 0, max 5×1
  twos: [0, 10],             // Min 0, max 5×2
  threes: [0, 15],
  fours: [0, 20],
  fives: [0, 25],
  sixes: [0, 30],
  threeOfKind: [0, 30],      // Min 0 (fail), max 5×6
  fourOfKind: [0, 30],
  fullHouse: [0, 25],        // 0 or 25 only
  smallStraight: [0, 30],    // 0 or 30 only
  largeStraight: [0, 40],    // 0 or 40 only
  dicee: [0, 50],          // 0 or 50 only
  chance: [5, 30]            // Min 5×1, max 5×6
};

function validateScore(
  category: DiceeCategory,
  score: number
): void {
  const [min, max] = CATEGORY_CONSTRAINTS[category];
  if (score < min || score > max) {
    throw new ValidationError(
      `Score ${score} for ${category} outside valid range [${min}, ${max}]`
    );
  }
  
  // Additional constraint: fixed-value categories
  if (['full_house', 'small_straight', 'large_straight', 'dicee'].includes(category)) {
    if (score !== 0 && score !== max) {
      throw new ValidationError(
        `${category} must score 0 or ${max}, got ${score}`
      );
    }
  }
}
```

### 8.4 Determinism Guarantee

**Requirement:** Same input always produces same output (no hidden randomness)

```typescript
// ✅ CORRECT: Deterministic probability calculation
function calculateProbability(dice: number[], category: string): number {
  return exactEnumeration(dice, category);  // Pure function
}

// ❌ INCORRECT: Non-deterministic
function calculateProbability(dice: number[], category: string): number {
  if (Math.random() > 0.5) {  // ❌ Random branch
    return exactEnumeration(dice, category);
  } else {
    return monteCarlo(dice, category);
  }
}
```

**Test:**

```typescript
test('determinism guarantee', () => {
  const dice = [3, 3, 5, 5, 6];
  const category = 'full_house';
  
  // Run 100 times
  const results = Array(100).fill(null).map(() =>
    calculateProbability(dice, category)
  );
  
  // All results must be identical
  const allSame = results.every(r => r === results[0]);
  expect(allSame).toBe(true);
});
```

### 8.5 Cache Consistency Guarantee

**Requirement:** Cached values match fresh calculations

```typescript
class CacheValidator {
  async validateCacheEntry(
    key: string,
    cachedValue: any
  ): Promise<void> {
    const fresh = await computeFresh(key);
    
    if (!deepEqual(cachedValue, fresh)) {
      // Log discrepancy
      logger.error('Cache inconsistency', {
        key,
        cached: cachedValue,
        fresh
      });
      
      // Invalidate cache
      await cache.delete(key);
      
      throw new CacheInconsistencyError(
        `Cached value for ${key} does not match fresh calculation`
      );
    }
  }
}
```

### 8.6 Event Ordering Guarantee

**Requirement:** Events are totally ordered by timestamp

```typescript
function validateEventOrdering(events: GameEvent[]): void {
  for (let i = 1; i < events.length; i++) {
    if (events[i].timestamp < events[i-1].timestamp) {
      throw new InvariantViolation(
        `Event ordering violated at index ${i}: ` +
        `${events[i].timestamp} < ${events[i-1].timestamp}`
      );
    }
  }
  
  // Additionally: turn numbers must be sequential
  const turnNumbers = events
    .filter(e => e.eventType === 'score')
    .map(e => e.turnNumber);
  
  for (let i = 1; i < turnNumbers.length; i++) {
    if (turnNumbers[i] !== turnNumbers[i-1] + 1) {
      throw new InvariantViolation(
        `Turn numbers not sequential: ${turnNumbers[i-1]} → ${turnNumbers[i]}`
      );
    }
  }
}
```

---

## 9. Performance & Scalability

### 9.1 Latency Breakdown

**Target: P95 < 100ms end-to-end**

```
User Action (dice roll)
    ↓
[Frontend] Capture state (1ms)
    ↓
[WASM] Calculate probabilities (15ms P95)
    ↓
[Frontend] Update UI (5ms)
    ↓
[Network] Send to backend (20ms P95)
    ↓
[API Gateway] Route request (2ms)
    ↓
[Decision Analyzer] Calculate EV (30ms P95)
    ↓
[Database] Record event (10ms P95)
    ↓
[Network] Return response (20ms P95)
    ↓
[Frontend] Display feedback (5ms)
    ↓
Total: 108ms (exceeds target by 8ms)
```

**Optimization Strategies:**

1. **Async event recording** — Don't wait for DB write
   - Saves 10ms
   - New total: 98ms ✓

2. **Pre-computed EV tables** — Cache common states
   - Reduces Decision Analyzer to 5ms
   - New total: 73ms ✓

3. **Edge computing** — Deploy WASM + cache near users
   - Reduces network to 5ms
   - New total: 53ms ✓

### 9.2 Throughput Targets

**Phase 1 (100 concurrent games):**
- 100 games × 13 turns × 3 rolls = 3,900 calculations/hour
- ~1.1 requests/second
- Single server easily handles

**Phase 2 (10,000 concurrent games):**
- 10,000 games × 13 turns × 3 rolls = 390,000 calculations/hour
- ~108 requests/second
- Need: 3-4 servers with load balancing

**Scalability Strategy:**

```
┌─────────────┐
│   Cloudflare│
│   (Global)  │
└──────┬──────┘
       │
   ┌───▼───┐
   │ Load  │
   │Balance│
   └───┬───┘
       │
   ┌───┴───┬────────┬────────┐
   │       │        │        │
┌──▼──┐ ┌──▼──┐ ┌──▼──┐  ┌──▼──┐
│API-1│ │API-2│ │API-3│  │API-4│
└──┬──┘ └──┬──┘ └──┬──┘  └──┬──┘
   │       │        │        │
   └───────┴────────┴────────┘
           │
      ┌────▼────┐
      │ Postgres│
      │ (Primary│
      └────┬────┘
           │
      ┌────▼────┐
      │ Postgres│
      │ (Replica│
      └─────────┘
```

### 9.3 Caching Strategy

**Three-Tier Cache:**

1. **Client WASM Cache** (70K pre-computed states)
   - Hit rate: 80%
   - Latency: 3ms
   - Storage: 5MB

2. **Redis Cache** (Hot server-side)
   - Hit rate: 15% (of cache misses)
   - Latency: 5ms
   - TTL: 1 hour

3. **Postgres Lookup Table**
   - Hit rate: 5% (of cache misses)
   - Latency: 10ms
   - Permanent storage

**Overall Cache Hit Rate:** 80% + 20%×15% + 20%×85%×5% = 84%

**Cache Invalidation:**
- Version all cached data: `state_v1`, `state_v2`
- TTL-based expiration for safety
- Explicit invalidation on schema changes

### 9.4 Resource Requirements

**Per Server Instance:**

| Resource | Requirement | Notes |
|----------|-------------|-------|
| CPU | 2 cores | 80% avg utilization |
| RAM | 4 GB | 2GB app, 2GB cache |
| Disk | 20 GB | Logs + temp storage |
| Network | 100 Mbps | 99th percentile |

**Database:**

| Metric | Requirement |
|--------|-------------|
| Storage | 100 GB / 100K games |
| IOPS | 1000 sustained |
| Connections | 100 concurrent |
| Replication | 1 read replica |

**Cost Estimate (Phase 1):**
- Compute: $50/month (2 servers)
- Database: $30/month (managed Postgres)
- CDN: $10/month (WASM + assets)
- **Total: $90/month**

---

## 10. Security & Fair Play

### 10.1 Client Integrity

**Problem:** Users could modify WASM to calculate fake probabilities

**Solution: Subresource Integrity (SRI)**

```html
<script 
  type="module" 
  src="https://cdn.dicee.app/engine-v1.0.0.js"
  integrity="sha384-oqVuAfXRKap7fdgcCY5uykM6+R9GqQ8K/uxy9rx7HNQlGYl1kPzQho1wx4JwY8wC"
  crossorigin="anonymous">
</script>
```

**Verification:** Server cross-checks critical calculations

```typescript
// Client sends calculation result
POST /v1/verify-calculation
{
  "dice": [5,5,5,2,6],
  "probability": 0.1667,
  "clientSignature": "hash-of-inputs"
}

// Server re-calculates and compares
if (Math.abs(serverProbability - clientProbability) > 0.001) {
  flagPotentialTampering(userId);
}
```

### 10.2 Deterministic Seeds (Anti-Cheat)

**Requirement:** All probability calculations use deterministic methods, not random sampling in production

```typescript
// ✅ CORRECT: Deterministic
function calculateProbability(dice: number[]): number {
  return exactCombinatorics(dice);
}

// ❌ INCORRECT: Allows client manipulation
function calculateProbability(dice: number[]): number {
  Math.seedrandom(clientProvidedSeed);  // ❌ Client controls randomness
  return monteCarlo(dice, 10000);
}
```

### 10.3 Rate Limiting

**Prevent Abuse:**

```typescript
// Per-user rate limits
const rateLimits = {
  '/probabilities': '100 requests / minute',
  '/decision': '50 requests / minute',
  '/simulate': '10 requests / minute',  // Expensive
  '/game': '1000 requests / hour'       // Gameplay actions
};

// Implementation (Redis)
async function checkRateLimit(
  userId: string,
  endpoint: string
): Promise<boolean> {
  const key = `ratelimit:${userId}:${endpoint}`;
  const count = await redis.incr(key);
  
  if (count === 1) {
    await redis.expire(key, 60);  // 1 minute window
  }
  
  return count <= getRateLimitForEndpoint(endpoint);
}
```

### 10.4 Fair Play Monitoring

**Anomaly Detection:**

```typescript
interface PlayerBehaviorProfile {
  avgDecisionTime: number;              // ~3-10 seconds typical
  optimalDecisionRate: number;          // 40-80% typical
  calculationRequestRate: number;       // 1-5 per roll typical
  
  // Red flags
  suspiciousPatterns: {
    alwaysOptimal: boolean;             // >98% optimal (bot?)
    instantDecisions: boolean;          // <100ms consistently
    perfectPredictions: boolean;        // Always predicts exact probability
  };
}

async function detectCheating(
  playerId: string
): Promise<boolean> {
  const profile = await getPlayerProfile(playerId);
  
  const redFlags = [
    profile.optimalDecisionRate > 0.98,
    profile.avgDecisionTime < 0.1,
    profile.suspiciousPatterns.perfectPredictions
  ];
  
  return redFlags.filter(Boolean).length >= 2;
}
```

### 10.5 Privacy & Data Protection

**Principles:**
- No PII in statistical telemetry
- Player IDs are UUIDs (not emails)
- Game events contain no sensitive data
- Analytics are aggregated and anonymized

**GDPR Compliance:**
```typescript
// Right to deletion
async function deletePlayerData(playerId: string): Promise<void> {
  // Anonymize events (keep for research)
  await db.query(
    'UPDATE game_events SET player_id = $1 WHERE player_id = $2',
    ['anonymous', playerId]
  );
  
  // Delete profile
  await db.query('DELETE FROM player_profiles WHERE id = $1', [playerId]);
  
  // Clear cache
  await redis.del(`profile:${playerId}`);
}
```

---

## 11. Testing & Validation Strategy

### 11.1 Unit Testing

**Coverage Target:** >95% for core algorithms

**Test Categories:**

```typescript
describe('Probability Calculations', () => {
  // Correctness tests
  test('known probability values', () => {
    expect(P([1,1,1,1,1], 'dicee')).toBe(1.0);
    expect(P([5,5,5,2,6], 'full_house')).toBeCloseTo(1/6);
    expect(P([1,2,3,4,6], 'large_straight')).toBe(0);
  });
  
  // Property-based tests
  test('probabilities sum to ≤1', () => {
    fc.assert(
      fc.property(randomDiceState(), (dice) => {
        const probs = calculateAll(dice);
        return Object.values(probs).reduce((a,b) => a+b, 0) <= 1.0;
      })
    );
  });
  
  // Edge cases
  test('handles all dice kept', () => {
    const p = P([3,3,3,3,3], [T,T,T,T,T], 'dicee');
    expect(p).toBe(1.0);  // Already achieved
  });
});
```

### 11.2 Integration Testing

**End-to-End Flow:**

```typescript
describe('Statistical Engine Integration', () => {
  test('complete decision flow', async () => {
    const engine = new StatisticalEngine();
    
    // 1. Calculate probabilities
    const probs = await engine.calculateProbabilities({
      dice: [5,5,5,2,6],
      keptMask: [true, true, true, false, false],
      rollsRemaining: 1
    });
    
    expect(probs.fullHouse.value).toBeGreaterThan(0);
    
    // 2. Get recommendation
    const rec = await engine.getRecommendation({
      gameState: buildGameState(),
      explanationDepth: 'detailed'
    });
    
    expect(rec.expectedValue).toBeDefined();
    expect(rec.reasoning).toBeTruthy();
    
    // 3. Evaluate decision
    const eval = await engine.evaluateDecision({
      gameState: buildGameState(),
      chosenCategory: 'full_house',
      timeToDecision: 3500
    });
    
    expect(eval.quality).toBeDefined();
  });
});
```

### 11.3 Validation Against Reference

**Cross-Check with Known Solutions:**

```typescript
// Published optimal Dicee strategies
import { optimalStrategyReference } from './reference-data';

describe('Optimal Strategy Validation', () => {
  test('matches published EV tables', () => {
    for (const scenario of optimalStrategyReference) {
      const ourEV = calculateOptimalEV(scenario.state);
      const refEV = scenario.expectedValue;
      
      // Within 0.5 points (published data has rounding)
      expect(Math.abs(ourEV - refEV)).toBeLessThan(0.5);
    }
  });
});
```

### 11.4 Performance Testing

**Latency Requirements:**

```typescript
describe('Performance SLAs', () => {
  test('probability calculation <100ms P95', async () => {
    const latencies: number[] = [];
    
    for (let i = 0; i < 1000; i++) {
      const start = performance.now();
      await calculateProbabilities(randomState());
      latencies.push(performance.now() - start);
    }
    
    const p95 = percentile(latencies, 95);
    expect(p95).toBeLessThan(100);
  });
  
  test('handles 1000 requests/second', async () => {
    const requests = Array(1000).fill(null).map(() =>
      calculateProbabilities(randomState())
    );
    
    const start = performance.now();
    await Promise.all(requests);
    const duration = performance.now() - start;
    
    expect(duration).toBeLessThan(1000);
  });
});
```

### 11.5 Chaos Engineering

**Test Resilience:**

```typescript
describe('Failure Handling', () => {
  test('gracefully degrades when cache unavailable', async () => {
    // Simulate Redis failure
    await redis.disconnect();
    
    // Should still work (slower)
    const result = await calculateProbabilities(state);
    expect(result).toBeDefined();
    expect(result.computationTime).toBeGreaterThan(50);
  });
  
  test('falls back when Monte Carlo times out', async () => {
    // Simulate heavy load
    await simulateHighCPU();
    
    const rec = await getRecommendation(complexState);
    expect(rec.recommendation).toBeDefined();
    expect(rec.confidence).toBeLessThan('high');
  });
});
```

---

## 12. Implementation Roadmap

### Phase 1: Core Calculation Engine (Week 1)
**Goal:** Exact probability calculations working

- ✅ Implement scoring functions (all 13 categories)
- ✅ Single-roll probability enumeration
- ✅ Unit tests (>95% coverage)
- ✅ Basic EV calculation (terminal states)
- ✅ TypeScript implementation + validation

**Deliverables:**
- `packages/probability-core/` library
- 100+ unit tests passing
- Benchmark results documented

### Phase 2: Multi-Roll EV & Caching (Week 2)
**Goal:** Dynamic programming EV calculator

- ✅ Recursive EV with memoization
- ✅ Pre-compute lookup tables
- ✅ Decision Analyzer service (Bun)
- ✅ Redis caching integration
- ✅ Integration tests

**Deliverables:**
- `services/decision-analyzer/` API
- Lookup table generator script
- Performance benchmarks (<100ms)

### Phase 3: WASM Compilation (Week 3)
**Goal:** Client-side zero-latency engine

- ✅ Port core algorithms to Rust
- ✅ Compile to WASM
- ✅ npm package: `@dicee/probability-engine`
- ✅ Browser integration tests
- ✅ SRI hashing for security

**Deliverables:**
- WASM module (<200KB)
- CDN deployment
- Browser compatibility tests

### Phase 4: Monte Carlo & Validation (Week 3-4)
**Goal:** Heavy simulation for validation

- ✅ Numba-optimized simulator
- ✅ Confidence interval calculation
- ✅ Validation test suite
- ✅ Optional GPU acceleration

**Deliverables:**
- `services/monte-carlo/` Python service
- Cross-validation report
- Performance benchmarks

### Phase 5: Learning Tracker (Week 4-5)
**Goal:** Adaptive skill assessment

- ✅ Player skill profiling
- ✅ Decision quality tracking
- ✅ Adaptive presentation logic
- ✅ Tool unlocking system
- ✅ Analytics dashboard

**Deliverables:**
- `services/learning-tracker/` FastAPI service
- Skill assessment algorithm
- Progression tests

### Phase 6: Production Hardening (Week 5-6)
**Goal:** Deploy-ready system

- ✅ Load testing (1000 rps)
- ✅ Monitoring dashboards
- ✅ Error tracking (Sentry)
- ✅ Documentation complete
- ✅ Security audit

**Deliverables:**
- Production deployment
- Runbooks and alerts
- API documentation (OpenAPI)

---

## 13. Sample Execution Trace

### Real Example: Turn 3, Roll 2

**Initial State:**
```json
{
  "gameId": "game-123",
  "playerId": "player-alice",
  "turnNumber": 3,
  "rollNumber": 2,
  "dice": [5, 5, 5, 2, 6],
  "keptDice": [false, false, false, false, false],
  "availableCategories": [
    "ones", "twos", "fours", "sixes",
    "three_of_kind", "four_of_kind", "full_house",
    "small_straight", "large_straight", "dicee", "chance"
  ]
}
```

---

**Step 1: Player Rolls Dice**

Event recorded:
```json
{
  "id": "evt-001",
  "eventType": "roll",
  "eventVersion": "1.0.0",
  "timestamp": 1698765432100,
  "traceId": "trace-xyz",
  "gameId": "game-123",
  "playerId": "player-alice",
  "turnNumber": 3,
  "rollNumber": 2,
  "diceResult": [5, 5, 5, 2, 6],
  "keptMask": [false, false, false, false, false],
  "preRollDice": [1, 3, 5, 5, 5],
  "computationTime": 12
}
```

---

**Step 2: WASM Engine Calculates Probabilities**

Request to WASM:
```typescript
engine.calculate_probabilities(
  new Uint8Array([5, 5, 5, 2, 6]),
  new Uint8Array([0, 0, 0, 0, 0]),  // None kept yet
  1  // 1 roll remaining
)
```

Result (13ms):
```json
{
  "probabilities": {
    "full_house": {
      "value": 0.1667,
      "asPercentage": "16.7%",
      "asFraction": "1/6",
      "confidence": 1.0,
      "isAchievable": true,
      "recommendKeep": [0, 1, 2]  // Keep the three 5s
    },
    "four_of_kind": {
      "value": 0.2778,
      "asPercentage": "27.8%",
      "asFraction": "10/36",
      "confidence": 1.0,
      "isAchievable": true,
      "recommendKeep": [0, 1, 2]
    },
    "dicee": {
      "value": 0.0278,
      "asPercentage": "2.8%",
      "asFraction": "1/36",
      "confidence": 1.0,
      "isAchievable": true,
      "recommendKeep": [0, 1, 2]
    },
    "fives": {
      "value": 1.0,
      "asPercentage": "100%",
      "confidence": 1.0,
      "isAchievable": true
    }
  },
  "computationMethod": "exact",
  "computationTime": 13,
  "cacheHit": false
}
```

---

**Step 3: Player Hovers "Full House"**

Event recorded:
```json
{
  "id": "evt-002",
  "eventType": "hover",
  "timestamp": 1698765433200,
  "traceId": "trace-xyz",
  "categoryHovered": "full_house",
  "hoverDuration": 1200,
  "wouldScore": 25,
  "currentEV": 4.17,  // 25 × 0.1667
  "isOptimal": false
}
```

---

**Step 4: Decision Analyzer Calculates EV**

Request:
```json
POST /v1/decision
{
  "gameState": {
    "dice": [5, 5, 5, 2, 6],
    "rollsRemaining": 1,
    "availableCategories": ["full_house", "fives", "chance", ...]
  },
  "explanationDepth": "detailed"
}
```

Decision Analyzer logic:
```typescript
// Option 1: Score Fives now
EV(fives) = 15  // Guaranteed

// Option 2: Score Chance now  
EV(chance) = 28  // Guaranteed (5+5+5+2+6)

// Option 3: Reroll for Full House
EV(full_house | keep [5,5,5], reroll [2,6]) = 
  P(get pair) × 25 + P(fail) × score_later
  = 0.1667 × 25 + 0.8333 × 0
  = 4.17

// Option 4: Reroll for Four-of-a-Kind
EV(4oak | keep [5,5,5], reroll [2,6]) =
  P(get another 5) × 27 + P(fail) × 0
  = 0.2778 × 27 + 0.7222 × 0
  = 7.5

// Optimal: Score Chance (EV = 28)
```

Response (42ms):
```json
{
  "status": "success",
  "recommendation": {
    "action": "score",
    "category": "chance",
    "expectedValue": 28.0,
    "confidence": "high",
    "reasoning": "Guaranteed 28 points by scoring Chance now. Rerolling risks losing value for uncertain category achievements.",
    "alternatives": [
      {
        "category": "fives",
        "expectedValue": 15.0,
        "evDifference": -13.0,
        "reasoning": "Scores 15 points (three 5s) but leaves 13 points on table"
      },
      {
        "category": "four_of_kind",
        "expectedValue": 7.5,
        "evDifference": -20.5,
        "reasoning": "27.8% chance of rolling another 5, but risky"
      }
    ],
    "learningTip": "Chance is most valuable with high dice totals and no clear category fit"
  },
  "computationTime": 42,
  "traceId": "trace-xyz"
}
```

---

**Step 5: Player Chooses "Fives" (Suboptimal)**

Event recorded:
```json
{
  "id": "evt-003",
  "eventType": "score",
  "timestamp": 1698765436800,
  "traceId": "trace-xyz",
  "gameId": "game-123",
  "playerId": "player-alice",
  "turnNumber": 3,
  "chosenCategory": "fives",
  "pointsEarned": 15,
  
  "expectedValue": 15.0,
  "optimalCategory": "chance",
  "optimalEV": 28.0,
  "evDifference": -13.0,
  "decisionQuality": "suboptimal",
  
  "timeToDecision": 3700,
  "categoriesConsidered": ["full_house", "fives", "chance"],
  "backtrackCount": 1,
  "hintRequested": false
}
```

---

**Step 6: Learning Tracker Updates Skill Profile**

Async operation (50ms):
```python
await learning_tracker.record_decision({
  "player_id": "player-alice",
  "ev_difference": -13.0,
  "decision_quality": "suboptimal",
  "category_used": "fives"
})

# Update running statistics
profile = await get_player_profile("player-alice")
profile.decision_quality_ewma = 0.9 × profile.decision_quality_ewma + 0.1 × (-13.0)
profile.category_mastery["fives"] -= 2  # Suboptimal use
```

---

**Step 7: Feedback Displayed to Player**

```json
{
  "status": "success",
  "evaluation": {
    "quality": "suboptimal",
    "evDifference": -13.0,
    "feedback": "You scored 15 points in Fives, but Chance would have earned 28 points (13 more). Consider using Chance for high-value mixed dice.",
    "missedPoints": 13,
    "learningTip": "Fives is better saved for rolls with four or five 5s."
  }
}
```

---

**Total Execution Time:**
- WASM calculation: 13ms
- Decision analysis: 42ms
- Event recording: 8ms (async)
- Learning tracker: 50ms (async, non-blocking)
- **User-perceived latency: 55ms** ✓

---

## 14. Research References

### 14.1 Probability Theory Foundations

1. **Ross, S.** (2019). *A First Course in Probability* (10th ed.). Pearson.
   - Chapters 2-4: Combinatorics and conditional probability
   - Chapter 7: Expected value and variance

2. **Feller, W.** (1968). *An Introduction to Probability Theory and Its Applications* (3rd ed.). Wiley.
   - Volume 1, Chapter 2: Dice problems and combinatorics

3. **Knuth, D.** (1997). *The Art of Computer Programming, Vol. 2: Seminumerical Algorithms* (3rd ed.). Addison-Wesley.
   - Section 3.3: Random number generation
   - Section 1.2.6: Binomial coefficients

### 14.2 Game Theory & Optimal Play

4. **Sutton, R. & Barto, A.** (2018). *Reinforcement Learning: An Introduction* (2nd ed.). MIT Press.
   - Chapter 3: Finite Markov decision processes
   - Chapter 4: Dynamic programming

5. **Bellman, R.** (1957). *Dynamic Programming*. Princeton University Press.
   - Original formulation of Bellman equations

6. **Russell, S. & Norvig, P.** (2020). *Artificial Intelligence: A Modern Approach* (4th ed.). Pearson.
   - Chapter 17: Making simple decisions (MDPs)

### 14.3 Dicee-Specific Research

7. **Glenn, J.** (2006). "Optimal Strategy in Dicee." *College Mathematics Journal*, 37(5), 367-371.
   - Exhaustive dynamic programming solution
   - Expected value tables for optimal play

8. **Verhoeff, T. & van den Boom, R.** (2004). "Dicee: A Large Stochastic Multiple-Choice Knapsack Problem." *TU Eindhoven Technical Report*.
   - Computational complexity analysis

9. **Woodward, J.** (2018). "Solving Dicee with Dynamic Programming and Memoization." *Journal of Computing Sciences in Colleges*, 33(4), 12-19.

### 14.4 Educational Technology

10. **Papert, S.** (1980). *Mindstorms: Children, Computers, and Powerful Ideas*. Basic Books.
    - Constructionist learning theory
    - Learning through making decisions

11. **Gee, J.** (2003). *What Video Games Have to Teach Us About Learning and Literacy*. Palgrave Macmillan.
    - Game-based learning principles

12. **Koedinger, K. & Corbett, A.** (2006). "Cognitive Tutors: Technology Bringing Learning Sciences to the Classroom." *The Cambridge Handbook of the Learning Sciences*.
    - Adaptive learning systems

### 14.5 Statistical Computing

13. **Metropolis, N. & Ulam, S.** (1949). "The Monte Carlo Method." *Journal of the American Statistical Association*, 44(247), 335-341.
    - Original Monte Carlo paper

14. **Gentle, J.** (2009). *Computational Statistics*. Springer.
    - Chapter 2: Monte Carlo methods
    - Chapter 5: Markov chain Monte Carlo

### 14.6 Software Architecture

15. **Fowler, M.** (2017). *Event Sourcing*. martinfowler.com
    - Event-driven architecture patterns

16. **Newman, S.** (2021). *Building Microservices* (2nd ed.). O'Reilly.
    - Microservices design patterns
    - Failure handling strategies

---

## 15. Appendices

### Appendix A: Probability Calculation Examples

**Example 1: Full House Probability**

Given: `[5, 5, 5, 2, 6]`, keep `[T, T, T, F, F]`

Need: Any pair (2,2), (6,6), or any matching pair

```
Total outcomes when rolling 2 dice: 6² = 36

Favorable outcomes:
- Rolling (1,1): 1 way
- Rolling (2,2): 1 way
- Rolling (3,3): 1 way
- Rolling (4,4): 1 way
- Rolling (5,5): 1 way
- Rolling (6,6): 1 way

Total favorable: 6

P(Full House) = 6/36 = 1/6 ≈ 16.67%
```

---

**Example 2: Dicee Continuation**

Given: `[3, 3, 3, 3, 4]`, keep `[T, T, T, T, F]`

Need: Roll a 3

```
Total outcomes: 6
Favorable outcomes: 1 (rolling a 3)

P(Dicee) = 1/6 ≈ 16.67%
```

---

### Appendix B: EV Calculation Example

**Scenario:** `[5, 5, 5, 2, 6]`, 1 roll left

**Available categories:** Fives, Chance, Full House

**EV Calculations:**

1. **Score Fives now:**
   ```
   EV = 15 (guaranteed)
   ```

2. **Score Chance now:**
   ```
   EV = 28 (guaranteed: 5+5+5+2+6)
   ```

3. **Reroll for Full House:**
   ```
   Keep: [5,5,5]
   Reroll: [2,6]
   
   P(get pair) = 6/36 = 1/6
   Score if success = 25
   Score if fail = 0 (must use Chance later for ~14 pts avg)
   
   EV = (1/6 × 25) + (5/6 × 0) = 4.17
   ```

**Optimal Decision:** Score Chance (EV = 28)

**If player chooses Fives:**
- EV difference: 15 - 28 = -13 points
- Decision quality: "Suboptimal"

---

### Appendix C: Service Health Checks

**Liveness Probes:**

```yaml
# Probability Engine (WASM)
GET /health/live
Response: { "status": "ok", "version": "1.0.0" }

# Decision Analyzer
GET /health/live
Response: { "status": "ok", "uptime": 3600, "version": "1.2.0" }

# Monte Carlo Simulator
GET /health/live
Response: { "status": "ok", "gpu_available": true }

# Learning Tracker
GET /health/live
Response: { "status": "ok", "db_connected": true }
```

**Readiness Probes:**

```yaml
# Decision Analyzer
GET /health/ready
Response: {
  "status": "ready",
  "dependencies": {
    "redis": "connected",
    "postgres": "connected",
    "wasm_engine": "loaded"
  }
}
```

---

### Appendix D: Error Codes Reference

| Code | Description | HTTP Status | Resolution |
|------|-------------|-------------|------------|
| `INVALID_DICE_STATE` | Malformed dice input | 400 | Fix request format |
| `INVALID_KEPT_MASK` | Kept mask length ≠ 5 | 400 | Fix request format |
| `INVALID_CATEGORY` | Unknown category name | 400 | Use valid category |
| `CATEGORY_UNAVAILABLE` | Already scored | 409 | Choose different |
| `COMPUTATION_TIMEOUT` | Exceeded deadline | 504 | Retry or simplify |
| `SERVICE_UNAVAILABLE` | Backend down | 503 | Retry with backoff |
| `RATE_LIMIT_EXCEEDED` | Too many requests | 429 | Wait and retry |
| `CACHE_INCONSISTENCY` | Cache vs. fresh mismatch | 500 | Invalidate cache |
| `INVARIANT_VIOLATION` | Math invariant broken | 500 | Report bug |

---

### Appendix E: Monitoring Metrics

**Key Metrics to Track:**

```yaml
# Performance
- probability_calculation_latency_ms (P50, P95, P99)
- decision_analysis_latency_ms (P50, P95, P99)
- monte_carlo_duration_ms (P50, P95, P99)
- api_response_time_ms (P50, P95, P99)

# Throughput
- requests_per_second (by endpoint)
- calculations_per_second
- cache_hit_rate (percentage)
- cache_miss_rate (percentage)

# Quality
- calculation_accuracy_delta (vs. reference)
- ev_calculation_errors (count)
- invariant_violations (count)
- cache_inconsistencies (count)

# Business
- active_games (gauge)
- games_completed_per_hour (rate)
- decision_quality_avg (by skill level)
- tool_unlocks_per_day (rate)
```

---

**Document Status:** ✅ RFC Ready for Review  
**Next Steps:**
1. Circulate for team review
2. Address feedback and update
3. Final approval → Begin Phase 1 implementation
4. Create RFC-002 (Educational Alignment)

---

**Related Documents:**
- RFC-002: Educational Alignment & Curriculum Integration (TBD)
- RFC-003: Data Contracts & Event Schema (TBD)
- RFC-004: Frontend-Backend Integration Contract (TBD)
- RFC-005: Adaptive Learning Model Specification (TBD)
- RFC-006: Security & Privacy Architecture (TBD)
