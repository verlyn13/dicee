# Simulation 004: Service Imports Component

> **Status**: Design Complete
> **Created**: 2025-12-05
> **Invariant**: `service_layer_boundaries`
> **Severity**: `error` (BLOCKING)
> **Category**: Structural / Architectural

---

## Executive Summary

This simulation validates the `service_layer_boundaries` invariant, which enforces that **services must not import from components, stores, or routes**. Services are business logic that should be UI-agnostic.

**Current Status**: ✅ Clean. Services only import types, external libraries, and other services.

**Why This Matters**:
1. **Testability**: Services should be unit-testable without UI framework mocks
2. **Reusability**: Services can be used in CLI, workers, or other contexts
3. **Layered Architecture**: Maintains clear dependency direction
4. **Separation of Concerns**: Business logic separate from presentation

---

## Part 1: Technical Background

### 1.1 Layered Architecture Principle

```
┌─────────────────────────────────────────────────────────────────────┐
│                          LAYER HIERARCHY                           │
│                                                                     │
│  Dependencies flow DOWNWARD only (no upward imports)               │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │                        ROUTES                                 │ │
│  │   /play, /profile, /lobby - SvelteKit pages                   │ │
│  │   May import: components, stores, services, types             │ │
│  └───────────────────────────────┬───────────────────────────────┘ │
│                                  │                                  │
│                                  ▼                                  │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │                      COMPONENTS                               │ │
│  │   UI elements - DiceTray, Scorecard, Modal                    │ │
│  │   May import: components, stores*, services*, types, utils    │ │
│  │   * Smart containers only                                     │ │
│  └───────────────────────────────┬───────────────────────────────┘ │
│                                  │                                  │
│                                  ▼                                  │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │                        STORES                                 │ │
│  │   State management - game, auth, room                         │ │
│  │   May import: services, types, supabase                       │ │
│  └───────────────────────────────┬───────────────────────────────┘ │
│                                  │                                  │
│                                  ▼                                  │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │                       SERVICES                                │ │
│  │   Business logic - engine, roomService                        │ │
│  │   May import: types, supabase, external libs                  │ │
│  │   ❌ Must NOT import: components, stores, routes              │ │
│  └───────────────────────────────┬───────────────────────────────┘ │
│                                  │                                  │
│                                  ▼                                  │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │                    TYPES / SUPABASE / UTILS                   │ │
│  │   Pure definitions, no runtime dependencies                   │ │
│  │   May import: only other types                                │ │
│  └───────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

### 1.2 Why Services Must Be UI-Agnostic

**Problem: Service imports Component**
```typescript
// ❌ BAD: services/notificationService.ts
import Toast from '$lib/components/ui/Toast.svelte';

class NotificationService {
  showError(message: string) {
    // How do you even render a Svelte component from here?
    // This doesn't work - services don't have access to DOM
    new Toast({ target: document.body, props: { message } });
  }
}
```

**Problems**:
1. Services run in any context (server, worker, test) - no DOM available
2. Creates tight coupling between business logic and UI framework
3. Makes service impossible to unit test without Svelte runtime
4. Violates Single Responsibility - service doing UI work

**Correct Pattern: Events/Callbacks**
```typescript
// ✅ GOOD: services/notificationService.ts
type NotificationHandler = (notification: Notification) => void;

class NotificationService {
  private handlers: Set<NotificationHandler> = new Set();

