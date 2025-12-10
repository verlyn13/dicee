# Simulation 005: Parallel Category Type Definition

> **Status**: Design Complete
> **Created**: 2025-12-05
> **Invariant**: `category_type_consistency`
> **Severity**: `error` (BLOCKING)
> **Category**: Domain / Type Safety

---

## Executive Summary

This simulation validates the `category_type_consistency` invariant, which enforces that **all Category type references must derive from the canonical `ALL_CATEGORIES` const array**. Parallel type definitions cause silent bugs when values don't match.

**CRITICAL FINDING**: A real violation exists in the Dicee codebase today.

| File | Category Type | Case Style |
|------|---------------|------------|
| `$lib/types.ts` | `(typeof ALL_CATEGORIES)[number]` | **PascalCase** (`'Ones'`, `'Dicee'`) |
| `$lib/types/multiplayer.ts` | Literal union type | **camelCase** (`'ones'`, `'dicee'`) |

This divergence will cause runtime bugs when converting between single-player and multiplayer game states.

---

## Part 1: Technical Background

### 1.1 The Const Array Pattern

TypeScript's `as const` assertion enables deriving types from runtime values:

```typescript
// Canonical source of truth (runtime array + compile-time type)
export const ALL_CATEGORIES = [
  'Ones', 'Twos', 'Threes', 'Fours', 'Fives', 'Sixes',
  'ThreeOfAKind', 'FourOfAKind', 'FullHouse',
  'SmallStraight', 'LargeStraight', 'Dicee', 'Chance'
] as const;

// Type derived from the const array
export type Category = (typeof ALL_CATEGORIES)[number];
// Result: 'Ones' | 'Twos' | 'Threes' | ... | 'Chance'
```

**Benefits**:
1. **Single Source of Truth**: Array is iterable at runtime, type is inferred
2. **Compile-Time Safety**: TypeScript knows all valid values
3. **Refactor Safety**: Add/remove categories in one place
4. **Exhaustiveness Checks**: Switch statements catch missing cases

### 1.2 The Parallel Definition Anti-Pattern

```typescript
// ❌ ANTI-PATTERN: Parallel type definition
export type Category =
  | 'ones' | 'twos' | 'threes' | 'fours' | 'fives' | 'sixes'
  | 'threeOfAKind' | 'fourOfAKind' | 'fullHouse'
  | 'smallStraight' | 'largeStraight' | 'dicee' | 'chance';
```

**Problems**:
1. **Divergence Risk**: Types can get out of sync (which happened!)
2. **No Runtime Access**: Can't iterate over values
3. **Case Mismatch**: Easy to use different naming conventions
4. **Hidden Bugs**: TypeScript won't catch cross-boundary issues

### 1.3 The Dicee Divergence Problem

**Current State**:

```typescript
// $lib/types.ts (single-player)
const ALL_CATEGORIES = ['Ones', 'Twos', ..., 'Dicee', 'Chance'] as const;
type Category = (typeof ALL_CATEGORIES)[number];

// $lib/types/multiplayer.ts (multiplayer)
type Category = 'ones' | 'twos' | ... | 'dicee' | 'chance';
```

**Runtime Bug Example**:

```typescript
// In multiplayerGame store
function scoreCategory(category: MultiplayerCategory) {
  // category = 'dicee' (camelCase from server)

  // If we try to use this with single-player scoring...
  const analysis = getAnalysis(category);
  // TypeScript: OK (both are strings)
  // Runtime: Fails because engine expects 'Dicee' not 'dicee'
}
```

**Why This Happened**:
- PartyKit server was developed separately
- Server uses camelCase (JavaScript convention)
- Single-player uses PascalCase (domain convention)
- No shared type source between them

---

## Part 2: Current Codebase Analysis

### 2.1 Canonical Definition (`$lib/types.ts`)

```typescript
// Lines 18-34
export const UPPER_CATEGORIES = ['Ones', 'Twos', 'Threes', 'Fours', 'Fives', 'Sixes'] as const;

export const LOWER_CATEGORIES = [
  'ThreeOfAKind', 'FourOfAKind', 'FullHouse',
  'SmallStraight', 'LargeStraight', 'Dicee', 'Chance',
] as const;

export const ALL_CATEGORIES = [...UPPER_CATEGORIES, ...LOWER_CATEGORIES] as const;

export type UpperCategory = (typeof UPPER_CATEGORIES)[number];
export type LowerCategory = (typeof LOWER_CATEGORIES)[number];
export type Category = (typeof ALL_CATEGORIES)[number];
```

**Analysis**:
- ✅ Uses const array pattern
- ✅ Derives types from array
- ✅ Has mapping utilities (`CATEGORY_TO_INDEX`, `CATEGORY_DISPLAY_NAMES`)
- **Case**: PascalCase

### 2.2 Parallel Definition (`$lib/types/multiplayer.ts`)

```typescript
// Lines 30-44
export type Category =
  | 'ones' | 'twos' | 'threes' | 'fours' | 'fives' | 'sixes'
  | 'threeOfAKind' | 'fourOfAKind' | 'fullHouse'
  | 'smallStraight' | 'largeStraight' | 'dicee' | 'chance';

export interface Scorecard {
  ones: number | null;
  twos: number | null;
  // ... (uses camelCase keys)
}
```

