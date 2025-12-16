# Observability Architectural Patterns & Schema Design

> **Status**: Architecture Guide
> **Created**: 2025-12-16
> **Companion To**: `observability-plan.md`
> **Purpose**: Integrate observability implementation with Dicee architectural patterns

---

## Executive Summary

This document bridges `observability-plan.md` with our established architectural patterns:
- **Zod 4 runtime validation** for all log events
- **Test-first approach** with fixtures and schema tests
- **Const array → inferred type** pattern for event taxonomy
- **AKG integration** for layer enforcement
- **Type consistency** with existing domain models

**Critical**: Observability code must follow the same patterns as production code. No exceptions.

### Key Architectural Insights

**Package Isolation**:
- `packages/cloudflare-do/` is **isolated** from `packages/web/`
- Server-side instrumentation lives in `cloudflare-do` (can only import `shared`)
- Client-side telemetry (if needed) lives in `web/src/lib/services/` (services layer)
- Cross-package communication: WebSocket events, not imports

**Layer Boundaries** (AKG-Enforced):
- `cloudflare-do` layer: Can import `shared` only
- `services` layer: Can import `types`, `supabase`, `wasm`, `shared` (NOT `components`, `routes`, `stores`)
- `stores` layer: Can import `services`, `types`, `supabase`, `shared` (NOT `components`, `routes`)
- `components` layer: Can import `components`, `types`, `shared` (NOT `stores`, `services`)

**Observability Placement**:
- ✅ Server-side: `packages/cloudflare-do/src/lib/instrumentation.ts` (used by GameRoom, GlobalLobby)
- ✅ Client-side (optional): `packages/web/src/lib/services/telemetry/` (used by services only)
- ❌ Never: Direct imports from `cloudflare-do` to `web` or vice versa

---

## 1. Zod 4 Schema Patterns for Observability

### 1.1 Event Taxonomy Schema

**Pattern**: Use const arrays as single source of truth, derive Zod enums from them.

