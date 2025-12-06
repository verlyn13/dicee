# Simulation 002: Circular Store Dependency

> **Status**: Design Complete
> **Created**: 2025-12-05
> **Invariant**: `store_no_circular_deps`
> **Severity**: `error` (BLOCKING)
> **Category**: Structural

---

## Executive Summary

This simulation validates the `store_no_circular_deps` invariant, which detects circular import chains between Svelte 5 rune stores. This is a **blocking** invariant because circular dependencies can cause:

1. **Silent runtime failures** - Svelte 5 runes may return `undefined` during initialization
2. **Inconsistent state** - Partial initialization leads to unpredictable behavior
3. **Module loading hangs** - JavaScript module resolution can deadlock
4. **Untraceable bugs** - Errors manifest far from the actual cycle

**Current Codebase Status**: ✅ No circular dependencies detected. Architecture is healthy.

---

## Part 1: Technical Background

### 1.1 Why Circular Dependencies Break Svelte 5 Runes

Svelte 5 runes (`$state`, `$derived`, `$effect`) rely on **compile-time transformation** and **runtime signal tracking**. When modules form a cycle:

```
store_a.svelte.ts → imports → store_b.svelte.ts → imports → store_a.svelte.ts
```

The JavaScript module loader encounters this sequence:

1. Begin loading `store_a.svelte.ts`
2. Encounter `import { b } from './store_b.svelte.ts'`
3. Begin loading `store_b.svelte.ts` (before `a` finishes)
4. Encounter `import { a } from './store_a.svelte.ts'`
5. `store_a` is **partially initialized** - exported values may be `undefined`
6. `store_b` continues with broken reference
7. `store_a` completes, but damage is done

**Svelte 5 runes compound this** because:
- `$state()` returns a proxy that may not be initialized
- `$derived()` may capture stale closures
- `$effect()` may run before dependencies are ready

### 1.2 Real Error Patterns

```typescript
// store_a.svelte.ts
import { b } from './store_b.svelte.ts';  // b is undefined here!

class StoreA {
  #count = $state(0);

  // This will throw: Cannot read property 'value' of undefined
  readonly combined = $derived(this.#count + b.value);
}

export const a = new StoreA();
```

**Runtime errors observed:**
- `TypeError: Cannot read property 'value' of undefined`
- `TypeError: b is not a function`
- Silent `NaN` values from arithmetic with `undefined`
- `$effect` callbacks that never fire
- Infinite loops when effects trigger circular updates

### 1.3 Current Dicee Store Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    STORES LAYER                         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─────────────┐                                       │
│  │   auth      │  (independent - no store imports)     │
│  │ .svelte.ts  │                                       │
│  └─────────────┘                                       │
│                                                         │
│  ┌─────────────┐      composition      ┌────────────┐ │
│  │    game     │ ◄──────────────────── │   dice     │ │
│  │ .svelte.ts  │      (class import)   │ .svelte.ts │ │
│  │             │ ◄──────────────────── ├────────────┤ │
│  │             │      (class import)   │ scorecard  │ │
│  └─────────────┘                       │ .svelte.ts │ │
│        │                               └────────────┘ │
│        │ imports service                               │
│        ▼                                               │
│  ┌─────────────┐                                       │
│  │   engine    │  (services layer)                     │
│  │    .ts      │                                       │
│  └─────────────┘                                       │
│                                                         │
│  ┌─────────────┐      imports service  ┌────────────┐ │
│  │    room     │ ─────────────────────►│ roomService│ │
│  │ .svelte.ts  │                       │ .svelte.ts │ │
│  └─────────────┘                       └────────────┘ │
│                                              ▲         │
│  ┌─────────────┐      imports service        │         │
│  │ multiplayer │ ────────────────────────────┘         │
│  │ Game.svelte │                                       │
│  │    .ts      │                                       │
│  └─────────────┘                                       │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Key Pattern**: `game.svelte.ts` uses **class composition** (imports class, instantiates internally) rather than importing singleton instances. This is a safe pattern.

---

## Part 2: Violation Scenarios

### 2.1 Scenario A: Direct Mutual Import (Most Common)

**How it happens**: Developer needs auth status in room store, and connection status in auth store.

```typescript
// room.svelte.ts
import { auth } from './auth.svelte';  // Need userId

class RoomStore {
  readonly isAuthorized = $derived(auth.isAuthenticated && this.isConnected);
}

// auth.svelte.ts
import { room } from './room.svelte';  // Need connection for "online" indicator

class AuthState {
  readonly isOnline = $derived(this.isAuthenticated && room.isConnected);
}
```

**Cycle**: `room → auth → room`

### 2.2 Scenario B: Transitive Cycle (Harder to Detect)

**How it happens**: Three stores each import the next, forming a ring.

```typescript
// game.svelte.ts
import { multiplayer } from './multiplayerGame.svelte';  // Sync state

// multiplayerGame.svelte.ts
import { room } from './room.svelte';  // Connection status

// room.svelte.ts
import { game } from './game.svelte';  // Game state for room
```

