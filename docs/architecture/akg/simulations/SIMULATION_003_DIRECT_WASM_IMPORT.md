# Simulation 003: Direct WASM Import

> **Status**: Design Complete
> **Created**: 2025-12-05
> **Invariant**: `wasm_single_entry`
> **Severity**: `error` (BLOCKING)
> **Category**: Structural / Domain

---

## Executive Summary

This simulation validates the `wasm_single_entry` invariant, which enforces that **only the designated bridge module** (`$lib/engine.ts`) may import from the WASM bindings (`$lib/wasm/`).

**Current Status**: ✅ Clean. Only `engine.ts` imports from WASM.

**Why This Matters**:
1. **Type Safety**: Raw WASM uses bitmasks, byte arrays - bridge converts to TypeScript types
2. **Error Handling**: Bridge wraps WASM panics with meaningful errors
3. **Initialization**: Bridge manages singleton WASM initialization
4. **Caching**: Bridge can implement result caching without scattered logic
5. **Version Control**: Single point to update when Rust API changes

---

## Part 1: Technical Background

### 1.1 Current WASM Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         APPLICATION LAYER                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   Components          Stores              Routes                   │
│   ┌─────────┐        ┌─────────┐         ┌─────────┐              │
│   │Scorecard│        │  game   │         │ /play   │              │
│   │  .svelte│        │.svelte  │         │ /+page  │              │
│   └────┬────┘        │  .ts    │         │ .svelte │              │
│        │             └────┬────┘         └────┬────┘              │
│        │                  │                   │                    │
│        └─────────┬────────┴───────────────────┘                    │
│                  │                                                  │
│                  ▼                                                  │
│   ┌──────────────────────────────────────────────────────────────┐ │
│   │              services/engine.ts                              │ │
│   │   - Lazy loading (dynamic import)                            │ │
│   │   - State management (initialized/failed/ready)              │ │
│   │   - Public API: analyzeTurnOptimal()                         │ │
│   └───────────────────────────┬──────────────────────────────────┘ │
│                               │                                    │
│                               │ dynamic import                     │
│                               ▼                                    │
│   ┌──────────────────────────────────────────────────────────────┐ │
│   │                  $lib/engine.ts (BRIDGE)                     │ │
│   │   ┌────────────────────────────────────────────────────────┐ │ │
│   │   │ RESPONSIBILITIES:                                      │ │ │
│   │   │ • Import WASM module (single import point)             │ │ │
│   │   │ • init() - Initialize WASM runtime                     │ │ │
│   │   │ • Type conversion: Category[] → bitmask                │ │ │
│   │   │ • Type conversion: WasmResult → TurnAnalysis           │ │ │
│   │   │ • Input validation (dice values, rolls)                │ │ │
│   │   │ • Error wrapping                                       │ │ │
│   │   └────────────────────────────────────────────────────────┘ │ │
│   └───────────────────────────┬──────────────────────────────────┘ │
│                               │                                    │
│                               │ import init, { analyze_turn }      │
│                               ▼                                    │
├─────────────────────────────────────────────────────────────────────┤
│                          WASM LAYER                                │
├─────────────────────────────────────────────────────────────────────┤
│   ┌──────────────────────────────────────────────────────────────┐ │
│   │                  $lib/wasm/dicee_engine.js                   │ │
│   │   - Auto-generated by wasm-bindgen                           │ │
│   │   - Raw WASM bindings                                        │ │
│   │   - Uses: Uint8Array, bitmasks, snake_case                   │ │
│   └───────────────────────────┬──────────────────────────────────┘ │
│                               │                                    │
│                               │ WebAssembly.instantiate()          │
│                               ▼                                    │
│   ┌──────────────────────────────────────────────────────────────┐ │
│   │                  dicee_engine_bg.wasm (~35KB)                │ │
│   │   - Compiled Rust binary                                     │ │
│   │   - M1-M4 probability solver                                 │ │
│   └──────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

### 1.2 Why Direct WASM Imports Are Dangerous

**Problem 1: Type Mismatch**
```typescript
// Raw WASM interface (from dicee_engine.d.ts)
export function analyze_turn(
  dice: Uint8Array,           // Not DiceArray
  rolls_remaining: number,
  available_categories: number // Bitmask, not Category[]
): any;                        // Untyped JSON

// Bridge provides type-safe interface
export function analyzeTurn(
  dice: DiceArray,             // Typed tuple
  rollsRemaining: number,
  availableCategories: Category[] // String array
): TurnAnalysis;               // Fully typed result
```

**Problem 2: Initialization Race**
```typescript
// ❌ BAD: Direct import - may call before init()
import { analyze_turn } from '$lib/wasm/dicee_engine';
analyze_turn(...); // RuntimeError: WASM not initialized!

// ✅ GOOD: Bridge handles initialization
import { analyzeTurn, initEngine } from '$lib/engine';
await initEngine();
analyzeTurn(...); // Safe
```

