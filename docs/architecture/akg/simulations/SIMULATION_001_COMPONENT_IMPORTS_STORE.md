# Simulation 001: Component Imports Store Directly

> **Status**: Design Complete
> **Created**: 2025-12-05
> **Invariant**: `layer_component_isolation`
> **Severity**: `warning`
> **Category**: Structural

---

## Executive Summary

This simulation validates the `layer_component_isolation` invariant, which detects when components import directly from the stores layer instead of receiving data via props.

**Real-World Example Found**: `AuthStatusCard.svelte` imports `auth` store directly. This is acceptable because it functions as a smart container, but demonstrates the pattern we want to detect.

---

## Part 1: Scenario Definition

### 1.1 Context

The Dicee codebase follows a **smart/dumb component pattern**:

| Type | Imports Stores? | Receives Data Via | Example |
|------|-----------------|-------------------|---------|
| **Dumb Component** | ❌ No | Props only | `Die.svelte`, `CategoryRow.svelte` |
| **Smart Container** | ✅ Yes (or via prop) | Store subscription | `MultiplayerGameView.svelte` |

**Problem**: Without architectural governance, it's easy to gradually pollute dumb components with store imports, breaking component reusability and testability.

### 1.2 The Violation Scenario

**Scenario**: Developer creates `PlayerScore.svelte` to display the current player's score.

**Incorrect Implementation** (violates pattern):
```svelte
<!-- packages/web/src/lib/components/scorecard/PlayerScore.svelte -->
<script lang="ts">
  import { game } from '$lib/stores/game.svelte';  // ❌ Direct store import

  const totalScore = $derived(game.totalScore);
</script>

<div class="player-score">
  <span class="label">Score</span>
  <span class="value">{totalScore}</span>
</div>
```

**Correct Implementation** (follows pattern):
```svelte
<!-- packages/web/src/lib/components/scorecard/PlayerScore.svelte -->
<script lang="ts">
  interface Props {
    score: number;
  }

  let { score }: Props = $props();  // ✅ Data via props
</script>

<div class="player-score">
  <span class="label">Score</span>
  <span class="value">{score}</span>
</div>
```

### 1.3 Why This Matters

| Concern | Impact |
|---------|--------|
| **Testability** | Direct store imports require mocking stores in tests |
| **Reusability** | Component can't be used with different data sources |
| **Predictability** | Hidden dependencies make behavior harder to trace |
| **Storybook/Isolation** | Can't render component without store setup |

---

## Part 2: Graph Representation

### 2.1 Violation Graph Structure

```json
{
  "nodes": [
    {
      "id": "module::packages_web_src_lib_components_scorecard_PlayerScore_svelte",
      "type": "Component",
      "name": "PlayerScore.svelte",
      "filePath": "packages/web/src/lib/components/scorecard/PlayerScore.svelte",
      "attributes": {
        "layer": "components",
        "classification": "dumb",
        "hasStoreImport": true
      }
    },
    {
      "id": "module::packages_web_src_lib_stores_game_svelte_ts",
      "type": "Store",
      "name": "game.svelte.ts",
      "filePath": "packages/web/src/lib/stores/game.svelte.ts",
      "attributes": {
        "layer": "stores"
      }
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
      "id": "imports::PlayerScore::game",
      "type": "imports",
      "sourceNodeId": "module::packages_web_src_lib_components_scorecard_PlayerScore_svelte",
      "targetNodeId": "module::packages_web_src_lib_stores_game_svelte_ts",
      "evidence": [{
        "filePath": "packages/web/src/lib/components/scorecard/PlayerScore.svelte",
        "startLine": 2,
        "endLine": 2,
        "snippet": "import { game } from '$lib/stores/game.svelte';"
      }]
    },
    {
      "id": "belongs_to::PlayerScore::components",
      "type": "belongs_to",
      "sourceNodeId": "module::packages_web_src_lib_components_scorecard_PlayerScore_svelte",
      "targetNodeId": "layer::components"
    },
    {
      "id": "belongs_to::game::stores",
      "type": "belongs_to",
      "sourceNodeId": "module::packages_web_src_lib_stores_game_svelte_ts",
      "targetNodeId": "layer::stores"
    }
  ]
}
```