**Cycle**: `game → multiplayer → room → game`

### 2.3 Scenario C: Self-Cycle via Re-export (Subtle)

**How it happens**: Index file re-exports, store imports from index.

```typescript
// stores/index.ts
export { game } from './game.svelte';
export { auth } from './auth.svelte';

// stores/game.svelte.ts
import { auth } from './index';  // Seems safe, but...

// If index.ts does:
// export { game } from './game.svelte';  // Creates self-reference during load
```

**Cycle**: `game → index → game`

### 2.4 Scenario D: Effect-Induced Logical Cycle (Hardest)

**How it happens**: No import cycle, but effects create runtime cycle.

```typescript
// game.svelte.ts
import { eventBus } from './events';

$effect(() => {
  eventBus.emit('gameStateChanged', this.state);
});

// auth.svelte.ts
import { eventBus } from './events';

eventBus.on('gameStateChanged', (state) => {
  // This triggers an effect in game store
  eventBus.emit('authCheckRequired');
});
```

**Note**: This is a **logical cycle**, not an import cycle. AKG can warn about potential event-based cycles but cannot fully detect them statically.

---

## Part 3: Graph Representation

### 3.1 Cycle Detection Data Structure

```json
{
  "nodes": [
    {
      "id": "store::auth",
      "type": "Store",
      "name": "auth.svelte.ts",
      "filePath": "packages/web/src/lib/stores/auth.svelte.ts",
      "attributes": {
        "layer": "stores",
        "storeType": "singleton",
        "runeTypes": ["$state", "$derived"]
      }
    },
    {
      "id": "store::room",
      "type": "Store",
      "name": "room.svelte.ts",
      "filePath": "packages/web/src/lib/stores/room.svelte.ts",
      "attributes": {
        "layer": "stores",
        "storeType": "factory",
        "runeTypes": ["$state", "$derived"]
      }
    }
  ],
  "edges": [
    {
      "id": "imports::room::auth",
      "type": "imports",
      "sourceNodeId": "store::room",
      "targetNodeId": "store::auth",
      "attributes": {
        "importType": "singleton",
        "namedImports": ["auth"]
      },
      "evidence": [{
        "filePath": "packages/web/src/lib/stores/room.svelte.ts",
        "startLine": 3,
        "snippet": "import { auth } from './auth.svelte';"
      }]
    },
    {
      "id": "imports::auth::room",
      "type": "imports",
      "sourceNodeId": "store::auth",
      "targetNodeId": "store::room",
      "attributes": {
        "importType": "singleton",
        "namedImports": ["room"]
      },
      "evidence": [{
        "filePath": "packages/web/src/lib/stores/auth.svelte.ts",
        "startLine": 5,
        "snippet": "import { room } from './room.svelte';"
      }]
    }
  ]
}
```

### 3.2 Cycle Representation

When a cycle is detected, the graph includes metadata:

```json
{
  "metadata": {
    "cycles": [
      {
        "id": "cycle::auth::room",
        "nodes": ["store::auth", "store::room"],
        "edges": ["imports::room::auth", "imports::auth::room"],
        "length": 2,
        "severity": "error"
      }
    ]
  }
}
```

---

## Part 4: Invariant Definition

### 4.1 Invariant Specification

```yaml
id: "store_no_circular_deps"
name: "Store: No Circular Dependencies"
description: |
  Stores in the stores/ directory must not have circular import dependencies.
  Circular dependencies cause Svelte 5 runes to fail during initialization,
  leading to undefined values and unpredictable behavior.

type: "structural"
severity: "error"  # BLOCKING - must fix before merge

rule:
  scope: "stores"
  detect:
    algorithm: "tarjan_scc"  # Strongly Connected Components
    edge_types: ["imports"]
    min_cycle_length: 2

  exempt_when: []  # No exemptions - cycles are always errors

adr_reference: null  # Document in CONVENTIONS.md
rationale: |
  Svelte 5 runes rely on JavaScript module initialization order.
  Circular imports cause partial initialization, breaking $state/$derived.
  See Simulation 002 for technical analysis.
```

### 4.2 Implementation