**Problem 3: Error Handling**
```typescript
// ❌ BAD: WASM throws cryptic errors
try {
  analyze_turn(new Uint8Array([7, 7, 7, 7, 7]), 0, 0x1FFF);
} catch (e) {
  // Error: unreachable executed
  // No context about what went wrong
}

// ✅ GOOD: Bridge provides context
try {
  analyzeTurn([7, 7, 7, 7, 7], 0, ['Yahtzee']);
} catch (e) {
  // Error: Invalid die value in: [7, 7, 7, 7, 7]
  // Clear, actionable error message
}
```

**Problem 4: Version Coupling**
```typescript
// ❌ BAD: Multiple files importing WASM = multiple update points
// component.svelte
import { analyze_turn } from '$lib/wasm/dicee_engine';

// store.svelte.ts
import { analyze_turn } from '$lib/wasm/dicee_engine';

// When Rust API changes: "analyze_turn" → "analyze_position"
// Must update EVERY file

// ✅ GOOD: Single bridge = single update point
// Only engine.ts needs updating
```

### 1.3 Legitimate vs. Illegitimate Access

| Module Type | Can Import WASM? | Reason |
|-------------|------------------|--------|
| `$lib/engine.ts` | ✅ YES | Designated bridge |
| `services/engine.ts` | ❌ NO | Uses bridge via `$lib/engine` |
| Components | ❌ NO | Use services layer |
| Stores | ❌ NO | Use services layer |
| Routes | ❌ NO | Use services layer |
| Test files (`*.test.ts`) | ⚠️ EXEMPT | May need direct access for unit tests |
| Mock files (`__mocks__/`) | ⚠️ EXEMPT | Must mock WASM interface |

---

## Part 2: Violation Scenarios

### 2.1 Scenario A: Component Imports WASM for "Optimization"

**How it happens**: Developer thinks bypassing the bridge is faster.

```svelte
<!-- packages/web/src/lib/components/scorecard/CategoryRow.svelte -->
<script lang="ts">
  import { analyze_turn } from '$lib/wasm/dicee_engine'; // ❌ Direct import
  import type { Category, DiceArray } from '$lib/types';

  interface Props {
    category: Category;
    dice: DiceArray;
  }

  let { category, dice }: Props = $props();

  // Direct WASM call - bypasses type safety
  const score = $derived(() => {
    const result = analyze_turn(
      new Uint8Array(dice),
      0,
      1 << categoryIndex // Manual bitmask - error prone
    );
    return result.categories[0].immediate_score;
  });
</script>
```

**Problems**:
1. `analyze_turn` may not be initialized
2. Bitmask calculation is error-prone
3. Result type is `any` - no type checking
4. When WASM API changes, this breaks silently

### 2.2 Scenario B: Store Imports WASM for "Simplicity"

**How it happens**: Developer wants to avoid async/await.

```typescript
// packages/web/src/lib/stores/game.svelte.ts
import { analyze_turn } from '$lib/wasm/dicee_engine'; // ❌ Direct import
import type { DiceArray } from '$lib/types';

class GameState {
  // Synchronous access seems simpler...
  #getScore(dice: DiceArray, category: number): number {
    const result = analyze_turn(
      new Uint8Array(dice),
      0,
      1 << category
    );
    return result.categories[0].immediate_score;
  }
}
```

**Problems**:
1. Assumes WASM is already initialized (race condition)
2. Category index mapping done manually
3. No input validation
4. Scattered WASM knowledge across codebase

### 2.3 Scenario C: Route Server Load Function Imports WASM

**How it happens**: Attempting to use WASM in server context.

```typescript
// packages/web/src/routes/api/analyze/+server.ts
import { analyze_turn } from '$lib/wasm/dicee_engine'; // ❌ Direct import

export async function POST({ request }) {
  const { dice } = await request.json();
  const result = analyze_turn(...);
  return Response.json(result);
}
```

**Problems**:
1. WASM may not work in server context (Node.js vs browser)
2. No server-side initialization handling
3. Should use edge function with proper WASM loading

---

## Part 3: Graph Representation

### 3.1 Violation Graph Structure