### 2.2 Key Detection Patterns

The invariant looks for edges matching:
```typescript
{
  type: "imports",
  sourceNode: { layer: "components" },
  targetNode: { layer: "stores" }
}
```

With exemption for:
```typescript
// Exempt if source is classified as smart container
sourceNode.attributes.classification === "smart"
```

---

## Part 3: Invariant Definition

### 3.1 Invariant Specification

```yaml
id: "layer_component_isolation"
name: "Layer: Component Isolation"
description: |
  Components in the components/ directory should not import directly from
  stores/. Dumb components receive data via props. Smart containers may
  import stores but should be explicitly classified.

type: "structural"
severity: "warning"

rule:
  detect:
    edge_type: "imports"
    source_layer: "components"
    target_layer: "stores"

  exempt_when:
    - source_classification: "smart"
    - source_name_pattern: "*Container.svelte"
    - explicit_annotation: "// akg-smart-component"

adr_reference: null  # No ADR yet, document in CONVENTIONS.md
rationale: |
  Smart/dumb component separation improves testability and reusability.
  Documented in .claude/CONVENTIONS.md.
```

### 3.2 Implementation

```typescript
// src/tools/akg/invariants/definitions/layer-component-isolation.ts

import type { InvariantCheckFn } from '../checker';
import type { InvariantViolation } from '../../schema/invariant.schema';
import type { AKGNode, AKGEdge } from '../../schema/graph.schema';

export const layerComponentIsolation: InvariantCheckFn = (graph, engine) => {
  const violations: InvariantViolation[] = [];

  // Get all import edges from components to stores
  const componentNodes = graph.nodes.filter(
    n => n.attributes.layer === 'components'
  );

  for (const component of componentNodes) {
    // Skip if explicitly classified as smart
    if (component.attributes.classification === 'smart') continue;

    // Skip if name contains "Container"
    if (component.name.includes('Container')) continue;

    // Get outgoing import edges
    const imports = engine.getOutgoingEdges(component.id, 'imports');

    for (const edge of imports) {
      const targetNode = engine.getNode(edge.targetNodeId);

      // Check if importing from stores layer
      if (targetNode?.attributes.layer === 'stores') {
        violations.push({
          invariantId: 'layer_component_isolation',
          invariantName: 'Layer: Component Isolation',
          severity: 'warning',

          message: `Dumb component imports from stores/ directly`,

          suggestion: buildSuggestion(component, targetNode),

          sourceNode: component.name,
          targetNode: targetNode.name,

          evidence: edge.evidence.map(e => ({
            filePath: e.filePath,
            line: e.startLine,
            snippet: e.snippet,
          })),
        });
      }
    }
  }

  return violations;
};

function buildSuggestion(component: AKGNode, store: AKGNode): string {
  const componentName = component.name.replace('.svelte', '');
  const storeName = store.name.replace('.svelte.ts', '');

  return `Option A: Convert to smart container
  - Rename to ${componentName}Container.svelte
  - Keep store import, add // akg-smart-component comment

Option B: Make component dumb (recommended for reusability)
  - Remove store import
  - Add prop for needed data: interface Props { ${storeName}Data: ... }
  - Let parent component subscribe to store and pass data

Option C: Add explicit annotation if this is intentionally smart
  - Add comment: // akg-smart-component: ${componentName} needs direct store access for [reason]`;
}
```

### 3.3 Classification Logic

```typescript
// src/tools/akg/discovery/analyzers/component-analyzer.ts