```typescript
// src/tools/akg/invariants/definitions/store-no-circular-deps.ts

import type { InvariantCheckFn } from '../checker';
import type { InvariantViolation } from '../../schema/invariant.schema';
import type { AKGNode, AKGEdge, AKGGraph } from '../../schema/graph.schema';
import type { AKGQueryEngine } from '../../query/engine';

/**
 * Tarjan's algorithm for finding Strongly Connected Components (SCCs).
 * An SCC with more than one node indicates a cycle.
 */
function findCycles(
  graph: AKGGraph,
  engine: AKGQueryEngine,
  nodeFilter: (node: AKGNode) => boolean
): AKGNode[][] {
  const storeNodes = graph.nodes.filter(nodeFilter);
  const nodeIds = new Set(storeNodes.map(n => n.id));

  let index = 0;
  const nodeIndex = new Map<string, number>();
  const lowLink = new Map<string, number>();
  const onStack = new Set<string>();
  const stack: string[] = [];
  const sccs: AKGNode[][] = [];

  function strongConnect(nodeId: string): void {
    nodeIndex.set(nodeId, index);
    lowLink.set(nodeId, index);
    index++;
    stack.push(nodeId);
    onStack.add(nodeId);

    // Get outgoing import edges to other stores
    const outEdges = engine.getOutgoingEdges(nodeId, 'imports');

    for (const edge of outEdges) {
      // Only consider edges to other stores
      if (!nodeIds.has(edge.targetNodeId)) continue;

      if (!nodeIndex.has(edge.targetNodeId)) {
        strongConnect(edge.targetNodeId);
        lowLink.set(nodeId, Math.min(
          lowLink.get(nodeId)!,
          lowLink.get(edge.targetNodeId)!
        ));
      } else if (onStack.has(edge.targetNodeId)) {
        lowLink.set(nodeId, Math.min(
          lowLink.get(nodeId)!,
          nodeIndex.get(edge.targetNodeId)!
        ));
      }
    }

    // If nodeId is a root node, pop the SCC
    if (lowLink.get(nodeId) === nodeIndex.get(nodeId)) {
      const scc: AKGNode[] = [];
      let w: string;
      do {
        w = stack.pop()!;
        onStack.delete(w);
        const node = engine.getNode(w);
        if (node) scc.push(node);
      } while (w !== nodeId);

      // Only report SCCs with more than one node (actual cycles)
      if (scc.length > 1) {
        sccs.push(scc);
      }
    }
  }

  for (const node of storeNodes) {
    if (!nodeIndex.has(node.id)) {
      strongConnect(node.id);
    }
  }

  return sccs;
}

/**
 * Build human-readable cycle path
 */
function buildCyclePath(
  cycle: AKGNode[],
  engine: AKGQueryEngine
): { path: string; edges: AKGEdge[] } {
  const edges: AKGEdge[] = [];
  const nodeNames = cycle.map(n => n.name.replace('.svelte.ts', ''));

  // Find edges that form the cycle
  for (let i = 0; i < cycle.length; i++) {
    const from = cycle[i];
    const to = cycle[(i + 1) % cycle.length];

    const edge = engine.getOutgoingEdges(from.id, 'imports')
      .find(e => e.targetNodeId === to.id);

    if (edge) edges.push(edge);
  }

  // Build readable path: auth → room → auth
  const path = [...nodeNames, nodeNames[0]].join(' → ');

  return { path, edges };
}

export const storeNoCircularDeps: InvariantCheckFn = (graph, engine) => {
  const violations: InvariantViolation[] = [];

  // Find all store nodes
  const isStoreNode = (node: AKGNode): boolean => {
    return (
      node.type === 'Store' ||
      node.attributes.layer === 'stores' ||
      node.filePath?.includes('/stores/') === true
    );
  };

  // Detect cycles using Tarjan's algorithm
  const cycles = findCycles(graph, engine, isStoreNode);

  for (const cycle of cycles) {
    const { path, edges } = buildCyclePath(cycle, engine);

    violations.push({
      invariantId: 'store_no_circular_deps',
      invariantName: 'Store: No Circular Dependencies',
      severity: 'error',

      message: `Circular dependency detected in stores: ${path}`,

      suggestion: buildSuggestion(cycle, edges),

      sourceNode: cycle[0].name,
      targetNode: cycle[cycle.length - 1].name,

      evidence: edges.flatMap(e =>
        e.evidence.map(ev => ({
          filePath: ev.filePath,
          line: ev.startLine,
          snippet: ev.snippet,
        }))
      ),

      // Extra metadata for cycle-specific handling
      businessRule: `Cycle length: ${cycle.length} stores`,
    });
  }

  return violations;
};

function buildSuggestion(cycle: AKGNode[], edges: AKGEdge[]): string {
  const names = cycle.map(n => n.name.replace('.svelte.ts', ''));

  return `🚫 BLOCKING: Circular store dependencies break Svelte 5 runes.

The cycle must be broken. Options:

1. **Extract Shared State** (Recommended)
   Create a new store that both ${names[0]} and ${names[1]} can import:

   \`\`\`
   ${names[0]} ─┐
               ├──► sharedState.svelte.ts
   ${names[1]} ─┘
   \`\`\`

2. **Use Dependency Injection**
   Pass the dependency as a parameter instead of importing:

   \`\`\`typescript
   // Instead of: import { ${names[1]} } from './${names[1]}.svelte';
   export function create${capitalize(names[0])}(${names[1]}Ref: ${capitalize(names[1])}) {
     // Use ${names[1]}Ref instead of importing
   }
   \`\`\`

3. **Use Events/Callbacks**
   Decouple with event-based communication:

   \`\`\`typescript
   // ${names[0]}.svelte.ts
   let onStateChange: ((state: State) => void) | null = null;
   export function setStateChangeHandler(handler: typeof onStateChange) {
     onStateChange = handler;
   }
   \`\`\`

4. **Merge Stores**
   If tightly coupled, consider combining into one store.

⚠️  Do NOT use dynamic imports or lazy loading as a workaround.
    This masks the problem but doesn't fix the architectural issue.`;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