```json
{
  "nodes": [
    {
      "id": "module::components::CategoryRow",
      "type": "Component",
      "name": "CategoryRow.svelte",
      "filePath": "packages/web/src/lib/components/scorecard/CategoryRow.svelte",
      "attributes": {
        "layer": "components",
        "classification": "dumb"
      }
    },
    {
      "id": "module::wasm::dicee_engine",
      "type": "WASMModule",
      "name": "dicee_engine.js",
      "filePath": "packages/web/src/lib/wasm/dicee_engine.js",
      "attributes": {
        "layer": "wasm",
        "isGenerated": true,
        "wasmBinary": "dicee_engine_bg.wasm"
      }
    },
    {
      "id": "module::bridge::engine",
      "type": "WASMBridge",
      "name": "engine.ts",
      "filePath": "packages/web/src/lib/engine.ts",
      "attributes": {
        "layer": "services",
        "isWASMBridge": true
      }
    }
  ],
  "edges": [
    {
      "id": "imports::CategoryRow::dicee_engine",
      "type": "imports",
      "sourceNodeId": "module::components::CategoryRow",
      "targetNodeId": "module::wasm::dicee_engine",
      "attributes": {
        "importType": "named",
        "namedImports": ["analyze_turn"],
        "isViolation": true
      },
      "evidence": [{
        "filePath": "packages/web/src/lib/components/scorecard/CategoryRow.svelte",
        "startLine": 2,
        "endLine": 2,
        "snippet": "import { analyze_turn } from '$lib/wasm/dicee_engine';"
      }]
    }
  ]
}
```

### 3.2 Valid Import Pattern

```json
{
  "edges": [
    {
      "id": "imports::bridge::wasm",
      "type": "imports",
      "sourceNodeId": "module::bridge::engine",
      "targetNodeId": "module::wasm::dicee_engine",
      "attributes": {
        "importType": "named",
        "namedImports": ["init", "analyze_turn"],
        "isViolation": false
      }
    },
    {
      "id": "imports::service::bridge",
      "type": "imports",
      "sourceNodeId": "module::services::engine",
      "targetNodeId": "module::bridge::engine",
      "attributes": {
        "importType": "namespace"
      }
    }
  ]
}
```

---

## Part 4: Invariant Definition

### 4.1 Invariant Specification

```yaml
id: "wasm_single_entry"
name: "WASM: Single Entry Point"
description: |
  Only the designated WASM bridge module ($lib/engine.ts) may import from
  the WASM bindings ($lib/wasm/). All other modules must use the bridge.

type: "structural"
severity: "error"  # BLOCKING

rule:
  scope:
    target_pattern: "$lib/wasm/**"
    target_description: "WASM bindings directory"

  detect:
    edge_type: "imports"
    target_matches: "packages/web/src/lib/wasm/"

  allow_only:
    - file: "packages/web/src/lib/engine.ts"
      reason: "Designated WASM bridge"

  exempt_when:
    - source_pattern: "*.test.ts"
      reason: "Unit tests may need direct WASM access"
    - source_pattern: "**/__mocks__/**"
      reason: "Mock implementations need to match WASM interface"
    - source_pattern: "**/__tests__/**"
      reason: "Test fixtures may need direct access"

adr_reference: null  # Document in CONVENTIONS.md
rationale: |
  Centralized WASM access ensures type safety, proper initialization,
  error handling, and single point for version updates.
  See Simulation 003 for technical justification.
```

### 4.2 Implementation

```typescript
// src/tools/akg/invariants/definitions/wasm-single-entry.ts

import type { InvariantCheckFn } from '../checker';
import type { InvariantViolation } from '../../schema/invariant.schema';
import type { AKGNode, AKGEdge } from '../../schema/graph.schema';

/**
 * Pattern matching for WASM directory
 */
const WASM_PATH_PATTERN = /\/wasm\//;
const WASM_MODULE_PATTERN = /wasm\/dicee_engine/;

/**
 * Allowed importers (designated bridges)
 */
const ALLOWED_IMPORTERS = [
  'packages/web/src/lib/engine.ts',
  'src/lib/engine.ts',  // Relative path variant
];

/**
 * Exempt patterns (tests and mocks)
 */
const EXEMPT_PATTERNS = [
  /\.test\.ts$/,
  /\.spec\.ts$/,
  /__tests__\//,
  /__mocks__\//,
  /\.test\.svelte$/,
];

/**
 * Check if a file path is exempt from the invariant
 */
function isExempt(filePath: string): boolean {
  return EXEMPT_PATTERNS.some(pattern => pattern.test(filePath));
}

/**
 * Check if a file is the allowed WASM bridge
 */
function isAllowedImporter(filePath: string): boolean {
  return ALLOWED_IMPORTERS.some(allowed =>
    filePath.endsWith(allowed) || filePath.includes(allowed)
  );
}

/**
 * Check if import target is WASM module
 */
function isWASMImport(targetNode: AKGNode): boolean {
  return (
    WASM_PATH_PATTERN.test(targetNode.filePath ?? '') ||
    WASM_MODULE_PATTERN.test(targetNode.filePath ?? '') ||
    targetNode.type === 'WASMModule' ||
    targetNode.attributes.layer === 'wasm'
  );
}

export const wasmSingleEntry: InvariantCheckFn = (graph, engine) => {
  const violations: InvariantViolation[] = [];

  // Find all WASM module nodes
  const wasmNodes = graph.nodes.filter(n =>
    isWASMImport(n) ||
    n.type === 'WASMModule' ||
    (n.filePath && WASM_PATH_PATTERN.test(n.filePath))
  );

  if (wasmNodes.length === 0) {
    // No WASM modules in graph - nothing to check
    return violations;
  }

  // Check all edges that point to WASM modules
  for (const wasmNode of wasmNodes) {
    const incomingEdges = engine.getIncomingEdges(wasmNode.id, 'imports');

    for (const edge of incomingEdges) {
      const sourceNode = engine.getNode(edge.sourceNodeId);
      if (!sourceNode) continue;

      const sourcePath = sourceNode.filePath ?? sourceNode.name;

      // Skip if source is the allowed bridge
      if (isAllowedImporter(sourcePath)) {
        continue;
      }

      // Skip if source is exempt (test/mock)
      if (isExempt(sourcePath)) {
        continue;
      }

      // This is a violation
      violations.push({
        invariantId: 'wasm_single_entry',
        invariantName: 'WASM: Single Entry Point',
        severity: 'error',

        message: `Direct WASM import not allowed from ${sourceNode.name}`,

        suggestion: buildSuggestion(sourceNode, wasmNode, edge),

        sourceNode: sourceNode.name,
        targetNode: wasmNode.name,

        evidence: edge.evidence.map(e => ({
          filePath: e.filePath,
          line: e.startLine,
          snippet: e.snippet,
        })),

        businessRule: 'Only $lib/engine.ts may import from $lib/wasm/',
      });
    }
  }

  return violations;
};

function buildSuggestion(
  source: AKGNode,
  target: AKGNode,
  edge: AKGEdge
): string {
  const namedImports = edge.attributes.namedImports as string[] | undefined;
  const importList = namedImports?.join(', ') || 'functions';

  return `🚫 BLOCKING: Direct WASM imports bypass type safety and initialization.