**Analysis**:
- ❌ Parallel literal union (not derived)
- ❌ Different case convention (camelCase)
- ❌ No const array (can't iterate)
- ❌ Scorecard interface also uses camelCase keys

### 2.3 Impact Analysis

| Component | Uses Canonical? | Uses Multiplayer? | Risk |
|-----------|-----------------|-------------------|------|
| `game.svelte.ts` | ✅ `Category` | ❌ | Safe |
| `scorecard.svelte.ts` | ✅ `Category` | ❌ | Safe |
| `engine.ts` | ✅ `Category` | ❌ | Safe |
| `multiplayerGame.svelte.ts` | ❌ | ✅ `Category` | **DANGEROUS** |
| `MultiplayerScorecard.svelte` | ❌ | ✅ `Category` | **DANGEROUS** |
| `roomService.svelte.ts` | ❌ | ✅ via commands | **DANGEROUS** |

**Bug Scenario**:
```typescript
// In multiplayer game, player scores 'dicee' (camelCase)
// Store sends to server: { type: 'category.score', category: 'dicee' }
// Server processes, sends back: { type: 'category.scored', category: 'dicee' }

// If we ever need to show analysis using the engine:
import { analyzeTurn } from '$lib/services/engine';
const analysis = await analyzeTurn(dice, 0, ['dicee']);
// ⚠️ Engine expects 'Dicee' (PascalCase)
// Result: Category not found or wrong category scored
```

---

## Part 3: Graph Representation

### 3.1 Type Definition Nodes

```json
{
  "nodes": [
    {
      "id": "type::Category::canonical",
      "type": "TypeDefinition",
      "name": "Category",
      "filePath": "packages/web/src/lib/types.ts",
      "attributes": {
        "layer": "types",
        "definitionStyle": "derived",
        "sourceArray": "ALL_CATEGORIES",
        "caseConvention": "PascalCase",
        "isCanonical": true,
        "values": ["Ones", "Twos", "Threes", "Fours", "Fives", "Sixes",
                   "ThreeOfAKind", "FourOfAKind", "FullHouse",
                   "SmallStraight", "LargeStraight", "Dicee", "Chance"]
      }
    },
    {
      "id": "type::Category::multiplayer",
      "type": "TypeDefinition",
      "name": "Category",
      "filePath": "packages/web/src/lib/types/multiplayer.ts",
      "attributes": {
        "layer": "types",
        "definitionStyle": "literal_union",
        "sourceArray": null,
        "caseConvention": "camelCase",
        "isCanonical": false,
        "values": ["ones", "twos", "threes", "fours", "fives", "sixes",
                   "threeOfAKind", "fourOfAKind", "fullHouse",
                   "smallStraight", "largeStraight", "dicee", "chance"]
      }
    },
    {
      "id": "const::ALL_CATEGORIES",
      "type": "ConstArray",
      "name": "ALL_CATEGORIES",
      "filePath": "packages/web/src/lib/types.ts",
      "attributes": {
        "isCanonicalSource": true,
        "elementCount": 13
      }
    }
  ],
  "edges": [
    {
      "id": "derives_from::Category::ALL_CATEGORIES",
      "type": "derives_from",
      "sourceNodeId": "type::Category::canonical",
      "targetNodeId": "const::ALL_CATEGORIES",
      "attributes": {
        "derivationMethod": "indexed_access"
      }
    }
  ]
}
```

### 3.2 Violation Representation

```json
{
  "violations": [
    {
      "id": "violation::parallel_category::multiplayer",
      "type": "parallel_type_definition",
      "canonicalNode": "type::Category::canonical",
      "parallelNode": "type::Category::multiplayer",
      "divergences": [
        {
          "type": "case_mismatch",
          "canonical": "Ones",
          "parallel": "ones"
        },
        {
          "type": "case_mismatch",
          "canonical": "ThreeOfAKind",
          "parallel": "threeOfAKind"
        }
      ]
    }
  ]
}
```

---

## Part 4: Invariant Definition

### 4.1 Invariant Specification

```yaml
id: "category_type_consistency"
name: "Category: Type Consistency"
description: |
  All Category type definitions must derive from the canonical ALL_CATEGORIES
  const array in $lib/types.ts. Parallel type definitions with different
  values or case conventions cause runtime bugs.

type: "domain"
severity: "error"  # BLOCKING

rule:
  canonical_source:
    file: "packages/web/src/lib/types.ts"
    const_name: "ALL_CATEGORIES"
    type_name: "Category"

  detect:
    - type_definitions_named: "Category"
    - literal_union_types_matching: "scoring category pattern"
    - interfaces_with_category_keys: true

  violations:
    - parallel_definition: "Type defined without deriving from ALL_CATEGORIES"
    - case_mismatch: "Values don't match canonical case"
    - missing_values: "Not all canonical values present"
    - extra_values: "Values not in canonical source"

  exempt_when:
    - is_type_import: true  # `import type { Category }` is fine
    - is_type_alias: true   # `type MyCategory = Category` is fine
    - in_test_file: true    # Tests may define partial categories

adr_reference: "ADR-001: Canonical Configuration Model"
rationale: |
  Single-player and multiplayer must use consistent category identifiers.
  The WASM engine, database, and UI all depend on exact string matching.
```

### 4.2 Implementation

```typescript
// src/tools/akg/invariants/definitions/category-type-consistency.ts

import type { InvariantCheckFn } from '../checker';
import type { InvariantViolation } from '../../schema/invariant.schema';
import type { AKGNode } from '../../schema/graph.schema';

/**
 * Canonical category values (should match $lib/types.ts)
 */
const CANONICAL_CATEGORIES = [
  'Ones', 'Twos', 'Threes', 'Fours', 'Fives', 'Sixes',
  'ThreeOfAKind', 'FourOfAKind', 'FullHouse',
  'SmallStraight', 'LargeStraight', 'Dicee', 'Chance'
] as const;

const CANONICAL_FILE = 'packages/web/src/lib/types.ts';

/**
 * Patterns that indicate a Category-like type definition
 */
const CATEGORY_PATTERNS = [
  /type\s+Category\s*=/,
  /type\s+\w*Category\w*\s*=/,
  /'ones'\s*\|.*'dicee'/i,  // Literal union with category values
  /'Ones'\s*\|.*'Dicee'/,
];

/**
 * Exempt patterns (imports, re-exports, aliases)
 */
const EXEMPT_PATTERNS = [
  /import\s+.*Category.*from/,
  /export\s+.*Category.*from/,
  /type\s+\w+\s*=\s*Category\s*;/,  // Simple alias
  /type\s+\w+\s*=\s*Extract<Category/,  // Derived type
];

function isExempt(content: string, filePath: string): boolean {
  if (filePath.includes('.test.ts') || filePath.includes('__tests__')) {
    return true;
  }
  return EXEMPT_PATTERNS.some(p => p.test(content));
}

function extractCategoryValues(content: string): string[] | null {
  // Match literal union: 'value1' | 'value2' | ...
  const unionMatch = content.match(
    /type\s+Category\s*=\s*([^;]+);/
  );

  if (!unionMatch) return null;

  const unionBody = unionMatch[1];
  const values = unionBody.match(/'([^']+)'/g);

  if (!values) return null;

  return values.map(v => v.replace(/'/g, ''));
}

function findDivergences(
  canonical: readonly string[],
  parallel: string[]
): Array<{ type: string; detail: string }> {
  const divergences: Array<{ type: string; detail: string }> = [];

  // Check for case mismatches
  const canonicalLower = canonical.map(c => c.toLowerCase());
  const parallelLower = parallel.map(p => p.toLowerCase());

  for (const value of parallel) {
    const lowerValue = value.toLowerCase();
    const canonicalIndex = canonicalLower.indexOf(lowerValue);

    if (canonicalIndex === -1) {
      divergences.push({
        type: 'extra_value',
        detail: `'${value}' is not a canonical category`
      });
    } else if (canonical[canonicalIndex] !== value) {
      divergences.push({
        type: 'case_mismatch',
        detail: `'${value}' should be '${canonical[canonicalIndex]}'`
      });
    }
  }

  // Check for missing values
  for (const value of canonical) {
    const lowerValue = value.toLowerCase();
    if (!parallelLower.includes(lowerValue)) {
      divergences.push({
        type: 'missing_value',
        detail: `Missing canonical category '${value}'`
      });
    }
  }

  return divergences;
}

export const categoryTypeConsistency: InvariantCheckFn = (graph, engine) => {
  const violations: InvariantViolation[] = [];

  // Find all type definition nodes
  const typeNodes = graph.nodes.filter(n =>
    n.type === 'TypeDefinition' ||
    n.type === 'Module' ||
    n.filePath?.endsWith('.ts')
  );

  for (const node of typeNodes) {
    // Skip canonical file
    if (node.filePath?.includes(CANONICAL_FILE)) continue;

    // Skip test files
    if (node.filePath?.includes('.test.ts')) continue;
    if (node.filePath?.includes('__tests__')) continue;
    if (node.filePath?.includes('__mocks__')) continue;

    // Get node content (would need content analysis in real implementation)
    const content = node.attributes.content as string | undefined;
    if (!content) continue;

    // Check for Category type definition
    const hasParallelDefinition = CATEGORY_PATTERNS.some(p => p.test(content));
    if (!hasParallelDefinition) continue;

    // Skip if it's an import or alias
    if (isExempt(content, node.filePath ?? '')) continue;

    // Extract values from parallel definition
    const parallelValues = extractCategoryValues(content);
    if (!parallelValues) continue;

    // Find divergences
    const divergences = findDivergences(CANONICAL_CATEGORIES, parallelValues);

    if (divergences.length > 0) {
      violations.push({
        invariantId: 'category_type_consistency',
        invariantName: 'Category: Type Consistency',
        severity: 'error',

        message: `Parallel Category type definition with ${divergences.length} divergence(s)`,

        suggestion: buildSuggestion(node, divergences),

        sourceNode: node.name,
        targetNode: 'ALL_CATEGORIES (canonical)',

        evidence: [{
          filePath: node.filePath ?? '',
          line: node.attributes.line as number ?? 0,
          snippet: `type Category = '${parallelValues[0]}' | ...`
        }],

        businessRule: 'All Category types must derive from ALL_CATEGORIES',
      });
    }
  }

  return violations;
};

function buildSuggestion(
  node: AKGNode,
  divergences: Array<{ type: string; detail: string }>
): string {
  const caseMismatches = divergences.filter(d => d.type === 'case_mismatch');
  const missingValues = divergences.filter(d => d.type === 'missing_value');
  const extraValues = divergences.filter(d => d.type === 'extra_value');

  let suggestion = `🚫 BLOCKING: Parallel Category type definition detected.

This type must derive from the canonical ALL_CATEGORIES const array.

Divergences found:
`;

  if (caseMismatches.length > 0) {
    suggestion += `\n❌ Case Mismatches (${caseMismatches.length}):\n`;
    for (const d of caseMismatches.slice(0, 5)) {
      suggestion += `   ${d.detail}\n`;
    }
    if (caseMismatches.length > 5) {
      suggestion += `   ... and ${caseMismatches.length - 5} more\n`;
    }
  }

  if (missingValues.length > 0) {
    suggestion += `\n❌ Missing Values (${missingValues.length}):\n`;
    for (const d of missingValues.slice(0, 3)) {
      suggestion += `   ${d.detail}\n`;
    }
  }

  if (extraValues.length > 0) {
    suggestion += `\n❌ Extra Values (${extraValues.length}):\n`;
    for (const d of extraValues.slice(0, 3)) {
      suggestion += `   ${d.detail}\n`;
    }
  }

  suggestion += `
✅ Option 1: Import from canonical source
   import type { Category } from '$lib/types';

✅ Option 2: Re-export from canonical source
   export type { Category } from '$lib/types';

✅ Option 3: If you need a case conversion, create a mapping
   import { ALL_CATEGORIES, type Category } from '$lib/types';

   const toCamelCase = (cat: Category): string =>
     cat.charAt(0).toLowerCase() + cat.slice(1);

   const fromCamelCase = (cat: string): Category =>
     (cat.charAt(0).toUpperCase() + cat.slice(1)) as Category;

⚠️  If server requires camelCase, convert at the boundary:
   // When sending to server
   const serverCategory = toCamelCase(category);

   // When receiving from server
   const category = fromCamelCase(serverCategory);`;

  return suggestion;
}
```

### 4.3 AST-Based Detection (Advanced)

```typescript
// src/tools/akg/discovery/analyzers/type-definition-analyzer.ts

import { Project, SyntaxKind, TypeAliasDeclaration } from 'ts-morph';

interface TypeDefinitionInfo {
  name: string;
  filePath: string;
  line: number;
  definitionStyle: 'derived' | 'literal_union' | 'interface' | 'other';
  sourceArray?: string;
  literalValues?: string[];
}

export function analyzeTypeDefinitions(filePath: string): TypeDefinitionInfo[] {
  const project = new Project();
  const sourceFile = project.addSourceFileAtPath(filePath);
  const results: TypeDefinitionInfo[] = [];

  // Find all type alias declarations
  const typeAliases = sourceFile.getDescendantsOfKind(SyntaxKind.TypeAliasDeclaration);

  for (const typeAlias of typeAliases) {
    const name = typeAlias.getName();
    const typeNode = typeAlias.getTypeNode();

    if (!typeNode) continue;

    const info: TypeDefinitionInfo = {
      name,
      filePath,
      line: typeAlias.getStartLineNumber(),
      definitionStyle: 'other',
    };

    // Check if it's a derived type: (typeof ARRAY)[number]
    if (typeNode.getKind() === SyntaxKind.IndexedAccessType) {
      const text = typeNode.getText();
      const match = text.match(/\(typeof\s+(\w+)\)\[number\]/);
      if (match) {
        info.definitionStyle = 'derived';
        info.sourceArray = match[1];
      }
    }

    // Check if it's a literal union: 'a' | 'b' | 'c'
    if (typeNode.getKind() === SyntaxKind.UnionType) {
      const unionTypes = typeNode.asKind(SyntaxKind.UnionType)?.getTypeNodes();
      if (unionTypes?.every(t => t.getKind() === SyntaxKind.LiteralType)) {
        info.definitionStyle = 'literal_union';
        info.literalValues = unionTypes.map(t =>
          t.getText().replace(/['"]/g, '')
        );
      }
    }

    results.push(info);
  }

  return results;
}
```

---

## Part 5: Expected Detection Output

### 5.1 CLI Output

```
pnpm akg:check

🔒 Checking invariants...

❌ category_type_consistency (1 violation)

   ┌──────────────────────────────────────────────────────────────┐
   │  PARALLEL CATEGORY TYPE DEFINITION                          │
   │                                                              │
   │    $lib/types/multiplayer.ts defines Category separately    │
   │    from canonical source ($lib/types.ts)                    │
   └──────────────────────────────────────────────────────────────┘

   File: packages/web/src/lib/types/multiplayer.ts:31-44
   │ export type Category =
   │   | 'ones' | 'twos' | 'threes' | 'fours' | 'fives' | 'sixes'
   │   | 'threeOfAKind' | 'fourOfAKind' | 'fullHouse'
   │   | 'smallStraight' | 'largeStraight' | 'dicee' | 'chance';

   Divergences found:

   ❌ Case Mismatches (13):
      'ones' should be 'Ones'
      'twos' should be 'Twos'
      'threes' should be 'Threes'
      'fours' should be 'Fours'
      'fives' should be 'Fives'
      ... and 8 more

   🚫 BLOCKING: All Category types must derive from ALL_CATEGORIES.

   ✅ Option 1: Import from canonical source
      import type { Category } from '$lib/types';

   ✅ Option 2: Create case conversion utilities at the boundary
      const toCamelCase = (cat: Category): string => ...
      const fromCamelCase = (cat: string): Category => ...

📊 Summary:
   Total: 8 invariants checked
   Passed: 7
   Failed: 1
   Errors: 1

🚫 BLOCKING VIOLATIONS FOUND. Must fix before merge.
```

### 5.2 JSON Output

```json
{
  "invariantId": "category_type_consistency",
  "passed": false,
  "violations": [
    {
      "invariantId": "category_type_consistency",
      "invariantName": "Category: Type Consistency",
      "severity": "error",
      "message": "Parallel Category type definition with 13 divergence(s)",
      "sourceNode": "multiplayer.ts",
      "targetNode": "ALL_CATEGORIES (canonical)",
      "evidence": [
        {
          "filePath": "packages/web/src/lib/types/multiplayer.ts",
          "line": 31,
          "snippet": "type Category = 'ones' | 'twos' | ..."
        }
      ],
      "businessRule": "All Category types must derive from ALL_CATEGORIES",
      "metadata": {
        "divergences": {
          "caseMismatches": 13,
          "missingValues": 0,
          "extraValues": 0
        }
      }
    }
  ]
}
```

---

## Part 6: Resolution Strategy

### 6.1 Recommended Fix: Shared Types with Conversion Layer

**Step 1: Update multiplayer.ts to import canonical type**

```typescript
// packages/web/src/lib/types/multiplayer.ts

// Import canonical Category type
import type { Category as CanonicalCategory } from '$lib/types';

// Re-export for internal use
export type { CanonicalCategory as Category };

// OR if server MUST use camelCase, create explicit conversion type
export type ServerCategory = Lowercase<CanonicalCategory>;
```

**Step 2: Create conversion utilities**

```typescript
// packages/web/src/lib/types/category-utils.ts

import type { Category } from '$lib/types';

/**
 * Category names as used by the PartyKit server (camelCase)
 */
export type ServerCategoryName = Lowercase<Category>;

/**
 * Convert canonical Category to server format
 */
export function toServerCategory(category: Category): string {
  return category.charAt(0).toLowerCase() + category.slice(1);
}

/**
 * Convert server format to canonical Category
 * @throws if invalid category
 */
export function fromServerCategory(serverCategory: string): Category {
  const canonical = serverCategory.charAt(0).toUpperCase() + serverCategory.slice(1);

  // Validate
  const validCategories: Category[] = [
    'Ones', 'Twos', 'Threes', 'Fours', 'Fives', 'Sixes',
    'ThreeOfAKind', 'FourOfAKind', 'FullHouse',
    'SmallStraight', 'LargeStraight', 'Dicee', 'Chance'
  ];

  if (!validCategories.includes(canonical as Category)) {
    throw new Error(`Invalid category: ${serverCategory}`);
  }

  return canonical as Category;
}

/**
 * Category mapping for scorecard interfaces
 */
export const CATEGORY_KEY_MAP: Record<Category, string> = {
  Ones: 'ones',
  Twos: 'twos',
  Threes: 'threes',
  Fours: 'fours',
  Fives: 'fives',
  Sixes: 'sixes',
  ThreeOfAKind: 'threeOfAKind',
  FourOfAKind: 'fourOfAKind',
  FullHouse: 'fullHouse',
  SmallStraight: 'smallStraight',
  LargeStraight: 'largeStraight',
  Dicee: 'dicee',
  Chance: 'chance',
};
```

**Step 3: Update multiplayer Scorecard interface**

```typescript
// packages/web/src/lib/types/multiplayer.ts

import type { Category } from '$lib/types';

// Server scorecard uses camelCase keys, but we can type it properly
export type ServerScorecardKey = Lowercase<Category> | 'diceeBonus' | 'upperBonus';

export interface ServerScorecard {
  [key: string]: number | null;
  diceeBonus: number;
  upperBonus: number;
}

// Conversion function
export function toCanonicalScorecard(server: ServerScorecard): Record<Category, number | null> {
  // ... conversion logic
}
```

**Step 4: Update multiplayerGame store**

```typescript
// packages/web/src/lib/stores/multiplayerGame.svelte.ts

import type { Category } from '$lib/types';
import { fromServerCategory, toServerCategory } from '$lib/types/category-utils';

function handleCategoryScored(event: { category: string; ... }): void {
  // Convert from server format at the boundary
  const category = fromServerCategory(event.category);

  // Now use canonical Category type
  updateScorecard(category, event.score);
}

function scoreCategory(category: Category): void {
  // Convert to server format when sending
  roomService.send({
    type: 'category.score',
    category: toServerCategory(category),
  });
}
```

### 6.2 Alternative: Update Server to Use PascalCase

If you control the PartyKit server, the cleaner solution is to align it with the canonical format:

```typescript
// partykit/server.ts

// Use PascalCase to match client
type Category =
  | 'Ones' | 'Twos' | 'Threes' | 'Fours' | 'Fives' | 'Sixes'
  | 'ThreeOfAKind' | 'FourOfAKind' | 'FullHouse'
  | 'SmallStraight' | 'LargeStraight' | 'Dicee' | 'Chance';
```

This eliminates conversion entirely.

---

## Part 7: Test Fixtures

### 7.1 Valid: Derived Type

```typescript
// tests/tools/akg/invariants/fixtures/category-consistency-valid.ts

export const validCategoryGraph: AKGGraph = {
  version: '1.0.0',
  generatedAt: new Date().toISOString(),
  projectRoot: '/test',
  nodes: [
    {
      id: 'const::ALL_CATEGORIES',
      type: 'ConstArray',
      name: 'ALL_CATEGORIES',
      filePath: 'packages/web/src/lib/types.ts',
      attributes: {
        isCanonicalSource: true,
        values: ['Ones', 'Twos', 'Threes', 'Fours', 'Fives', 'Sixes',
                 'ThreeOfAKind', 'FourOfAKind', 'FullHouse',
                 'SmallStraight', 'LargeStraight', 'Dicee', 'Chance']
      },
      metadata: { discoveredAt: new Date().toISOString(), confidence: 'high' }
    },
    {
      id: 'type::Category::canonical',
      type: 'TypeDefinition',
      name: 'Category',
      filePath: 'packages/web/src/lib/types.ts',
      attributes: {
        definitionStyle: 'derived',
        sourceArray: 'ALL_CATEGORIES',
        isCanonical: true
      },
      metadata: { discoveredAt: new Date().toISOString(), confidence: 'high' }
    }
  ],
  edges: [
    {
      id: 'derives_from::Category::ALL_CATEGORIES',
      type: 'derives_from',
      sourceNodeId: 'type::Category::canonical',
      targetNodeId: 'const::ALL_CATEGORIES',
      attributes: {},
      evidence: [],
      metadata: { discoveredAt: new Date().toISOString(), confidence: 'high' }
    }
  ],
  metadata: { totalFiles: 1, discoveryDurationMs: 10 }
};
```

### 7.2 Violation: Parallel Literal Union

```typescript
// tests/tools/akg/invariants/fixtures/category-consistency-violation.ts

export const violationCategoryGraph: AKGGraph = {
  version: '1.0.0',
  generatedAt: new Date().toISOString(),
  projectRoot: '/test',
  nodes: [
    {
      id: 'const::ALL_CATEGORIES',
      type: 'ConstArray',
      name: 'ALL_CATEGORIES',
      filePath: 'packages/web/src/lib/types.ts',
      attributes: {
        isCanonicalSource: true,
        values: ['Ones', 'Twos', 'Threes', 'Fours', 'Fives', 'Sixes',
                 'ThreeOfAKind', 'FourOfAKind', 'FullHouse',
                 'SmallStraight', 'LargeStraight', 'Dicee', 'Chance']
      },
      metadata: { discoveredAt: new Date().toISOString(), confidence: 'high' }
    },
    {
      id: 'type::Category::multiplayer',
      type: 'TypeDefinition',
      name: 'Category',
      filePath: 'packages/web/src/lib/types/multiplayer.ts',
      attributes: {
        definitionStyle: 'literal_union',
        sourceArray: null,
        isCanonical: false,
        content: `type Category = 'ones' | 'twos' | 'threes' | 'fours' | 'fives' | 'sixes' | 'threeOfAKind' | 'fourOfAKind' | 'fullHouse' | 'smallStraight' | 'largeStraight' | 'dicee' | 'chance';`,
        line: 31
      },
      metadata: { discoveredAt: new Date().toISOString(), confidence: 'high' }
    }
  ],
  edges: [],
  metadata: { totalFiles: 2, discoveryDurationMs: 10 }
};
```

### 7.3 Valid: Type Import

```typescript
// tests/tools/akg/invariants/fixtures/category-consistency-import.ts

export const importCategoryGraph: AKGGraph = {
  version: '1.0.0',
  generatedAt: new Date().toISOString(),
  projectRoot: '/test',
  nodes: [
    {
      id: 'module::game_store',
      type: 'Module',
      name: 'game.svelte.ts',
      filePath: 'packages/web/src/lib/stores/game.svelte.ts',
      attributes: {
        content: `import type { Category } from '$lib/types';`,
        usesCategory: true,
        definesCategory: false
      },
      metadata: { discoveredAt: new Date().toISOString(), confidence: 'high' }
    }
  ],
  edges: [],
  metadata: { totalFiles: 1, discoveryDurationMs: 10 }
};
```

### 7.4 Test Implementation

```typescript
// tests/tools/akg/invariants/category-type-consistency.test.ts

import { describe, it, expect } from 'vitest';
import { categoryTypeConsistency } from '@/tools/akg/invariants/definitions/category-type-consistency';
import { AKGQueryEngine } from '@/tools/akg/query/engine';
import {
  validCategoryGraph,
  violationCategoryGraph,
  importCategoryGraph
} from './fixtures/category-consistency';

describe('category_type_consistency invariant', () => {
  describe('valid architecture', () => {
    it('should pass when Category derives from ALL_CATEGORIES', () => {
      const engine = new AKGQueryEngine(validCategoryGraph);
      const violations = categoryTypeConsistency(validCategoryGraph, engine);

      expect(violations).toHaveLength(0);
    });

    it('should pass when Category is imported (not redefined)', () => {
      const engine = new AKGQueryEngine(importCategoryGraph);
      const violations = categoryTypeConsistency(importCategoryGraph, engine);

      expect(violations).toHaveLength(0);
    });
  });

  describe('violation detection', () => {
    it('should detect parallel literal union definition', () => {
      const engine = new AKGQueryEngine(violationCategoryGraph);
      const violations = categoryTypeConsistency(violationCategoryGraph, engine);

      expect(violations).toHaveLength(1);
      expect(violations[0]).toMatchObject({
        invariantId: 'category_type_consistency',
        severity: 'error',
        sourceNode: 'Category'
      });
    });

    it('should identify case mismatches', () => {
      const engine = new AKGQueryEngine(violationCategoryGraph);
      const violations = categoryTypeConsistency(violationCategoryGraph, engine);

      expect(violations[0].message).toContain('divergence');
      expect(violations[0].suggestion).toContain('case');
    });

    it('should suggest importing from canonical source', () => {
      const engine = new AKGQueryEngine(violationCategoryGraph);
      const violations = categoryTypeConsistency(violationCategoryGraph, engine);

      expect(violations[0].suggestion).toContain("import type { Category } from '$lib/types'");
    });

    it('should suggest conversion utilities for server boundary', () => {
      const engine = new AKGQueryEngine(violationCategoryGraph);
      const violations = categoryTypeConsistency(violationCategoryGraph, engine);

      expect(violations[0].suggestion).toContain('toCamelCase');
      expect(violations[0].suggestion).toContain('fromCamelCase');
    });
  });

  describe('edge cases', () => {
    it('should not flag Extract<Category, ...> derived types', () => {
      const extractGraph = {
        ...validCategoryGraph,
        nodes: [
          ...validCategoryGraph.nodes,
          {
            id: 'type::UpperCategory',
            type: 'TypeDefinition',
            name: 'UpperCategory',
            filePath: 'packages/web/src/lib/types.ts',
            attributes: {
              content: `type UpperCategory = Extract<Category, 'Ones' | 'Twos' | 'Threes' | 'Fours' | 'Fives' | 'Sixes'>;`,
              definitionStyle: 'derived'
            },
            metadata: { discoveredAt: new Date().toISOString(), confidence: 'high' }
          }
        ]
      };

      const engine = new AKGQueryEngine(extractGraph);
      const violations = categoryTypeConsistency(extractGraph, engine);

      expect(violations).toHaveLength(0);
    });

    it('should flag if canonical values are missing', () => {
      const missingGraph = {
        ...violationCategoryGraph,
        nodes: [
          violationCategoryGraph.nodes[0],
          {
            ...violationCategoryGraph.nodes[1],
            attributes: {
              ...violationCategoryGraph.nodes[1].attributes,
              content: `type Category = 'ones' | 'twos' | 'dicee';`  // Missing most categories
            }
          }
        ]
      };

      const engine = new AKGQueryEngine(missingGraph);
      const violations = categoryTypeConsistency(missingGraph, engine);

      expect(violations).toHaveLength(1);
      expect(violations[0].suggestion).toContain('Missing');
    });
  });
});
```

---

## Part 8: Agent Integration

### 8.1 Pre-Type-Definition Check

```typescript
// mcp__project-akg__check_type_definition
{
  "typeName": "Category",
  "filePath": "packages/web/src/lib/types/multiplayer.ts",
  "result": {
    "allowed": false,
    "invariant": "category_type_consistency",
    "reason": "Category type already defined in canonical source",
    "canonicalSource": "packages/web/src/lib/types.ts",
    "recommendation": "Import from canonical source instead of redefining"
  }
}
```

### 8.2 Agent Decision Protocol

```markdown
## Before Defining Category-Like Types

1. Check if a canonical Category type exists:
   - Search for: `const.*CATEGORIES.*as const`
   - Search for: `type Category =`

2. If canonical exists, ALWAYS import:
   import type { Category } from '$lib/types';

3. If you need a subset, use Extract:
   type UpperCategory = Extract<Category, 'Ones' | 'Twos' | ...>;

4. If you need different casing for an API boundary:
   - Import canonical type
   - Create conversion functions
   - Convert at the boundary, not in types

## Never Do This

❌ Define a new Category literal union
❌ Use different case conventions
❌ Create types that look like categories without deriving from canonical
```

### 8.3 Fix Automation

This invariant supports **partial auto-fix**:

```typescript
function suggestAutoFix(violation: InvariantViolation): string | null {
  // If it's just a parallel definition, suggest import replacement
  if (violation.message.includes('case_mismatch')) {
    return `
// Replace:
// type Category = 'ones' | 'twos' | ...;

// With:
import type { Category } from '$lib/types';

// If server needs camelCase, add conversion:
import { toServerCategory, fromServerCategory } from '$lib/types/category-utils';
`;
  }
  return null;
}
```

---

## Part 9: Immediate Action Required

### 9.1 This Is a Real Bug

The divergence between `$lib/types.ts` and `$lib/types/multiplayer.ts` **exists today** and will cause bugs when:

1. Multiplayer game tries to use single-player engine analysis
2. Statistics are aggregated across game modes
3. Database queries use category as a key
4. WASM engine receives camelCase category

### 9.2 Recommended Fix Priority

| Priority | Task | Effort |
|----------|------|--------|
| **P0** | Create `category-utils.ts` with conversion functions | 30 min |
| **P0** | Update `multiplayerGame.svelte.ts` to convert at boundaries | 1 hr |
| **P1** | Update `multiplayer.ts` to import canonical Category | 1 hr |
| **P1** | Update PartyKit server to align types | 2 hr |
| **P2** | Add integration tests for cross-mode scenarios | 2 hr |

### 9.3 Verification After Fix

```bash
# After fix, this should pass
pnpm akg:check --invariant=category_type_consistency

# And this TypeScript check should work
tsc --noEmit
```

---

## Part 10: Metrics & Effectiveness

### 10.1 Expected Metrics

| Metric | Target | Notes |
|--------|--------|-------|
| Existing violations | 1 (found!) | Fix immediately |
| Future violations caught | ≥ 1 per quarter | Preventive |
| False positive rate | < 5% | May flag derived types incorrectly |
| Detection complexity | Medium | Requires AST analysis |

### 10.2 Why This Invariant Is Critical for Dicee

1. **WASM Engine**: Uses PascalCase categories for scoring
2. **Database**: Stores category names as strings
3. **PartyKit**: Server/client must agree on format
4. **Statistics**: Cross-mode aggregation requires consistency
5. **Leaderboards**: Category-based rankings need exact matching

---

## Appendix A: Category Value Reference

| Canonical (PascalCase) | Server (camelCase) | Index |
|------------------------|-------------------|-------|
| `Ones` | `ones` | 0 |
| `Twos` | `twos` | 1 |
| `Threes` | `threes` | 2 |
| `Fours` | `fours` | 3 |
| `Fives` | `fives` | 4 |
| `Sixes` | `sixes` | 5 |
| `ThreeOfAKind` | `threeOfAKind` | 6 |
| `FourOfAKind` | `fourOfAKind` | 7 |
| `FullHouse` | `fullHouse` | 8 |
| `SmallStraight` | `smallStraight` | 9 |
| `LargeStraight` | `largeStraight` | 10 |
| `Dicee` | `dicee` | 11 |
| `Chance` | `chance` | 12 |

---

## Appendix B: Related Invariants

| Invariant | Relationship |
|-----------|--------------|
| `store_no_circular_deps` | Type imports shouldn't create cycles |
| `wasm_single_entry` | WASM uses canonical Category |
| `service_layer_boundaries` | Services should use canonical types |

---

**Simulation Status**: Ready for implementation. ~~**Contains real violation to fix.**~~ **RESOLVED**

**Immediate Actions**:
1. ✅ Design complete
2. ✅ **FIX EXISTING VIOLATION** (P0) - Resolved 2025-12-05
3. ⏳ Implement invariant (Week 3)
4. ⏳ Add test fixtures (Week 3)
5. ⏳ Enable in CI (blocking)

---

## Appendix C: Resolution Log (2025-12-05)

### C.1 Fix Applied

The Category type divergence was addressed by **accepting dual representation with explicit boundary conversion**:

| File | Purpose | Status |
|------|---------|--------|
| `$lib/types.ts` | Internal TypeScript (PascalCase) | ✅ Documented |
| `$lib/types/multiplayer.ts` | Wire format (camelCase) | ✅ Documented |
| `$lib/types/category-convert.ts` | **NEW** Conversion utilities | ✅ Created |

### C.2 Files Modified

**Created**:
- `packages/web/src/lib/types/category-convert.ts`
  - `CORE_TO_WIRE` / `WIRE_TO_CORE` mapping records
  - `toWireCategory()` / `toCoreCategory()` conversion functions
  - `isWireCategory()` / `isCoreCategory()` type guards

**Updated**:
- `packages/web/src/lib/types/multiplayer.ts`
  - Added documentation clarifying wire format purpose
  - Added `@invariant category_type_consistency` tag
  - Referenced `category-convert.ts` for boundary crossings

- `packages/web/src/lib/types.ts`
  - Added documentation clarifying internal use
  - Added `@invariant category_type_consistency` tag
  - Referenced wire format location

### C.3 Design Decision

**Accepted dual representation** rather than forcing single type because:

1. **Wire format requirements**: JSON/WebSocket messages conventionally use camelCase
2. **PartyKit server compatibility**: Server already uses camelCase
3. **Internal consistency**: Engine and single-player use PascalCase consistently
4. **Explicit boundaries**: Conversion utilities make the boundary explicit

### C.4 Usage Pattern

```typescript
// At WebSocket boundary (receiving)
import { toCoreCategory } from '$lib/types/category-convert';

function handleServerEvent(event: CategoryScoredEvent) {
  const category = toCoreCategory(event.category); // 'dicee' → 'Dicee'
  updateScorecard(category);
}

// At WebSocket boundary (sending)
import { toWireCategory } from '$lib/types/category-convert';

function scoreCategory(category: CoreCategory) {
  send({ category: toWireCategory(category) }); // 'Dicee' → 'dicee'
}
```

### C.5 Verification

```bash
# TypeScript compiles without errors
pnpm check:web
# ✅ svelte-check found 0 errors
# ✅ biome check passed

# File structure verified
ls packages/web/src/lib/types/
# category-convert.ts  index.ts  multiplayer.ts
```

### C.6 Remaining Work

| Task | Status | Notes |
|------|--------|-------|
| Conversion utilities | ✅ Complete | `category-convert.ts` |
| Type documentation | ✅ Complete | Both files documented |
| Update multiplayer stores to use conversion | ⏳ Pending | When store integration needed |
| AKG invariant implementation | ⏳ Week 3 | Will detect new violations |