```typescript
// packages/cloudflare-do/src/lib/observability/events.schema.ts

import { z } from 'zod';

// =============================================================================
// Event Categories (Const Arrays → Inferred Types)
// =============================================================================

/**
 * Lifecycle event types
 */
export const LIFECYCLE_EVENTS = [
  'lifecycle.wake',
  'lifecycle.connect',
  'lifecycle.disconnect',
  'lifecycle.reconnect',
] as const;

export type LifecycleEvent = (typeof LIFECYCLE_EVENTS)[number];

/**
 * Storage event types
 */
export const STORAGE_EVENTS = [
  'storage.read.start',
  'storage.read.end',
  'storage.write.start',
  'storage.write.end',
  'storage.delete',
  'storage.list',
] as const;

export type StorageEvent = (typeof STORAGE_EVENTS)[number];

/**
 * State machine event types
 */
export const STATE_EVENTS = [
  'state.transition',
  'state.transition.rejected',
  'state.snapshot',
] as const;

export type StateEvent = (typeof STATE_EVENTS)[number];

/**
 * Seat management event types
 */
export const SEAT_EVENTS = [
  'seat.assign',
  'seat.reserve',
  'seat.reclaim.attempt',
  'seat.reclaim.result',
  'seat.release',
] as const;

export type SeatEvent = (typeof SEAT_EVENTS)[number];

/**
 * Game event types
 */
export const GAME_EVENTS = [
  'game.start',
  'game.turn.start',
  'game.turn.end',
  'game.roll',
  'game.score',
  'game.complete',
] as const;

export type GameEvent = (typeof GAME_EVENTS)[number];

/**
 * Connection event types
 */
export const CONNECTION_EVENTS = [
  'connection.auth.success',
  'connection.auth.failure',
  'connection.token.expired',
  'connection.rate_limit',
] as const;

export type ConnectionEvent = (typeof CONNECTION_EVENTS)[number];

/**
 * Broadcast event types
 */
export const BROADCAST_EVENTS = [
  'broadcast.prepare',
  'broadcast.sent',
] as const;

export type BroadcastEvent = (typeof BROADCAST_EVENTS)[number];

/**
 * Error event types
 */
export const ERROR_EVENTS = [
  'error.handler.failed',
  'error.storage.failed',
  'error.broadcast.failed',
  'error.state.corruption',
] as const;

export type ErrorEvent = (typeof ERROR_EVENTS)[number];

/**
 * Diagnostic event types
 */
export const DIAGNOSTIC_EVENTS = [
  'diagnostic.snapshot',
  'diagnostic.health_check',
] as const;

export type DiagnosticEvent = (typeof DIAGNOSTIC_EVENTS)[number];

/**
 * All event types (union)
 */
export const ALL_EVENT_TYPES = [
  ...LIFECYCLE_EVENTS,
  ...STORAGE_EVENTS,
  ...STATE_EVENTS,
  ...SEAT_EVENTS,
  ...GAME_EVENTS,
  ...CONNECTION_EVENTS,
  ...BROADCAST_EVENTS,
  ...ERROR_EVENTS,
  ...DIAGNOSTIC_EVENTS,
] as const;

export type EventType = (typeof ALL_EVENT_TYPES)[number];

// =============================================================================
// Zod Schemas
// =============================================================================

/**
 * Log level enum (Zod-validated)
 */
export const LogLevel = z.enum(['debug', 'info', 'warn', 'error']);
export type LogLevel = z.infer<typeof LogLevel>;

/**
 * Component identifier
 */
export const Component = z.enum(['GameRoom', 'GlobalLobby']);
export type Component = z.infer<typeof Component>;

/**
 * Event type schema (derived from const array)
 */
export const EventTypeSchema = z.enum(ALL_EVENT_TYPES);

/**
 * Base log entry (all events share this structure)
 */
export const BaseLogEntry = z.object({
  _ts: z.number().int().positive(),
  _level: LogLevel,
  _component: Component,
  _event: EventTypeSchema,
  _reqId: z.number().int().positive().optional(),
  _correlationId: z.string().min(1).optional(),
  roomCode: z.string().optional(),
  userId: z.string().optional(),
  connectionId: z.string().optional(),
});

export type BaseLogEntry = z.infer<typeof BaseLogEntry>;

// =============================================================================
// Event-Specific Schemas
// =============================================================================

/**
 * Lifecycle wake event
 */
export const LifecycleWakeEvent = BaseLogEntry.extend({
  _event: z.literal('lifecycle.wake'),
  storageKeys: z.array(z.string()),
  connectedClients: z.number().int().nonnegative(),
  hasGameState: z.boolean(),
  hasSeats: z.boolean(),
  hasRoomState: z.boolean(),
  keyCount: z.number().int().nonnegative(),
});

export type LifecycleWakeEvent = z.infer<typeof LifecycleWakeEvent>;

/**
 * Client connect event
 */
export const ClientConnectEvent = BaseLogEntry.extend({
  _event: z.literal('lifecycle.connect'),
  userId: z.string().min(1),
  role: z.enum(['player', 'spectator', 'pending']),
  connectionId: z.string().min(1),
});

export type ClientConnectEvent = z.infer<typeof ClientConnectEvent>;

/**
 * Client disconnect event
 */
export const ClientDisconnectEvent = BaseLogEntry.extend({
  _event: z.literal('lifecycle.disconnect'),
  userId: z.string().min(1),
  connectionId: z.string().min(1),
  closeCode: z.number().int(),
  closeReason: z.string(),
  wasPlayer: z.boolean(),
  codeCategory: z.string(),
});

export type ClientDisconnectEvent = z.infer<typeof ClientDisconnectEvent>;

/**
 * Storage read end event
 */
export const StorageReadEndEvent = BaseLogEntry.extend({
  _event: z.literal('storage.read.end'),
  key: z.string().min(1),
  found: z.boolean(),
  valueType: z.string().optional(),
  durationMs: z.number().nonnegative().optional(),
  sizeBytes: z.number().int().nonnegative().optional(),
});

export type StorageReadEndEvent = z.infer<typeof StorageReadEndEvent>;

/**
 * Storage write end event
 */
export const StorageWriteEndEvent = BaseLogEntry.extend({
  _event: z.literal('storage.write.end'),
  key: z.string().min(1),
  success: z.boolean(),
  durationMs: z.number().nonnegative().optional(),
});

export type StorageWriteEndEvent = z.infer<typeof StorageWriteEndEvent>;

/**
 * Seat reclaim result event
 */
export const SeatReclaimResultEvent = BaseLogEntry.extend({
  _event: z.literal('seat.reclaim.result'),
  userId: z.string().min(1),
  result: z.enum(['reclaimed', 'spectator']),
  reason: z.string().optional(),
});

export type SeatReclaimResultEvent = z.infer<typeof SeatReclaimResultEvent>;

/**
 * Error event
 */
export const ErrorLogEvent = BaseLogEntry.extend({
  _level: z.literal('error'),
  errorMessage: z.string(),
  errorStack: z.string().optional(),
  errorName: z.string(),
});

export type ErrorLogEvent = z.infer<typeof ErrorLogEvent>;

// =============================================================================
// Union Type for All Events
// =============================================================================

/**
 * Discriminated union of all log events
 */
export const LogEvent = z.discriminatedUnion('_event', [
  LifecycleWakeEvent,
  ClientConnectEvent,
  ClientDisconnectEvent,
  StorageReadEndEvent,
  StorageWriteEndEvent,
  SeatReclaimResultEvent,
  ErrorLogEvent,
  // Add more event schemas here as they're defined
  BaseLogEntry, // Fallback for unknown events
]);

export type LogEvent = z.infer<typeof LogEvent>;

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Validate a log entry against schema
 */
export function validateLogEntry(entry: unknown): LogEvent {
  return LogEvent.parse(entry);
}

/**
 * Safe parse (returns success/error result)
 */
export function safeValidateLogEntry(entry: unknown): z.SafeParseReturnType<unknown, LogEvent> {
  return LogEvent.safeParse(entry);
}

/**
 * Check if event is of a specific type (type guard)
 */
export function isEventType<T extends EventType>(
  event: LogEvent,
  type: T
): event is Extract<LogEvent, { _event: T }> {
  return event._event === type;
}

/**
 * Get event category from event type
 */
export function getEventCategory(eventType: EventType): string {
  if (LIFECYCLE_EVENTS.includes(eventType as LifecycleEvent)) return 'lifecycle';
  if (STORAGE_EVENTS.includes(eventType as StorageEvent)) return 'storage';
  if (STATE_EVENTS.includes(eventType as StateEvent)) return 'state';
  if (SEAT_EVENTS.includes(eventType as SeatEvent)) return 'seat';
  if (GAME_EVENTS.includes(eventType as GameEvent)) return 'game';
  if (CONNECTION_EVENTS.includes(eventType as ConnectionEvent)) return 'connection';
  if (BROADCAST_EVENTS.includes(eventType as BroadcastEvent)) return 'broadcast';
  if (ERROR_EVENTS.includes(eventType as ErrorEvent)) return 'error';
  if (DIAGNOSTIC_EVENTS.includes(eventType as DiagnosticEvent)) return 'diagnostic';
  return 'unknown';
}
```