❌ Current (violation):
   ${edge.evidence[0]?.snippet || `import { ${importList} } from '$lib/wasm/dicee_engine';`}

✅ Use the bridge instead:
   import { analyzeTurn, initEngine } from '$lib/engine';
   // or
   import { analyzeTurnOptimal } from '$lib/services/engine';

Why this matters:
1. Bridge handles WASM initialization (avoid race conditions)
2. Bridge converts types (bitmasks → arrays, snake_case → camelCase)
3. Bridge validates inputs (provides helpful error messages)
4. Single update point when Rust API changes

If you need synchronous access:
   // First ensure initialization (once, at app startup)
   await initEngine();
   // Then use isEngineReady() to check before sync calls

If this is a test file:
   // Tests are exempt - rename to *.test.ts or move to __tests__/`;
}
```

### 4.3 Import Specifier Analysis

```typescript
// src/tools/akg/discovery/analyzers/import-analyzer.ts

/**
 * Detect imports to WASM from import specifier string
 */
export function isWASMImportSpecifier(specifier: string): boolean {
  const wasmPatterns = [
    /\$lib\/wasm\//,
    /\.\/wasm\//,
    /\.\.\/wasm\//,
    /wasm\/dicee_engine/,
    /dicee_engine\.js$/,
  ];

  return wasmPatterns.some(p => p.test(specifier));
}

/**
 * Extract import details for WASM imports
 */
export interface WASMImportInfo {
  specifier: string;
  namedImports: string[];
  defaultImport: string | null;
  isTypeOnly: boolean;
  line: number;
}

export function analyzeWASMImport(importStatement: string, line: number): WASMImportInfo | null {
  // Match: import { analyze_turn, init } from '$lib/wasm/dicee_engine';
  const namedMatch = importStatement.match(
    /import\s+\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]/
  );

  // Match: import init from '$lib/wasm/dicee_engine';
  const defaultMatch = importStatement.match(
    /import\s+(\w+)\s+from\s+['"]([^'"]+)['"]/
  );

  // Match: import type { InitOutput } from '$lib/wasm/dicee_engine';
  const typeMatch = importStatement.match(
    /import\s+type\s+\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]/
  );

  if (typeMatch && isWASMImportSpecifier(typeMatch[2])) {
    return {
      specifier: typeMatch[2],
      namedImports: typeMatch[1].split(',').map(s => s.trim()),
      defaultImport: null,
      isTypeOnly: true,
      line,
    };
  }

  if (namedMatch && isWASMImportSpecifier(namedMatch[2])) {
    return {
      specifier: namedMatch[2],
      namedImports: namedMatch[1].split(',').map(s => s.trim()),
      defaultImport: null,
      isTypeOnly: false,
      line,
    };
  }

  if (defaultMatch && isWASMImportSpecifier(defaultMatch[2])) {
    return {
      specifier: defaultMatch[2],
      namedImports: [],
      defaultImport: defaultMatch[1],
      isTypeOnly: false,
      line,
    };
  }

  return null;
}
```

---

## Part 5: Expected Detection Output

### 5.1 CLI Output

```
pnpm akg:check