export function classifyComponent(
  imports: ImportInfo[],
  fileName: string,
  fileContent: string
): 'smart' | 'dumb' {
  // Check for explicit annotation
  if (fileContent.includes('// akg-smart-component')) {
    return 'smart';
  }

  // Check naming convention
  if (fileName.includes('Container')) {
    return 'smart';
  }

  // Check imports
  const hasStoreImport = imports.some(i =>
    i.moduleSpecifier.includes('/stores/') ||
    i.moduleSpecifier.includes('stores.')
  );

  const hasServiceImport = imports.some(i =>
    i.moduleSpecifier.includes('/services/')
  );

  // If it imports stores or services, it's smart (but may be unintentional)
  if (hasStoreImport || hasServiceImport) {
    return 'smart';  // Classified, but violation still raised
  }

  return 'dumb';
}
```

---

## Part 4: Expected Detection Output

### 4.1 CLI Output

```
pnpm akg:check

🔒 Checking invariants...

⚠️  layer_component_isolation (1 violation)
   - PlayerScore.svelte imports from stores/game.svelte.ts

     File: packages/web/src/lib/components/scorecard/PlayerScore.svelte:2
     Import: import { game } from '$lib/stores/game.svelte';

     💡 Option A: Convert to smart container
        - Rename to PlayerScoreContainer.svelte
        - Keep store import, add // akg-smart-component comment

     💡 Option B: Make component dumb (recommended for reusability)
        - Remove store import
        - Add prop for needed data: interface Props { score: number }
        - Let parent component subscribe to store and pass data

     💡 Option C: Add explicit annotation if this is intentionally smart
        - Add comment: // akg-smart-component: PlayerScore needs direct store access for [reason]

📊 Summary:
   Total: 8 invariants checked
   Passed: 7
   Failed: 1
   Errors: 0
   Warnings: 1

✅ No blocking violations. Warnings should be addressed.
```

### 4.2 JSON Output (for CI/MCP)

```json
{
  "invariantId": "layer_component_isolation",
  "passed": false,
  "violations": [
    {
      "invariantId": "layer_component_isolation",
      "invariantName": "Layer: Component Isolation",
      "severity": "warning",
      "message": "Dumb component imports from stores/ directly",
      "sourceNode": "PlayerScore.svelte",
      "targetNode": "game.svelte.ts",
      "evidence": [
        {
          "filePath": "packages/web/src/lib/components/scorecard/PlayerScore.svelte",
          "line": 2,
          "snippet": "import { game } from '$lib/stores/game.svelte';"
        }
      ],
      "suggestion": "Option A: Convert to smart container\n..."
    }
  ],
  "durationMs": 12,
  "checkedAt": "2025-12-05T10:30:00.000Z"
}
```

---

## Part 5: Resolution Paths

### 5.1 Resolution Path A: Convert to Smart Container

**When to use**: Component genuinely needs direct store access (e.g., subscribing to real-time updates)

```svelte
<!-- Rename: PlayerScore.svelte → PlayerScoreContainer.svelte -->
<script lang="ts">
  // akg-smart-component: Container for score display with live updates
  import { game } from '$lib/stores/game.svelte';
  import PlayerScoreDisplay from './PlayerScoreDisplay.svelte';

  const totalScore = $derived(game.totalScore);
</script>

<PlayerScoreDisplay score={totalScore} />
```

**Verification**:
```bash
pnpm akg:check
# ✅ layer_component_isolation passed (PlayerScoreContainer is smart)
```

### 5.2 Resolution Path B: Refactor to Dumb Component (Recommended)

**When to use**: Component can receive data as props (most cases)

```svelte
<!-- packages/web/src/lib/components/scorecard/PlayerScore.svelte -->
<script lang="ts">
  interface Props {
    score: number;
    label?: string;
  }

  let { score, label = 'Score' }: Props = $props();
</script>

<div class="player-score">
  <span class="label">{label}</span>
  <span class="value">{score}</span>
</div>
```

**Parent component handles subscription**:
```svelte
<!-- packages/web/src/lib/components/game/GameView.svelte -->
<script lang="ts">
  import { game } from '$lib/stores/game.svelte';
  import PlayerScore from '$lib/components/scorecard/PlayerScore.svelte';

  const totalScore = $derived(game.totalScore);
</script>

