# Project-Wide Observability Review & Implementation Strategy

> **Version**: 1.0.0  
> **Created**: 2025-01-XX  
> **Status**: Planning  
> **Purpose**: Ensure type-safe, test-first, unified observability across entire Dicee project

---

## Executive Summary

> **👉 For Implementation**: See **[Observability Workflow](observability-workflow.md)** for complete step-by-step guide

This document provides a **project-wide review** of observability implementation, ensuring:
- ✅ **Type-considered approach**: All events validated with Zod 4 schemas
- ✅ **Testing-first paradigm**: TDD with fixtures and comprehensive test coverage
- ✅ **Unified structure**: Consistent patterns across all components
- ✅ **Technical debt elimination**: Replace ad-hoc logging with structured instrumentation
- ✅ **End-to-end observability**: From client actions to server state changes

**Critical**: This review identifies **29 ad-hoc console.log statements** in `GameRoom.ts` that must be replaced with structured instrumentation.

---

## Table of Contents

1. [Current State Analysis](#1-current-state-analysis)
2. [Technical Debt Inventory](#2-technical-debt-inventory)
3. [Type-Safe Architecture](#3-type-safe-architecture)
4. [Test-First Implementation Strategy](#4-test-first-implementation-strategy)
5. [Unified Structure Plan](#5-unified-structure-plan)
6. [Migration Path](#6-migration-path)
7. [Quality Gates](#7-quality-gates)

---

## 1. Current State Analysis

### 1.1 Existing Logging Infrastructure

**Current Logger** (`packages/cloudflare-do/src/lib/logger.ts`):
- ✅ Structured JSON logging
- ✅ Component-based context
- ❌ **Not type-safe** - uses `unknown` in LogContext
- ❌ **No Zod validation** - entries not validated
- ❌ **No event taxonomy** - free-form messages
- ❌ **No correlation IDs** - can't trace request flow
- ❌ **No test coverage** - logger itself untested

**Usage Pattern**:
```typescript
// Current (inconsistent)
const logger = createLogger({ component: 'GameRoom' });
logger.info('Player joined', { userId: '123' }); // No schema validation
```

### 1.2 Ad-Hoc Logging (Technical Debt)

**Found**: 29 `console.log` statements in `GameRoom.ts`:
- Line 691: `console.log('[Broadcast] ${msgType} → ${sentCount}/${allSockets.length} sockets')`
- Line 803: `console.log(...)` - Debug output
- Line 832: `console.log(...)` - Debug output
- Line 868: `console.log('[GameRoom] Player ${seat.displayName} reconnected...')`
- Line 884: `console.log(...)` - Debug output
- Line 918: `console.log('[GameRoom] Seat expired for ${seat.displayName}...')`
- Line 1054: `console.error('[GameRoom] Failed to send highlight:', error)`
- Line 1075: `console.log('[GameRoom] Notified lobby: user ${userId}...')`
- Line 1080: `console.warn(...)`
- Line 1085: `console.error(...)`
- Line 1189: `console.log('[GameRoom] Player ${connState.displayName} reconnected...')`
- Line 1313: `console.log('[GameRoom] >>> RECEIVED: ${type} from ${connState.userId}')`
- Line 1718: `console.log('[GameRoom] Invite ${inviteId} sent...')`
- Line 1755: `console.log('[GameRoom] Invite ${invite.id} cancelled...')`
- Line 1766: `console.log('[GameRoom] Invite response for unknown invite...')`
- Line 1781: `console.log('[GameRoom] Host not found...')`
- Line 1799: `console.log(...)` - Debug output
- Line 1822: `console.log('[GameRoom] Cancelled ${this.pendingInvites.size}...')`
- Line 1865: `console.log('[GameRoom] Invite ${inviteId} expired...')`
- Line 2400: `console.log('[GameRoom] About to trigger AI turn check...')`
- Line 2402: `console.log('[GameRoom] AI turn trigger complete')`
- Line 2597: `console.log(...)` - Debug output
- Line 2732: `console.log('[GameRoom] AI player removed: ${removedPlayer.displayName}...')`
- Line 3070: `console.log('[GameRoom] executeAICommand ENTRY: ${playerId} ${command.type}')`
- Line 3074: `console.error('[GameRoom] No game state for AI command')`
- Line 3078: `console.log('[GameRoom] executeAICommand has game state, processing...')`
- Line 3579: `console.log('[GameRoom] Sending CHAT_HISTORY with ${history.length} messages')`
- Line 3755: `console.log(...)` - Debug output

**Problems**:
- ❌ Inconsistent format (some with `[GameRoom]`, some without)
- ❌ No structured fields (can't query by userId, roomCode, etc.)
- ❌ No correlation IDs (can't trace request flow)
- ❌ No type safety (typos in field names not caught)
- ❌ No validation (invalid data can be logged)
- ❌ Not testable (can't verify log output in tests)

### 1.3 Testing Infrastructure

**Current State**:
- ✅ Vitest configured (`packages/cloudflare-do/vitest.config.ts`)
- ✅ 275 tests across multiple suites
- ✅ Test-first patterns exist (see `durable-objects-testing.md`)
- ❌ **No tests for logging/instrumentation**
- ❌ **No test fixtures for log events**
- ❌ **No validation tests for log schemas**

**Test Patterns Found**:
```typescript
// Good pattern from existing tests
function testConfig(overrides: Partial<SimulationConfig> = {}): SimulationConfig {
  return { ...defaultConfig, ...overrides };
}
```

### 1.4 Type System Patterns

**Current Patterns**:
- ✅ Const arrays → inferred types: `const CATEGORIES = [...] as const`
- ✅ Zod 4 schemas: `packages/shared/src/validation/schemas.ts`
- ✅ Type-schema consistency invariant (AKG enforced)
- ✅ Result pattern: `{ data: T | null; error: Error | null }`
- ❌ **Logger not using Zod validation**
- ❌ **No type guards for log events**

---

## 2. Technical Debt Inventory

### 2.1 High Priority (Must Fix)

| Issue | Location | Impact | Fix |
|-------|----------|--------|-----|
| 29 ad-hoc console.logs | `GameRoom.ts` | Can't query logs, no correlation | Replace with instrumentation |
| Unvalidated log entries | `logger.ts` | Runtime errors possible | Add Zod validation |
| No event taxonomy | All files | Inconsistent event names | Use const arrays + Zod enums |
| No correlation IDs | All files | Can't trace request flow | Add correlation ID support |
| No test coverage | `logger.ts` | Can't verify logging works | Write tests first |

### 2.2 Medium Priority (Should Fix)

| Issue | Location | Impact | Fix |
|-------|----------|--------|-----|
| Inconsistent log formats | Multiple files | Hard to parse | Standardize on structured JSON |
| No type safety | `logger.ts` | Typos not caught | Use Zod schemas |
| No performance metrics | All files | Can't detect slow operations | Add duration tracking |
| No error context | Error logs | Hard to debug | Add stack traces, context |

### 2.3 Low Priority (Nice to Have)

| Issue | Location | Impact | Fix |
|-------|----------|--------|-----|
| No log sampling | All files | High volume in production | Add head_sampling_rate config |
| No log aggregation | All files | Can't see patterns | Use Cloudflare Analytics |

---

## 3. Type-Safe Architecture

### 3.1 Three-Layer Type Safety

```
┌─────────────────────────────────────────────────────────────┐
│ Layer 1: Compile-Time (TypeScript)                          │
│  • Const arrays define event taxonomy                        │
│  • Type inference from const arrays                          │
│  • TypeScript ensures correct event types                    │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ Layer 2: Runtime (Zod 4 Validation)                          │
│  • Zod schemas derived from const arrays                     │
│  • All log entries validated before emission                 │
│  • Type guards for event filtering                           │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ Layer 3: Query-Time (MCP + Schema Validation)               │
│  • Query results validated against schemas                   │
│  • Type-safe query builders                                  │
│  • Discriminated unions for type narrowing                  │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 Event Schema Architecture

**Pattern**: Const Array → Type Inference → Zod Schema → Validation

```typescript
// Step 1: Const array (single source of truth)
export const LIFECYCLE_EVENTS = [
  'lifecycle.wake',
  'lifecycle.connect',
  'lifecycle.disconnect',
  'lifecycle.reconnect',
] as const;

// Step 2: Type inference
export type LifecycleEvent = (typeof LIFECYCLE_EVENTS)[number];

// Step 3: Zod enum (derived from const array)
export const LifecycleEventSchema = z.enum(LIFECYCLE_EVENTS);

// Step 4: Event-specific schema (extends base)
export const LifecycleWakeEventSchema = BaseLogEntrySchema.extend({
  _event: z.literal('lifecycle.wake'),
  storageKeys: z.array(z.string()),
  connectedClients: z.number().int().nonnegative(),
  // ... other fields
});

// Step 5: Discriminated union (for type narrowing)
export const LogEventSchema = z.discriminatedUnion('_event', [
  LifecycleWakeEventSchema,
  ClientConnectEventSchema,
  // ... all event schemas
]);
```

### 3.3 Type-Safe Instrumentation API

```typescript
// Type-safe instrumentation (no 'unknown' types)
export function createInstrumentation(
  component: 'GameRoom' | 'GlobalLobby',
  roomCode?: string
): Instrumentation {
  // All methods return validated LogEvent types
  hibernationWake(storageKeys: string[], connectedClients: number): LifecycleWakeEvent {
    // Implementation validates and returns typed event
  }
  
  clientConnect(userId: string, role: 'player' | 'spectator' | 'pending', connectionId: string): ClientConnectEvent {
    // Implementation validates and returns typed event
  }
}
```

---

## 4. Test-First Implementation Strategy

### 4.1 TDD Workflow for Observability

**Red-Green-Refactor Cycle**:

```
1. RED: Write failing test for event schema
2. GREEN: Implement minimal schema to pass
3. REFACTOR: Improve schema design
4. REPEAT: Add next event type
```

### 4.2 Test Structure

```
packages/cloudflare-do/src/lib/
├── observability/
│   ├── events.schema.ts              # Schemas (implemented test-first)
│   └── __tests__/
│       ├── events.schema.test.ts     # Schema validation tests
│       ├── events.fixtures.ts       # Test fixtures for all events
│       └── events.type-guards.test.ts # Type guard tests
├── instrumentation.ts               # Implementation (test-first)
└── __tests__/
    ├── instrumentation.test.ts       # Instrumentation tests
    └── instrumentation.integration.test.ts # Integration tests
```

### 4.3 Test Fixtures Pattern

**Create**: `packages/cloudflare-do/src/lib/observability/__tests__/events.fixtures.ts`

```typescript
/**
 * Test Fixtures for Observability Events
 * 
 * Provides type-safe, validated fixtures for all event types.
 * Use in tests to ensure consistency and catch schema changes.
 */

import type {
  LifecycleWakeEvent,
  ClientConnectEvent,
  ClientDisconnectEvent,
  StorageReadEndEvent,
  SeatReclaimResultEvent,
  // ... all event types
} from '../events.schema.js';

/**
 * Create a valid lifecycle.wake event fixture
 */
export function createLifecycleWakeFixture(
  overrides?: Partial<LifecycleWakeEvent>
): LifecycleWakeEvent {
  return {
    _ts: Date.now(),
    _level: 'info',
    _component: 'GameRoom',
    _event: 'lifecycle.wake',
    _reqId: 1,
    roomCode: 'TEST-ROOM',
    storageKeys: ['game', 'seats'],
    connectedClients: 2,
    hasGameState: true,
    hasSeats: true,
    hasRoomState: true,
    keyCount: 2,
    ...overrides,
  };
}

/**
 * Create a valid lifecycle.connect event fixture
 */
export function createClientConnectFixture(
  overrides?: Partial<ClientConnectEvent>
): ClientConnectEvent {
  return {
    _ts: Date.now(),
    _level: 'info',
    _component: 'GameRoom',
    _event: 'lifecycle.connect',
    _reqId: 2,
    userId: 'user-123',
    role: 'player',
    connectionId: 'conn-456',
    roomCode: 'TEST-ROOM',
    ...overrides,
  };
}

// ... fixtures for all event types
```

### 4.4 Test-First Implementation Order

**Phase 1: Schema Tests (Week 1, Days 1-2)**
1. ✅ Write test for `LIFECYCLE_EVENTS` const array
2. ✅ Write test for `LifecycleEvent` type inference
3. ✅ Write test for `LifecycleWakeEventSchema` validation
4. ✅ Implement schema to pass tests
5. ✅ Repeat for all event categories

**Phase 2: Instrumentation Tests (Week 1, Days 3-4)**
1. ✅ Write test for `createInstrumentation()` factory
2. ✅ Write test for `hibernationWake()` method
3. ✅ Write test for validation failure handling
4. ✅ Implement instrumentation to pass tests
5. ✅ Repeat for all instrumentation methods

**Phase 3: Integration Tests (Week 1, Days 5)**
1. ✅ Write test for GameRoom using instrumentation
2. ✅ Write test for event emission in real scenarios
3. ✅ Write test for correlation ID flow
4. ✅ Implement integration
5. ✅ Verify all tests pass

### 4.5 Test Coverage Requirements

**Minimum Coverage Targets**:
- Schema validation: **100%** (all event types, all fields)
- Instrumentation methods: **100%** (all methods tested)
- Error handling: **100%** (all error paths)
- Type guards: **100%** (all type narrowing functions)
- Integration: **>80%** (critical paths covered)

**Test Types Required**:
- ✅ Unit tests: Schema validation, instrumentation methods
- ✅ Integration tests: GameRoom + instrumentation, GlobalLobby + instrumentation
- ✅ Type tests: TypeScript type inference, type guards
- ✅ Property tests: Random valid events, edge cases

---

## 5. Unified Structure Plan

### 5.1 Directory Structure

```
packages/cloudflare-do/src/
├── lib/
│   ├── instrumentation.ts              # Main instrumentation class (replaces logger.ts)
│   ├── observability/
│   │   ├── events.schema.ts            # All event Zod schemas
│   │   ├── metrics.schema.ts           # Metrics schemas (future)
│   │   ├── queries.ts                 # MCP query helpers (future)
│   │   └── __tests__/
│   │       ├── events.schema.test.ts   # Schema tests
│   │       ├── events.fixtures.ts      # Test fixtures
│   │       ├── events.type-guards.test.ts
│   │       └── metrics.schema.test.ts  # Metrics tests (future)
│   └── __tests__/
│       ├── instrumentation.test.ts     # Unit tests
│       └── instrumentation.integration.test.ts
├── GameRoom.ts                         # Uses instrumentation (migrated)
├── GlobalLobby.ts                      # Uses instrumentation (migrated)
└── [other files]
```

### 5.2 File Organization Principles

**Single Responsibility**:
- `events.schema.ts` - Only Zod schemas and type definitions
- `instrumentation.ts` - Only instrumentation class and factory
- `queries.ts` - Only MCP query helpers (future)

**Co-location**:
- Tests live next to source files in `__tests__/` directories
- Fixtures live with tests they support
- Types exported from schema files

**Import Hierarchy**:
```typescript
// instrumentation.ts imports from:
import { validateLogEntry, type LogEvent } from './observability/events.schema.js';

// GameRoom.ts imports from:
import { createInstrumentation } from './lib/instrumentation.js';

// Tests import from:
import { createInstrumentation } from '../instrumentation.js';
import { createLifecycleWakeFixture } from './events.fixtures.js';
```

### 5.3 Naming Conventions

**Files**:
- Schema files: `*.schema.ts` (e.g., `events.schema.ts`)
- Test files: `*.test.ts` (e.g., `instrumentation.test.ts`)
- Fixture files: `*.fixtures.ts` (e.g., `events.fixtures.ts`)

**Types**:
- Event types: `PascalCaseEvent` (e.g., `LifecycleWakeEvent`)
- Schema types: `PascalCaseSchema` (e.g., `LifecycleWakeEventSchema`)
- Const arrays: `UPPER_SNAKE_CASE` (e.g., `LIFECYCLE_EVENTS`)

**Functions**:
- Factory functions: `createNoun` (e.g., `createInstrumentation`)
- Fixture functions: `createNounFixture` (e.g., `createLifecycleWakeFixture`)
- Validators: `validateNoun` (e.g., `validateLogEntry`)
- Type guards: `isNoun` (e.g., `isEventType`)

---

## 6. Migration Path

### 6.1 Phase 1: Foundation (Week 1)

**Goal**: Create type-safe, test-first foundation

**Tasks**:
1. ✅ Create `events.schema.ts` with test-first approach
   - Write tests for const arrays
   - Write tests for Zod schemas
   - Implement schemas to pass tests
   - Achieve 100% test coverage

2. ✅ Create `events.fixtures.ts` with all event fixtures
   - One fixture function per event type
   - Type-safe overrides
   - Used in all tests

3. ✅ Create `instrumentation.ts` with test-first approach
   - Write tests for each method
   - Implement methods to pass tests
   - Integrate Zod validation
   - Achieve 100% test coverage

4. ✅ Run AKG checks
   - Verify no layer violations
   - Verify imports are valid
   - Fix any violations

**Deliverables**:
- ✅ `events.schema.ts` with all event schemas
- ✅ `events.fixtures.ts` with all fixtures
- ✅ `instrumentation.ts` with full implementation
- ✅ 100% test coverage for schemas and instrumentation
- ✅ All AKG checks passing

### 6.2 Phase 2: Migration (Week 2)

**Goal**: Replace ad-hoc logging with instrumentation

**Migration Strategy**: Replace one category at a time

**Step 1: Lifecycle Events** (Day 1)
- Replace all `lifecycle.*` console.logs in GameRoom.ts
- Replace all `lifecycle.*` console.logs in GlobalLobby.ts
- Add tests for lifecycle event emission
- Verify logs in Cloudflare Dashboard

**Step 2: Storage Events** (Day 2)
- Wrap all `ctx.storage.get()` calls with instrumentation
- Wrap all `ctx.storage.put()` calls with instrumentation
- Add tests for storage event emission
- Verify storage operation tracking

**Step 3: Seat Management Events** (Day 3)
- Replace all seat-related console.logs
- Add instrumentation to seat reservation/release
- Add tests for seat event emission
- Verify seat lifecycle tracking

**Step 4: Game Events** (Day 4)
- Replace all game-related console.logs
- Add instrumentation to game state transitions
- Add tests for game event emission
- Verify game state tracking

**Step 5: Error Events** (Day 5)
- Replace all `console.error()` calls
- Add structured error logging
- Add tests for error event emission
- Verify error tracking

**Deliverables**:
- ✅ All 29 console.log statements replaced
- ✅ All logging uses instrumentation
- ✅ All events validated with Zod
- ✅ All events have test coverage
- ✅ Logs queryable via MCP

### 6.3 Phase 3: Enhancement (Week 3)

**Goal**: Add correlation IDs and advanced features

**Tasks**:
1. Add correlation ID support
   - Client sends correlationId in messages
   - Server propagates correlationId in logs
   - Tests verify correlation ID flow

2. Add performance metrics
   - Duration tracking for operations
   - Storage operation latency
   - WebSocket message processing time

3. Add MCP query helpers
   - Query templates for common scenarios
   - Type-safe query builders
   - Result validation

**Deliverables**:
- ✅ Correlation IDs working end-to-end
- ✅ Performance metrics collected
- ✅ MCP query helpers available
- ✅ All features tested

### 6.4 Phase 4: Cleanup (Week 4)

**Goal**: Remove technical debt and finalize

**Tasks**:
1. Remove old `logger.ts` (deprecated)
2. Update all documentation
3. Run full quality gate
4. Verify no console.log statements remain
5. Final AKG check

**Deliverables**:
- ✅ Old logger.ts removed
- ✅ Documentation updated
- ✅ All quality gates passing
- ✅ Zero technical debt
- ✅ Production-ready observability

---

## 7. Quality Gates

### 7.1 Pre-Implementation Checklist

Before writing any code:
- [ ] Read `docs/planning/mcp-orchestration-review.md` for MCP integration patterns
- [ ] Query `context7` MCP for current Cloudflare Workers logging patterns
- [ ] Query `cloudflare-docs` MCP for Workers Logs API
- [ ] Query `memory` MCP for existing observability decisions
- [ ] Verify AKG layer rules using `akg_layer_rules` MCP
- [ ] Validate import placement using `akg_check_import` MCP
- [ ] Check existing test patterns in codebase
- [ ] Review Zod 4 patterns from `docs/references/zod4/zod4.md`

### 7.2 Implementation Quality Gates

**For Each File**:
- [ ] Write tests FIRST (before implementation)
- [ ] Use const arrays for event taxonomy
- [ ] Derive Zod schemas from const arrays
- [ ] Validate all log entries before emission
- [ ] Export types from schema files
- [ ] Co-locate tests with source files

**For Each Feature**:
- [ ] 100% test coverage for new code
- [ ] All tests passing
- [ ] TypeScript strict mode passes
- [ ] Biome linting passes
- [ ] AKG checks pass (no layer violations)

### 7.3 Migration Quality Gates

**Before Replacing Each console.log**:
- [ ] Identify event type from taxonomy
- [ ] Write test for event emission
- [ ] Implement instrumentation call
- [ ] Verify test passes
- [ ] Verify log appears in Cloudflare Dashboard
- [ ] Remove old console.log

**After Each Migration Phase**:
- [ ] All tests passing
- [ ] No console.log statements in migrated code
- [ ] Logs queryable via MCP
- [ ] Documentation updated

### 7.4 Final Quality Gate

Before marking observability complete:
```bash
# Run full quality gate
./scripts/quality-gate.sh

# Verify no console.log statements
grep -r "console\.log\|console\.error\|console\.warn" packages/cloudflare-do/src --exclude-dir=__tests__

# Verify test coverage
pnpm --filter @dicee/cloudflare-do test --coverage

# Verify AKG checks
pnpm akg:check

# Verify TypeScript
pnpm --filter @dicee/cloudflare-do check

# Verify Biome
pnpm --filter @dicee/cloudflare-do biome:check
```

**Success Criteria**:
- ✅ Zero console.log/error/warn in production code
- ✅ 100% test coverage for observability code
- ✅ All AKG checks passing
- ✅ All TypeScript checks passing
- ✅ All Biome checks passing
- ✅ Logs queryable via MCP
- ✅ Documentation complete

---

## 8. Implementation Checklist (Detailed)

### Week 1: Foundation (Test-First)

**Day 1-2: Schema Foundation**
- [ ] Create `events.schema.ts` file structure
- [ ] Write test: `LIFECYCLE_EVENTS` const array exists
- [ ] Write test: `LifecycleEvent` type inference works
- [ ] Write test: `LifecycleWakeEventSchema` validates correct data
- [ ] Write test: `LifecycleWakeEventSchema` rejects invalid data
- [ ] Implement `LIFECYCLE_EVENTS` const array
- [ ] Implement `LifecycleEvent` type
- [ ] Implement `LifecycleWakeEventSchema` Zod schema
- [ ] Repeat for all event categories (STORAGE, STATE, SEAT, GAME, CONNECTION, ERROR, DIAGNOSTIC)
- [ ] Write test: `ALL_EVENT_TYPES` contains all events
- [ ] Write test: `LogEventSchema` discriminated union works
- [ ] Implement `LogEventSchema` discriminated union
- [ ] Write test: `validateLogEntry()` function works
- [ ] Implement `validateLogEntry()` function
- [ ] Write test: `isEventType()` type guard works
- [ ] Implement `isEventType()` type guard
- [ ] Achieve 100% test coverage for schemas

**Day 3: Fixtures**
- [ ] Create `events.fixtures.ts` file
- [ ] Write fixture: `createLifecycleWakeFixture()`
- [ ] Write fixture: `createClientConnectFixture()`
- [ ] Write fixture for all event types
- [ ] Write test: Fixtures produce valid events
- [ ] Write test: Fixtures can be overridden
- [ ] Verify all fixtures pass schema validation

**Day 4-5: Instrumentation**
- [ ] Create `instrumentation.ts` file structure
- [ ] Write test: `createInstrumentation()` factory works
- [ ] Write test: `hibernationWake()` emits valid event
- [ ] Write test: `hibernationWake()` validates with Zod
- [ ] Implement `createInstrumentation()` factory
- [ ] Implement `hibernationWake()` method
- [ ] Repeat for all instrumentation methods
- [ ] Write test: Request ID increments
- [ ] Write test: Correlation ID propagation
- [ ] Write test: Error handling for invalid events
- [ ] Implement error handling
- [ ] Achieve 100% test coverage for instrumentation

### Week 2: Migration (Replace Ad-Hoc Logging)

**Day 1: Lifecycle Events**
- [ ] Identify all lifecycle-related console.logs in GameRoom.ts
- [ ] Write test: GameRoom emits lifecycle.wake on initialization
- [ ] Write test: GameRoom emits lifecycle.connect on WebSocket open
- [ ] Write test: GameRoom emits lifecycle.disconnect on WebSocket close
- [ ] Replace console.logs with instrumentation calls
- [ ] Verify tests pass
- [ ] Verify logs in Cloudflare Dashboard
- [ ] Repeat for GlobalLobby.ts

**Day 2: Storage Events**
- [ ] Create storage wrapper functions with instrumentation
- [ ] Write test: Storage read emits storage.read.start and storage.read.end
- [ ] Write test: Storage write emits storage.write.start and storage.write.end
- [ ] Replace all `ctx.storage.get()` with instrumented wrapper
- [ ] Replace all `ctx.storage.put()` with instrumented wrapper
- [ ] Verify tests pass
- [ ] Verify storage operations tracked in logs

**Day 3: Seat Management Events**
- [ ] Identify all seat-related console.logs
- [ ] Write test: Seat assignment emits seat.assign
- [ ] Write test: Seat reservation emits seat.reserve
- [ ] Write test: Seat reclamation emits seat.reclaim.attempt and seat.reclaim.result
- [ ] Replace console.logs with instrumentation calls
- [ ] Verify tests pass
- [ ] Verify seat lifecycle tracked in logs

**Day 4: Game Events**
- [ ] Identify all game-related console.logs
- [ ] Write test: Game start emits game.start
- [ ] Write test: Turn start emits game.turn.start
- [ ] Write test: Dice roll emits game.roll
- [ ] Write test: Category score emits game.score
- [ ] Replace console.logs with instrumentation calls
- [ ] Verify tests pass
- [ ] Verify game events tracked in logs

**Day 5: Error Events**
- [ ] Identify all console.error calls
- [ ] Write test: Handler failure emits error.handler.failed
- [ ] Write test: Storage failure emits error.storage.failed
- [ ] Write test: Broadcast failure emits error.broadcast.failed
- [ ] Replace console.error calls with instrumentation calls
- [ ] Verify tests pass
- [ ] Verify error tracking in logs

### Week 3: Enhancement

**Day 1-2: Correlation IDs**
- [ ] Add correlationId to client WebSocket messages
- [ ] Write test: Correlation ID propagates through logs
- [ ] Implement correlation ID support in instrumentation
- [ ] Verify correlation ID flow end-to-end

**Day 3-4: Performance Metrics**
- [ ] Add duration tracking to storage operations
- [ ] Add duration tracking to WebSocket message processing
- [ ] Write tests for duration tracking
- [ ] Verify metrics in logs

**Day 5: MCP Query Helpers**
- [ ] Create query helper functions
- [ ] Write tests for query helpers
- [ ] Document query patterns
- [ ] Verify queries work via MCP

### Week 4: Cleanup

**Day 1-2: Remove Technical Debt**
- [ ] Remove old `logger.ts` file
- [ ] Remove all remaining console.log statements
- [ ] Update all imports
- [ ] Verify no broken references

**Day 3: Documentation**
- [ ] Update observability-plan.md with implementation details
- [ ] Update observability-architectural-patterns.md with lessons learned
- [ ] Create migration guide for future reference
- [ ] Document query patterns

**Day 4-5: Final Verification**
- [ ] Run full quality gate
- [ ] Verify 100% test coverage
- [ ] Verify all AKG checks pass
- [ ] Verify logs queryable via MCP
- [ ] Deploy to staging and verify
- [ ] Create final report

---

## 9. Technical Debt Elimination Strategy

### 9.1 Ad-Hoc Console.logs → Structured Instrumentation

**Before** (Technical Debt):
```typescript
// GameRoom.ts - Line 1313
console.log(`[GameRoom] >>> RECEIVED: ${type} from ${connState.userId}`);
```

**After** (Type-Safe, Testable):
```typescript
// GameRoom.ts
this.instr?.broadcastPrepare(type, 1);

// Emits validated event:
// {
//   _ts: 1234567890,
//   _level: 'debug',
//   _component: 'GameRoom',
//   _event: 'broadcast.prepare',
//   _reqId: 42,
//   _correlationId: 'abc-123',
//   roomCode: 'TEST-ROOM',
//   eventType: 'DICE_ROLL',
//   recipientCount: 1
// }
```

### 9.2 Unvalidated Logger → Zod-Validated Instrumentation

**Before** (Technical Debt):
```typescript
// logger.ts - No validation
interface LogContext {
  [key: string]: unknown; // ❌ No type safety
}

logger.info('Player joined', { userId: '123' }); // ❌ Not validated
```

**After** (Type-Safe):
```typescript
// instrumentation.ts - Zod validated
const event = {
  _ts: Date.now(),
  _level: 'info',
  _component: 'GameRoom',
  _event: 'lifecycle.connect',
  userId: '123',
  role: 'player',
  connectionId: 'conn-456',
};

const validated = validateLogEntry(event); // ✅ Validated with Zod
console.info(JSON.stringify(validated)); // ✅ Type-safe output
```

### 9.3 Inconsistent Formats → Unified Event Taxonomy

**Before** (Technical Debt):
```typescript
console.log('[GameRoom] Player joined'); // ❌ Inconsistent
console.log('Player joined room'); // ❌ Different format
logger.info('Player joined', { userId }); // ❌ Different API
```

**After** (Unified):
```typescript
// All use same instrumentation API
this.instr.clientConnect(userId, 'player', connectionId);
// ✅ Consistent format, validated, queryable
```

---

## 10. Success Metrics

### 10.1 Code Quality Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Test Coverage | 100% | `pnpm test --coverage` |
| TypeScript Errors | 0 | `pnpm check` |
| Biome Errors | 0 | `pnpm biome:check` |
| AKG Violations | 0 | `pnpm akg:check` |
| Console.log Statements | 0 | `grep -r "console\."` |
| Zod Validation Coverage | 100% | All events validated |

### 10.2 Observability Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Event Types Covered | 100% | All event categories instrumented |
| Correlation ID Usage | 100% | All client messages have correlationId |
| Query Success Rate | >95% | MCP queries return results |
| Log Parsing Success | 100% | All logs parse as valid JSON |
| Schema Validation | 100% | All events pass Zod validation |

### 10.3 Technical Debt Metrics

| Metric | Before | After | Target |
|--------|--------|-------|--------|
| Ad-hoc console.logs | 29 | 0 | 0 |
| Unvalidated log entries | All | 0 | 0 |
| Inconsistent log formats | Many | 0 | 0 |
| Missing correlation IDs | All | 0 | 0 |
| Untested logging code | All | 0 | 0 |

---

## 11. Risk Mitigation

### 11.1 Implementation Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Breaking existing functionality | High | Test-first approach, gradual migration |
| Performance impact | Medium | Benchmark Zod validation, optimize if needed |
| Log volume increase | Medium | Use head_sampling_rate in production |
| Schema changes break queries | Medium | Version schemas, maintain backward compatibility |

### 11.2 Migration Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Missing events during migration | High | Migrate one category at a time, verify logs |
| Breaking tests | Medium | Write tests first, migrate incrementally |
| Production issues | High | Deploy to staging first, monitor closely |

---

## 12. References

### Planning Documents (Read in Order)
1. **[Observability Workflow](observability-workflow.md)** - **👉 START HERE** - Complete implementation guide
2. **[Observability Project Review](observability-project-review.md)** - This document (strategy & technical debt)
3. **[Observability Architectural Patterns](observability-architectural-patterns.md)** - Implementation patterns
4. **[Observability Plan](observability-plan.md)** - High-level plan
5. **[MCP Orchestration Review](mcp-orchestration-review.md)** - Memory & AKG integration
6. **[Existing Instrumentation](instrumentation.md)** - Original debugging strategy

### Project Documentation
- **Testing Guide**: `docs/testing/durable-objects-testing.md`
- **Conventions**: `.claude/CONVENTIONS.md`
- **TypeScript Strategy**: `.claude/typescript-biome-strategy.md`
- **Workflow Orchestration**: `.claude/workflow-orchestration.md`

### External References
- **Zod 4 Reference**: `docs/references/zod4/zod4.md`
- **Context7 MCP**: `docs/references/context7-readme.md`
- **Cloudflare Workers Docs**: Query via `cloudflare-docs` MCP

### Code References
- **Current Logger**: `packages/cloudflare-do/src/lib/logger.ts`
- **GameRoom**: `packages/cloudflare-do/src/GameRoom.ts` (29 console.logs to replace)
- **GlobalLobby**: `packages/cloudflare-do/src/GlobalLobby.ts`
- **Test Patterns**: `packages/cloudflare-do/src/**/__tests__/*.test.ts`
- **Zod Patterns**: `packages/shared/src/validation/schemas.ts`

---

**Document Status**: Planning  
**Last Updated**: 2025-01-XX  
**Owner**: Development Team  
**Reviewers**: TBD

**Next Steps**:
1. Review and approve this project-wide strategy
2. Begin Week 1: Foundation (test-first schema implementation)
3. Track progress in `.claude/state/current-phase.json`
4. Update this document as implementation progresses