🔒 Checking invariants...

❌ wasm_single_entry (1 violation)

   ┌──────────────────────────────────────────────────────────────┐
   │  DIRECT WASM IMPORT DETECTED                                 │
   │                                                              │
   │    CategoryRow.svelte → $lib/wasm/dicee_engine               │
   └──────────────────────────────────────────────────────────────┘

   File: packages/web/src/lib/components/scorecard/CategoryRow.svelte:2
   │ import { analyze_turn } from '$lib/wasm/dicee_engine';

   🚫 BLOCKING: Direct WASM imports bypass type safety and initialization.

   ❌ Current (violation):
      import { analyze_turn } from '$lib/wasm/dicee_engine';

   ✅ Use the bridge instead:
      import { analyzeTurn, initEngine } from '$lib/engine';
      // or
      import { analyzeTurnOptimal } from '$lib/services/engine';

   Why this matters:
   1. Bridge handles WASM initialization (avoid race conditions)
   2. Bridge converts types (bitmasks → arrays, snake_case → camelCase)
   3. Bridge validates inputs (provides helpful error messages)
   4. Single update point when Rust API changes

📊 Summary:
   Total: 8 invariants checked
   Passed: 7
   Failed: 1
   Errors: 1
   Warnings: 0

🚫 BLOCKING VIOLATIONS FOUND. Must fix before merge.
```

### 5.2 JSON Output (for CI/MCP)

```json
{
  "invariantId": "wasm_single_entry",
  "passed": false,
  "violations": [
    {
      "invariantId": "wasm_single_entry",
      "invariantName": "WASM: Single Entry Point",
      "severity": "error",
      "message": "Direct WASM import not allowed from CategoryRow.svelte",
      "sourceNode": "CategoryRow.svelte",
      "targetNode": "dicee_engine.js",
      "evidence": [
        {
          "filePath": "packages/web/src/lib/components/scorecard/CategoryRow.svelte",
          "line": 2,
          "snippet": "import { analyze_turn } from '$lib/wasm/dicee_engine';"
        }
      ],
      "businessRule": "Only $lib/engine.ts may import from $lib/wasm/",
      "suggestion": "..."
    }
  ],
  "durationMs": 8,
  "checkedAt": "2025-12-05T14:00:00.000Z"
}
```

---

## Part 6: Resolution Pattern

### 6.1 The Only Fix: Use the Bridge

**Before** (violation):
```svelte
<script lang="ts">
  import { analyze_turn } from '$lib/wasm/dicee_engine';
  import type { DiceArray } from '$lib/types';

  interface Props {
    dice: DiceArray;
    category: number;
  }

  let { dice, category }: Props = $props();

  // Manual bitmask, untyped result, no error handling
  const analysis = $derived(() => {
    const result = analyze_turn(new Uint8Array(dice), 0, 1 << category);
    return result.categories[0].immediate_score;
  });
</script>
```

**After** (correct):
```svelte
<script lang="ts">
  import { analyzeTurnOptimal } from '$lib/services/engine';
  import type { Category, DiceArray } from '$lib/types';

  interface Props {
    dice: DiceArray;
    category: Category;
  }

  let { dice, category }: Props = $props();

  // Store analysis result
  let analysis = $state<number | null>(null);

  // Async analysis with proper typing
  $effect(() => {
    analyzeTurnOptimal(dice, 0, [category])
      .then(result => {
        const catAnalysis = result.categories.find(c => c.category === category);
        analysis = catAnalysis?.immediateScore ?? null;
      })
      .catch(err => {
        console.warn('Analysis failed:', err);
        analysis = null;
      });
  });
</script>
```

**Or if component is presentational (recommended)**:
```svelte
<script lang="ts">
  interface Props {
    score: number;  // Parent does the analysis
    category: string;
  }

  let { score, category }: Props = $props();
</script>

<div class="category-row">
  <span>{category}</span>
  <span>{score}</span>
</div>
```

### 6.2 Type-Only Imports Are NOT Exempt

```typescript
// ❌ Still a violation - creates coupling
import type { InitOutput } from '$lib/wasm/dicee_engine';

// ✅ If you need WASM types, they should be re-exported from bridge
// Add to $lib/engine.ts:
export type { InitOutput } from './wasm/dicee_engine';

// Then import from bridge:
import type { InitOutput } from '$lib/engine';
```

### 6.3 Test File Exemption

```typescript
// packages/web/src/lib/wasm/__tests__/dicee_engine.test.ts
// This is EXEMPT because it's testing the WASM module itself

import init, { analyze_turn } from '../dicee_engine';