<PlayerScore score={totalScore} />
```

**Verification**:
```bash
pnpm akg:check
# ✅ layer_component_isolation passed (PlayerScore has no store imports)
```

### 5.3 Resolution Path C: Explicit Annotation

**When to use**: Legacy code that will be refactored later, or justified exception

```svelte
<script lang="ts">
  // akg-smart-component: Temporarily using store directly, see ticket #123
  import { game } from '$lib/stores/game.svelte';
  // ...
</script>
```

**Verification**:
```bash
pnpm akg:check
# ✅ layer_component_isolation passed (explicit annotation)
```

---

## Part 6: Test Fixtures

### 6.1 Valid Architecture (No Violation)

```typescript
// tests/tools/akg/invariants/fixtures/component-isolation-valid.ts

export const validComponentGraph: AKGGraph = {
  version: '1.0.0',
  generatedAt: new Date().toISOString(),
  projectRoot: '/test',
  nodes: [
    // Dumb component - only imports types
    {
      id: 'module::components::PlayerScore',
      type: 'Component',
      name: 'PlayerScore.svelte',
      filePath: 'src/lib/components/scorecard/PlayerScore.svelte',
      attributes: {
        layer: 'components',
        classification: 'dumb',
        hasStoreImport: false
      },
      metadata: { discoveredAt: new Date().toISOString(), confidence: 'high' }
    },
    // Types module (allowed import)
    {
      id: 'module::types::types',
      type: 'Module',
      name: 'types.ts',
      filePath: 'src/lib/types.ts',
      attributes: { layer: 'types' },
      metadata: { discoveredAt: new Date().toISOString(), confidence: 'high' }
    }
  ],
  edges: [
    // Only imports types - OK
    {
      id: 'imports::PlayerScore::types',
      type: 'imports',
      sourceNodeId: 'module::components::PlayerScore',
      targetNodeId: 'module::types::types',
      attributes: {},
      evidence: [],
      metadata: { discoveredAt: new Date().toISOString(), confidence: 'high' }
    }
  ],
  metadata: { totalFiles: 2, discoveryDurationMs: 10 }
};
```

### 6.2 Violation Case (Component Imports Store)

```typescript
// tests/tools/akg/invariants/fixtures/component-isolation-violation.ts

export const violationComponentGraph: AKGGraph = {
  version: '1.0.0',
  generatedAt: new Date().toISOString(),
  projectRoot: '/test',
  nodes: [
    // Dumb component importing store - VIOLATION
    {
      id: 'module::components::PlayerScore',
      type: 'Component',
      name: 'PlayerScore.svelte',
      filePath: 'src/lib/components/scorecard/PlayerScore.svelte',
      attributes: {
        layer: 'components',
        classification: 'dumb',  // Classified as dumb but has store import
        hasStoreImport: true
      },
      metadata: { discoveredAt: new Date().toISOString(), confidence: 'high' }
    },
    // Store module
    {
      id: 'module::stores::game',
      type: 'Store',
      name: 'game.svelte.ts',
      filePath: 'src/lib/stores/game.svelte.ts',
      attributes: { layer: 'stores' },
      metadata: { discoveredAt: new Date().toISOString(), confidence: 'high' }
    }
  ],
  edges: [
    // Component imports store - VIOLATION
    {
      id: 'imports::PlayerScore::game',
      type: 'imports',
      sourceNodeId: 'module::components::PlayerScore',
      targetNodeId: 'module::stores::game',
      attributes: {},
      evidence: [{
        filePath: 'src/lib/components/scorecard/PlayerScore.svelte',
        startLine: 2,
        endLine: 2,
        snippet: "import { game } from '$lib/stores/game.svelte';"
      }],
      metadata: { discoveredAt: new Date().toISOString(), confidence: 'high' }
    }
  ],
  metadata: { totalFiles: 2, discoveryDurationMs: 10 }
};
```

### 6.3 Smart Container (No Violation)

```typescript
// tests/tools/akg/invariants/fixtures/component-isolation-smart.ts