### 1.2 Schema Integration with Instrumentation

**Update**: `packages/cloudflare-do/src/lib/instrumentation.ts`

```typescript
import { validateLogEntry, type LogEvent, type EventType } from './observability/events.schema.js';

export function createInstrumentation(
  component: 'GameRoom' | 'GlobalLobby',
  roomCode?: string
) {
  const baseContext = { _component: component, roomCode };
  let requestId = 0;

  function emit(level: LogLevel, event: EventType, data?: Record<string, unknown>) {
    const entry: unknown = {
      _ts: Date.now(),
      _level: level,
      _event: event,
      _reqId: ++requestId,
      ...baseContext,
      ...data,
    };

    // Validate before emitting (catches schema violations early)
    const validated = validateLogEntry(entry);

    // Output as JSON for Cloudflare Logs parsing
    console[level === 'debug' ? 'log' : level](JSON.stringify(validated));

    return validated; // Return for testing
  }

  // Rest of implementation...
}
```

---

## 2. Test-First Approach

### 2.1 Schema Tests

**Create**: `packages/cloudflare-do/src/lib/observability/__tests__/events.schema.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import {
  validateLogEntry,
  safeValidateLogEntry,
  isEventType,
  getEventCategory,
  ALL_EVENT_TYPES,
  LIFECYCLE_EVENTS,
  type LifecycleWakeEvent,
  type ClientConnectEvent,
  type SeatReclaimResultEvent,
} from '../events.schema.js';

describe('observability/events.schema', () => {
  describe('event taxonomy completeness', () => {
    it('should have unique event types', () => {
      const uniqueEvents = new Set(ALL_EVENT_TYPES);
      expect(uniqueEvents.size).toBe(ALL_EVENT_TYPES.length);
    });

    it('should categorize all event types', () => {
      for (const eventType of ALL_EVENT_TYPES) {
        const category = getEventCategory(eventType);
        expect(category).not.toBe('unknown');
      }
    });

    it('should have lifecycle events', () => {
      expect(LIFECYCLE_EVENTS.length).toBeGreaterThan(0);
      expect(LIFECYCLE_EVENTS).toContain('lifecycle.wake');
      expect(LIFECYCLE_EVENTS).toContain('lifecycle.connect');
    });
  });

  describe('validateLogEntry', () => {
    it('should validate a valid lifecycle.wake event', () => {
      const event: LifecycleWakeEvent = {
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
      };

      expect(() => validateLogEntry(event)).not.toThrow();
      const validated = validateLogEntry(event);
      expect(validated._event).toBe('lifecycle.wake');
    });

    it('should validate a valid lifecycle.connect event', () => {
      const event: ClientConnectEvent = {
        _ts: Date.now(),
        _level: 'info',
        _component: 'GameRoom',
        _event: 'lifecycle.connect',
        _reqId: 2,
        userId: 'user-123',
        role: 'player',
        connectionId: 'conn-456',
        roomCode: 'TEST-ROOM',
      };

      const validated = validateLogEntry(event);
      expect(validated._event).toBe('lifecycle.connect');
      expect(isEventType(validated, 'lifecycle.connect')).toBe(true);
    });

    it('should reject invalid log level', () => {
      const event = {
        _ts: Date.now(),
        _level: 'critical', // Invalid
        _component: 'GameRoom',
        _event: 'lifecycle.wake',
        storageKeys: [],
        connectedClients: 0,
        hasGameState: false,
        hasSeats: false,
        hasRoomState: false,
        keyCount: 0,
      };

      expect(() => validateLogEntry(event)).toThrow();
    });

    it('should reject invalid component', () => {
      const event = {
        _ts: Date.now(),
        _level: 'info',
        _component: 'InvalidComponent',
        _event: 'lifecycle.wake',
        storageKeys: [],
        connectedClients: 0,
        hasGameState: false,
        hasSeats: false,
        hasRoomState: false,
        keyCount: 0,
      };

      expect(() => validateLogEntry(event)).toThrow();
    });

    it('should reject missing required fields', () => {
      const event = {
        _ts: Date.now(),
        _level: 'info',
        _component: 'GameRoom',
        // Missing _event
      };

      expect(() => validateLogEntry(event)).toThrow();
    });
  });

  describe('safeValidateLogEntry', () => {
    it('should return success for valid event', () => {
      const event: ClientConnectEvent = {
        _ts: Date.now(),
        _level: 'info',
        _component: 'GameRoom',
        _event: 'lifecycle.connect',
        userId: 'user-123',
        role: 'player',
        connectionId: 'conn-456',
      };

      const result = safeValidateLogEntry(event);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data._event).toBe('lifecycle.connect');
      }
    });

    it('should return error for invalid event', () => {
      const event = {
        _ts: Date.now(),
        _level: 'invalid',
        _component: 'GameRoom',
        _event: 'lifecycle.connect',
      };

      const result = safeValidateLogEntry(event);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeDefined();
      }
    });
  });

  describe('isEventType type guard', () => {
    it('should narrow type for lifecycle.connect', () => {
      const event: ClientConnectEvent = {
        _ts: Date.now(),
        _level: 'info',
        _component: 'GameRoom',
        _event: 'lifecycle.connect',
        userId: 'user-123',
        role: 'player',
        connectionId: 'conn-456',
      };

      if (isEventType(event, 'lifecycle.connect')) {
        // TypeScript should know event.role exists here
        expect(event.role).toBe('player');
      }
    });

    it('should return false for mismatched event type', () => {
      const event: ClientConnectEvent = {
        _ts: Date.now(),
        _level: 'info',
        _component: 'GameRoom',
        _event: 'lifecycle.connect',
        userId: 'user-123',
        role: 'player',
        connectionId: 'conn-456',
      };

      expect(isEventType(event, 'lifecycle.disconnect')).toBe(false);
    });
  });

  describe('seat.reclaim.result event', () => {
    it('should validate reclaimed result', () => {
      const event: SeatReclaimResultEvent = {
        _ts: Date.now(),
        _level: 'info',
        _component: 'GameRoom',
        _event: 'seat.reclaim.result',
        userId: 'user-123',
        result: 'reclaimed',
        roomCode: 'TEST-ROOM',
      };

      const validated = validateLogEntry(event);
      expect(validated._event).toBe('seat.reclaim.result');
      if (isEventType(validated, 'seat.reclaim.result')) {
        expect(validated.result).toBe('reclaimed');
      }
    });

    it('should validate spectator result with reason', () => {
      const event: SeatReclaimResultEvent = {
        _ts: Date.now(),
        _level: 'info',
        _component: 'GameRoom',
        _event: 'seat.reclaim.result',
        userId: 'user-123',
        result: 'spectator',
        reason: 'Seat expired (deadline passed)',
        roomCode: 'TEST-ROOM',
      };

      const validated = validateLogEntry(event);
      if (isEventType(validated, 'seat.reclaim.result')) {
        expect(validated.result).toBe('spectator');
        expect(validated.reason).toContain('expired');
      }
    });
  });
});
```