```

### 4.3 Cycle Length Classification

```typescript
// Additional severity assessment based on cycle characteristics

function assessCycleSeverity(cycle: AKGNode[]): {
  severity: 'error';
  urgency: 'critical' | 'high' | 'medium';
  complexity: string;
} {
  const length = cycle.length;

  // All cycles are errors, but urgency varies
  if (length === 2) {
    return {
      severity: 'error',
      urgency: 'high',
      complexity: 'Direct mutual import - straightforward to fix'
    };
  } else if (length === 3) {
    return {
      severity: 'error',
      urgency: 'high',
      complexity: 'Triangle dependency - may need mediator pattern'
    };
  } else {
    return {
      severity: 'error',
      urgency: 'critical',
      complexity: `Long cycle (${length} stores) - requires architectural review`
    };
  }
}
```

---

## Part 5: Expected Detection Output

### 5.1 CLI Output (Direct Cycle)

```
pnpm akg:check

🔒 Checking invariants...

❌ store_no_circular_deps (1 violation)

   ┌──────────────────────────────────────────────────────────────┐
   │  CIRCULAR DEPENDENCY DETECTED                                │
   │                                                              │
   │    auth.svelte.ts → room.svelte.ts → auth.svelte.ts         │
   │                                                              │
   │  Cycle length: 2 stores                                      │
   └──────────────────────────────────────────────────────────────┘

   Evidence:

   packages/web/src/lib/stores/auth.svelte.ts:5
   │ import { room } from './room.svelte';

   packages/web/src/lib/stores/room.svelte.ts:3
   │ import { auth } from './auth.svelte';

   🚫 BLOCKING: Circular store dependencies break Svelte 5 runes.

   The cycle must be broken. Options:

   1. Extract Shared State (Recommended)
      Create a new store that both auth and room can import.

   2. Use Dependency Injection
      Pass the dependency as a parameter instead of importing.

   3. Use Events/Callbacks
      Decouple with event-based communication.

📊 Summary:
   Total: 8 invariants checked
   Passed: 7
   Failed: 1
   Errors: 1
   Warnings: 0

🚫 BLOCKING VIOLATIONS FOUND. Must fix before merge.
```

### 5.2 CLI Output (Transitive Cycle)

```
❌ store_no_circular_deps (1 violation)

   ┌──────────────────────────────────────────────────────────────┐
   │  CIRCULAR DEPENDENCY DETECTED                                │
   │                                                              │
   │    game → multiplayerGame → room → game                     │
   │                                                              │
   │  Cycle length: 3 stores (COMPLEX)                           │
   └──────────────────────────────────────────────────────────────┘

   Evidence:

   packages/web/src/lib/stores/game.svelte.ts:8
   │ import { multiplayer } from './multiplayerGame.svelte';

   packages/web/src/lib/stores/multiplayerGame.svelte.ts:12
   │ import { room } from './room.svelte';

   packages/web/src/lib/stores/room.svelte.ts:15
   │ import { game } from './game.svelte';

   ⚠️  This is a transitive cycle - harder to detect manually.

   Recommendation: Create a shared context store that all three can import.
```

### 5.3 JSON Output (for CI/MCP)

```json
{
  "invariantId": "store_no_circular_deps",
  "passed": false,
  "violations": [
    {
      "invariantId": "store_no_circular_deps",
      "invariantName": "Store: No Circular Dependencies",
      "severity": "error",
      "message": "Circular dependency detected in stores: auth → room → auth",
      "sourceNode": "auth.svelte.ts",
      "targetNode": "room.svelte.ts",
      "evidence": [
        {
          "filePath": "packages/web/src/lib/stores/auth.svelte.ts",
          "line": 5,
          "snippet": "import { room } from './room.svelte';"
        },
        {
          "filePath": "packages/web/src/lib/stores/room.svelte.ts",
          "line": 3,
          "snippet": "import { auth } from './auth.svelte';"
        }
      ],
      "businessRule": "Cycle length: 2 stores",
      "suggestion": "..."
    }
  ],
  "durationMs": 45,
  "checkedAt": "2025-12-05T12:00:00.000Z"
}
```

---

## Part 6: Resolution Patterns

### 6.1 Pattern A: Extract Shared State (Recommended)

**Before** (cycle):
```typescript
// auth.svelte.ts
import { room } from './room.svelte';
const isOnline = $derived(this.isAuthenticated && room.isConnected);

// room.svelte.ts
import { auth } from './auth.svelte';
const isAuthorized = $derived(auth.isAuthenticated && this.isConnected);
```

**After** (no cycle):
```typescript
// connectionContext.svelte.ts (NEW)
class ConnectionContext {
  #authStatus = $state<'authenticated' | 'anonymous' | 'none'>('none');
  #connectionStatus = $state<'connected' | 'disconnected'>('disconnected');