describe('dicee_engine WASM module', () => {
  beforeAll(async () => {
    await init();
  });

  it('should analyze turn correctly', () => {
    const result = analyze_turn(
      new Uint8Array([5, 5, 5, 5, 5]),
      0,
      0x0800 // Yahtzee bit
    );
    expect(result.categories[0].immediate_score).toBe(50);
  });
});
```

---

## Part 7: Test Fixtures

### 7.1 Valid Architecture (Bridge Pattern)

```typescript
// tests/tools/akg/invariants/fixtures/wasm-single-entry-valid.ts

export const validWASMGraph: AKGGraph = {
  version: '1.0.0',
  generatedAt: new Date().toISOString(),
  projectRoot: '/test',
  nodes: [
    {
      id: 'module::bridge::engine',
      type: 'WASMBridge',
      name: 'engine.ts',
      filePath: 'packages/web/src/lib/engine.ts',
      attributes: { layer: 'services', isWASMBridge: true },
      metadata: { discoveredAt: new Date().toISOString(), confidence: 'high' }
    },
    {
      id: 'module::wasm::dicee_engine',
      type: 'WASMModule',
      name: 'dicee_engine.js',
      filePath: 'packages/web/src/lib/wasm/dicee_engine.js',
      attributes: { layer: 'wasm', isGenerated: true },
      metadata: { discoveredAt: new Date().toISOString(), confidence: 'high' }
    },
    {
      id: 'module::services::engine',
      type: 'Service',
      name: 'engine.ts',
      filePath: 'packages/web/src/lib/services/engine.ts',
      attributes: { layer: 'services' },
      metadata: { discoveredAt: new Date().toISOString(), confidence: 'high' }
    }
  ],
  edges: [
    // Bridge imports WASM - OK
    {
      id: 'imports::bridge::wasm',
      type: 'imports',
      sourceNodeId: 'module::bridge::engine',
      targetNodeId: 'module::wasm::dicee_engine',
      attributes: { namedImports: ['init', 'analyze_turn'] },
      evidence: [{
        filePath: 'packages/web/src/lib/engine.ts',
        startLine: 16,
        endLine: 16,
        snippet: "import init, { analyze_turn } from './wasm/dicee_engine.js';"
      }],
      metadata: { discoveredAt: new Date().toISOString(), confidence: 'high' }
    },
    // Service imports bridge - OK
    {
      id: 'imports::service::bridge',
      type: 'imports',
      sourceNodeId: 'module::services::engine',
      targetNodeId: 'module::bridge::engine',
      attributes: {},
      evidence: [],
      metadata: { discoveredAt: new Date().toISOString(), confidence: 'high' }
    }
  ],
  metadata: { totalFiles: 3, discoveryDurationMs: 10 }
};
```

### 7.2 Violation (Component Imports WASM)

```typescript
// tests/tools/akg/invariants/fixtures/wasm-single-entry-violation.ts

export const violationWASMGraph: AKGGraph = {
  version: '1.0.0',
  generatedAt: new Date().toISOString(),
  projectRoot: '/test',
  nodes: [
    {
      id: 'module::component::CategoryRow',
      type: 'Component',
      name: 'CategoryRow.svelte',
      filePath: 'packages/web/src/lib/components/scorecard/CategoryRow.svelte',
      attributes: { layer: 'components' },
      metadata: { discoveredAt: new Date().toISOString(), confidence: 'high' }
    },
    {
      id: 'module::wasm::dicee_engine',
      type: 'WASMModule',
      name: 'dicee_engine.js',
      filePath: 'packages/web/src/lib/wasm/dicee_engine.js',
      attributes: { layer: 'wasm', isGenerated: true },
      metadata: { discoveredAt: new Date().toISOString(), confidence: 'high' }
    }
  ],
  edges: [
    // Component imports WASM directly - VIOLATION
    {
      id: 'imports::component::wasm',
      type: 'imports',
      sourceNodeId: 'module::component::CategoryRow',
      targetNodeId: 'module::wasm::dicee_engine',
      attributes: { namedImports: ['analyze_turn'] },
      evidence: [{
        filePath: 'packages/web/src/lib/components/scorecard/CategoryRow.svelte',
        startLine: 2,
        endLine: 2,
        snippet: "import { analyze_turn } from '$lib/wasm/dicee_engine';"
      }],
      metadata: { discoveredAt: new Date().toISOString(), confidence: 'high' }
    }
  ],
  metadata: { totalFiles: 2, discoveryDurationMs: 10 }
};
```

### 7.3 Exempt (Test File)

```typescript
// tests/tools/akg/invariants/fixtures/wasm-single-entry-exempt.ts