### 2.2 Instrumentation Tests

**Create**: `packages/cloudflare-do/src/lib/__tests__/instrumentation.test.ts`

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createInstrumentation } from '../instrumentation.js';
import { safeValidateLogEntry, isEventType } from '../observability/events.schema.js';

describe('instrumentation', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('should emit valid lifecycle.wake event', () => {
    const instr = createInstrumentation('GameRoom', 'TEST-ROOM');

    instr.hibernationWake(['game', 'seats'], 2);

    expect(consoleSpy).toHaveBeenCalled();
    const lastCall = consoleSpy.mock.calls[consoleSpy.mock.calls.length - 1];
    const logged = JSON.parse(lastCall[0] as string);

    const result = safeValidateLogEntry(logged);
    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data._component).toBe('GameRoom');
      expect(result.data._event).toBe('lifecycle.wake');
      expect(result.data.roomCode).toBe('TEST-ROOM');

      if (isEventType(result.data, 'lifecycle.wake')) {
        expect(result.data.storageKeys).toEqual(['game', 'seats']);
        expect(result.data.connectedClients).toBe(2);
      }
    }
  });

  it('should emit valid seat.reclaim.result event', () => {
    const instr = createInstrumentation('GameRoom', 'TEST-ROOM');

    instr.seatReclaimResult('user-123', 'spectator', 'Seat expired');

    const lastCall = consoleSpy.mock.calls[consoleSpy.mock.calls.length - 1];
    const logged = JSON.parse(lastCall[0] as string);

    const result = safeValidateLogEntry(logged);
    expect(result.success).toBe(true);

    if (result.success && isEventType(result.data, 'seat.reclaim.result')) {
      expect(result.data.userId).toBe('user-123');
      expect(result.data.result).toBe('spectator');
      expect(result.data.reason).toBe('Seat expired');
    }
  });

  it('should increment request ID for each event', () => {
    const instr = createInstrumentation('GameRoom', 'TEST-ROOM');

    instr.clientConnect('user-1', 'player', 'conn-1');
    instr.clientConnect('user-2', 'player', 'conn-2');

    const calls = consoleSpy.mock.calls;
    const event1 = JSON.parse(calls[calls.length - 2][0] as string);
    const event2 = JSON.parse(calls[calls.length - 1][0] as string);

    expect(event2._reqId).toBe(event1._reqId + 1);
  });

  it('should set correlation ID when provided', () => {
    const instr = createInstrumentation('GameRoom', 'TEST-ROOM');

    instr.setCorrelationId('abc-123');
    instr.clientConnect('user-1', 'player', 'conn-1');

    const lastCall = consoleSpy.mock.calls[consoleSpy.mock.calls.length - 1];
    const logged = JSON.parse(lastCall[0] as string);

    expect(logged._correlationId).toBe('abc-123');
  });
});
```

---

## 3. AKG Integration

### 3.1 Actual Layer Architecture (AKG-Enforced)

**CRITICAL**: The following diagram shows the **actual** AKG layer structure, not a simplified version. Observability code must follow these exact boundaries.

```
Actual Dicee Layer Architecture (from AKG):