export const smartContainerGraph: AKGGraph = {
  version: '1.0.0',
  generatedAt: new Date().toISOString(),
  projectRoot: '/test',
  nodes: [
    // Smart container - store import is allowed
    {
      id: 'module::components::GameViewContainer',
      type: 'Component',
      name: 'GameViewContainer.svelte',
      filePath: 'src/lib/components/game/GameViewContainer.svelte',
      attributes: {
        layer: 'components',
        classification: 'smart',  // Explicitly smart
        hasStoreImport: true
      },
      metadata: { discoveredAt: new Date().toISOString(), confidence: 'high' }
    },
    // Store module
    {
      id: 'module::stores::game',
      type: 'Store',
      name: 'game.svelte.ts',
      filePath: 'src/lib/stores/game.svelte.ts',
      attributes: { layer: 'stores' },
      metadata: { discoveredAt: new Date().toISOString(), confidence: 'high' }
    }
  ],
  edges: [
    // Smart container imports store - OK
    {
      id: 'imports::GameViewContainer::game',
      type: 'imports',
      sourceNodeId: 'module::components::GameViewContainer',
      targetNodeId: 'module::stores::game',
      attributes: {},
      evidence: [],
      metadata: { discoveredAt: new Date().toISOString(), confidence: 'high' }
    }
  ],
  metadata: { totalFiles: 2, discoveryDurationMs: 10 }
};
```

### 6.4 Test Implementation

```typescript
// tests/tools/akg/invariants/layer-component-isolation.test.ts

import { describe, it, expect } from 'vitest';
import { layerComponentIsolation } from '@/tools/akg/invariants/definitions/layer-component-isolation';
import { AKGQueryEngine } from '@/tools/akg/query/engine';
import {
  validComponentGraph,
  violationComponentGraph,
  smartContainerGraph
} from './fixtures/component-isolation';

describe('layer_component_isolation invariant', () => {
  describe('valid architecture', () => {
    it('should pass when dumb component only imports types', () => {
      const engine = new AKGQueryEngine(validComponentGraph);
      const violations = layerComponentIsolation(validComponentGraph, engine);

      expect(violations).toHaveLength(0);
    });
  });

  describe('violation detection', () => {
    it('should detect dumb component importing store', () => {
      const engine = new AKGQueryEngine(violationComponentGraph);
      const violations = layerComponentIsolation(violationComponentGraph, engine);

      expect(violations).toHaveLength(1);
      expect(violations[0]).toMatchObject({
        invariantId: 'layer_component_isolation',
        severity: 'warning',
        sourceNode: 'PlayerScore.svelte',
        targetNode: 'game.svelte.ts'
      });
    });

    it('should provide actionable suggestion', () => {
      const engine = new AKGQueryEngine(violationComponentGraph);
      const violations = layerComponentIsolation(violationComponentGraph, engine);

      expect(violations[0].suggestion).toContain('Option A');
      expect(violations[0].suggestion).toContain('Option B');
      expect(violations[0].suggestion).toContain('smart container');
    });

    it('should include evidence with line number', () => {
      const engine = new AKGQueryEngine(violationComponentGraph);
      const violations = layerComponentIsolation(violationComponentGraph, engine);

      expect(violations[0].evidence).toHaveLength(1);
      expect(violations[0].evidence[0]).toMatchObject({
        line: 2,
        snippet: expect.stringContaining('import')
      });
    });
  });

  describe('smart container exemption', () => {
    it('should not flag smart containers', () => {
      const engine = new AKGQueryEngine(smartContainerGraph);
      const violations = layerComponentIsolation(smartContainerGraph, engine);

      expect(violations).toHaveLength(0);
    });

    it('should not flag components with Container suffix', () => {
      // Container suffix implies smart even without explicit classification
      const graphWithContainerSuffix = {
        ...violationComponentGraph,
        nodes: violationComponentGraph.nodes.map(n =>
          n.id.includes('PlayerScore')
            ? { ...n, name: 'PlayerScoreContainer.svelte', attributes: { ...n.attributes, classification: undefined } }
            : n
        )
      };

      const engine = new AKGQueryEngine(graphWithContainerSuffix);
      const violations = layerComponentIsolation(graphWithContainerSuffix, engine);

      expect(violations).toHaveLength(0);
    });
  });
});
```

---

## Part 7: Real-World Analysis

### 7.1 Current Dicee Codebase Status

Components that import stores directly (found in codebase):

| Component | Store Import | Classification | Verdict |
|-----------|--------------|----------------|---------|
| `AuthStatusCard.svelte` | `auth.svelte` | Functions as smart | ⚠️ Should add annotation |
| `PlayNowButton.svelte` | `auth.svelte` | Functions as smart | ⚠️ Should add annotation |
| `HeroGame.svelte` | `game.svelte` | Smart container | ⚠️ Should add annotation |
| `Die.svelte` | None | Dumb | ✅ Correct |
| `CategoryRow.svelte` | None | Dumb | ✅ Correct |

### 7.2 Recommended Pre-AKG Cleanup

Before enabling this invariant, annotate existing smart components:

```bash
# Add annotations to known smart components
grep -l "from '\$lib/stores/" packages/web/src/lib/components/**/*.svelte | while read f; do
  echo "Review: $f"
