# RFC-003: Data Contracts & Event Schema
**Project:** Dicee — Educational Probability Platform  
**RFC Status:** Draft → Review  
**Version:** 1.0  
**Date:** October 25, 2025  
**Authors:** Engineering Team  
**Reviewers:** TBD

---

## Document Status & Versioning

| Version | Date | Changes | Status |
|---------|------|---------|--------|
| 1.0 | 2025-10-25 | Initial data contracts specification | Superseded |
| 1.1 | 2025-10-25 | Post-review revision: event categorization, slimmed events, integrity rules, invariants | Current |

**Review Summary:** Strong foundation with critical improvements applied. Split events into domain/analysis/telemetry streams, reduced event payload sizes, added game integrity rules and safety invariants, strengthened audit trail.

**Related RFCs:**
- RFC-001: Statistical Engine Architecture ✅
- RFC-002: UI/UX Canvas Design ✅
- RFC-004: Game Loop & Mechanics (Next)
- RFC-005: Adaptive Learning Model (Next)
- RFC-006: Event Model & Telemetry (Depends on this)
- RFC-007: API Integration Contract (Depends on this)

**Dependencies:**
- This RFC defines contracts used by all other RFCs
- RFC-006 will implement persistence for these schemas
- RFC-007 will implement transport for these contracts

---

## Abstract

This RFC specifies the **canonical data contracts** for the Dicee platform. It defines all event schemas, API request/response formats, data validation rules, and schema versioning strategies. These contracts form the **interface boundary** between all services (WASM Engine, Decision Analyzer, Learning Tracker, Frontend) and ensure type safety, backward compatibility, and data integrity across the system.

**Key Innovation:** Domain-driven event sourcing with strict schema versioning, enabling complete game reconstruction and time-travel debugging while maintaining forward/backward compatibility.

---

## Table of Contents