┌─────────────────────────────────────────────────────────────┐
│                    routes (SvelteKit)                       │
│  Can import: components, stores, services, types, wasm, shared│
└───────────────────────┬─────────────────────────────────────┘
                        │
        ┌───────────────┼───────────────┐
        │               │               │
        ▼               ▼               ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│  components  │ │    stores    │ │   services   │
│              │ │              │ │              │
│ Can import:  │ │ Can import:  │ │ Can import:  │
│ • components │ │ • services   │ │ • types      │
│ • types      │ │ • types      │ │ • supabase   │
│ • shared     │ │ • supabase   │ │ • wasm       │
│              │ │ • shared     │ │ • shared     │
│              │ │              │ │              │
│ CANNOT:      │ │ CANNOT:      │ │ CANNOT:      │
│ • stores     │ │ • components │ │ • components │
│ • services   │ │ • routes     │ │ • routes     │
│              │ │              │ │ • stores     │
└──────────────┘ └──────────────┘ └──────────────┘
                        │
                        │ (services layer)
                        ▼
┌─────────────────────────────────────────────────────────────┐
│              cloudflare-do (Durable Objects)                │
│  Can import: shared ONLY                                    │
│                                                             │
│  • GameRoom.ts                                              │
│  • GlobalLobby.ts                                            │
│  • instrumentation.ts  ← SERVER-SIDE OBSERVABILITY HERE     │
│  • observability/events.schema.ts                           │
│                                                             │
│  CANNOT import:                                             │
│  • components, stores, services, types (web package)        │
│  • routes                                                   │
└─────────────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│                    shared (Cross-package)                    │
│  Can import: nothing (foundation layer)                      │
│  • Common types and schemas                                 │
└─────────────────────────────────────────────────────────────┘
```

### 3.1.1 Observability Layer Placement

**Server-Side Observability** (Primary):
- **Location**: `packages/cloudflare-do/src/lib/`
- **Layer**: `cloudflare-do` (can only import `shared`)
- **Files**:
  - `instrumentation.ts` - Main instrumentation class
  - `observability/events.schema.ts` - Zod schemas
  - `observability/metrics.schema.ts` - Metrics schemas
- **Used by**: `GameRoom.ts`, `GlobalLobby.ts` (both in `cloudflare-do` layer)
- **AKG Rule**: ✅ Valid - `cloudflare-do` can import its own `lib/` files

**Client-Side Telemetry** (Future - Optional):
- **Location**: `packages/web/src/lib/services/telemetry/` (if needed)
- **Layer**: `services` (can import `types`, `supabase`, `wasm`, `shared`)
- **Purpose**: Client-side event tracking, correlation ID generation
- **Used by**: Service layer only (stores/components cannot import directly)
- **AKG Rule**: ✅ Valid - `services` layer can have its own modules

**Key Insight**: The `cloudflare-do` layer is **isolated** from the web package. It can only import `shared`. This means:
- ✅ Instrumentation code in `cloudflare-do/src/lib/` is valid
- ✅ Instrumentation can import from `shared` for common types
- ❌ Instrumentation cannot import from `web/src/lib/` (different package)
- ❌ Web package cannot import instrumentation (different package, different layer)

### 3.2 AKG Invariants for Observability

**Add New Invariant**: `observability_layer_boundaries`

**Before implementing**: Verify layer rules using AKG MCP:
```
Using akg MCP server, check layer rules for cloudflare-do layer
```

```typescript
// packages/web/src/tools/akg/invariants/builtin/observability-layer-boundaries.ts