done
```

Add to each:
```svelte
<script lang="ts">
// akg-smart-component: [reason for direct store access]
```

---

## Part 8: Agent Integration

### 8.1 MCP Tool Response

When agent queries for component status:

```typescript
// mcp__project-akg__check_component
{
  "component": "PlayerScore.svelte",
  "classification": "dumb",
  "violations": [{
    "invariant": "layer_component_isolation",
    "severity": "warning",
    "message": "Dumb component imports from stores/ directly"
  }],
  "recommendation": "Convert to dumb component by replacing store import with prop"
}
```

### 8.2 Agent Decision Protocol

```markdown
## Before Creating a Component

1. Does the component need to subscribe to a store?
   - NO → Create dumb component with props
   - YES → Continue to step 2

2. Can the parent provide the data as props instead?
   - YES → Create dumb component, parent handles subscription
   - NO → Continue to step 3

3. Create smart container:
   - Name with "Container" suffix OR
   - Add `// akg-smart-component: [reason]` annotation
   - Document why direct store access is needed
```

---

## Part 9: Metrics & Effectiveness

### 9.1 Expected Metrics After 4 Weeks

| Metric | Target | Measurement |
|--------|--------|-------------|
| Violations caught | ≥ 3 | CI logs |
| False positive rate | < 10% | Manual review of overrides |
| Fix rate | > 80% | Violations resolved within 1 week |
| Smart component annotations | 100% | All existing smart components documented |

### 9.2 Adjustment Triggers

- **If false positive rate > 20%**: Add more exemption patterns
- **If 0 violations after 4 weeks**: Check detection is working, or codebase is already clean
- **If agents consistently override**: Review if invariant is too strict

---

## Appendix A: File Locations

| File | Purpose |
|------|---------|
| `src/tools/akg/invariants/definitions/layer-component-isolation.ts` | Invariant implementation |
| `tests/tools/akg/invariants/layer-component-isolation.test.ts` | Unit tests |
| `tests/tools/akg/invariants/fixtures/component-isolation.ts` | Test fixtures |
| `docs/architecture/akg/invariants/layer-component-isolation.yaml` | Specification |

---

## Appendix B: Related Invariants

| Invariant | Relationship |
|-----------|--------------|
| `service_layer_boundaries` | Similar pattern for services |
| `store_no_circular_deps` | May interact if component creates cycle |
| `callback_prop_naming` | Often violated together |

---

**Simulation Status**: Ready for implementation in Week 4.

**Next Steps**:
1. ✅ Design complete
2. ⏳ Implement invariant (Week 4)
3. ⏳ Add test fixtures (Week 4)
4. ⏳ Pre-annotate existing smart components
5. ⏳ Enable in CI