  subscribe(handler: NotificationHandler) {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  notify(notification: Notification) {
    for (const handler of this.handlers) {
      handler(notification);
    }
  }
}

// In component (UI layer handles rendering):
import { notificationService } from '$lib/services';
import Toast from './Toast.svelte';

$effect(() => {
  return notificationService.subscribe((n) => {
    // Component decides how to render
    showToast(n.message);
  });
});
```

### 1.3 Current Dicee Services Architecture

```
services/
├── engine.ts              # WASM integration (imports $lib/engine, types)
├── roomService.svelte.ts  # PartyKit WebSocket (imports partysocket, types)
└── index.ts               # Re-exports

Current import patterns (all valid):
- engine.ts → $lib/types, $lib/engine
- roomService.svelte.ts → partysocket, $env/dynamic/public, $lib/types/multiplayer
```

**Note**: `roomService.svelte.ts` uses `.svelte.ts` extension because it uses `$state` internally for reactive patterns, but it's still a service (no UI imports).

---

## Part 2: Violation Scenarios

### 2.1 Scenario A: Service Imports Component for UI Feedback

**How it happens**: Developer wants service to show toast notifications.

```typescript
// packages/web/src/lib/services/roomService.svelte.ts
import Toast from '$lib/components/ui/Toast.svelte'; // ❌ VIOLATION

class RoomService {
  async connect(roomCode: string) {
    try {
      // ... connection logic
    } catch (error) {
      // Developer thinks: "Let me show a toast here"
      Toast.show('Connection failed!'); // Won't work, and violates architecture
    }
  }
}
```

**Why This Happens**:
- Developer is used to monolithic architectures
- Thinks "service should handle everything end-to-end"
- Doesn't understand layer boundaries

### 2.2 Scenario B: Service Imports Store for State Access

**How it happens**: Service needs to check current state.

```typescript
// packages/web/src/lib/services/engine.ts
import { game } from '$lib/stores/game.svelte'; // ❌ VIOLATION

export async function analyzeTurnOptimal(dice, rolls, categories) {
  // Developer thinks: "Let me get the current scorecard from store"
  const scorecard = game.scorecard.scores;

  // ... analysis logic using scorecard
}
```

**Why This Is Wrong**:
1. Creates circular dependency risk (stores often import services)
2. Service becomes impossible to test in isolation
3. Service tied to specific store implementation
4. Should receive data as parameters instead

### 2.3 Scenario C: Service Imports Route for Navigation

**How it happens**: Service wants to redirect user after action.

```typescript
// packages/web/src/lib/services/authService.ts
import { goto } from '$app/navigation'; // ⚠️ Edge case - SvelteKit module
import LoginPage from '$routes/login/+page.svelte'; // ❌ VIOLATION

class AuthService {
  async signOut() {
    await this.supabase.auth.signOut();
    goto('/login'); // This is a SvelteKit helper, different discussion
  }
}
```

**Note**: `$app/navigation` is a SvelteKit utility, not a route import. This simulation focuses on importing actual route components.

### 2.4 Scenario D: Service Imports Component Type

**How it happens**: Service defines type that references component props.

```typescript
// packages/web/src/lib/services/modalService.ts
import type { ModalProps } from '$lib/components/ui/Modal.svelte'; // ❌ VIOLATION

interface ModalConfig extends ModalProps {
  onConfirm: () => void;
}

class ModalService {
  queue: ModalConfig[] = [];
}
```

**Why This Is Wrong**:
- Even type-only imports create coupling
- Service shouldn't know about component prop shapes
- Define service's own types, let components adapt

---

## Part 3: Graph Representation

### 3.1 Violation Graph Structure

```json
{
  "nodes": [
    {
      "id": "service::roomService",
      "type": "Service",
      "name": "roomService.svelte.ts",
      "filePath": "packages/web/src/lib/services/roomService.svelte.ts",
      "attributes": {
        "layer": "services",
        "hasReactiveState": true
      }
    },
    {
      "id": "component::Toast",
      "type": "Component",
      "name": "Toast.svelte",
      "filePath": "packages/web/src/lib/components/ui/Toast.svelte",
      "attributes": {
        "layer": "components"
      }
    },
    {
      "id": "store::game",
      "type": "Store",
      "name": "game.svelte.ts",
      "filePath": "packages/web/src/lib/stores/game.svelte.ts",
      "attributes": {
        "layer": "stores"
      }
    },
    {
      "id": "layer::services",
      "type": "Layer",
      "name": "services"
    },
    {
      "id": "layer::components",
      "type": "Layer",
      "name": "components"
    },
    {
      "id": "layer::stores",
      "type": "Layer",
      "name": "stores"
    }
  ],
  "edges": [
    {
      "id": "imports::roomService::Toast",
      "type": "imports",
      "sourceNodeId": "service::roomService",
      "targetNodeId": "component::Toast",
      "attributes": {
        "importType": "default",
        "isLayerViolation": true
      },
      "evidence": [{
        "filePath": "packages/web/src/lib/services/roomService.svelte.ts",
        "startLine": 8,
        "endLine": 8,
        "snippet": "import Toast from '$lib/components/ui/Toast.svelte';"
      }]
    }
  ]
}
```

### 3.2 Layer Violation Detection Logic

```typescript
// Forbidden import directions for services
const SERVICE_FORBIDDEN_TARGETS = [
  'components',  // UI elements
  'stores',      // State management (bidirectional would create cycles)
  'routes',      // Page components
];

// What services CAN import
const SERVICE_ALLOWED_TARGETS = [
  'types',       // Type definitions
  'services',    // Other services
  'supabase',    // Database client
  'utils',       // Pure utilities
  'wasm',        // Via bridge only (see wasm_single_entry)
  'external',    // node_modules
];
```

---

## Part 4: Invariant Definition

### 4.1 Invariant Specification

```yaml
id: "service_layer_boundaries"
name: "Service: Layer Boundaries"
description: |
  Services in the services/ directory must not import from components/,
  stores/, or routes/. Services contain business logic that should be
  UI-agnostic and testable in isolation.

type: "structural"
severity: "error"  # BLOCKING

rule:
  scope:
    source_pattern: "**/services/**"
    source_description: "Service layer modules"

  forbidden_imports:
    - pattern: "**/components/**"
      reason: "Services must not depend on UI components"
    - pattern: "**/stores/**"
      reason: "Services must not depend on state management (creates cycles)"
    - pattern: "**/routes/**"
      reason: "Services must not depend on route components"
    - pattern: "*.svelte"
      reason: "Services must not import Svelte components"