import type { AKGGraph, AKGQueryEngine } from '../../schema/invariant.schema.js';
import type { InvariantViolation } from '../../schema/invariant.schema.js';
import { createViolation } from '../../schema/invariant.schema.js';

/**
 * Observability Layer Boundaries Invariant
 *
 * Rules (based on actual AKG layer structure):
 * 1. Server-side instrumentation.ts can ONLY be imported by cloudflare-do layer
 *    - Valid: GameRoom.ts, GlobalLobby.ts (both in cloudflare-do)
 *    - Invalid: Any file in packages/web/ (different package/layer)
 * 2. Client-side telemetry (if implemented) can ONLY be imported by services layer
 *    - Valid: Other service files
 *    - Invalid: stores, components, routes
 * 3. Stores and components cannot import observability directly
 *    - Must go through services layer if client-side telemetry needed
 *
 * Rationale:
 * - cloudflare-do layer is isolated (can only import shared)
 * - Web package layers follow strict dependency rules
 * - Observability follows same layer rules as domain code
 */
export function checkObservabilityLayerBoundaries(
  graph: AKGGraph,
  engine: AKGQueryEngine
): InvariantViolation[] {
  const violations: InvariantViolation[] = [];

  // Rule 1: Server-side instrumentation can only be imported by cloudflare-do
  const instrumentationImporters = engine.getNodes((node) =>
    engine.getOutgoing(node.id).some((edge) =>
      edge.target.includes('instrumentation.ts') ||
      edge.target.includes('observability/events.schema')
    )
  );

  for (const importer of instrumentationImporters) {
    // Only cloudflare-do package can import server-side instrumentation
    if (!importer.path.includes('packages/cloudflare-do/')) {
      violations.push(
        createViolation(
          'observability_layer_boundaries',
          'Observability Layer Boundaries',
          `Node "${importer.id}" (${importer.path}) imports server-side instrumentation but is not in cloudflare-do package. Server-side instrumentation can only be used by Durable Objects.`,
          importer.id,
          'error'
        )
      );
    }
  }

  // Rule 2: Client-side telemetry can only be imported by services layer
  const telemetryImporters = engine.getNodes((node) =>
    engine.getOutgoing(node.id).some((edge) =>
      edge.target.includes('services/telemetry') ||
      edge.target.includes('lib/telemetry')
    )
  );

  for (const importer of telemetryImporters) {
    // Check if importer is in services layer
    const isService = importer.path.includes('packages/web/src/lib/services/');
    const isStore = importer.path.includes('packages/web/src/lib/stores/');
    const isComponent = importer.path.includes('packages/web/src/lib/components/');
    const isRoute = importer.path.includes('packages/web/src/routes/');

    if (!isService && (isStore || isComponent || isRoute)) {
      violations.push(
        createViolation(
          'observability_layer_boundaries',
          'Observability Layer Boundaries',
          `Node "${importer.id}" (${importer.path}) imports client-side telemetry but is not in services layer. Only services can import telemetry.`,
          importer.id,
          'error'
        )
      );
    }
  }

  // Rule 3: Stores and components cannot import observability directly
  const stores = engine.getNodes((node) => node.path.includes('packages/web/src/lib/stores/'));
  const components = engine.getNodes((node) => node.path.includes('packages/web/src/lib/components/'));

  for (const node of [...stores, ...components]) {
    const outgoing = engine.getOutgoing(node.id);

    for (const edge of outgoing) {
      if (edge.target.includes('telemetry') || edge.target.includes('observability')) {
        violations.push(
          createViolation(
            'observability_layer_boundaries',
            'Observability Layer Boundaries',
            `${node.type} "${node.id}" cannot directly import observability/telemetry code. Use service layer instead.`,
            node.id,
            'warning'
          )
        );
      }
    }
  }

  return violations;
}
```

### 3.2.1 Package Boundary Rules

**Important**: The Dicee project has **two separate packages**:

1. **`packages/cloudflare-do/`** - Durable Objects (server-side)
   - Layer: `cloudflare-do`
   - Can import: `shared` only
   - Contains: `instrumentation.ts`, `GameRoom.ts`, `GlobalLobby.ts`

2. **`packages/web/`** - SvelteKit frontend (client-side)
   - Layers: `routes`, `components`, `stores`, `services`, `types`, `supabase`, `wasm`
   - Cannot import from `cloudflare-do` (different package)
   - If client-side telemetry needed: create in `services` layer

**Cross-Package Communication**:
- Client ↔ Server: WebSocket (not imports)
- Shared types: `packages/shared/` (both packages can import)
- Observability: Server-side only (in `cloudflare-do`), client uses WebSocket events

### 3.3 File Structure and Naming Conventions

**Server-Side Observability** (cloudflare-do package):

```
packages/cloudflare-do/src/
├── lib/
│   ├── instrumentation.ts              # Main instrumentation class
│   ├── observability/
│   │   ├── events.schema.ts            # Zod schemas for events
│   │   ├── metrics.schema.ts           # Zod schemas for metrics
│   │   └── queries.ts                  # MCP query helpers (if needed)
│   └── logger.ts                       # Existing logger (if present)
├── GameRoom.ts                         # Uses instrumentation
├── GlobalLobby.ts                      # Uses instrumentation
└── __tests__/
    ├── instrumentation.test.ts         # Instrumentation tests
    └── observability/
        ├── events.schema.test.ts       # Schema tests
        └── metrics.schema.test.ts      # Metrics schema tests