1. [Design Principles](#1-design-principles)
2. [Schema Versioning Strategy](#2-schema-versioning-strategy)
3. [Event Categorization & Streams](#3-event-categorization--streams)
4. [Core Type Definitions](#4-core-type-definitions)
5. [Event Schema Specification](#5-event-schema-specification)
6. [API Request/Response Contracts](#6-api-requestresponse-contracts)
7. [WebSocket Protocol](#7-websocket-protocol)
8. [Data Validation Rules](#8-data-validation-rules)
9. [Game Integrity Rules](#9-game-integrity-rules)
10. [Safety Invariants](#10-safety-invariants)
11. [Error Schema](#11-error-schema)
12. [Schema Evolution Guidelines](#12-schema-evolution-guidelines)
13. [Implementation Checklist](#13-implementation-checklist)
14. [Appendices](#14-appendices)

---

## 1. Design Principles

### 1.1 Core Principles

**1. Events Are Immutable**
- Once written, events cannot be modified or deleted
- All state changes are captured as new events
- Game state is derived from event replay

**2. Schemas Are Versioned**
- Every schema has a version field (semver)
- Breaking changes increment major version
- All services must handle multiple schema versions
- Backward compatibility for 2 major versions

**3. Strong Typing**
- All contracts have TypeScript definitions
- Rust types for WASM engine
- Python Pydantic models for services
- JSON Schema for validation

**4. Explicit Over Implicit**
- All fields are required unless marked optional
- No implicit type coercion
- Validation errors are detailed and actionable

**5. Traceable**
- Every event has `traceId` for distributed tracing
- `causalChain` links cause-and-effect
- Timestamps in ISO 8601 format (UTC)

### 1.2 Naming Conventions

**Events:** PascalCase + "Event" suffix
- ✅ `RollEvent`, `ScoreDecisionEvent`
- ❌ `roll_event`, `score_evt`

**Fields:** camelCase
- ✅ `diceResult`, `timeToDecision`
- ❌ `dice_result`, `TimeToDecision`

**Enums:** lowercase with underscores
- ✅ `"three_of_kind"`, `"large_straight"`
- ❌ `"ThreeOfKind"`, `"largeStraight"`

**Timestamps:** Unix epoch milliseconds (number) OR ISO 8601 strings
- ✅ `1698765432000` or `"2024-10-31T12:30:32.000Z"`
- ❌ `"2024-10-31"`, `"12:30 PM"`

---

## 2. Schema Versioning Strategy

### 2.1 Version Format

All schemas follow **semantic versioning**:

```
MAJOR.MINOR.PATCH

MAJOR: Breaking changes (remove field, change type)
MINOR: Additive changes (new optional field)
PATCH: Documentation or validation refinements
```

### 2.2 Version Compatibility Matrix

| Current Version | Can Read | Can Write |
|----------------|----------|-----------|
| 1.0.0 | 1.x.x | 1.0.x |
| 1.5.0 | 1.x.x | 1.5.x |
| 2.0.0 | 1.x.x, 2.x.x | 2.0.x |
| 2.1.0 | 1.x.x, 2.x.x | 2.1.x |

**Rules:**
- Services must read all minor versions within their major version
- Services must read the previous major version (1 major back)
- Services write only their exact version

### 2.3 Schema Migration Process

**Adding a field (MINOR version bump):**

```typescript
// v1.0.0
interface RollEvent {
  eventType: "roll";
  diceResult: number[];
}

// v1.1.0 - Add optional field
interface RollEvent {
  eventType: "roll";
  eventVersion: "1.1.0";
  diceResult: number[];
  keptMask?: boolean[];  // NEW - optional for backward compat
}
```

**Breaking change (MAJOR version bump):**

```typescript
// v1.x.x
interface RollEvent {
  diceResult: number[];  // Array of 5 numbers
}

// v2.0.0 - Change field type
interface RollEvent {
  eventVersion: "2.0.0";
  diceResult: [number, number, number, number, number];  // Tuple
}
```

---

## 3. Event Categorization & Streams

### 3.1 Three-Stream Architecture

Events are categorized into three distinct streams to optimize storage, querying, and replay performance:

| Stream Type | Purpose | Retention | Examples |
|-------------|---------|-----------|----------|
| **Domain Events** | Game state reconstruction | Permanent | `GameCreatedEvent`, `RollEvent`, `ScoreDecisionEvent` |
| **Analysis Events** | Statistical computations | 90 days | `AnalysisComputedEvent`, `RecommendationEvent` |
| **Telemetry Events** | Learning metrics & UX | 30 days | `HoverEvent`, `PredictionEvent`, `HintRequestedEvent` |

**Why Three Streams?**

1. **Storage Efficiency** — Domain events are small and permanent; heavy analysis results can be pruned
2. **Replay Performance** — Rebuilding game state doesn't require loading millions of hover events
3. **Query Optimization** — Different access patterns (real-time vs. batch analytics)
4. **Cost Control** — Telemetry can use cheaper storage; domain events use premium durability

### 3.2 Stream Routing

Every event has a `streamType` field that determines routing:

```typescript
type StreamType = 
  | "domain"      // Required for game state reconstruction
  | "analysis"    // Computational results (can be recomputed)
  | "telemetry";  // UX metrics for learning analytics

interface BaseGameEvent {
  // ... other fields
  streamType: StreamType;
}
```

**Routing Rules:**

```typescript
const STREAM_ROUTING = {
  domain: {
    storage: "postgresql",
    retention: "permanent",
    replication: "sync",
    backup: "hourly"
  },
  analysis: {
    storage: "postgresql",
    retention: "90_days",
    replication: "async",
    backup: "daily"
  },
  telemetry: {
    storage: "timescaledb",  // Or ClickHouse for analytics
    retention: "30_days",
    replication: "async",
    backup: "weekly"
  }
};
```

### 3.3 Event Classification Matrix

| Event Type | Stream | Rationale |
|------------|--------|-----------|
| `GameCreatedEvent` | domain | Required for reconstruction |
| `GameStartedEvent` | domain | Required for reconstruction |
| `RollEvent` | domain | Core game action |
| `RerollEvent` | domain | Core game action |
| `ScoreDecisionEvent` | domain | Core game action |
| `GameCompletedEvent` | domain | Required for reconstruction |
| `AnalysisComputedEvent` | analysis | Can be recomputed from domain events |
| `RecommendationEvent` | analysis | Can be recomputed from domain events |
| `HoverEvent` | telemetry | Learning metric only |
| `PredictionEvent` | telemetry | Learning metric only |
| `HintRequestedEvent` | telemetry | Learning metric only |
| `ErrorEvent` | domain | Required for audit trail |

### 3.4 Event Linking

Analysis and telemetry events link back to domain events via `causalChain`:

```typescript
// Domain event
const rollEvent: RollEvent = {
  id: "evt_001",
  streamType: "domain",
  // ...
};

// Analysis event (linked)
const analysisEvent: AnalysisComputedEvent = {
  id: "evt_002",
  streamType: "analysis",
  causalChain: ["evt_001"],  // Links to roll
  // ...
};

// Telemetry event (linked)
const hoverEvent: HoverEvent = {
  id: "evt_003",
  streamType: "telemetry",
  causalChain: ["evt_001"],  // Links to roll
  // ...
};
```

---

## 4. Core Type Definitions

### 4.1 Base Types

```typescript
// Primitive Types
type UUID = string;  // UUIDv4 format
type Timestamp = number;  // Unix epoch milliseconds
type ISODateTime = string;  // ISO 8601 format

// Dice
type DieValue = 1 | 2 | 3 | 4 | 5 | 6;
type DiceArray = [DieValue, DieValue, DieValue, DieValue, DieValue];
type KeptMask = [boolean, boolean, boolean, boolean, boolean];

// Roll Types
type RollType = "initial" | "reroll";

// Event Source
type EventSource = "client" | "server" | "engine" | "system";

// Yahtzee Categories
type YahtzeeCategory =
  // Upper section
  | "ones"
  | "twos"
  | "threes"
  | "fours"
  | "fives"
  | "sixes"
  // Lower section
  | "three_of_kind"
  | "four_of_kind"
  | "full_house"
  | "small_straight"
  | "large_straight"
  | "yahtzee"
  | "chance";

// Decision Quality
type DecisionQuality =
  | "optimal"      // Best EV choice
  | "excellent"    // Within 5% of optimal
  | "good"         // Within 10% of optimal
  | "acceptable"   // Within 20% of optimal
  | "suboptimal"   // Within 50% of optimal
  | "poor";        // >50% below optimal

// Player Skill Level
type SkillLevel =
  | "beginner"     // Learning probability basics
  | "intermediate" // Understanding EV
  | "advanced"     // Mastering strategy
  | "expert";      // Optimal play

// Game Status
type GameStatus =
  | "waiting"      // Lobby, not started
  | "active"       // In progress
  | "completed"    // Finished normally
  | "abandoned";   // Player left

// Turn Phase
type TurnPhase =
  | "initial_roll" // Turn 1, roll 1
  | "mid_turn"     // Rolls 2-3
  | "scoring";     // Choosing category
```

### 4.2 Scorecard Model

```typescript
interface Scorecard {
  // Upper Section
  ones?: number;
  twos?: number;
  threes?: number;
  fours?: number;
  fives?: number;
  sixes?: number;
  upperSubtotal: number;     // Sum of upper section
  upperBonus: number;        // 35 if upperSubtotal >= 63, else 0
  upperTotal: number;        // upperSubtotal + upperBonus
  
  // Lower Section
  threeOfKind?: number;
  fourOfKind?: number;
  fullHouse?: number;        // 25 or 0
  smallStraight?: number;    // 30 or 0
  largeStraight?: number;    // 40 or 0
  yahtzee?: number;          // 50 or 0
  chance?: number;
  yahtzeeBonus: number;      // 100 per extra Yahtzee
  lowerTotal: number;        // Sum of lower section
  
  // Grand Total
  grandTotal: number;        // upperTotal + lowerTotal
  
  // Metadata
  categoriesRemaining: YahtzeeCategory[];
  turnsCompleted: number;    // 0-13
}
```

### 4.3 Probability Vector

```typescript
interface ProbabilityVector {
  // Per-category probabilities and values
  categories: Record<YahtzeeCategory, CategoryStatistics>;
  
  // Optimal recommendation
  optimalCategory: YahtzeeCategory;
  optimalEV: number;
  
  // Metadata
  computationMethod: "exact" | "monte_carlo" | "heuristic";
  confidence: number;        // 0.0-1.0 (1.0 for exact)
  rollsRemaining: number;    // 0-2
  computationTimeMs: number;
  cacheHit: boolean;
}

interface CategoryStatistics {
  // Current roll
  probability: number;       // 0.0-1.0
  expectedValue: number;     // Points if scored now
  currentScore: number;      // Points for this roll
  
  // Multi-roll projection (if rollsRemaining > 0)
  futureEV?: number;         // EV after optimal rerolls
  rerollRecommendation?: {
    shouldReroll: boolean;
    keptMask: KeptMask;
    evGain: number;          // Expected improvement
  };
}
```

### 4.4 Decision Recommendation

```typescript
interface DecisionRecommendation {
  // Primary recommendation
  action: "roll" | "reroll" | "score";
  
  // If action is "reroll"
  keptMask?: KeptMask;
  rerollReason?: string;
  expectedImprovement?: number;  // EV gain from reroll
  
  // If action is "score"
  recommendedCategory?: YahtzeeCategory;
  expectedValue?: number;
  
  // Alternative options
  alternatives: Array<{
    category: YahtzeeCategory;
    ev: number;
    evDifference: number;     // Difference from optimal
    reasoning: string;
  }>;
  
  // Decision confidence
  confidence: number;          // 0.0-1.0
  reasoning: string;           // Human-readable explanation
  
  // Educational context
  pedagogyLevel: SkillLevel;
  learningTip?: string;
}
```

---

## 5. Event Schema Specification

### 5.1 Base Event Schema

All events inherit from this base:

```typescript
interface BaseGameEvent {
  // Event Identity
  id: UUID;                   // Event unique identifier
  eventType: string;          // Discriminator for event type
  eventVersion: string;       // Schema version (semver)
  sequenceNumber: number;     // Monotonic counter for ordering during replay
  
  // Stream Classification
  streamType: StreamType;     // "domain" | "analysis" | "telemetry"
  
  // Event Source
  eventSource: EventSource;   // "client" | "server" | "engine" | "system"
  
  // Correlation
  traceId: UUID;             // Distributed tracing ID
  causalChain: UUID[];        // Parent event IDs (cause chain)
  
  // Temporal
  timestamp: Timestamp;       // Event creation time (epoch ms)
  
  // Game Context
  gameId: UUID;
  playerId: UUID;
  turnNumber: number;         // 1-13
  rollNumber: number;         // 1-3 within turn
  
  // Execution Metadata (optional)
  computationTimeMs?: number;
  serviceName?: string;       // Which service generated this
  
  // Client Context (optional)
  clientInfo?: {
    userAgent?: string;
    platform?: string;        // "web" | "ios" | "android"
    screenSize?: { width: number; height: number };
  };
}
```

**Validation Rules:**
- `id` must be UUIDv4
- `eventType` must match one of registered event types
- `eventVersion` must be valid semver string
- `sequenceNumber` must be monotonically increasing per game
- `streamType` must be "domain", "analysis", or "telemetry"
- `eventSource` must be "client", "server", "engine", or "system"
- `timestamp` must be within 5 minutes of server time
- `turnNumber` must be 1-13
- `rollNumber` must be 1-3
- `causalChain` must reference existing event IDs

### 5.2 Game Lifecycle Events

#### GameCreatedEvent

```typescript
interface GameCreatedEvent extends BaseGameEvent {
  eventType: "game_created";
  eventVersion: "1.0.0";
  streamType: "domain";
  eventSource: "server";
  
  // Game configuration
  gameMode: "solo" | "multiplayer" | "tutorial";
  playerIds: UUID[];
  settings: {
    rulesVariant?: "standard" | "forced_yahtzee" | "joker_rules";
    timeLimit?: number;       // Seconds per turn (optional)
    allowUndo?: boolean;
  };
  
  // Host info
  hostPlayerId: UUID;
}
```

#### GameStartedEvent

```typescript
interface GameStartedEvent extends BaseGameEvent {
  eventType: "game_started";
  eventVersion: "1.0.0";
  
  // Turn order
  turnOrder: UUID[];         // Randomized player order
  firstPlayerId: UUID;
  
  // Starting state
  initialScorecards: Record<UUID, Scorecard>;
}
```

#### GameCompletedEvent

```typescript
interface GameCompletedEvent extends BaseGameEvent {
  eventType: "game_completed";
  eventVersion: "1.0.0";
  
  // Final results
  finalScores: Record<UUID, number>;
  winnerIds: UUID[];         // Can be tie
  
  // Game statistics
  totalTurns: number;
  gameDurationMs: number;
  averageDecisionTimeMs: number;
  
  // Completion reason
  reason: "normal" | "abandoned" | "timeout";
}
```

### 5.3 Turn Events

#### RollEvent

```typescript
interface RollEvent extends BaseGameEvent {
  eventType: "roll";
  eventVersion: "2.0.0";
  streamType: "domain";
  eventSource: "client";
  
  // Roll classification
  rollType: RollType;        // "initial" | "reroll"
  
  // Roll result
  diceResult: DiceArray;
  keptMask: KeptMask;        // Which dice were kept from previous
  
  // Pre-roll context (for rerolls)
  preRollDice?: DiceArray;   // Dice before this roll (if reroll)
  intentSignal?: "exploring" | "targeting_category" | "conservative";
  
  // Analysis link (probabilities computed separately)
  analysisId?: UUID;         // Link to AnalysisComputedEvent
  
  // Timing
  timeFromPreviousAction: number;  // ms
}
```

**Validation Rules:**
- `diceResult` must be 5 values, each 1-6
- `keptMask` must be 5 booleans
- If `rollType === "initial"`, `keptMask` should be all false
- If `rollType === "reroll"`, `preRollDice` must be present
- `rollsRemaining` = `3 - rollNumber`

**Design Note:** Probabilities and recommendations are stored in separate `AnalysisComputedEvent` to keep domain events lightweight. This enables:
- Faster game state reconstruction (don't need to load heavy analysis data)
- Ability to recompute analysis without replaying entire game
- Separate retention policies for domain vs. analysis data

#### RerollEvent (DEPRECATED)

**Status:** Deprecated in v2.0.0. Use `RollEvent` with `rollType: "reroll"` instead.

```typescript
// DEPRECATED: For backward compatibility only
interface RerollEvent extends BaseGameEvent {
  eventType: "reroll";
  eventVersion: "1.0.0";
  streamType: "domain";
  
  // Reroll decision
  previousDice: DiceArray;
  keptMask: KeptMask;        // Dice to keep
  newDice: DiceArray;        // Result after reroll
  
  // Decision quality
  wasOptimal: boolean;
  optimalKeptMask: KeptMask;
  evDifference: number;      // Loss from suboptimal choice
  
  // Metadata
  timeToDecision: number;    // ms from roll to reroll
  hintViewed: boolean;
}
```

**Migration:** Systems reading v1 events should map `RerollEvent` → `RollEvent` with:
- `rollType = "reroll"`
- `diceResult = newDice`
- `preRollDice = previousDice`

#### ScoreDecisionEvent

```typescript
interface ScoreDecisionEvent extends BaseGameEvent {
  eventType: "score";
  eventVersion: "1.1.0";
  
  // Scoring decision
  chosenCategory: YahtzeeCategory;
  pointsEarned: number;
  
  // Decision quality analysis
  expectedValue: number;
  optimalCategory: YahtzeeCategory;
  optimalEV: number;
  evDifference: number;      // Optimal EV - Actual EV
  decisionQuality: DecisionQuality;
  
  // Scorecard update
  previousScorecard: Scorecard;
  updatedScorecard: Scorecard;
  
  // Behavioral telemetry
  timeToDecision: number;    // ms from final roll to score
  categoriesConsidered: YahtzeeCategory[];  // Hover sequence
  backtrackCount: number;    // Number of category changes
  hintRequested: boolean;
  
  // Educational context
  learningTip?: string;
  conceptsApplied?: string[];  // ["expected_value", "probability"]
}
```

**Validation Rules:**
- `chosenCategory` must not be already scored
- `pointsEarned` must match scoring rules for category
- `updatedScorecard` must reflect new score correctly
- `evDifference` must be non-negative (optimal >= actual)

### 5.4 Analysis Events

Analysis events contain computational results that can be recomputed from domain events. They are stored separately with shorter retention periods.

#### AnalysisComputedEvent

```typescript
interface AnalysisComputedEvent extends BaseGameEvent {
  eventType: "analysis_computed";
  eventVersion: "1.0.0";
  streamType: "analysis";
  eventSource: "engine";
  
  // Analysis identifier (linked from RollEvent)
  analysisId: UUID;
  
  // Source event this analysis is for
  sourceEventId: UUID;       // The RollEvent this analyzes
  
  // Computed probabilities
  probabilities: ProbabilityVector;
  
  // Decision recommendations
  recommendations: DecisionRecommendation[];
  
  // Computation metadata
  computationMethod: "exact" | "monte_carlo" | "heuristic";
  confidence: number;        // 0.0-1.0
  cacheHit: boolean;
}
```

**Validation Rules:**
- `analysisId` must match `analysisId` field in corresponding `RollEvent`
- `sourceEventId` must reference a valid `RollEvent`
- `computationMethod` determines `confidence` range:
  - "exact" must have `confidence = 1.0`
  - "monte_carlo" must have `confidence >= 0.95`
  - "heuristic" may have lower confidence

#### RecommendationEvent (Optional Future Extension)

```typescript
interface RecommendationEvent extends BaseGameEvent {
  eventType: "recommendation";
  eventVersion: "1.0.0";
  streamType: "analysis";
  eventSource: "server";
  
  // Context
  gameStateSnapshot: {
    diceResult: DiceArray;
    scorecard: Scorecard;
    rollsRemaining: number;
  };
  
  // Recommendation
  recommendation: DecisionRecommendation;
  
  // Adaptive context
  playerSkillLevel: SkillLevel;
  pedagogyStrategy: string;
}
```

**Design Rationale:**

Separating analysis into its own events provides:

1. **Storage efficiency** — Domain events stay small (~500 bytes), analysis events are larger (~5-10KB)
2. **Replay performance** — Reconstructing game state doesn't require loading analysis
3. **Recomputation** — Can delete and regenerate analysis without losing game data
4. **Different retention** — Keep domain events forever, analysis events for 90 days
5. **Query optimization** — Separate indexes for gameplay vs. analytics queries

### 5.5 UI Telemetry Events

Telemetry events capture learning metrics and UX behavior. These are stored with the shortest retention (30 days) and are optimized for analytics queries.

#### HoverEvent

```typescript
interface HoverEvent extends BaseGameEvent {
  eventType: "hover";
  eventVersion: "1.0.0";
  streamType: "telemetry";
  eventSource: "client";
  
  // Hover target
  categoryHovered: YahtzeeCategory;
  hoverDuration: number;     // ms
  
  // Contextual calculation
  wouldScore: number;
  currentEV: number;
  isOptimal: boolean;
  
  // Sequence tracking
  hoverSequence: number;     // Nth hover in this turn
}
```

#### PredictionEvent

```typescript
interface PredictionEvent extends BaseGameEvent {
  eventType: "prediction";
  eventVersion: "1.0.0";
  streamType: "telemetry";
  eventSource: "client";
  
  // Player prediction
  predictedCategory: YahtzeeCategory;
  predictedProbability: number;  // 0.0-1.0
  confidenceLevel: "low" | "medium" | "high";
  
  // Actual values
  actualProbability: number;
  accuracyDelta: number;     // abs(predicted - actual)
  
  // Reward calculation
  predictionScore: number;   // Gamification points
}
```

#### HintRequestedEvent

```typescript
interface HintRequestedEvent extends BaseGameEvent {
  eventType: "hint_requested";
  eventVersion: "1.0.0";
  streamType: "telemetry";
  eventSource: "client";
  
  // Hint context
  currentDice: DiceArray;
  availableCategories: YahtzeeCategory[];
  
  // Hint delivered
  hintType: "optimal_category" | "reroll_strategy" | "probability_explanation";
  hintContent: string;
  
  // Learning impact
  playerSkillLevel: SkillLevel;
  conceptsIntroduced: string[];
}
```

### 5.6 Error Events

```typescript
interface ErrorEvent extends BaseGameEvent {
  eventType: "error";
  eventVersion: "1.0.0";
  streamType: "domain";      // Errors are part of audit trail
  eventSource: "system";
  
  // Error details
  errorCode: string;         // "INVALID_MOVE", "TIMEOUT", etc.
  errorMessage: string;
  severity: "warning" | "error" | "fatal";
  
  // Context
  failedAction: string;
  failedPayload?: any;
  
  // Recovery
  recovered: boolean;
  recoveryAction?: string;
}
```

---

## 6. API Request/Response Contracts

### 6.1 Probability Calculation Endpoint

**POST** `/api/v1/stats/probabilities`

**Request:**

```typescript
interface ProbabilityRequest {
  // Current state
  diceResult: DiceArray;
  keptMask: KeptMask;
  rollsRemaining: number;    // 0-2
  
  // Game context
  availableCategories: YahtzeeCategory[];
  currentScorecard: Scorecard;
  
  // Optional context
  opponentScores?: number[];
  skillLevel?: SkillLevel;
  
  // Computation preferences
  computationMethod?: "exact" | "monte_carlo" | "auto";
  maxComputationTimeMs?: number;  // Timeout hint
}
```

**Response:**

```typescript
interface ProbabilityResponse {
  // Calculation result
  probabilities: ProbabilityVector;
  
  // Metadata
  requestId: UUID;
  computationTimeMs: number;
  cacheHit: boolean;
  
  // Status
  success: boolean;
  error?: ErrorDetail;
}
```

### 5.2 Decision Recommendation Endpoint

**POST** `/api/v1/stats/recommendation`

**Request:**

```typescript
interface RecommendationRequest extends ProbabilityRequest {
  // Additional context for recommendations
  skillLevel: SkillLevel;
  showAlternatives: boolean;
  explanationDepth: "minimal" | "standard" | "detailed";
  
  // Player history (optional)
  recentDecisions?: ScoreDecisionEvent[];
}
```

**Response:**

```typescript
interface RecommendationResponse {
  // Primary recommendation
  recommendation: DecisionRecommendation;
  
  // Supporting data
  probabilities: ProbabilityVector;
  
  // Metadata
  requestId: UUID;
  computationTimeMs: number;
  
  // Status
  success: boolean;
  error?: ErrorDetail;
}
```

### 5.3 Decision Evaluation Endpoint

**POST** `/api/v1/stats/evaluate`

**Request:**

```typescript
interface EvaluationRequest {
  // Decision to evaluate
  gameState: {
    diceResult: DiceArray;
    rollNumber: number;
    availableCategories: YahtzeeCategory[];
    scorecard: Scorecard;
  };
  
  // Player's choice
  chosenCategory: YahtzeeCategory;
  
  // Context
  timeToDecision: number;    // ms
  skillLevel: SkillLevel;
}
```

**Response:**

```typescript
interface EvaluationResponse {
  // Quality assessment
  decisionQuality: DecisionQuality;
  pointsEarned: number;
  expectedValue: number;
  
  // Optimal comparison
  optimalCategory: YahtzeeCategory;
  optimalEV: number;
  evDifference: number;
  evPercentageLoss: number;  // (optimal - actual) / optimal
  
  // Feedback
  feedback: {
    summary: string;
    reasoning: string;
    learningTip?: string;
    mistakeCategory?: "probability" | "expected_value" | "strategy";
  };
  
  // Metadata
  requestId: UUID;
  success: boolean;
  error?: ErrorDetail;
}
```

### 5.4 Game State Query Endpoint

**GET** `/api/v1/games/{gameId}`

**Response:**

```typescript
interface GameStateResponse {
  // Game info
  gameId: UUID;
  status: GameStatus;
  mode: "solo" | "multiplayer" | "tutorial";
  
  // Players
  players: Array<{
    playerId: UUID;
    displayName: string;
    scorecard: Scorecard;
    isCurrentPlayer: boolean;
  }>;
  
  // Current turn
  currentTurn: {
    playerId: UUID;
    turnNumber: number;
    rollNumber: number;
    currentDice?: DiceArray;
    keptMask?: KeptMask;
    phase: TurnPhase;
  };
  
  // Event stream
  events: BaseGameEvent[];   // Full history
  
  // Timestamps
  createdAt: ISODateTime;
  startedAt?: ISODateTime;
  completedAt?: ISODateTime;
  
  // Metadata
  success: boolean;
  error?: ErrorDetail;
}
```

---

## 7. WebSocket Protocol

### 6.1 Connection Lifecycle

**Connection URL:** `wss://api.dicee.app/v1/game/{gameId}`

**Authentication:** JWT token in header or query param

```typescript
// Connection
const ws = new WebSocket(
  'wss://api.dicee.app/v1/game/123e4567',
  { headers: { 'Authorization': 'Bearer <jwt>' } }
);
```

### 6.2 Client → Server Messages

#### Join Game

```typescript
interface JoinMessage {
  type: "join";
  playerId: UUID;
  clientVersion: string;      // "1.0.0"
  reconnect: boolean;         // Resume existing session
}
```

#### Roll Dice

```typescript
interface RollMessage {
  type: "roll";
  keptMask?: KeptMask;       // Omit for initial roll
  requestProbabilities: boolean;
}
```

#### Score Category

```typescript
interface ScoreMessage {
  type: "score";
  category: YahtzeeCategory;
}
```

#### Request Hint

```typescript
interface HintRequestMessage {
  type: "request_hint";
  explanationDepth: "minimal" | "standard" | "detailed";
}
```

#### Hover Category (telemetry)

```typescript
interface HoverMessage {
  type: "hover";
  category: YahtzeeCategory;
  hoverStartTime: Timestamp;
}
```

### 6.3 Server → Client Messages

#### Game State Update

```typescript
interface StateUpdateMessage {
  type: "state_update";
  gameState: GameStateResponse;
  timestamp: Timestamp;
}
```

#### Roll Result

```typescript
interface RollResultMessage {
  type: "roll_result";
  event: RollEvent;          // Full event with probabilities
}
```

#### Turn Changed

```typescript
interface TurnChangedMessage {
  type: "turn_changed";
  newPlayerId: UUID;
  playerName: string;
  turnNumber: number;
}
```

#### Hint Delivered

```typescript
interface HintMessage {
  type: "hint";
  recommendation: DecisionRecommendation;
}
```

#### Error

```typescript
interface ErrorMessage {
  type: "error";
  errorCode: string;
  message: string;
  severity: "warning" | "error" | "fatal";
  recoverable: boolean;
}
```

#### Connection Status

```typescript
interface ConnectionStatusMessage {
  type: "connection_status";
  status: "connected" | "reconnecting" | "disconnected";
  reason?: string;
}
```

---

## 8. Data Validation Rules

### 7.1 Dice Validation

```typescript
function validateDiceArray(dice: any): dice is DiceArray {
  return (
    Array.isArray(dice) &&
    dice.length === 5 &&
    dice.every(d => Number.isInteger(d) && d >= 1 && d <= 6)
  );
}

function validateKeptMask(mask: any): mask is KeptMask {
  return (
    Array.isArray(mask) &&
    mask.length === 5 &&
    mask.every(m => typeof m === 'boolean')
  );
}
```

### 7.2 Scorecard Validation

```typescript
function validateScorecard(scorecard: Scorecard): ValidationResult {
  const errors: string[] = [];
  
  // Upper section validation
  const upperScores = [
    scorecard.ones, scorecard.twos, scorecard.threes,
    scorecard.fours, scorecard.fives, scorecard.sixes
  ].filter(s => s !== undefined);
  
  const upperSum = upperScores.reduce((a, b) => a! + b!, 0);
  
  if (upperSum !== scorecard.upperSubtotal) {
    errors.push(`Upper subtotal mismatch: ${upperSum} != ${scorecard.upperSubtotal}`);
  }
  
  // Upper bonus validation
  const expectedBonus = scorecard.upperSubtotal >= 63 ? 35 : 0;
  if (scorecard.upperBonus !== expectedBonus) {
    errors.push(`Upper bonus should be ${expectedBonus}, got ${scorecard.upperBonus}`);
  }
  
  // Category value validation
  if (scorecard.fullHouse !== undefined && ![0, 25].includes(scorecard.fullHouse)) {
    errors.push(`Full house must be 0 or 25, got ${scorecard.fullHouse}`);
  }
  
  if (scorecard.smallStraight !== undefined && ![0, 30].includes(scorecard.smallStraight)) {
    errors.push(`Small straight must be 0 or 30`);
  }
  
  if (scorecard.largeStraight !== undefined && ![0, 40].includes(scorecard.largeStraight)) {
    errors.push(`Large straight must be 0 or 40`);
  }
  
  if (scorecard.yahtzee !== undefined && ![0, 50].includes(scorecard.yahtzee)) {
    errors.push(`Yahtzee must be 0 or 50`);
  }
  
  // Yahtzee bonus validation (must be multiple of 100)
  if (scorecard.yahtzeeBonus % 100 !== 0) {
    errors.push(`Yahtzee bonus must be multiple of 100`);
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}
```

### 7.3 Event Validation

```typescript
function validateEvent(event: BaseGameEvent): ValidationResult {
  const errors: string[] = [];
  
  // UUID format validation
  if (!isValidUUID(event.id)) {
    errors.push(`Invalid event ID format`);
  }
  
  if (!isValidUUID(event.gameId)) {
    errors.push(`Invalid game ID format`);
  }
  
  if (!isValidUUID(event.playerId)) {
    errors.push(`Invalid player ID format`);
  }
  
  // Version validation
  if (!isValidSemver(event.eventVersion)) {
    errors.push(`Invalid event version: ${event.eventVersion}`);
  }
  
  // Range validation
  if (event.turnNumber < 1 || event.turnNumber > 13) {
    errors.push(`Turn number must be 1-13, got ${event.turnNumber}`);
  }
  
  if (event.rollNumber < 1 || event.rollNumber > 3) {
    errors.push(`Roll number must be 1-3, got ${event.rollNumber}`);
  }
  
  // Timestamp validation (within 5 minutes of server time)
  const now = Date.now();
  const timeDiff = Math.abs(now - event.timestamp);
  const fiveMinutes = 5 * 60 * 1000;
  
  if (timeDiff > fiveMinutes) {
    errors.push(`Timestamp too far from server time: ${timeDiff}ms`);
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}
```

### 7.4 Probability Vector Validation

```typescript
function validateProbabilityVector(pv: ProbabilityVector): ValidationResult {
  const errors: string[] = [];
  
  // Probability bounds
  for (const [category, stats] of Object.entries(pv.categories)) {
    if (stats.probability < 0 || stats.probability > 1) {
      errors.push(`${category} probability out of bounds: ${stats.probability}`);
    }
    
    // Exact computation should have confidence = 1.0
    if (pv.computationMethod === "exact" && pv.confidence !== 1.0) {
      errors.push(`Exact computation should have confidence 1.0`);
    }
  }
  
  // Optimal category must exist
  if (!pv.categories[pv.optimalCategory]) {
    errors.push(`Optimal category ${pv.optimalCategory} not in categories`);
  }
  
  // Optimal EV must match category EV
  const optimalStats = pv.categories[pv.optimalCategory];
  if (Math.abs(optimalStats.expectedValue - pv.optimalEV) > 0.01) {
    errors.push(`Optimal EV mismatch`);
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
}
```

---

## 9. Game Integrity Rules

These rules define **illegal game states** that must be prevented by validation. Violating these rules indicates a bug in game logic or potential cheating.

### 9.1 Turn Sequencing Rules

**Rule 9.1.1: Maximum Rolls Per Turn**
- Each turn must have exactly 1-3 rolls
- After 3 rolls, player MUST score
- Attempting a 4th roll is invalid

```typescript
function validateRollCount(events: RollEvent[]): boolean {
  const rollsThisTurn = events.filter(e => 
    e.turnNumber === currentTurn && e.rollType === "roll"
  ).length;
  return rollsThisTurn <= 3;
}
```

**Rule 9.1.2: Turn Advancement**
- Turn number increments only after `ScoreDecisionEvent`
- Cannot skip turns
- Cannot score twice in one turn

```typescript
function validateTurnAdvancement(events: GameEvent[]): boolean {
  const scoreEvents = events.filter(e => e.eventType === "score");
  
  for (let i = 0; i < scoreEvents.length; i++) {
    const expectedTurn = i + 1;
    if (scoreEvents[i].turnNumber !== expectedTurn) {
      return false;  // Turn sequence violation
    }
  }
  return true;
}
```

**Rule 9.1.3: Total Turns Per Game**
- Exactly 13 scoring decisions per player per game
- Game must complete after 13 turns
- Early completion requires explicit `GameCompletedEvent` with reason "abandoned"

### 9.2 Category Uniqueness Rules

**Rule 9.2.1: Category Scored Once**
- Each category can be scored exactly once per player per game
- Attempting to score an already-filled category is invalid

```typescript
function validateCategoryUniqueness(
  scorecard: Scorecard,
  chosenCategory: YahtzeeCategory
): boolean {
  return scorecard[chosenCategory] === undefined;
}
```

**Rule 9.2.2: Category Availability Consistency**
- `categoriesRemaining` in scorecard must match unscored categories
- Length decreases by exactly 1 after each score

```typescript
function validateCategoryList(scorecard: Scorecard): boolean {
  const scoredCount = Object.keys(scorecard).filter(
    k => scorecard[k as YahtzeeCategory] !== undefined
  ).length;
  
  const remainingCount = scorecard.categoriesRemaining.length;
  
  return scoredCount + remainingCount === 13;
}
```

### 9.3 Roll Validity Rules

**Rule 9.3.1: Kept Mask Consistency**
- For `rollType === "initial"`, `keptMask` must be all `false`
- For `rollType === "reroll"`, `keptMask` must have at least one `false` (otherwise, why reroll?)

**Rule 9.3.2: Dice Result Changes**
- After reroll, only unkept dice may change values
- Kept dice must match `preRollDice` values

```typescript
function validateReroll(
  preRollDice: DiceArray,
  keptMask: KeptMask,
  newDice: DiceArray
): boolean {
  for (let i = 0; i < 5; i++) {
    if (keptMask[i] && preRollDice[i] !== newDice[i]) {
      return false;  // Kept die changed value
    }
  }
  return true;
}
```

### 9.4 Scorecard Arithmetic Rules

**Rule 9.4.1: Score Calculation Correctness**
- `pointsEarned` must match the scoring function for the category and dice

```typescript
function validateScore(
  category: YahtzeeCategory,
  dice: DiceArray,
  pointsEarned: number
): boolean {
  const expected = SCORING_RULES[category](dice);
  return pointsEarned === expected;
}
```

**Rule 9.4.2: Upper Bonus Correctness**
- Upper bonus = 35 if `upperSubtotal >= 63`, else 0
- This is recalculated after each upper section score

```typescript
function validateUpperBonus(scorecard: Scorecard): boolean {
  const expected = scorecard.upperSubtotal >= 63 ? 35 : 0;
  return scorecard.upperBonus === expected;
}
```

**Rule 9.4.3: Grand Total Correctness**
- `grandTotal = upperTotal + lowerTotal`
- Must be recalculated after each score

### 9.5 Event Ordering Rules

**Rule 9.5.1: Causal Chain Integrity**
- Every event's `causalChain` must reference events with earlier `sequenceNumber`
- No circular dependencies
- Events cannot cause themselves

```typescript
function validateCausalChain(
  event: BaseGameEvent,
  allEvents: Map<UUID, BaseGameEvent>
): boolean {
  for (const parentId of event.causalChain) {
    const parent = allEvents.get(parentId);
    if (!parent || parent.sequenceNumber >= event.sequenceNumber) {
      return false;
    }
  }
  return true;
}
```

**Rule 9.5.2: Sequence Number Monotonicity**
- `sequenceNumber` must increase monotonically within a game
- No gaps allowed
- Starts at 1

```typescript
function validateSequenceNumbers(events: BaseGameEvent[]): boolean {
  for (let i = 0; i < events.length; i++) {
    if (events[i].sequenceNumber !== i + 1) {
      return false;
    }
  }
  return true;
}
```

### 9.6 Timestamp Consistency Rules

**Rule 9.6.1: Temporal Ordering**
- Events must be ordered by timestamp
- Later `sequenceNumber` implies later or equal timestamp

```typescript
function validateTimestamps(events: BaseGameEvent[]): boolean {
  for (let i = 1; i < events.length; i++) {
    if (events[i].timestamp < events[i-1].timestamp) {
      return false;
    }
  }
  return true;
}
```

---

## 10. Safety Invariants

These are mathematical properties that must hold for all valid data. Violating an invariant indicates corrupted data or calculation errors.

### 10.1 Probability Invariants

**Invariant 10.1.1: Probability Bounds**

For all categories in a `ProbabilityVector`:

```
∀ category: 0 ≤ P(category) ≤ 1
```

```typescript
function checkProbabilityBounds(pv: ProbabilityVector): boolean {
  return Object.values(pv.categories).every(
    stats => stats.probability >= 0 && stats.probability <= 1
  );
}
```

**Invariant 10.1.2: Probability Sum (Upper Bound)**

For disjoint categories (all lower section categories except Yahtzee bonus):

```
Σ P(category) ≤ 1.0 + ε  (where ε accounts for floating point)
```

Note: Sum can exceed 1.0 because categories can overlap (e.g., three-of-a-kind and full house can both match same dice).

**Invariant 10.1.3: Exact Computation Confidence**

```
computationMethod === "exact" ⟹ confidence === 1.0
```

### 10.2 Expected Value Invariants

**Invariant 10.2.1: EV Non-Negativity**

Expected values must be non-negative (you can't lose points):

```
∀ category: EV(category) ≥ 0
```

**Invariant 10.2.2: EV Bounds by Category**

```
EV(ones) ∈ [0, 5]      // Max 5 ones
EV(twos) ∈ [0, 10]     // Max 5 twos
...
EV(sixes) ∈ [0, 30]    // Max 5 sixes
EV(three_of_kind) ∈ [0, 30]  // Max sum
EV(four_of_kind) ∈ [0, 30]
EV(full_house) ∈ {0, 25}      // Binary
EV(small_straight) ∈ {0, 30}
EV(large_straight) ∈ {0, 40}
EV(yahtzee) ∈ {0, 50}
EV(chance) ∈ [5, 30]   // Sum of 5 dice
```

**Invariant 10.2.3: Optimal EV is Maximum**

```
EV(optimal_category) ≥ EV(any_other_category)
```

```typescript
function validateOptimalEV(pv: ProbabilityVector): boolean {
  const optimalEV = pv.optimalEV;
  
  return Object.values(pv.categories).every(
    stats => stats.expectedValue <= optimalEV + 0.01  // Float tolerance
  );
}
```

**Invariant 10.2.4: EV Monotonicity with Rolls**

Expected value should not decrease with more rolls remaining:

```
EV(state, rolls_remaining=2) ≥ EV(state, rolls_remaining=1) ≥ EV(state, rolls_remaining=0)
```

### 10.3 Scorecard Invariants

**Invariant 10.3.1: Score Non-Negativity**

All scores must be non-negative:

```
∀ category: scorecard[category] ≥ 0
```

**Invariant 10.3.2: Upper Section Arithmetic**

```
upperSubtotal = sum(ones, twos, threes, fours, fives, sixes)
upperBonus = (upperSubtotal ≥ 63) ? 35 : 0
upperTotal = upperSubtotal + upperBonus
```

**Invariant 10.3.3: Lower Section Arithmetic**

```
lowerTotal = sum(all lower section categories) + yahtzeeBonus
```

**Invariant 10.3.4: Grand Total**

```
grandTotal = upperTotal + lowerTotal
```

**Invariant 10.3.5: Yahtzee Bonus Multiplicity**

```
yahtzeeBonus % 100 === 0
```

(Bonus is earned in 100-point increments)

**Invariant 10.3.6: Fixed-Value Categories**

```
full_house ∈ {0, 25}
small_straight ∈ {0, 30}
large_straight ∈ {0, 40}
yahtzee ∈ {0, 50}
```

### 10.4 Game State Invariants

**Invariant 10.4.1: Turn Bounds**

```
1 ≤ turnNumber ≤ 13
```

**Invariant 10.4.2: Roll Bounds**

```
1 ≤ rollNumber ≤ 3
```

**Invariant 10.4.3: Categories Remaining**

```
categoriesRemaining.length = 13 - turnsCompleted
```

**Invariant 10.4.4: Game Completion**

```
status === "completed" ⟹ turnsCompleted === 13
```

### 10.5 Event Stream Invariants

**Invariant 10.5.1: Event Uniqueness**

All event IDs must be unique:

```
∀ i, j: events[i].id ≠ events[j].id  (for i ≠ j)
```

**Invariant 10.5.2: Sequence Continuity**

```
events are ordered by sequenceNumber with no gaps
```

**Invariant 10.5.3: Game Replay Determinism**

Replaying the same event stream must produce the same final game state:

```
replay(events) = replay(events)  (idempotent)
```

### 10.6 Decision Quality Invariants

**Invariant 10.6.1: EV Difference Non-Negativity**

```
evDifference = optimalEV - actualEV ≥ 0
```

(Optimal is always better than or equal to actual choice)

**Invariant 10.6.2: Decision Quality Consistency**

```
evDifference === 0 ⟹ decisionQuality === "optimal"
evDifference ≤ 0.05 * optimalEV ⟹ decisionQuality ∈ {"optimal", "excellent"}
```

### 10.7 Testing Invariants

All invariants should be:
1. **Tested in unit tests** with property-based testing
2. **Checked in assertions** during development
3. **Monitored in production** with alerts on violations
4. **Documented in code** with references to this RFC

```typescript
// Example assertion
function assertInvariants(gameState: GameState): void {
  assert(gameState.turnNumber >= 1 && gameState.turnNumber <= 13);
  assert(gameState.rollNumber >= 1 && gameState.rollNumber <= 3);
  
  const scorecard = gameState.currentPlayer.scorecard;
  assert(validateUpperBonus(scorecard));
  assert(validateGrandTotal(scorecard));
  
  // ... all invariants
}
```

---

## 11. Error Schema

### 11.1 Error Response Format

```typescript
interface ErrorDetail {
  // Error identification
  code: string;              // Machine-readable code
  message: string;           // Human-readable message
  severity: "warning" | "error" | "fatal";
  
  // Context
  timestamp: Timestamp;
  requestId?: UUID;
  traceId?: UUID;
  
  // Details
  details?: {
    field?: string;          // Which field caused error
    constraint?: string;     // Which validation failed
    expected?: any;          // Expected value
    actual?: any;            // Actual value
  };
  
  // Recovery
  recoverable: boolean;
  retryAfter?: number;       // Seconds to wait before retry
  suggestedAction?: string;
}
```

### 11.2 Standard Error Codes

**Client Errors (4xx):**

```typescript
const ErrorCodes = {
  // Validation errors
  INVALID_DICE: "ERR_INVALID_DICE",
  INVALID_CATEGORY: "ERR_INVALID_CATEGORY",
  CATEGORY_ALREADY_SCORED: "ERR_CATEGORY_SCORED",
  INVALID_TURN: "ERR_INVALID_TURN",
  
  // Game state errors
  GAME_NOT_FOUND: "ERR_GAME_NOT_FOUND",
  GAME_NOT_STARTED: "ERR_GAME_NOT_STARTED",
  GAME_COMPLETED: "ERR_GAME_COMPLETED",
  NOT_YOUR_TURN: "ERR_NOT_YOUR_TURN",
  
  // Auth errors
  UNAUTHORIZED: "ERR_UNAUTHORIZED",
  FORBIDDEN: "ERR_FORBIDDEN",
  SESSION_EXPIRED: "ERR_SESSION_EXPIRED",
  
  // Rate limiting
  RATE_LIMIT_EXCEEDED: "ERR_RATE_LIMIT",
} as const;
```

**Server Errors (5xx):**

```typescript
const ServerErrorCodes = {
  INTERNAL_ERROR: "ERR_INTERNAL",
  DATABASE_ERROR: "ERR_DATABASE",
  COMPUTATION_TIMEOUT: "ERR_TIMEOUT",
  SERVICE_UNAVAILABLE: "ERR_SERVICE_DOWN",
  CACHE_ERROR: "ERR_CACHE",
} as const;
```

### 11.3 Error Response Examples

**Validation Error:**

```json
{
  "success": false,
  "error": {
    "code": "ERR_INVALID_DICE",
    "message": "Dice array must contain exactly 5 values between 1 and 6",
    "severity": "error",
    "timestamp": 1698765432000,
    "requestId": "req_123e4567",
    "details": {
      "field": "diceResult",
      "constraint": "length_and_range",
      "expected": "Array of 5 integers (1-6)",
      "actual": "[1, 2, 3, 7]"
    },
    "recoverable": true,
    "suggestedAction": "Check dice values and retry"
  }
}
```

**Game State Error:**

```json
{
  "success": false,
  "error": {
    "code": "ERR_NOT_YOUR_TURN",
    "message": "Cannot perform action: it is not your turn",
    "severity": "warning",
    "timestamp": 1698765432000,
    "details": {
      "currentPlayerId": "player_456",
      "yourPlayerId": "player_789"
    },
    "recoverable": false,
    "suggestedAction": "Wait for your turn"
  }
}
```

---

## 12. Schema Evolution Guidelines

### 12.1 Adding New Fields (Minor Version)

**DO:**
- ✅ Add optional fields with default values
- ✅ Add new event types
- ✅ Add new enum values at the end

**Example:**

```typescript
// v1.0.0
interface RollEvent {
  eventType: "roll";
  diceResult: DiceArray;
}

// v1.1.0 - SAFE: Added optional field
interface RollEvent {
  eventType: "roll";
  eventVersion: "1.1.0";
  diceResult: DiceArray;
  intentSignal?: "exploring" | "targeting_category";  // NEW
}
```

### 12.2 Breaking Changes (Major Version)

**REQUIRES MAJOR BUMP:**
- ❌ Remove field
- ❌ Rename field
- ❌ Change field type
- ❌ Make optional field required
- ❌ Change enum values
- ❌ Change validation rules (stricter)

**Example:**

```typescript
// v1.x.x
interface RollEvent {
  diceResult: number[];  // Any length array
}

// v2.0.0 - BREAKING: Changed to fixed-length tuple
interface RollEvent {
  eventVersion: "2.0.0";
  diceResult: DiceArray;  // Exactly 5 elements
}
```

### 12.3 Deprecation Process

**Step 1: Announce deprecation**
- Add `@deprecated` JSDoc comment
- Add deprecation notice in release notes
- Set deprecation date (minimum 6 months)

```typescript
interface RollEvent {
  /**
   * @deprecated Use `diceResult` instead. Will be removed in v2.0.0
   */
  dice?: number[];
  
  diceResult: DiceArray;  // New field
}
```

**Step 2: Support both fields during transition**
- Accept both old and new field
- Write only new field
- Log warnings when old field used

**Step 3: Remove deprecated field in next major version**

---

## 13. Implementation Checklist

### 13.1 Type Definitions

- [ ] Generate TypeScript types from this spec
- [ ] Generate Rust types for WASM engine
- [ ] Generate Python Pydantic models
- [ ] Generate JSON Schema for validation
- [ ] Publish types to npm (`@dicee/types`)

### 13.2 Validation

- [ ] Implement validation functions for all schemas
- [ ] Add JSON Schema validation middleware
- [ ] Create validation test suite (>95% coverage)
- [ ] Add property-based tests for invariants

### 13.3 Versioning

- [ ] Implement schema version registry
- [ ] Add version compatibility matrix
- [ ] Create migration utilities
- [ ] Document upgrade paths

### 13.4 API Implementation

- [ ] Implement all REST endpoints
- [ ] Implement WebSocket protocol
- [ ] Add request/response validation
- [ ] Add error handling middleware
- [ ] Add rate limiting

### 13.5 Testing

- [ ] Contract tests between services
- [ ] Integration tests for full flows
- [ ] Load testing for all endpoints
- [ ] WebSocket connection stability tests

### 13.6 Documentation

- [ ] Generate API documentation (OpenAPI)
- [ ] Create integration guide
- [ ] Document error codes
- [ ] Provide code examples

---

## 14. Appendices

### Appendix A: Complete Event Type Registry

```typescript
const EventTypes = {
  // Game lifecycle
  GAME_CREATED: "game_created",
  GAME_STARTED: "game_started",
  GAME_COMPLETED: "game_completed",
  GAME_ABANDONED: "game_abandoned",
  
  // Turn events
  ROLL: "roll",
  REROLL: "reroll",
  SCORE: "score",
  
  // UI telemetry
  HOVER: "hover",
  PREDICTION: "prediction",
  HINT_REQUESTED: "hint_requested",
  
  // System
  ERROR: "error",
  CONNECTION: "connection",
} as const;
```

### Appendix B: Scoring Rules Reference

```typescript
const SCORING_RULES = {
  // Upper section
  ones: (dice: DiceArray) => dice.filter(d => d === 1).length * 1,
  twos: (dice: DiceArray) => dice.filter(d => d === 2).length * 2,
  threes: (dice: DiceArray) => dice.filter(d => d === 3).length * 3,
  fours: (dice: DiceArray) => dice.filter(d => d === 4).length * 4,
  fives: (dice: DiceArray) => dice.filter(d => d === 5).length * 5,
  sixes: (dice: DiceArray) => dice.filter(d => d === 6).length * 6,
  
  // Lower section
  threeOfKind: (dice: DiceArray) => hasNOfKind(dice, 3) ? sum(dice) : 0,
  fourOfKind: (dice: DiceArray) => hasNOfKind(dice, 4) ? sum(dice) : 0,
  fullHouse: (dice: DiceArray) => isFullHouse(dice) ? 25 : 0,
  smallStraight: (dice: DiceArray) => hasSmallStraight(dice) ? 30 : 0,
  largeStraight: (dice: DiceArray) => hasLargeStraight(dice) ? 40 : 0,
  yahtzee: (dice: DiceArray) => hasNOfKind(dice, 5) ? 50 : 0,
  chance: (dice: DiceArray) => sum(dice),
  
  // Bonuses
  upperBonus: (upperSum: number) => upperSum >= 63 ? 35 : 0,
  yahtzeeBonus: () => 100,  // Per additional Yahtzee
};
```

### Appendix C: Sample Event Flow

```typescript
// Complete game flow example

// 1. Game created
const gameCreated: GameCreatedEvent = {
  id: "evt_001",
  eventType: "game_created",
  eventVersion: "1.0.0",
  traceId: "trace_abc",
  causalChain: [],
  timestamp: 1698765432000,
  gameId: "game_123",
  playerId: "player_456",
  turnNumber: 0,
  rollNumber: 0,
  mode: "solo",
  playerIds: ["player_456"],
  settings: { rulesVariant: "standard" },
  hostPlayerId: "player_456"
};

// 2. Game started
const gameStarted: GameStartedEvent = {
  // ... base fields
  eventType: "game_started",
  causalChain: ["evt_001"],
  turnOrder: ["player_456"],
  firstPlayerId: "player_456",
  initialScorecards: { /* ... */ }
};

// 3. First roll
const firstRoll: RollEvent = {
  // ... base fields
  eventType: "roll",
  turnNumber: 1,
  rollNumber: 1,
  causalChain: ["evt_002"],
  diceResult: [3, 3, 5, 5, 6],
  keptMask: [false, false, false, false, false],
  probabilities: { /* computed */ },
  recommendations: [ /* computed */ ],
  timeFromPreviousAction: 2500
};

// 4. Reroll keeping 3s
const reroll: RerollEvent = {
  // ... base fields
  eventType: "reroll",
  turnNumber: 1,
  rollNumber: 2,
  causalChain: ["evt_003"],
  previousDice: [3, 3, 5, 5, 6],
  keptMask: [true, true, false, false, false],
  newDice: [3, 3, 3, 4, 5],
  wasOptimal: true,
  optimalKeptMask: [true, true, false, false, false],
  evDifference: 0,
  timeToDecision: 3200,
  hintViewed: false
};

// 5. Score three of a kind
const score: ScoreDecisionEvent = {
  // ... base fields
  eventType: "score",
  turnNumber: 1,
  rollNumber: 2,
  causalChain: ["evt_004"],
  chosenCategory: "three_of_kind",
  pointsEarned: 18,
  expectedValue: 18,
  optimalCategory: "three_of_kind",
  optimalEV: 18,
  evDifference: 0,
  decisionQuality: "optimal",
  previousScorecard: { /* before */ },
  updatedScorecard: { /* after */ },
  timeToDecision: 1800,
  categoriesConsidered: ["threes", "three_of_kind"],
  backtrackCount: 1,
  hintRequested: false
};
```

### Appendix D: Cross-Service Type Sharing

**Package Structure:**

```
@dicee/types/
├── index.ts              # Main export
├── events/
│   ├── base.ts
│   ├── game-lifecycle.ts
│   ├── turn-events.ts
│   └── telemetry.ts
├── api/
│   ├── requests.ts
│   ├── responses.ts
│   └── websocket.ts
├── domain/
│   ├── dice.ts
│   ├── scorecard.ts
│   ├── probability.ts
│   └── decision.ts
└── validation/
    ├── validators.ts
    └── schemas.json
```

**Usage:**

```typescript
// In any service
import {
  RollEvent,
  ProbabilityRequest,
  validateDiceArray
} from '@dicee/types';

// Type safety across services
function handleRoll(event: RollEvent): ProbabilityResponse {
  if (!validateDiceArray(event.diceResult)) {
    throw new ValidationError("Invalid dice");
  }
  // ...
}
```

---

## Next Steps

1. **Review this RFC** with the team
2. **Generate types** for all languages (TS, Rust, Python)
3. **Implement validation** functions with tests
4. **Create RFC-004** (Game Loop & Mechanics) using these contracts
5. **Create RFC-006** (Event Model & Telemetry) for persistence layer
6. **Create RFC-007** (API Integration Contract) for transport layer

---

**Document Status:** ✅ RFC v1.1 — Production Ready (Post-Review Revision Complete)

**Key Improvements Applied:**
- ✅ Three-stream architecture (domain/analysis/telemetry)
- ✅ Slimmed event payloads (separated analysis from domain events)
- ✅ Added game integrity rules (section 9)
- ✅ Added safety invariants (section 10)
- ✅ Enhanced audit trail (sequenceNumber, eventSource, streamType)
- ✅ Normalized naming conventions (gameMode, rollType)
- ✅ Deprecated RerollEvent in favor of unified RollEvent

**Authors:** Engineering Team  
**Last Updated:** October 25, 2025  
**Version:** 1.1  
**Status:** Ready for Implementation

**Next Steps:**
1. Begin RFC-004 (Game Loop & Mechanics)
2. Implement type generation pipeline
3. Build validation test suite
4. Deploy to RFC-006 (Event Model & Telemetry) persistence layer