export const exemptWASMGraph: AKGGraph = {
  version: '1.0.0',
  generatedAt: new Date().toISOString(),
  projectRoot: '/test',
  nodes: [
    {
      id: 'module::test::engine',
      type: 'TestModule',
      name: 'engine.test.ts',
      filePath: 'packages/web/src/lib/wasm/__tests__/engine.test.ts',
      attributes: { layer: 'test', isTest: true },
      metadata: { discoveredAt: new Date().toISOString(), confidence: 'high' }
    },
    {
      id: 'module::wasm::dicee_engine',
      type: 'WASMModule',
      name: 'dicee_engine.js',
      filePath: 'packages/web/src/lib/wasm/dicee_engine.js',
      attributes: { layer: 'wasm', isGenerated: true },
      metadata: { discoveredAt: new Date().toISOString(), confidence: 'high' }
    }
  ],
  edges: [
    // Test file imports WASM - EXEMPT
    {
      id: 'imports::test::wasm',
      type: 'imports',
      sourceNodeId: 'module::test::engine',
      targetNodeId: 'module::wasm::dicee_engine',
      attributes: { namedImports: ['init', 'analyze_turn'] },
      evidence: [{
        filePath: 'packages/web/src/lib/wasm/__tests__/engine.test.ts',
        startLine: 3,
        endLine: 3,
        snippet: "import init, { analyze_turn } from '../dicee_engine';"
      }],
      metadata: { discoveredAt: new Date().toISOString(), confidence: 'high' }
    }
  ],
  metadata: { totalFiles: 2, discoveryDurationMs: 10 }
};
```

### 7.4 Test Implementation

```typescript
// tests/tools/akg/invariants/wasm-single-entry.test.ts

import { describe, it, expect } from 'vitest';
import { wasmSingleEntry } from '@/tools/akg/invariants/definitions/wasm-single-entry';
import { AKGQueryEngine } from '@/tools/akg/query/engine';
import {
  validWASMGraph,
  violationWASMGraph,
  exemptWASMGraph
} from './fixtures/wasm-single-entry';

describe('wasm_single_entry invariant', () => {
  describe('valid architecture', () => {
    it('should pass when only bridge imports WASM', () => {
      const engine = new AKGQueryEngine(validWASMGraph);
      const violations = wasmSingleEntry(validWASMGraph, engine);

      expect(violations).toHaveLength(0);
    });

    it('should allow service to import bridge', () => {
      const engine = new AKGQueryEngine(validWASMGraph);
      const violations = wasmSingleEntry(validWASMGraph, engine);

      expect(violations).toHaveLength(0);
    });
  });

  describe('violation detection', () => {
    it('should detect component importing WASM', () => {
      const engine = new AKGQueryEngine(violationWASMGraph);
      const violations = wasmSingleEntry(violationWASMGraph, engine);

      expect(violations).toHaveLength(1);
      expect(violations[0]).toMatchObject({
        invariantId: 'wasm_single_entry',
        severity: 'error',
        sourceNode: 'CategoryRow.svelte',
        targetNode: 'dicee_engine.js'
      });
    });

    it('should provide clear fix suggestion', () => {
      const engine = new AKGQueryEngine(violationWASMGraph);
      const violations = wasmSingleEntry(violationWASMGraph, engine);

      expect(violations[0].suggestion).toContain('$lib/engine');
      expect(violations[0].suggestion).toContain('bridge');
    });

    it('should include evidence with line number', () => {
      const engine = new AKGQueryEngine(violationWASMGraph);
      const violations = wasmSingleEntry(violationWASMGraph, engine);

      expect(violations[0].evidence[0]).toMatchObject({
        line: 2,
        snippet: expect.stringContaining('analyze_turn')
      });
    });
  });

  describe('test file exemption', () => {
    it('should not flag test files', () => {
      const engine = new AKGQueryEngine(exemptWASMGraph);
      const violations = wasmSingleEntry(exemptWASMGraph, engine);

      expect(violations).toHaveLength(0);
    });

    it('should exempt files in __tests__ directories', () => {
      // Test file path includes __tests__
      expect(exemptWASMGraph.nodes[0].filePath).toContain('__tests__');

      const engine = new AKGQueryEngine(exemptWASMGraph);
      const violations = wasmSingleEntry(exemptWASMGraph, engine);

      expect(violations).toHaveLength(0);
    });
  });

  describe('edge cases', () => {
    it('should detect store importing WASM', () => {
      const storeViolationGraph = {
        ...violationWASMGraph,
        nodes: [
          {
            id: 'module::store::game',
            type: 'Store',
            name: 'game.svelte.ts',
            filePath: 'packages/web/src/lib/stores/game.svelte.ts',
            attributes: { layer: 'stores' },
            metadata: { discoveredAt: new Date().toISOString(), confidence: 'high' }
          },
          violationWASMGraph.nodes[1]  // WASM module
        ],
        edges: [
          {
            ...violationWASMGraph.edges[0],
            id: 'imports::store::wasm',
            sourceNodeId: 'module::store::game',
            evidence: [{
              filePath: 'packages/web/src/lib/stores/game.svelte.ts',
              startLine: 5,
              endLine: 5,
              snippet: "import { analyze_turn } from '$lib/wasm/dicee_engine';"
            }]
          }
        ]
      };

      const engine = new AKGQueryEngine(storeViolationGraph);
      const violations = wasmSingleEntry(storeViolationGraph, engine);

      expect(violations).toHaveLength(1);
      expect(violations[0].sourceNode).toBe('game.svelte.ts');
    });

    it('should handle graph with no WASM modules', () => {
      const noWASMGraph = {
        ...validWASMGraph,
        nodes: validWASMGraph.nodes.filter(n => n.type !== 'WASMModule'),
        edges: []
      };

      const engine = new AKGQueryEngine(noWASMGraph);
      const violations = wasmSingleEntry(noWASMGraph, engine);

      expect(violations).toHaveLength(0);
    });
  });
});
```

---

## Part 8: Agent Integration

### 8.1 Pre-Import Check

Before adding any import that looks like it might be WASM:

```typescript
// mcp__project-akg__check_import
{
  "source": "CategoryRow.svelte",
  "importSpecifier": "$lib/wasm/dicee_engine",
  "result": {
    "allowed": false,
    "invariant": "wasm_single_entry",
    "reason": "Only $lib/engine.ts may import from $lib/wasm/",
    "suggestion": "Use $lib/services/engine.ts instead"
  }
}
```

### 8.2 Agent Decision Protocol

```markdown
## Before Importing WASM Functions