  readonly isOnline = $derived(
    this.#authStatus !== 'none' && this.#connectionStatus === 'connected'
  );

  setAuthStatus(status: typeof this.#authStatus) {
    this.#authStatus = status;
  }

  setConnectionStatus(status: typeof this.#connectionStatus) {
    this.#connectionStatus = status;
  }
}
export const connectionContext = new ConnectionContext();

// auth.svelte.ts (no room import)
import { connectionContext } from './connectionContext.svelte';

$effect(() => {
  connectionContext.setAuthStatus(
    this.isAuthenticated ? (this.isAnonymous ? 'anonymous' : 'authenticated') : 'none'
  );
});

// room.svelte.ts (no auth import)
import { connectionContext } from './connectionContext.svelte';

$effect(() => {
  connectionContext.setConnectionStatus(this.isConnected ? 'connected' : 'disconnected');
});
```

**Verification**:
```bash
pnpm akg:check
# ✅ store_no_circular_deps passed
```

### 6.2 Pattern B: Dependency Injection

**Before** (cycle):
```typescript
// game.svelte.ts
import { multiplayer } from './multiplayerGame.svelte';

class GameState {
  syncWithMultiplayer() {
    multiplayer.updateGameState(this.state);
  }
}
```

**After** (no cycle):
```typescript
// game.svelte.ts (no multiplayer import)
class GameState {
  #syncHandler: ((state: GameStateData) => void) | null = null;

  setSyncHandler(handler: typeof this.#syncHandler) {
    this.#syncHandler = handler;
  }

  syncWithMultiplayer() {
    this.#syncHandler?.(this.state);
  }
}

// Usage in component (where both are available):
import { game } from '$lib/stores/game.svelte';
import { multiplayer } from '$lib/stores/multiplayerGame.svelte';

game.setSyncHandler((state) => multiplayer.updateGameState(state));
```

### 6.3 Pattern C: Event-Based Decoupling

**Before** (cycle):
```typescript
// scorecard.svelte.ts
import { game } from './game.svelte';

class ScorecardState {
  complete() {
    game.endGame();  // Direct call creates coupling
  }
}
```

**After** (no cycle):
```typescript
// events.ts (shared event definitions)
export type GameEvent =
  | { type: 'scorecard:completed'; payload: { finalScore: number } }
  | { type: 'game:ended'; payload: { result: GameResult } };

export const gameEvents = new EventTarget();

// scorecard.svelte.ts (no game import)
import { gameEvents } from './events';

class ScorecardState {
  complete() {
    gameEvents.dispatchEvent(
      new CustomEvent('scorecard:completed', {
        detail: { finalScore: this.grandTotal }
      })
    );
  }
}

// game.svelte.ts (no scorecard import needed for this)
import { gameEvents } from './events';

gameEvents.addEventListener('scorecard:completed', (e) => {
  const { finalScore } = (e as CustomEvent).detail;
  this.endGame(finalScore);
});
```

### 6.4 Anti-Pattern: Dynamic Import (DO NOT USE)

```typescript
// ❌ BAD: Masks the problem but doesn't fix it
async function getRoom() {
  const { room } = await import('./room.svelte');
  return room;
}

// This creates:
// 1. Race conditions
// 2. Undefined state during import
// 3. Harder to debug issues
// 4. Type safety loss
```

---

## Part 7: Test Fixtures

### 7.1 Valid Architecture (No Cycle)

```typescript
// tests/tools/akg/invariants/fixtures/store-deps-valid.ts

export const validStoreGraph: AKGGraph = {
  version: '1.0.0',
  generatedAt: new Date().toISOString(),
  projectRoot: '/test',
  nodes: [
    {
      id: 'store::game',
      type: 'Store',
      name: 'game.svelte.ts',
      filePath: 'src/lib/stores/game.svelte.ts',
      attributes: { layer: 'stores' },
      metadata: { discoveredAt: new Date().toISOString(), confidence: 'high' }
    },
    {
      id: 'store::dice',
      type: 'Store',
      name: 'dice.svelte.ts',
      filePath: 'src/lib/stores/dice.svelte.ts',
      attributes: { layer: 'stores' },
      metadata: { discoveredAt: new Date().toISOString(), confidence: 'high' }
    },
    {
      id: 'store::scorecard',
      type: 'Store',
      name: 'scorecard.svelte.ts',
      filePath: 'src/lib/stores/scorecard.svelte.ts',
      attributes: { layer: 'stores' },
      metadata: { discoveredAt: new Date().toISOString(), confidence: 'high' }
    }
  ],
  edges: [
    // game imports dice (one-way, no cycle)
    {
      id: 'imports::game::dice',
      type: 'imports',
      sourceNodeId: 'store::game',
      targetNodeId: 'store::dice',
      attributes: {},
      evidence: [],
      metadata: { discoveredAt: new Date().toISOString(), confidence: 'high' }
    },
    // game imports scorecard (one-way, no cycle)
    {
      id: 'imports::game::scorecard',
      type: 'imports',
      sourceNodeId: 'store::game',
      targetNodeId: 'store::scorecard',
      attributes: {},
      evidence: [],
      metadata: { discoveredAt: new Date().toISOString(), confidence: 'high' }
    }
    // dice and scorecard don't import anything else
  ],
  metadata: { totalFiles: 3, discoveryDurationMs: 10 }
};
```

### 7.2 Direct Cycle (2 Nodes)

```typescript
// tests/tools/akg/invariants/fixtures/store-deps-direct-cycle.ts