  allowed_imports:
    - pattern: "**/types/**"
    - pattern: "**/services/**"
    - pattern: "**/supabase/**"
    - pattern: "**/utils/**"
    - pattern: "$lib/engine*"
    - pattern: "$env/**"
    - pattern: "node_modules/**"

  exempt_when:
    - source_pattern: "*.test.ts"
      reason: "Tests may import anything for mocking"
    - source_pattern: "**/__mocks__/**"
      reason: "Mock implementations"

adr_reference: null
rationale: |
  Layered architecture with unidirectional dependencies enables:
  - Unit testing without UI framework
  - Reuse in non-browser contexts
  - Clear separation of concerns
  See Simulation 004 for detailed analysis.
```

### 4.2 Implementation

```typescript
// src/tools/akg/invariants/definitions/service-layer-boundaries.ts

import type { InvariantCheckFn } from '../checker';
import type { InvariantViolation } from '../../schema/invariant.schema';
import type { AKGNode, AKGEdge } from '../../schema/graph.schema';

/**
 * Patterns that identify service files
 */
const SERVICE_PATTERNS = [
  /\/services\//,
  /\.service\.ts$/,
  /Service\.ts$/,
];

/**
 * Forbidden import targets for services
 */
const FORBIDDEN_LAYER_PATTERNS = [
  { pattern: /\/components\//, layer: 'components', reason: 'UI components' },
  { pattern: /\/stores\//, layer: 'stores', reason: 'state management' },
  { pattern: /\/routes\//, layer: 'routes', reason: 'route components' },
  { pattern: /\.svelte$/, layer: 'components', reason: 'Svelte component' },
];

/**
 * Exempt source patterns
 */
const EXEMPT_PATTERNS = [
  /\.test\.ts$/,
  /\.spec\.ts$/,
  /__tests__\//,
  /__mocks__\//,
];

function isServiceFile(filePath: string): boolean {
  return SERVICE_PATTERNS.some(p => p.test(filePath));
}

function isExempt(filePath: string): boolean {
  return EXEMPT_PATTERNS.some(p => p.test(filePath));
}

function getForbiddenLayer(targetPath: string): { layer: string; reason: string } | null {
  for (const { pattern, layer, reason } of FORBIDDEN_LAYER_PATTERNS) {
    if (pattern.test(targetPath)) {
      return { layer, reason };
    }
  }
  return null;
}

export const serviceLayerBoundaries: InvariantCheckFn = (graph, engine) => {
  const violations: InvariantViolation[] = [];

  // Find all service nodes
  const serviceNodes = graph.nodes.filter(n =>
    n.type === 'Service' ||
    n.attributes.layer === 'services' ||
    isServiceFile(n.filePath ?? '')
  );

  for (const service of serviceNodes) {
    // Skip test files
    if (isExempt(service.filePath ?? '')) continue;

    // Get all import edges from this service
    const imports = engine.getOutgoingEdges(service.id, 'imports');

    for (const edge of imports) {
      const targetNode = engine.getNode(edge.targetNodeId);
      if (!targetNode) continue;

      const targetPath = targetNode.filePath ?? targetNode.name;
      const forbidden = getForbiddenLayer(targetPath);

      if (forbidden) {
        violations.push({
          invariantId: 'service_layer_boundaries',
          invariantName: 'Service: Layer Boundaries',
          severity: 'error',

          message: `Service imports ${forbidden.reason} (${forbidden.layer} layer)`,

          suggestion: buildSuggestion(service, targetNode, forbidden),

          sourceNode: service.name,
          targetNode: targetNode.name,

          evidence: edge.evidence.map(e => ({
            filePath: e.filePath,
            line: e.startLine,
            snippet: e.snippet,
          })),

          businessRule: `Services must not import from ${forbidden.layer}/`,
        });
      }
    }
  }

  return violations;
};

function buildSuggestion(
  service: AKGNode,
  target: AKGNode,
  forbidden: { layer: string; reason: string }
): string {
  const serviceName = service.name.replace(/\.svelte\.ts$|\.ts$/, '');
  const targetName = target.name.replace(/\.svelte$|\.ts$/, '');

  if (forbidden.layer === 'components') {
    return `🚫 BLOCKING: Services cannot import UI components.

Services are business logic that must work without a UI framework.

❌ Current:
   ${serviceName} → ${targetName} (component)

✅ Pattern 1: Event-based communication
   // In service:
   type NotifyFn = (msg: string) => void;
   private notifyHandlers = new Set<NotifyFn>();

   subscribe(handler: NotifyFn) {
     this.notifyHandlers.add(handler);
     return () => this.notifyHandlers.delete(handler);
   }

   notify(msg: string) {
     for (const h of this.notifyHandlers) h(msg);
   }

   // In component:
   $effect(() => service.subscribe(msg => showToast(msg)));

✅ Pattern 2: Return result, let caller handle UI
   // In service:
   async connect(): Promise<{ success: boolean; error?: string }>

   // In component:
   const result = await service.connect();
   if (!result.success) showToast(result.error);`;
  }

  if (forbidden.layer === 'stores') {
    return `🚫 BLOCKING: Services cannot import stores.

This creates circular dependency risk and tight coupling.

❌ Current:
   ${serviceName} → ${targetName} (store)

✅ Pattern: Receive data as parameters
   // Instead of:
   import { game } from '$lib/stores/game.svelte';
   function analyze() {
     const dice = game.dice.values;
   }

   // Do:
   function analyze(dice: DiceArray) {
     // Use parameter directly
   }

   // Caller (in store or component) provides data:
   service.analyze(game.dice.values);

This makes the service pure and testable.`;
  }

  if (forbidden.layer === 'routes') {
    return `🚫 BLOCKING: Services cannot import route components.

Routes are page-level UI - services should be navigation-agnostic.

❌ Current:
   ${serviceName} → ${targetName} (route)

✅ Pattern: Use callbacks for navigation
   // In service:
   interface ServiceConfig {
     onSuccess?: () => void;
     onError?: (error: Error) => void;
   }

   // In route:
   service.doAction({
     onSuccess: () => goto('/success'),
     onError: (e) => goto('/error')
   });`;
  }

  return `🚫 BLOCKING: Services cannot import from ${forbidden.layer} layer.

Refactor to remove this dependency.`;
}
```

### 4.3 Layer Detection Helper

```typescript
// src/tools/akg/discovery/analyzers/layer-analyzer.ts

/**
 * Determine which architectural layer a file belongs to
 */
export function detectLayer(filePath: string): string {
  const patterns: [RegExp, string][] = [
    [/\/routes\//, 'routes'],
    [/\/components\//, 'components'],
    [/\/stores\//, 'stores'],
    [/\/services\//, 'services'],
    [/\/types\//, 'types'],
    [/\/supabase\//, 'supabase'],
    [/\/utils\//, 'utils'],
    [/\/wasm\//, 'wasm'],
    [/\/lib\/engine\.ts$/, 'wasm-bridge'],
  ];

  for (const [pattern, layer] of patterns) {
    if (pattern.test(filePath)) {
      return layer;
    }
  }

  // Default based on extension
  if (filePath.endsWith('.svelte')) {
    return 'components';  // Assume component if .svelte outside known dirs
  }

  return 'unknown';
}

/**
 * Check if an import from sourceLayer to targetLayer is valid
 */
export function isValidLayerImport(sourceLayer: string, targetLayer: string): boolean {
  const LAYER_RULES: Record<string, string[]> = {
    'routes': ['components', 'stores', 'services', 'types', 'utils', 'supabase'],
    'components': ['components', 'types', 'utils'],  // Smart containers can also import stores/services
    'stores': ['services', 'types', 'supabase', 'wasm-bridge'],
    'services': ['services', 'types', 'supabase', 'utils', 'wasm-bridge', 'external'],
    'types': ['types'],
    'supabase': ['types'],
    'utils': ['types', 'utils'],
    'wasm-bridge': ['wasm', 'types'],
    'wasm': [],  // WASM modules shouldn't import anything from our code
  };

  const allowed = LAYER_RULES[sourceLayer];
  if (!allowed) return true;  // Unknown layer - don't restrict

  return allowed.includes(targetLayer);
}
```

---

## Part 5: Expected Detection Output

### 5.1 CLI Output (Component Import)

```
pnpm akg:check

🔒 Checking invariants...

❌ service_layer_boundaries (1 violation)

   ┌──────────────────────────────────────────────────────────────┐
   │  SERVICE LAYER VIOLATION                                     │
   │                                                              │
   │    roomService.svelte.ts → Toast.svelte                     │
   │                                                              │
   │    services/ cannot import from components/                  │
   └──────────────────────────────────────────────────────────────┘

   File: packages/web/src/lib/services/roomService.svelte.ts:8
   │ import Toast from '$lib/components/ui/Toast.svelte';

   🚫 BLOCKING: Services cannot import UI components.

   Services are business logic that must work without a UI framework.

   ✅ Pattern 1: Event-based communication
      // In service:
      type NotifyFn = (msg: string) => void;
      subscribe(handler: NotifyFn) { ... }

      // In component:
      $effect(() => service.subscribe(msg => showToast(msg)));

   ✅ Pattern 2: Return result, let caller handle UI
      async connect(): Promise<{ success: boolean; error?: string }>

📊 Summary:
   Total: 8 invariants checked
   Passed: 7
   Failed: 1
   Errors: 1

🚫 BLOCKING VIOLATIONS FOUND. Must fix before merge.
```

### 5.2 CLI Output (Store Import)

```
❌ service_layer_boundaries (1 violation)

   ┌──────────────────────────────────────────────────────────────┐
   │  SERVICE LAYER VIOLATION                                     │
   │                                                              │
   │    engine.ts → game.svelte.ts                               │
   │                                                              │
   │    services/ cannot import from stores/                      │
   └──────────────────────────────────────────────────────────────┘

   File: packages/web/src/lib/services/engine.ts:5
   │ import { game } from '$lib/stores/game.svelte';

   🚫 BLOCKING: Services cannot import stores.

   This creates circular dependency risk and tight coupling.

   ✅ Pattern: Receive data as parameters
      // Instead of:
      import { game } from '$lib/stores/game.svelte';
      function analyze() { const dice = game.dice.values; }

      // Do:
      function analyze(dice: DiceArray) { ... }
```

### 5.3 JSON Output (for CI/MCP)

```json
{
  "invariantId": "service_layer_boundaries",
  "passed": false,
  "violations": [
    {
      "invariantId": "service_layer_boundaries",
      "invariantName": "Service: Layer Boundaries",
      "severity": "error",
      "message": "Service imports UI components (components layer)",
      "sourceNode": "roomService.svelte.ts",
      "targetNode": "Toast.svelte",
      "evidence": [
        {
          "filePath": "packages/web/src/lib/services/roomService.svelte.ts",
          "line": 8,
          "snippet": "import Toast from '$lib/components/ui/Toast.svelte';"
        }
      ],
      "businessRule": "Services must not import from components/",
      "suggestion": "..."
    }
  ],
  "durationMs": 15,
  "checkedAt": "2025-12-05T15:00:00.000Z"
}
```

---

## Part 6: Resolution Patterns

### 6.1 Pattern A: Event-Based Notification System

**Before** (violation):
```typescript
// services/connectionService.ts
import Toast from '$lib/components/ui/Toast.svelte'; // ❌

class ConnectionService {
  async connect() {
    try {
      await this.socket.connect();
    } catch (error) {
      Toast.show('Connection failed!'); // Won't work
    }
  }
}
```

**After** (event-based):
```typescript
// services/connectionService.ts
export type ConnectionEvent =
  | { type: 'connected' }
  | { type: 'disconnected' }
  | { type: 'error'; message: string };

type ConnectionEventHandler = (event: ConnectionEvent) => void;

class ConnectionService {
  private handlers = new Set<ConnectionEventHandler>();

  subscribe(handler: ConnectionEventHandler) {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  private emit(event: ConnectionEvent) {
    for (const handler of this.handlers) {
      handler(event);
    }
  }

  async connect() {
    try {
      await this.socket.connect();
      this.emit({ type: 'connected' });
    } catch (error) {
      this.emit({ type: 'error', message: error.message });
    }
  }
}
```

```svelte
<!-- components/ConnectionStatus.svelte -->
<script lang="ts">
  import { connectionService } from '$lib/services';
  import Toast from './Toast.svelte';

  let showToast = $state(false);
  let toastMessage = $state('');

  $effect(() => {
    return connectionService.subscribe((event) => {
      if (event.type === 'error') {
        toastMessage = event.message;
        showToast = true;
      }
    });
  });
</script>

{#if showToast}
  <Toast message={toastMessage} onClose={() => showToast = false} />
{/if}
```

### 6.2 Pattern B: Result Objects

**Before** (violation):
```typescript
// services/authService.ts
import { auth } from '$lib/stores/auth.svelte'; // ❌

class AuthService {
  async signIn(email: string) {
    const result = await this.supabase.auth.signIn({ email });
    if (result.error) {
      auth.setError(result.error.message); // Coupling to store
    }
  }
}
```

**After** (result pattern):
```typescript
// services/authService.ts
export interface AuthResult {
  success: boolean;
  error?: string;
  data?: { user: User };
}

class AuthService {
  async signIn(email: string): Promise<AuthResult> {
    const { data, error } = await this.supabase.auth.signIn({ email });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: { user: data.user } };
  }
}
```

```typescript
// stores/auth.svelte.ts
import { authService } from '$lib/services';

class AuthStore {
  async signIn(email: string) {
    this.loading = true;
    const result = await authService.signIn(email);

    if (result.success) {
      this.user = result.data.user;
    } else {
      this.error = result.error;
    }

    this.loading = false;
  }
}
```

### 6.3 Pattern C: Dependency Injection

**Before** (violation):
```typescript
// services/analyticsService.ts
import { game } from '$lib/stores/game.svelte'; // ❌

class AnalyticsService {
  trackGameEnd() {
    const score = game.scorecard.grandTotal;
    this.track('game_end', { score });
  }
}
```

**After** (dependency injection):
```typescript
// services/analyticsService.ts
interface GameData {
  score: number;
  turnsPlayed: number;
}

class AnalyticsService {
  trackGameEnd(data: GameData) {
    this.track('game_end', data);
  }
}
```

```typescript
// stores/game.svelte.ts
import { analyticsService } from '$lib/services';

class GameStore {
  endGame() {
    // ... game end logic

    analyticsService.trackGameEnd({
      score: this.scorecard.grandTotal,
      turnsPlayed: this.turnNumber,
    });
  }
}
```

### 6.4 Pattern D: Toast Store (Recommended for Dicee)

For notification systems specifically, create a dedicated store:

```typescript
// stores/toasts.svelte.ts
export interface Toast {
  id: string;
  message: string;
  type: 'info' | 'success' | 'error';
  duration?: number;
}

class ToastStore {
  #toasts = $state<Toast[]>([]);

  get toasts() { return this.#toasts; }

  add(toast: Omit<Toast, 'id'>) {
    const id = crypto.randomUUID();
    this.#toasts.push({ ...toast, id });

    if (toast.duration !== 0) {
      setTimeout(() => this.remove(id), toast.duration ?? 5000);
    }
  }

  remove(id: string) {
    this.#toasts = this.#toasts.filter(t => t.id !== id);
  }
}

export const toasts = new ToastStore();
```

```typescript
// services/roomService.svelte.ts
// Service emits events, doesn't know about toasts
emit({ type: 'error', message: 'Connection failed' });

// stores/room.svelte.ts
import { toasts } from './toasts.svelte';

// Store subscribes to service and shows toasts
roomService.subscribe((event) => {
  if (event.type === 'error') {
    toasts.add({ message: event.message, type: 'error' });
  }
});
```

---

## Part 7: Test Fixtures

### 7.1 Valid Architecture

```typescript
// tests/tools/akg/invariants/fixtures/service-boundaries-valid.ts

export const validServiceGraph: AKGGraph = {
  version: '1.0.0',
  generatedAt: new Date().toISOString(),
  projectRoot: '/test',
  nodes: [
    {
      id: 'service::engine',
      type: 'Service',
      name: 'engine.ts',
      filePath: 'packages/web/src/lib/services/engine.ts',
      attributes: { layer: 'services' },
      metadata: { discoveredAt: new Date().toISOString(), confidence: 'high' }
    },
    {
      id: 'types::types',
      type: 'Module',
      name: 'types.ts',
      filePath: 'packages/web/src/lib/types.ts',
      attributes: { layer: 'types' },
      metadata: { discoveredAt: new Date().toISOString(), confidence: 'high' }
    },
    {
      id: 'bridge::engine',
      type: 'WASMBridge',
      name: 'engine.ts',
      filePath: 'packages/web/src/lib/engine.ts',
      attributes: { layer: 'wasm-bridge' },
      metadata: { discoveredAt: new Date().toISOString(), confidence: 'high' }
    }
  ],
  edges: [
    // Service imports types - OK
    {
      id: 'imports::engine::types',
      type: 'imports',
      sourceNodeId: 'service::engine',
      targetNodeId: 'types::types',
      attributes: {},
      evidence: [],
      metadata: { discoveredAt: new Date().toISOString(), confidence: 'high' }
    },
    // Service imports WASM bridge - OK
    {
      id: 'imports::engine::bridge',
      type: 'imports',
      sourceNodeId: 'service::engine',
      targetNodeId: 'bridge::engine',
      attributes: {},
      evidence: [],
      metadata: { discoveredAt: new Date().toISOString(), confidence: 'high' }
    }
  ],
  metadata: { totalFiles: 3, discoveryDurationMs: 10 }
};
```

### 7.2 Violation: Service Imports Component

```typescript
// tests/tools/akg/invariants/fixtures/service-boundaries-component.ts

export const componentViolationGraph: AKGGraph = {
  version: '1.0.0',
  generatedAt: new Date().toISOString(),
  projectRoot: '/test',
  nodes: [
    {
      id: 'service::roomService',
      type: 'Service',
      name: 'roomService.svelte.ts',
      filePath: 'packages/web/src/lib/services/roomService.svelte.ts',
      attributes: { layer: 'services' },
      metadata: { discoveredAt: new Date().toISOString(), confidence: 'high' }
    },
    {
      id: 'component::Toast',
      type: 'Component',
      name: 'Toast.svelte',
      filePath: 'packages/web/src/lib/components/ui/Toast.svelte',
      attributes: { layer: 'components' },
      metadata: { discoveredAt: new Date().toISOString(), confidence: 'high' }
    }
  ],
  edges: [
    // Service imports component - VIOLATION
    {
      id: 'imports::roomService::Toast',
      type: 'imports',
      sourceNodeId: 'service::roomService',
      targetNodeId: 'component::Toast',
      attributes: { importType: 'default' },
      evidence: [{
        filePath: 'packages/web/src/lib/services/roomService.svelte.ts',
        startLine: 8,
        endLine: 8,
        snippet: "import Toast from '$lib/components/ui/Toast.svelte';"
      }],
      metadata: { discoveredAt: new Date().toISOString(), confidence: 'high' }
    }
  ],
  metadata: { totalFiles: 2, discoveryDurationMs: 10 }
};
```

### 7.3 Violation: Service Imports Store

```typescript
// tests/tools/akg/invariants/fixtures/service-boundaries-store.ts

export const storeViolationGraph: AKGGraph = {
  version: '1.0.0',
  generatedAt: new Date().toISOString(),
  projectRoot: '/test',
  nodes: [
    {
      id: 'service::engine',
      type: 'Service',
      name: 'engine.ts',
      filePath: 'packages/web/src/lib/services/engine.ts',
      attributes: { layer: 'services' },
      metadata: { discoveredAt: new Date().toISOString(), confidence: 'high' }
    },
    {
      id: 'store::game',
      type: 'Store',
      name: 'game.svelte.ts',
      filePath: 'packages/web/src/lib/stores/game.svelte.ts',
      attributes: { layer: 'stores' },
      metadata: { discoveredAt: new Date().toISOString(), confidence: 'high' }
    }
  ],
  edges: [
    // Service imports store - VIOLATION
    {
      id: 'imports::engine::game',
      type: 'imports',
      sourceNodeId: 'service::engine',
      targetNodeId: 'store::game',
      attributes: { namedImports: ['game'] },
      evidence: [{
        filePath: 'packages/web/src/lib/services/engine.ts',
        startLine: 5,
        endLine: 5,
        snippet: "import { game } from '$lib/stores/game.svelte';"
      }],
      metadata: { discoveredAt: new Date().toISOString(), confidence: 'high' }
    }
  ],
  metadata: { totalFiles: 2, discoveryDurationMs: 10 }
};
```

### 7.4 Test Implementation

```typescript
// tests/tools/akg/invariants/service-layer-boundaries.test.ts

import { describe, it, expect } from 'vitest';
import { serviceLayerBoundaries } from '@/tools/akg/invariants/definitions/service-layer-boundaries';
import { AKGQueryEngine } from '@/tools/akg/query/engine';
import {
  validServiceGraph,
  componentViolationGraph,
  storeViolationGraph
} from './fixtures/service-boundaries';

describe('service_layer_boundaries invariant', () => {
  describe('valid architecture', () => {
    it('should pass when service only imports types and other services', () => {
      const engine = new AKGQueryEngine(validServiceGraph);
      const violations = serviceLayerBoundaries(validServiceGraph, engine);

      expect(violations).toHaveLength(0);
    });
  });

  describe('component import violation', () => {
    it('should detect service importing component', () => {
      const engine = new AKGQueryEngine(componentViolationGraph);
      const violations = serviceLayerBoundaries(componentViolationGraph, engine);

      expect(violations).toHaveLength(1);
      expect(violations[0]).toMatchObject({
        invariantId: 'service_layer_boundaries',
        severity: 'error',
        sourceNode: 'roomService.svelte.ts',
        targetNode: 'Toast.svelte'
      });
    });

    it('should identify layer in message', () => {
      const engine = new AKGQueryEngine(componentViolationGraph);
      const violations = serviceLayerBoundaries(componentViolationGraph, engine);

      expect(violations[0].message).toContain('components');
    });

    it('should provide event-based pattern suggestion', () => {
      const engine = new AKGQueryEngine(componentViolationGraph);
      const violations = serviceLayerBoundaries(componentViolationGraph, engine);

      expect(violations[0].suggestion).toContain('Event-based');
      expect(violations[0].suggestion).toContain('subscribe');
    });
  });

  describe('store import violation', () => {
    it('should detect service importing store', () => {
      const engine = new AKGQueryEngine(storeViolationGraph);
      const violations = serviceLayerBoundaries(storeViolationGraph, engine);

      expect(violations).toHaveLength(1);
      expect(violations[0]).toMatchObject({
        invariantId: 'service_layer_boundaries',
        severity: 'error',
        sourceNode: 'engine.ts',
        targetNode: 'game.svelte.ts'
      });
    });

    it('should warn about circular dependency risk', () => {
      const engine = new AKGQueryEngine(storeViolationGraph);
      const violations = serviceLayerBoundaries(storeViolationGraph, engine);

      expect(violations[0].suggestion).toContain('circular');
    });

    it('should suggest parameter pattern', () => {
      const engine = new AKGQueryEngine(storeViolationGraph);
      const violations = serviceLayerBoundaries(storeViolationGraph, engine);

      expect(violations[0].suggestion).toContain('parameter');
    });
  });

  describe('test file exemption', () => {
    it('should not flag test files', () => {
      const testFileGraph = {
        ...componentViolationGraph,
        nodes: [
          {
            ...componentViolationGraph.nodes[0],
            name: 'engine.test.ts',
            filePath: 'packages/web/src/lib/services/engine.test.ts',
          },
          componentViolationGraph.nodes[1]
        ],
        edges: [
          {
            ...componentViolationGraph.edges[0],
            sourceNodeId: 'service::roomService',
            evidence: [{
              filePath: 'packages/web/src/lib/services/engine.test.ts',
              startLine: 5,
              endLine: 5,
              snippet: "import Toast from '$lib/components/ui/Toast.svelte';"
            }]
          }
        ]
      };

      const engine = new AKGQueryEngine(testFileGraph);
      const violations = serviceLayerBoundaries(testFileGraph, engine);

      expect(violations).toHaveLength(0);
    });
  });

  describe('edge cases', () => {
    it('should detect .svelte file imports even without /components/ path', () => {
      const svelteViolation = {
        ...componentViolationGraph,
        nodes: [
          componentViolationGraph.nodes[0],
          {
            ...componentViolationGraph.nodes[1],
            filePath: 'packages/web/src/lib/ui/Toast.svelte', // Not in components/
          }
        ]
      };

      const engine = new AKGQueryEngine(svelteViolation);
      const violations = serviceLayerBoundaries(svelteViolation, engine);

      expect(violations).toHaveLength(1);
    });

    it('should allow service importing another service', () => {
      const serviceToService = {
        ...validServiceGraph,
        nodes: [
          ...validServiceGraph.nodes,
          {
            id: 'service::analytics',
            type: 'Service',
            name: 'analytics.ts',
            filePath: 'packages/web/src/lib/services/analytics.ts',
            attributes: { layer: 'services' },
            metadata: { discoveredAt: new Date().toISOString(), confidence: 'high' }
          }
        ],
        edges: [
          ...validServiceGraph.edges,
          {
            id: 'imports::engine::analytics',
            type: 'imports',
            sourceNodeId: 'service::engine',
            targetNodeId: 'service::analytics',
            attributes: {},
            evidence: [],
            metadata: { discoveredAt: new Date().toISOString(), confidence: 'high' }
          }
        ]
      };

      const engine = new AKGQueryEngine(serviceToService);
      const violations = serviceLayerBoundaries(serviceToService, engine);

      expect(violations).toHaveLength(0);
    });
  });
});
```

---

## Part 8: Agent Integration

### 8.1 Pre-Import Check

```typescript
// mcp__project-akg__check_import
{
  "source": "roomService.svelte.ts",
  "sourceLayer": "services",
  "importSpecifier": "$lib/components/ui/Toast.svelte",
  "targetLayer": "components",
  "result": {
    "allowed": false,
    "invariant": "service_layer_boundaries",
    "reason": "Services cannot import from components layer",
    "alternatives": [
      "Use event-based communication pattern",
      "Use Result objects",
      "Create a toast store"
    ]
  }
}
```

### 8.2 Agent Decision Protocol

```markdown
## Before Adding Import to Service

1. Identify target layer:
   - `/components/` or `.svelte` → components (FORBIDDEN)
   - `/stores/` → stores (FORBIDDEN)
   - `/routes/` → routes (FORBIDDEN)
   - `/types/`, `/services/`, `/supabase/`, `/utils/` → OK

2. If target is FORBIDDEN:
   - DO NOT add the import
   - Apply appropriate pattern:
     - UI feedback → Event-based or Result pattern
     - State access → Parameter injection
     - Navigation → Callback pattern

3. If unsure, ask human:
   "This import would violate service layer boundaries.
    Should I implement [Pattern A] or [Pattern B]?"

## When Creating New Services

1. Services should be pure business logic
2. Never import from UI layers (components, routes)
3. Never import from state layer (stores)
4. Use events/callbacks to communicate outcomes
5. Use parameters to receive data
```

---

## Part 9: Real-World Risk Assessment

### 9.1 Current Dicee Risk Analysis

| Service | Risk | Current Status |
|---------|------|----------------|
| `engine.ts` | 🟢 LOW | Only imports types, $lib/engine |
| `roomService.svelte.ts` | 🟡 MEDIUM | Uses events, but growing complexity |

**Risk Points**:
- As notification requirements grow, temptation to import Toast
- As game state complexity grows, temptation to import stores

### 9.2 Proactive Measures

1. **Create toast store now** (before it becomes a pattern violation)
2. **Document event patterns** in CONVENTIONS.md
3. **Add to new-file templates**: Services start with event infrastructure

---

## Part 10: Metrics & Effectiveness

### 10.1 Expected Metrics

| Metric | Target | Notes |
|--------|--------|-------|
| Violations caught | ≥ 1 per quarter | Preventive |
| False positive rate | 0% | Clear layer definitions |
| Detection time | < 20ms | Simple pattern match |
| Fix complexity | Medium | Requires refactoring |

### 10.2 Why This Invariant Matters for Dicee

1. **Server-Side Rendering**: Services must work in SSR context (no DOM)
2. **Edge Functions**: Services will run in Supabase/Cloudflare (no UI)
3. **Testing**: Services should be testable with Vitest without Svelte
4. **PartyKit Workers**: roomService must work in Worker context

---

## Appendix A: Layer Import Rules Reference

| Source Layer | May Import |
|--------------|------------|
| routes | components, stores, services, types, utils, supabase |
| components (smart) | components, stores, services, types, utils |
| components (dumb) | components, types, utils |
| stores | services, types, supabase |
| services | services, types, supabase, utils, wasm-bridge |
| types | types |
| wasm-bridge | wasm, types |

---

## Appendix B: Related Invariants

| Invariant | Relationship |
|-----------|--------------|
| `layer_component_isolation` | Components shouldn't import stores either |
| `store_no_circular_deps` | Service→store would create cycle risk |
| `wasm_single_entry` | WASM access is a service concern |

---

**Simulation Status**: Ready for implementation in Week 3.

**Next Steps**:
1. ✅ Design complete
2. ⏳ Implement invariant (Week 3)
3. ⏳ Add test fixtures (Week 3)
4. ⏳ Create toast store proactively
5. ⏳ Enable in CI (blocking)
