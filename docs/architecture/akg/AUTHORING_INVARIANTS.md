# AKG Invariant Authoring Guide

> **Version**: 1.0.0
> **Created**: 2025-12-06
> **Status**: Complete
> **Prerequisites**: Familiarity with TypeScript, AKG concepts

---

## Table of Contents

1. [Overview](#1-overview)
2. [Invariant Anatomy](#2-invariant-anatomy)
3. [Step-by-Step Guide](#3-step-by-step-guide)
4. [Query Engine API](#4-query-engine-api)
5. [Testing Invariants](#5-testing-invariants)
6. [Best Practices](#6-best-practices)
7. [Examples](#7-examples)

---

## 1. Overview

### 1.1 What is an Invariant?

An invariant is a rule that must hold true across your codebase. AKG invariants operate on the architectural knowledge graph, checking relationships between modules, enforcing layer boundaries, and validating naming conventions.

### 1.2 Built-in Invariants

| ID | Category | Severity | Description |
|----|----------|----------|-------------|
| `wasm_single_entry` | dependency | Error | Only engine.ts imports WASM modules |
| `store_no_circular_deps` | dependency | Error | Stores must not have circular dependencies |
| `layer_component_isolation` | dependency | Warning | Dumb components shouldn't import stores |
| `service_layer_boundaries` | dependency | Error | Services shouldn't import UI layers |
| `store_file_naming` | naming | Error | Store files must use .svelte.ts extension |
| `callback_prop_naming` | naming | Warning | Callback props use onVerb pattern |

### 1.3 When to Write Custom Invariants

Write custom invariants when you need to:
- Enforce project-specific architectural rules
- Prevent common mistakes in your codebase
- Validate naming conventions
- Enforce module boundaries

---

## 2. Invariant Anatomy

### 2.1 Basic Structure

```typescript
import { defineInvariant } from '../registry.js';
import { createViolation } from '../../schema/invariant.schema.js';

defineInvariant(
  {
    // Metadata (required)
    id: 'my_custom_invariant',
    name: 'My Custom Invariant',
    description: 'What this invariant enforces',
    category: 'structural',
    severity: 'error',
    businessRule: 'Why this rule exists',
    enabledByDefault: true,

    // Optional filters
    include: ['**/*.ts'],
    exclude: ['**/*.test.ts'],
    meta: { added: '1.0.0', author: 'your-name' },
  },
  (graph, engine) => {
    const violations = [];

    // Your check logic here

    return violations;
  }
);
```

### 2.2 Metadata Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | Unique snake_case identifier |
| `name` | string | Yes | Human-readable name |
| `description` | string | Yes | What the invariant checks |
| `category` | InvariantCategory | Yes | structural, naming, dependency, or custom |
| `severity` | InvariantSeverity | Yes | error, warning, or info |
| `businessRule` | string | Yes | Why this rule exists |
| `enabledByDefault` | boolean | Yes | Whether enabled without config |
| `include` | string[] | No | Glob patterns to include |
| `exclude` | string[] | No | Glob patterns to exclude |
| `meta` | Record | No | Additional metadata |

### 2.3 Severity Levels

| Severity | Exit Code | Use When |
|----------|-----------|----------|
| `error` | 1 | Rule violation breaks functionality |
| `warning` | 0 | Potential issue, but not critical |
| `info` | 0 | Informational, no action required |

---

## 3. Step-by-Step Guide

### Step 1: Create the Invariant File

Create a new file in `packages/web/src/tools/akg/invariants/definitions/`:

```bash
touch packages/web/src/tools/akg/invariants/definitions/my-invariant.ts
```

### Step 2: Write the Invariant

```typescript
/**
 * My Custom Invariant
 *
 * Enforces [your rule here]
 */

import { defineInvariant } from '../registry.js';
import { createViolation } from '../../schema/invariant.schema.js';
import type { AKGQueryEngine } from '../../query/engine.js';
import type { AKGGraph } from '../../schema/graph.schema.js';

defineInvariant(
  {
    id: 'my_custom_invariant',
    name: 'My Custom Invariant',
    description: 'Ensures all service files are in the services directory',
    category: 'structural',
    severity: 'error',
    businessRule: 'Service files should be organized in a dedicated directory',
    enabledByDefault: true,
    include: ['**/services/**/*.ts'],
  },
  (graph: AKGGraph, engine: AKGQueryEngine) => {
    const violations = [];

    // Get all nodes in the services layer
    const serviceNodes = engine.getNodes(
      (node) => node.attributes.layer === 'services'
    );

    // Check each service node
    for (const node of serviceNodes) {
      if (!node.filePath?.includes('/services/')) {
        violations.push(createViolation(
          'my_custom_invariant',
          'My Custom Invariant',
          `Service "${node.name}" should be in the services directory`,
          node.id,
          'error',
          node.filePath,
          node.attributes.line,
        ));
      }
    }

    return violations;
  }
);
```

### Step 3: Register the Invariant

Add your import to `packages/web/src/tools/akg/invariants/definitions/index.ts`:

```typescript
// Built-in invariants
import './wasm-single-entry.js';
import './store-no-circular-deps.js';
import './layer-component-isolation.js';
import './service-layer-boundaries.js';
import './store-file-naming.js';
import './callback-prop-naming.js';

// Custom invariants
import './my-invariant.js';
```

### Step 4: Test the Invariant

Run the check CLI to see your invariant in action:

```bash
# List all invariants (should include yours)
pnpm akg:check --list

# Run the check
pnpm akg:check -v

# Run with verbose output
pnpm akg:check --verbose
```

---

## 4. Query Engine API

### 4.1 Node Queries

```typescript
// Get a specific node by ID
const node = engine.getNode('packages/web/src/lib/services/engine.ts');

// Get all nodes matching a filter
const stores = engine.getNodes(
  (node) => node.type === 'module' &&
            node.attributes.layer === 'stores'
);

// Get nodes by type
const components = engine.getNodesByType('component');

// Get nodes by layer
const services = engine.getNodesByLayer('services');
```

### 4.2 Edge Queries

```typescript
// Get a specific edge by ID
const edge = engine.getEdge('edge-123');

// Get all edges matching a filter
const imports = engine.getEdges(
  (edge) => edge.type === 'imports'
);

// Get outgoing edges from a node
const dependencies = engine.getOutgoing('node-id');

// Get incoming edges to a node
const dependents = engine.getIncoming('node-id');
```

### 4.3 Graph Traversal

```typescript
// Find path between two nodes
const path = engine.findPath('source-id', 'target-id');

// Find all cycles in the graph
const cycles = engine.findCycles();

// Get all reachable nodes from a starting point
const reachable = engine.getReachable('start-id');

// Check if cycles exist (faster than finding all)
const hasCycles = engine.hasCycles();
```

### 4.4 Node Properties

```typescript
interface AKGNode {
  id: string;              // Unique identifier
  name: string;            // Display name
  type: NodeType;          // module, component, store, service, layer, package
  filePath?: string;       // Relative file path
  attributes: {
    layer?: string;        // Architectural layer
    package?: string;      // Package name
    isEntry?: boolean;     // Entry point
    isExport?: boolean;    // Exports from module
    framework?: string;    // Framework (svelte, etc.)
    isVirtual?: boolean;   // Virtual node (layer, package)
    line?: number;         // Line number in source
    column?: number;       // Column number in source
  };
}
```

### 4.5 Edge Properties

```typescript
interface AKGEdge {
  id: string;              // Unique identifier
  source: string;          // Source node ID
  target: string;          // Target node ID
  type: EdgeType;          // imports, exports, contains, layer_can_use, layer_member
  attributes: {
    weight?: number;       // Edge weight
    isDefault?: boolean;   // Default import
    isType?: boolean;      // Type-only import
    importedNames?: string[]; // Named imports
  };
}
```

---

## 5. Testing Invariants

### 5.1 Unit Test Structure

Create a test file at `packages/web/src/tools/akg/__tests__/invariants/my-invariant.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { createTestGraph, createTestNode } from '../../__tests__/helpers.js';
import { AKGQueryEngine } from '../../query/engine.js';
import { runInvariant, getInvariant } from '../../invariants/runner.js';

describe('my_custom_invariant', () => {
  let graph;
  let engine;

  beforeEach(() => {
    graph = createTestGraph();
    engine = new AKGQueryEngine(graph);
  });

  it('should pass when services are in correct directory', () => {
    graph.nodes.push(createTestNode({
      id: 'services/api.ts',
      type: 'module',
      filePath: 'packages/web/src/lib/services/api.ts',
      attributes: { layer: 'services' }
    }));

    engine = new AKGQueryEngine(graph);
    const invariant = getInvariant('my_custom_invariant');
    const violations = runInvariant(invariant, graph, engine);

    expect(violations).toHaveLength(0);
  });

  it('should fail when service is in wrong directory', () => {
    graph.nodes.push(createTestNode({
      id: 'utils/api.ts',
      type: 'module',
      filePath: 'packages/web/src/lib/utils/api.ts',
      attributes: { layer: 'services' }
    }));

    engine = new AKGQueryEngine(graph);
    const invariant = getInvariant('my_custom_invariant');
    const violations = runInvariant(invariant, graph, engine);

    expect(violations).toHaveLength(1);
    expect(violations[0].message).toContain('services directory');
  });
});
```

### 5.2 Running Tests

```bash
# Run invariant tests
pnpm web:vitest -- run src/tools/akg/__tests__/invariants

# Run with watch mode
pnpm web:vitest -- src/tools/akg/__tests__/invariants

# Run specific test file
pnpm web:vitest -- run src/tools/akg/__tests__/invariants/my-invariant.test.ts
```

---

## 6. Best Practices

### 6.1 Performance

- **Filter early**: Use `getNodes()` with a filter rather than iterating all nodes
- **Cache lookups**: Store query results if needed multiple times
- **Limit scope**: Use `include`/`exclude` patterns to narrow checks

```typescript
// Good: Filter in query
const stores = engine.getNodes(n => n.type === 'store');

// Avoid: Filter after full iteration
const stores = graph.nodes.filter(n => n.type === 'store');
```

### 6.2 Clear Messages

- Include the node/file name in violation messages
- Explain what's wrong and what's expected
- Provide actionable guidance

```typescript
// Good
`Store "${node.name}" should use .svelte.ts extension, found "${ext}"`

// Avoid
`Wrong extension`
```

### 6.3 Appropriate Severity

- **Error**: Breaks functionality or violates critical architecture
- **Warning**: Best practice violation, should be fixed
- **Info**: Suggestion for improvement

### 6.4 Business Rules

Document the "why" in the `businessRule` field:

```typescript
businessRule: 'WASM modules should only be imported through engine.ts to ensure proper initialization and error handling',
```

### 6.5 Include/Exclude Patterns

Use patterns to scope invariants to relevant files:

```typescript
// Only check TypeScript files
include: ['**/*.ts'],
exclude: ['**/*.test.ts', '**/__tests__/**'],

// Only check Svelte components
include: ['**/*.svelte'],

// Only check specific directory
include: ['**/stores/**/*.ts'],
```

---

## 7. Examples

### 7.1 Naming Convention Invariant

```typescript
defineInvariant(
  {
    id: 'hook_file_naming',
    name: 'Hook File Naming',
    description: 'Hook files must start with "use"',
    category: 'naming',
    severity: 'warning',
    businessRule: 'React-style hook naming convention for consistency',
    enabledByDefault: true,
    include: ['**/hooks/**/*.ts'],
    exclude: ['**/*.test.ts', '**/index.ts'],
  },
  (graph, engine) => {
    const violations = [];

    const hookNodes = engine.getNodes(
      (n) => n.filePath?.includes('/hooks/') &&
             n.type === 'module' &&
             !n.filePath.endsWith('index.ts')
    );

    for (const node of hookNodes) {
      const fileName = node.name.replace(/\.(ts|svelte\.ts)$/, '');
      if (!fileName.startsWith('use')) {
        violations.push(createViolation(
          'hook_file_naming',
          'Hook File Naming',
          `Hook file "${node.name}" should start with "use" (e.g., "useKeyboard.ts")`,
          node.id,
          'warning',
          node.filePath,
        ));
      }
    }

    return violations;
  }
);
```

### 7.2 Dependency Restriction Invariant

```typescript
defineInvariant(
  {
    id: 'no_direct_supabase',
    name: 'No Direct Supabase Import',
    description: 'Components cannot import Supabase directly',
    category: 'dependency',
    severity: 'error',
    businessRule: 'All Supabase access should go through service layer',
    enabledByDefault: true,
    include: ['**/components/**/*.svelte'],
  },
  (graph, engine) => {
    const violations = [];

    const componentNodes = engine.getNodesByLayer('components');

    for (const node of componentNodes) {
      const outgoing = engine.getOutgoing(node.id);

      for (const edge of outgoing) {
        if (edge.type === 'imports') {
          const target = engine.getNode(edge.target);
          if (target?.filePath?.includes('/supabase/')) {
            violations.push(createViolation(
              'no_direct_supabase',
              'No Direct Supabase Import',
              `Component "${node.name}" imports Supabase directly. Use a service instead.`,
              node.id,
              'error',
              node.filePath,
            ));
          }
        }
      }
    }

    return violations;
  }
);
```

### 7.3 Cycle Detection Invariant

```typescript
defineInvariant(
  {
    id: 'no_component_cycles',
    name: 'No Component Cycles',
    description: 'Components should not have circular dependencies',
    category: 'dependency',
    severity: 'error',
    businessRule: 'Circular component dependencies indicate poor separation of concerns',
    enabledByDefault: true,
  },
  (graph, engine) => {
    const violations = [];

    const cycles = engine.findCycles();

    for (const cycle of cycles) {
      // Check if cycle involves components
      const hasComponents = cycle.some(nodeId => {
        const node = engine.getNode(nodeId);
        return node?.type === 'component';
      });

      if (hasComponents) {
        violations.push(createViolation(
          'no_component_cycles',
          'No Component Cycles',
          `Circular dependency detected: ${cycle.join(' → ')}`,
          cycle[0],
          'error',
        ));
      }
    }

    return violations;
  }
);
```

---

## Quick Reference

### Creating a Violation

```typescript
import { createViolation } from '../../schema/invariant.schema.js';

const violation = createViolation(
  'invariant_id',           // Invariant ID
  'Invariant Name',         // Display name
  'Violation message',      // What's wrong
  'node-id',                // Affected node ID
  'error',                  // Severity
  'path/to/file.ts',        // Optional: file path
  42,                       // Optional: line number
  10,                       // Optional: column number
);
```

### Common Patterns

```typescript
// Check file extension
const ext = node.filePath?.split('.').slice(-1)[0];

// Check directory structure
const isInDir = node.filePath?.includes('/services/');

// Check naming pattern
const name = node.name.replace(/\..*$/, '');
const isValid = /^[a-z][a-zA-Z]*$/.test(name);

// Check import relationships
const imports = engine.getOutgoing(node.id)
  .filter(e => e.type === 'imports');
```

---

**Document Status**: Complete

**Next Steps**: Use this guide to create custom invariants for your project's specific needs.