export const directCycleGraph: AKGGraph = {
  version: '1.0.0',
  generatedAt: new Date().toISOString(),
  projectRoot: '/test',
  nodes: [
    {
      id: 'store::auth',
      type: 'Store',
      name: 'auth.svelte.ts',
      filePath: 'src/lib/stores/auth.svelte.ts',
      attributes: { layer: 'stores' },
      metadata: { discoveredAt: new Date().toISOString(), confidence: 'high' }
    },
    {
      id: 'store::room',
      type: 'Store',
      name: 'room.svelte.ts',
      filePath: 'src/lib/stores/room.svelte.ts',
      attributes: { layer: 'stores' },
      metadata: { discoveredAt: new Date().toISOString(), confidence: 'high' }
    }
  ],
  edges: [
    // auth imports room
    {
      id: 'imports::auth::room',
      type: 'imports',
      sourceNodeId: 'store::auth',
      targetNodeId: 'store::room',
      attributes: {},
      evidence: [{
        filePath: 'src/lib/stores/auth.svelte.ts',
        startLine: 5,
        endLine: 5,
        snippet: "import { room } from './room.svelte';"
      }],
      metadata: { discoveredAt: new Date().toISOString(), confidence: 'high' }
    },
    // room imports auth - CREATES CYCLE
    {
      id: 'imports::room::auth',
      type: 'imports',
      sourceNodeId: 'store::room',
      targetNodeId: 'store::auth',
      attributes: {},
      evidence: [{
        filePath: 'src/lib/stores/room.svelte.ts',
        startLine: 3,
        endLine: 3,
        snippet: "import { auth } from './auth.svelte';"
      }],
      metadata: { discoveredAt: new Date().toISOString(), confidence: 'high' }
    }
  ],
  metadata: { totalFiles: 2, discoveryDurationMs: 10 }
};
```

### 7.3 Transitive Cycle (3 Nodes)

```typescript
// tests/tools/akg/invariants/fixtures/store-deps-transitive-cycle.ts

export const transitiveCycleGraph: AKGGraph = {
  version: '1.0.0',
  generatedAt: new Date().toISOString(),
  projectRoot: '/test',
  nodes: [
    {
      id: 'store::game',
      type: 'Store',
      name: 'game.svelte.ts',
      filePath: 'src/lib/stores/game.svelte.ts',
      attributes: { layer: 'stores' },
      metadata: { discoveredAt: new Date().toISOString(), confidence: 'high' }
    },
    {
      id: 'store::multiplayer',
      type: 'Store',
      name: 'multiplayerGame.svelte.ts',
      filePath: 'src/lib/stores/multiplayerGame.svelte.ts',
      attributes: { layer: 'stores' },
      metadata: { discoveredAt: new Date().toISOString(), confidence: 'high' }
    },
    {
      id: 'store::room',
      type: 'Store',
      name: 'room.svelte.ts',
      filePath: 'src/lib/stores/room.svelte.ts',
      attributes: { layer: 'stores' },
      metadata: { discoveredAt: new Date().toISOString(), confidence: 'high' }
    }
  ],
  edges: [
    {
      id: 'imports::game::multiplayer',
      type: 'imports',
      sourceNodeId: 'store::game',
      targetNodeId: 'store::multiplayer',
      attributes: {},
      evidence: [{
        filePath: 'src/lib/stores/game.svelte.ts',
        startLine: 8,
        endLine: 8,
        snippet: "import { multiplayer } from './multiplayerGame.svelte';"
      }],
      metadata: { discoveredAt: new Date().toISOString(), confidence: 'high' }
    },
    {
      id: 'imports::multiplayer::room',
      type: 'imports',
      sourceNodeId: 'store::multiplayer',
      targetNodeId: 'store::room',
      attributes: {},
      evidence: [{
        filePath: 'src/lib/stores/multiplayerGame.svelte.ts',
        startLine: 12,
        endLine: 12,
        snippet: "import { room } from './room.svelte';"
      }],
      metadata: { discoveredAt: new Date().toISOString(), confidence: 'high' }
    },
    {
      id: 'imports::room::game',
      type: 'imports',
      sourceNodeId: 'store::room',
      targetNodeId: 'store::game',
      attributes: {},
      evidence: [{
        filePath: 'src/lib/stores/room.svelte.ts',
        startLine: 15,
        endLine: 15,
        snippet: "import { game } from './game.svelte';"
      }],
      metadata: { discoveredAt: new Date().toISOString(), confidence: 'high' }
    }
  ],
  metadata: { totalFiles: 3, discoveryDurationMs: 10 }
};
```

### 7.4 Test Implementation

```typescript
// tests/tools/akg/invariants/store-no-circular-deps.test.ts