```

**Client-Side Telemetry** (web package - optional, future):

```
packages/web/src/lib/services/
└── telemetry/                          # Only if client-side telemetry needed
    ├── clientTelemetry.ts              # Client-side event tracking
    ├── correlation.ts                  # Correlation ID management
    └── __tests__/
        └── clientTelemetry.test.ts
```

**Key Points**:
- Server-side instrumentation: `packages/cloudflare-do/src/lib/`
- Client-side telemetry (if needed): `packages/web/src/lib/services/telemetry/`
- Shared types: `packages/shared/src/` (both packages can use)
- Tests: Co-located with source files in `__tests__/` directories

---

## 4. Validation Strategy

### 4.1 Three-Layer Validation

```typescript
/**
 * Three-Layer Validation Pattern for Observability
 *
 * 1. Compile-time: TypeScript ensures event structure
 * 2. Runtime: Zod validates before emission
 * 3. Query-time: MCP tools validate query results
 */

// Layer 1: Compile-time (TypeScript)
const event: LifecycleWakeEvent = {
  _ts: Date.now(),
  _level: 'info',
  _component: 'GameRoom',
  _event: 'lifecycle.wake',
  storageKeys: ['game'],
  connectedClients: 1,
  hasGameState: true,
  hasSeats: false,
  hasRoomState: true,
  keyCount: 1,
};