1. NEVER import directly from `$lib/wasm/`
2. Check if the function exists in `$lib/engine.ts` or `$lib/services/engine.ts`
3. If not, ADD it to the bridge first, then import from bridge

## If You Need a New WASM Function Exposed

1. Add wrapper to `$lib/engine.ts`:
   - Import from WASM
   - Add type conversion
   - Add input validation
   - Export with camelCase name

2. Add to `$lib/services/engine.ts` if lazy loading is needed

3. Then import from services layer in your component/store

## If You're Writing Tests

Test files (*.test.ts) ARE exempt and may import WASM directly.
But prefer testing through the bridge when possible.
```

### 8.3 Auto-Fix Capability

This invariant has **partial auto-fix** capability:

```typescript
// Auto-fix for simple cases
function autoFix(violation: InvariantViolation): string | null {
  const snippet = violation.evidence[0]?.snippet;
  if (!snippet) return null;

  // Simple replacement: analyze_turn → analyzeTurn
  const fixed = snippet
    .replace(/from ['"].*wasm\/dicee_engine.*['"]/, "from '$lib/services/engine'")
    .replace(/analyze_turn/g, 'analyzeTurnOptimal');

  // Can only auto-fix if it's a direct swap
  // More complex cases need manual intervention
  if (snippet.includes('new Uint8Array') || snippet.includes('<<')) {
    return null; // Manual fix needed for type conversions
  }

  return fixed;
}
```

---

## Part 9: Metrics & Effectiveness

### 9.1 Expected Metrics

| Metric | Target | Notes |
|--------|--------|-------|
| Violations caught | ≥ 1 | Any is good - means it's working |
| False positive rate | 0% | Allowlist is explicit |
| Detection time | < 20ms | Simple pattern match |
| Fix success rate | 100% | Single fix pattern |

### 9.2 Why This Invariant Is Highly Effective

1. **Zero ambiguity** - Either you import from wasm/ or you don't
2. **Clear allowlist** - Only engine.ts is allowed
3. **Obvious fix** - Always use the bridge
4. **No edge cases** - Even type-only imports are violations
5. **Auto-detectable** - Simple string pattern matching

---

## Appendix A: WASM Bridge API Reference

| Raw WASM | Bridge ($lib/engine) | Service ($lib/services/engine) |
|----------|---------------------|-------------------------------|
| `init()` | `initEngine()` | `initializeEngine()` (with retry) |
| `analyze_turn(Uint8Array, n, bitmask)` | `analyzeTurn(DiceArray, n, Category[])` | `analyzeTurnOptimal(...)` (lazy loading) |
| - | `isEngineReady()` | `isEngineReady()`, `getEngineState()` |

---

## Appendix B: Related Invariants

| Invariant | Relationship |
|-----------|--------------|
| `service_layer_boundaries` | Services shouldn't import WASM either |
| `layer_component_isolation` | Components should use services |
| `store_no_circular_deps` | Engine imports shouldn't create cycles |

---

**Simulation Status**: Ready for implementation in Week 3.

**Next Steps**:
1. ✅ Design complete
2. ⏳ Implement invariant (Week 3)
3. ⏳ Add test fixtures (Week 3)
4. ⏳ Add auto-fix for simple cases
5. ⏳ Enable in CI (blocking)