import { describe, it, expect } from 'vitest';
import { storeNoCircularDeps } from '@/tools/akg/invariants/definitions/store-no-circular-deps';
import { AKGQueryEngine } from '@/tools/akg/query/engine';
import {
  validStoreGraph,
  directCycleGraph,
  transitiveCycleGraph
} from './fixtures/store-deps';

describe('store_no_circular_deps invariant', () => {
  describe('valid architecture', () => {
    it('should pass when stores have no cycles', () => {
      const engine = new AKGQueryEngine(validStoreGraph);
      const violations = storeNoCircularDeps(validStoreGraph, engine);

      expect(violations).toHaveLength(0);
    });

    it('should pass with one-way dependencies (tree structure)', () => {
      // game → dice, game → scorecard is valid (no back-edges)
      const engine = new AKGQueryEngine(validStoreGraph);
      const violations = storeNoCircularDeps(validStoreGraph, engine);

      expect(violations).toHaveLength(0);
    });
  });

  describe('direct cycle detection', () => {
    it('should detect direct mutual imports (A → B → A)', () => {
      const engine = new AKGQueryEngine(directCycleGraph);
      const violations = storeNoCircularDeps(directCycleGraph, engine);

      expect(violations).toHaveLength(1);
      expect(violations[0]).toMatchObject({
        invariantId: 'store_no_circular_deps',
        severity: 'error',
        message: expect.stringContaining('auth')
      });
      expect(violations[0].message).toContain('room');
    });

    it('should have error severity (blocking)', () => {
      const engine = new AKGQueryEngine(directCycleGraph);
      const violations = storeNoCircularDeps(directCycleGraph, engine);

      expect(violations[0].severity).toBe('error');
    });

    it('should provide evidence for both edges in cycle', () => {
      const engine = new AKGQueryEngine(directCycleGraph);
      const violations = storeNoCircularDeps(directCycleGraph, engine);

      expect(violations[0].evidence.length).toBeGreaterThanOrEqual(2);
      expect(violations[0].evidence.some(e =>
        e.filePath.includes('auth')
      )).toBe(true);
      expect(violations[0].evidence.some(e =>
        e.filePath.includes('room')
      )).toBe(true);
    });
  });

  describe('transitive cycle detection', () => {
    it('should detect transitive cycles (A → B → C → A)', () => {
      const engine = new AKGQueryEngine(transitiveCycleGraph);
      const violations = storeNoCircularDeps(transitiveCycleGraph, engine);

      expect(violations).toHaveLength(1);
    });

    it('should include all stores in cycle path', () => {
      const engine = new AKGQueryEngine(transitiveCycleGraph);
      const violations = storeNoCircularDeps(transitiveCycleGraph, engine);

      const message = violations[0].message;
      expect(message).toContain('game');
      expect(message).toContain('multiplayer');
      expect(message).toContain('room');
    });

    it('should provide evidence for all three edges', () => {
      const engine = new AKGQueryEngine(transitiveCycleGraph);
      const violations = storeNoCircularDeps(transitiveCycleGraph, engine);

      expect(violations[0].evidence.length).toBe(3);
    });
  });

  describe('edge cases', () => {
    it('should not flag self-imports as cycles', () => {
      // A file importing itself is a different error
      const selfImportGraph = {
        ...validStoreGraph,
        edges: [{
          id: 'imports::game::game',
          type: 'imports',
          sourceNodeId: 'store::game',
          targetNodeId: 'store::game',
          attributes: {},
          evidence: [],
          metadata: { discoveredAt: new Date().toISOString(), confidence: 'high' }
        }]
      };

      const engine = new AKGQueryEngine(selfImportGraph);
      const violations = storeNoCircularDeps(selfImportGraph, engine);

      // Self-import creates SCC of size 1, which we don't report
      // (it's still an error, but a different invariant should catch it)
      expect(violations).toHaveLength(0);
    });

    it('should handle stores with no imports', () => {
      const isolatedStoreGraph = {
        ...validStoreGraph,
        edges: []  // No imports at all
      };

      const engine = new AKGQueryEngine(isolatedStoreGraph);
      const violations = storeNoCircularDeps(isolatedStoreGraph, engine);

      expect(violations).toHaveLength(0);
    });

    it('should only consider store nodes (not services)', () => {
      // If store imports service and service imports store,
      // that's a different pattern (not store-to-store cycle)
      const storeServiceGraph = {
        ...validStoreGraph,
        nodes: [
          ...validStoreGraph.nodes,
          {
            id: 'service::engine',
            type: 'Service',
            name: 'engine.ts',
            filePath: 'src/lib/services/engine.ts',
            attributes: { layer: 'services' },
            metadata: { discoveredAt: new Date().toISOString(), confidence: 'high' }
          }
        ],
        edges: [
          {
            id: 'imports::game::engine',
            type: 'imports',
            sourceNodeId: 'store::game',
            targetNodeId: 'service::engine',
            attributes: {},
            evidence: [],
            metadata: { discoveredAt: new Date().toISOString(), confidence: 'high' }
          }
        ]
      };

      const engine = new AKGQueryEngine(storeServiceGraph);
      const violations = storeNoCircularDeps(storeServiceGraph, engine);

      expect(violations).toHaveLength(0);
    });
  });
});
```

---

## Part 8: Agent Integration

### 8.1 Three Strikes Rule Integration

When an agent encounters a circular dependency error:

```markdown
## Agent Protocol: Circular Dependency