// Layer 2: Runtime (Zod)
const validated = validateLogEntry(event); // Throws if invalid

// Layer 3: Query-time (MCP results validated)
const queryResult = await queryLogs({ event: 'lifecycle.wake' });
const validatedResults = queryResult.map(validateLogEntry);
```

### 4.2 Error Handling Pattern

```typescript
/**
 * Safe emission pattern with fallback
 */
function emit(level: LogLevel, event: EventType, data?: Record<string, unknown>) {
  try {
    const entry: unknown = {
      _ts: Date.now(),
      _level: level,
      _event: event,
      _reqId: ++requestId,
      ...baseContext,
      ...data,
    };

    // Validate (throws on invalid)
    const validated = validateLogEntry(entry);

    // Emit validated event
    console[level === 'debug' ? 'log' : level](JSON.stringify(validated));

    return validated;
  } catch (error) {
    // Fallback: emit error event for invalid schema
    console.error(JSON.stringify({
      _ts: Date.now(),
      _level: 'error',
      _component: baseContext._component,
      _event: 'error.instrumentation.failed',
      errorMessage: error instanceof Error ? error.message : String(error),
      originalEvent: event,
      originalData: data,
    }));

    throw error; // Re-throw in development
  }
}
```

---

## 5. Implementation Checklist (Updated)

### Phase 1: Schema & Types (Week 1)
- [ ] Create `events.schema.ts` with Zod 4 patterns
- [ ] Use const arrays for event taxonomy
- [ ] Implement discriminated union for all events
- [ ] Write schema tests (100% coverage)
- [ ] Document type inference patterns
- [ ] Add AKG invariant for observability layers

### Phase 2: Instrumentation (Week 1)
- [ ] Update `instrumentation.ts` to use schemas
- [ ] Add validation before emission
- [ ] Write instrumentation tests
- [ ] Test validation error handling
- [ ] Verify Zod performance (benchmark)

### Phase 3: Integration (Week 2)
- [ ] Integrate into GameRoom
- [ ] Integrate into GlobalLobby
- [ ] Add correlation ID support
- [ ] Test end-to-end event flow
- [ ] Verify logs in Cloudflare Dashboard
- [ ] Run AKG checks (no violations)

### Phase 4: Query & Analysis (Week 2-3)
- [ ] Create MCP query templates
- [ ] Build query helper functions
- [ ] Validate query results with schemas
- [ ] Test correlation queries
- [ ] Document query patterns

---

## 6. Testing Strategy

### 6.1 Unit Tests
- **Schema tests**: Validate all event types
- **Instrumentation tests**: Verify emission logic
- **Type guard tests**: Ensure type narrowing works

### 6.2 Integration Tests
- **GameRoom integration**: Verify events emitted correctly
- **Storage operation tracking**: Check read/write events
- **Correlation tracking**: Verify correlation IDs flow

### 6.3 E2E Tests
- **Log query tests**: Query via MCP, validate results
- **Event correlation**: Trace client action → server event
- **Error scenarios**: Test validation failures

---

## 7. References

### Project Patterns
- **Type System**: `packages/web/src/lib/types.ts`
- **Zod Patterns**: `packages/web/src/lib/tools/akg/schema/*.ts`
- **AKG Invariants**: `packages/web/src/lib/tools/akg/invariants/builtin/`
- **Test Patterns**: `packages/web/src/lib/**/__tests__/`

### Documentation
- **Observability Plan**: `docs/planning/observability-plan.md`
- **TypeScript Strategy**: `.claude/typescript-biome-strategy.md`
- **Conventions**: `.claude/CONVENTIONS.md`
- **Zod 4 Reference**: `docs/references/zod4/zod4.md`

---

**Document Status**: Architecture Guide
**Last Updated**: 2025-12-16
**Owner**: Development Team

**Next Steps**:
1. Review this architectural guide
2. Update `observability-plan.md` references
3. Implement schemas (test-first)
4. Integrate with AKG invariants