**Strike 1**: Attempt Pattern A (Extract Shared State)
- Analyze what data is shared between stores
- Create a minimal shared context store
- Refactor both stores to use the shared store

**Strike 2**: Attempt Pattern B (Dependency Injection)
- Convert the less-used import to a setter
- Wire up in a component that has access to both

**Strike 3**: STOP and ask human
- Document the cycle and attempted fixes
- Present options for human decision:
  1. Merge the stores
  2. Redesign the architecture
  3. Accept temporary workaround

**NEVER attempt Pattern D (dynamic import) - this masks the problem**
```

### 8.2 MCP Tool Response

```typescript
// mcp__project-akg__check_invariants({ severity: "error" })
{
  "summary": {
    "total": 1,
    "passed": 0,
    "failed": 1,
    "blocking": true
  },
  "violations": [{
    "invariant": "store_no_circular_deps",
    "severity": "error",
    "cycle": ["auth", "room"],
    "length": 2,
    "recommendation": "Extract shared state to connectionContext.svelte.ts",
    "autoFixAvailable": false,
    "requiresHumanReview": true
  }]
}
```

### 8.3 Agent Decision Protocol

```markdown
## Before Adding Store Import

1. Check if target is a store (ends with .svelte.ts in stores/)
2. If yes, run: mcp__project-akg__check_would_create_cycle
3. If cycle would be created:
   - DO NOT add the import
   - Present alternatives to human
   - Use Pattern A/B/C instead

## Detecting Cycles Before Commit

1. Run akg:check before `git add`
2. If store_no_circular_deps fails → HALT
3. Apply Three Strikes Rule
4. Only commit when cycle is resolved
```

---

## Part 9: Real-World Risk Assessment

### 9.1 Current Dicee Risk Analysis

| Store Pair | Risk Level | Reason |
|------------|------------|--------|
| auth ↔ room | 🟡 MEDIUM | Both need user identity; could tempt mutual import |
| game ↔ multiplayer | 🟡 MEDIUM | State sync between single/multiplayer |
| room ↔ multiplayer | 🟢 LOW | Both use roomService, unlikely to need each other |
| auth ↔ game | 🟢 LOW | Minimal overlap |
| dice ↔ scorecard | 🟢 LOW | No logical coupling |

### 9.2 Proactive Measures

1. **Document store hierarchy in CONVENTIONS.md**
2. **Add runtime detection for development**:
   ```typescript
   // stores/index.ts (dev only)
   if (import.meta.env.DEV) {
     // Check for undefined exports indicating partial initialization
     for (const [name, store] of Object.entries(stores)) {
       if (store === undefined) {
         console.error(`Store '${name}' is undefined - possible circular dependency`);
       }
     }
   }
   ```

3. **Pre-commit hook** (future):
   ```bash
   pnpm akg:check --fast --invariant=store_no_circular_deps
   ```

---

## Part 10: Metrics & Effectiveness

### 10.1 Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Cycles prevented | ≥ 1 per quarter | Blocked PRs |
| False positive rate | 0% | Cycles are deterministic |
| Detection time | < 100ms | Performance test |
| Fix rate | 100% | All cycles must be fixed |

### 10.2 This Invariant Is Special

Unlike `layer_component_isolation` (warning), this invariant:
- Has **zero tolerance** - all cycles are errors
- Has **zero exemptions** - no annotation can override
- Has **zero workarounds** - dynamic import is forbidden
- Requires **immediate action** - cannot be deferred

---

## Appendix A: Algorithm Complexity

| Algorithm | Time | Space | Notes |
|-----------|------|-------|-------|
| Tarjan SCC | O(V + E) | O(V) | Optimal for cycle detection |
| DFS-based | O(V + E) | O(V) | Simpler, also works |
| Floyd-Warshall | O(V³) | O(V²) | Overkill for this use case |

For Dicee's ~10 stores, any algorithm is instant.

---

## Appendix B: Related Invariants

| Invariant | Relationship |
|-----------|--------------|
| `layer_component_isolation` | Components importing stores indirectly |
| `service_layer_boundaries` | Services shouldn't import stores |
| `no_index_barrel_cycles` | Index re-export cycles |

---

**Simulation Status**: Ready for implementation in Week 3.

**Next Steps**:
1. ✅ Design complete
2. ⏳ Implement Tarjan's algorithm (Week 3)
3. ⏳ Add test fixtures (Week 3)
4. ⏳ Add dev-mode runtime detection
5. ⏳ Enable in CI (blocking)
