# TypeScript & Biome Strategy

> **Version**: 1.0.0
> **Date**: 2025-12-03
> **Status**: Active
> **Applies To**: All code in `packages/web/`

---

## Quick Reference

### Commands

```bash
# Daily workflow
pnpm check         # TypeScript + Svelte check
pnpm biome:check   # Lint without fixing
pnpm biome:fix     # Auto-fix issues
pnpm test          # Run tests

# Quality gate (before commit)
pnpm check && pnpm biome:check && pnpm test && pnpm build
```

### Type Patterns to Use

```typescript
// Domain types from const arrays
export const CATEGORIES = ['A', 'B', 'C'] as const;
export type Category = (typeof CATEGORIES)[number];

// Supabase table types
import type { Tables, TablesInsert, TablesUpdate } from '$lib/types/database';
type Profile = Tables<'profiles'>;

// Result types (standardized pattern)
type Result<T> = { data: T | null; error: Error | null };
```

### Type Patterns to AVOID

```typescript
// ❌ Avoid `any` - use `unknown` and narrow
(auth as any).__setLoading(true);

// ❌ Avoid double assertions
players as (GamePlayer & { profile: Profile })[]

// ❌ Avoid non-null assertions in business logic
user!.id

// ✅ Prefer proper narrowing
if (!user) throw new Error('...');
user.id  // now safely narrowed
```

---

## Strategy Overview

### Current Stack

| Tool | Version | Purpose |
|------|---------|---------|
| TypeScript | 5.9.3 | Type checking, IDE support |
| Biome | 2.x (upgrading from 1.9.4) | Linting, formatting, import organization |
| Svelte | 5.x | UI framework with runes |
| SvelteKit | 2.x | Full-stack framework |
| Supabase | 2.x | Backend (typed client) |

### Design Principles

1. **Type Safety Over Convenience**: No `any`, minimal assertions
2. **Single Source of Truth**: Types derived from data, not duplicated
3. **Fail Fast**: TypeScript catches errors, not runtime
4. **Agent-Friendly**: Clear patterns that AI can follow consistently

---

## TypeScript Configuration

### tsconfig.json (packages/web/)

```json
{
  "extends": "./.svelte-kit/tsconfig.json",
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noPropertyAccessFromIndexSignature": true,
    "rewriteRelativeImportExtensions": true,
    "verbatimModuleSyntax": true,
    "moduleResolution": "bundler"
  }
}
```

### Key Compiler Options Explained

| Option | Value | Why |
|--------|-------|-----|
| `strict` | `true` | Full strict mode - non-negotiable |
| `noUncheckedIndexedAccess` | `true` | Array/object access returns `T \| undefined` |
| `exactOptionalPropertyTypes` | `true` | Distinguishes `undefined` from "missing" |
| `noPropertyAccessFromIndexSignature` | `true` | Forces bracket notation for dynamic keys |
| `verbatimModuleSyntax` | `true` | Explicit `type` imports |

---

## Type Architecture

### Layer 1: Database Types (Generated)

```
src/lib/types/database.ts  <- supabase gen types --local
```

These types are **auto-generated**. Never edit directly.

```typescript
// Good: Use helper types
type Profile = Tables<'profiles'>;
type ProfileInsert = TablesInsert<'profiles'>;
type ProfileUpdate = TablesUpdate<'profiles'>;

// Good: Access nested types
type Json = Database['public']['Tables']['profiles']['Row']['badges'];
```

### Layer 2: Domain Types (Hand-Crafted)

```
src/lib/types.ts           <- Game-specific types
```

These types represent **business logic**, not database schema.

```typescript
// Const arrays become the source of truth
export const CATEGORIES = ['Ones', 'Twos', ...] as const;
export type Category = (typeof CATEGORIES)[number];

// Related types derive from the source
export const CATEGORY_NAMES: Record<Category, string> = { ... };
```

### Layer 3: API Types (Function Signatures)

```
src/lib/supabase/profiles.ts
src/lib/supabase/stats.ts
```

Standardized result pattern:

```typescript
async function getProfile(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<{ data: Profile | null; error: Error | null }> {
  // ...
}
```

### Layer 4: Store Types (Svelte Runes)

```
src/lib/stores/*.svelte.ts
```

Private state with public derived:

```typescript
class AuthState {
  #user = $state<User | null>(null);
  readonly isAuthenticated = $derived(this.#user !== null);

  get user() { return this.#user; }
}
```

---

## Type Patterns Catalog

### Pattern 1: Const Arrays with Derived Types

**Use When**: You have a fixed set of values (categories, statuses, etc.)

```typescript
// 1. Define the const array (source of truth)
export const GAME_STATUSES = ['idle', 'rolling', 'scoring', 'completed'] as const;

// 2. Derive the union type
export type GameStatus = (typeof GAME_STATUSES)[number];

// 3. Create related mappings
export const STATUS_LABELS: Record<GameStatus, string> = {
  idle: 'Ready',
  rolling: 'Rolling...',
  scoring: 'Select Category',
  completed: 'Game Over'
};

// 4. Type guard for runtime validation
function isGameStatus(value: unknown): value is GameStatus {
  return GAME_STATUSES.includes(value as GameStatus);
}
```

### Pattern 2: Result Types for API Calls

**Use When**: Any async operation that can fail

```typescript
// Generic result type
type Result<T> = { data: T; error: null } | { data: null; error: Error };

// Usage
async function fetchData(): Promise<Result<Data>> {
  try {
    const data = await api.get();
    return { data, error: null };
  } catch (e) {
    return { data: null, error: e instanceof Error ? e : new Error(String(e)) };
  }
}

// Consumer - forces you to handle both cases
const { data, error } = await fetchData();
if (error) {
  handleError(error);
  return;
}
// data is now narrowed to non-null
```

### Pattern 3: Branded Types for IDs

**Use When**: You want to prevent mixing IDs from different entities

```typescript
// Create branded types
type UserId = string & { readonly __brand: 'UserId' };
type GameId = string & { readonly __brand: 'GameId' };

// Factory functions
function toUserId(id: string): UserId {
  return id as UserId;
}

// Now these are type errors:
// getGame(userId);  // Error: UserId not assignable to GameId
```

### Pattern 4: Discriminated Unions for State

**Use When**: A value can be in one of several states with different data

```typescript
type GameState =
  | { status: 'idle' }
  | { status: 'playing'; turnNumber: number; rollNumber: number }
  | { status: 'completed'; finalScore: number; duration: number };

// TypeScript narrows based on discriminant
function handleState(state: GameState) {
  switch (state.status) {
    case 'idle':
      // state is { status: 'idle' }
      break;
    case 'playing':
      // state has turnNumber, rollNumber
      break;
    case 'completed':
      // state has finalScore, duration
      break;
  }
}
```

### Pattern 5: Supabase Join Type Handling

**Use When**: Querying related tables

```typescript
// The problem: Supabase returns nested objects, not flat joins
const { data } = await supabase
  .from('game_players')
  .select('*, profiles(*)')
  .eq('game_id', gameId);

// Solution 1: Define expected shape explicitly
type GamePlayerWithProfile = Tables<'game_players'> & {
  profiles: Tables<'profiles'>;
};

// Solution 2: Use type inference with zod for runtime validation
import { z } from 'zod';

const GamePlayerWithProfileSchema = z.object({
  // ... define expected shape
});

type GamePlayerWithProfile = z.infer<typeof GamePlayerWithProfileSchema>;
```

---

## Anti-Patterns to Avoid

### 1. Type Assertions to `any`

```typescript
// ❌ BAD: Escapes type system entirely
(auth as any).__setLoading(true);

// ✅ GOOD: Add proper types to the API
interface AuthStateTestHelpers {
  __setLoading(loading: boolean): void;
}
```

### 2. Double Assertions

```typescript
// ❌ BAD: Usually indicates a design problem
players as unknown as (GamePlayer & { profile: Profile })[]

// ✅ GOOD: Define the type properly or use type guards
function hasProfile(player: GamePlayer & { profiles?: unknown }):
  player is GamePlayer & { profiles: Profile } {
  return player.profiles !== null;
}
```

### 3. Non-null Assertions in Logic

```typescript
// ❌ BAD: Crashes at runtime if assumption is wrong
user!.id

// ✅ GOOD: Guard first
if (!user) throw new Error('User required');
user.id  // Safe
```

### 4. Implicit `any` in Callbacks

```typescript
// ❌ BAD: items is any[]
data.map(item => item.name);

// ✅ GOOD: Explicit typing
data.map((item: Item) => item.name);
```

---

## Biome Configuration

### Upgrading to Biome 2.x

```bash
# Upgrade
pnpm add -D @biomejs/biome@latest

# Migrate configuration
npx @biomejs/biome migrate --write
```

### biome.json (packages/web/) - Biome 2.3+

Key changes from Biome 1.x:
- `files.ignore` → `files.includes` with negation patterns
- Single `!` excludes from lint/format, double `!!` excludes from scanner/indexing
- `organizeImports` → `assist.actions.source.organizeImports`
- `include` in overrides → `includes`
- `linter.includes` for tool-specific file filtering

```json
{
  "$schema": "https://biomejs.dev/schemas/2.3.8/schema.json",
  "vcs": {
    "enabled": true,
    "clientKind": "git",
    "useIgnoreFile": true
  },
  "files": {
    "ignoreUnknown": true,
    "includes": [
      "**",
      "!**/node_modules",
      "!!**/.svelte-kit",
      "!!**/build",
      "!!**/playwright-report",
      "!!**/test-results",
      "!**/src/lib/wasm"
    ]
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "tab",
    "indentWidth": 2,
    "lineWidth": 100
  },
  "assist": {
    "enabled": true,
    "actions": {
      "source": {
        "organizeImports": "on"
      }
    }
  },
  "linter": {
    "enabled": true,
    "includes": ["**", "!**/*.svelte"],
    "rules": {
      "recommended": true,
      "correctness": {
        "noUnusedImports": "error",
        "noUnusedVariables": "error",
        "noUnusedPrivateClassMembers": "error",
        "useExhaustiveDependencies": "warn",
        "noUndeclaredVariables": "error"
      },
      "style": {
        "useConst": "error",
        "noNonNullAssertion": "warn",
        "noInferrableTypes": "off",
        "useTemplate": "warn",
        "useExponentiationOperator": "warn",
        "noUselessElse": "warn",
        "useDefaultParameterLast": "error"
      },
      "suspicious": {
        "noExplicitAny": "error",
        "noArrayIndexKey": "warn",
        "noAssignInExpressions": "error",
        "noDoubleEquals": "error",
        "noImplicitAnyLet": "error",
        "noConfusingVoidType": "warn",
        "noEmptyBlockStatements": "warn"
      },
      "complexity": {
        "noExcessiveCognitiveComplexity": {
          "level": "warn",
          "options": { "maxAllowedComplexity": 15 }
        },
        "noForEach": "off",
        "useLiteralKeys": "warn"
      },
      "performance": {
        "noAccumulatingSpread": "warn",
        "noDelete": "warn"
      }
    }
  },
  "javascript": {
    "formatter": {
      "quoteStyle": "single",
      "semicolons": "always",
      "trailingCommas": "all",
      "arrowParentheses": "always"
    }
  },
  "overrides": [
    {
      "includes": ["**/*.test.ts", "**/*.spec.ts", "**/tests/**/*.ts"],
      "linter": {
        "rules": {
          "suspicious": { "noExplicitAny": "warn" },
          "complexity": { "noExcessiveCognitiveComplexity": "off" }
        }
      }
    },
    {
      "includes": ["**/database.ts", "**/*.d.ts"],
      "linter": {
        "rules": {
          "style": { "useNamingConvention": "off" }
        }
      }
    }
  ]
}
```

### Key Rule Choices Explained

| Rule | Setting | Rationale |
|------|---------|-----------|
| `noExplicitAny` | `error` | Forces proper typing; `unknown` preferred |
| `noNonNullAssertion` | `warn` | Discourage but allow for asserting known state |
| `noUnusedImports` | `error` | Clean imports, aids tree-shaking |
| `noDoubleEquals` | `error` | Prevent subtle equality bugs |
| `useConst` | `error` | Immutability by default |

---

## Agent Type Safety Guardrails

### For All Agents

1. **Never use `any`** - Use `unknown` and type guards
2. **Never use `// @ts-ignore`** - Fix the type issue properly
3. **Always read types before editing** - Understand the type before modifying
4. **Run `pnpm check` after every edit** - Catch issues immediately

### Type Fix Decision Tree

```
Type Error?
│
├─ "Cannot assign X to Y"
│   └─ Is Y correct? → Cast X properly or fix the source
│
├─ "Property does not exist"
│   ├─ Is the property optional? → Use optional chaining ?.
│   └─ Should it exist? → Add to type definition
│
├─ "X is possibly undefined"
│   ├─ Should it be undefined? → Handle the case
│   └─ It's always defined here → Add guard before use
│
└─ Complex Supabase join type?
    └─ Define explicit interface, don't assert
```

### When to Ask for Help

- Type system requires `as unknown as X` (design issue)
- Generic types with 3+ levels of nesting
- Inferred types don't match runtime behavior
- TypeScript error persists after 3 attempts

---

## Svelte 5 Runes Type Patterns

### State with Types

```typescript
// Private class field with $state
#items = $state<Item[]>([]);

// Public readonly access
get items(): readonly Item[] {
  return this.#items;
}
```

### Derived with Types

```typescript
// Simple derived
readonly isEmpty = $derived(this.#items.length === 0);

// Complex derived using $derived.by
readonly summary = $derived.by(() => {
  // Complex computation with proper return type
  return this.#items.reduce((acc, item) => ({
    total: acc.total + item.value,
    count: acc.count + 1
  }), { total: 0, count: 0 });
});
```

### Effect Types

```typescript
// Effects don't return values
$effect(() => {
  // Side effects only
  console.log('Items changed:', this.#items.length);
});
```

---

## Testing Type Patterns

### Mock Type Safety

```typescript
// Define mock interface matching the real thing
interface MockAuth {
  signInWithGoogle: ReturnType<typeof vi.fn>;
  isAnonymous: boolean;
  // Only include what tests need
}

// Create properly typed mock
const createMockAuth = (overrides?: Partial<MockAuth>): MockAuth => ({
  signInWithGoogle: vi.fn(),
  isAnonymous: false,
  ...overrides
});
```

### Type-Safe Test Helpers

```typescript
// Factory for test data
function createTestProfile(overrides?: Partial<Profile>): Profile {
  return {
    id: 'test-id',
    display_name: 'Test User',
    // ... all required fields
    ...overrides
  };
}
```

---

## Migration Checklist

### Immediate Actions

- [ ] Upgrade Biome to 2.x: `pnpm add -D @biomejs/biome@latest`
- [ ] Run migration: `npx @biomejs/biome migrate --write`
- [ ] Add `noUncheckedIndexedAccess` to tsconfig
- [ ] Fix all `noExplicitAny` violations
- [ ] Remove useless `export {}` from app.d.ts

### Short-Term

- [ ] Create branded types for IDs
- [ ] Standardize Result<T> pattern across all API functions
- [ ] Add type guards for runtime validation at boundaries
- [ ] Enable `exactOptionalPropertyTypes`

### Long-Term

- [ ] Explore Biome plugins for project-specific rules
- [ ] Add runtime validation (zod) at API boundaries
- [ ] Consider TypeScript 7 when stable

---

## Lessons from Practice

Real-world patterns discovered during development:

1. **Test files need different rules** - `biome.json` overrides for `**/__tests__/**/*.ts` disable strict rules that conflict with mocking patterns
2. **forEach implicit returns** - `arr.forEach(x => fn(x))` returns the result; use braces to make it void
3. **Promise resolver pattern** - If you declare `let resolve` to capture a Promise's resolver but don't use it, simplify to `new Promise(() => {})`
4. **biome-ignore becomes error** - When a rule is disabled via overrides, existing biome-ignore comments become `suppressions/unused` errors
5. **Run biome standalone** - `pnpm biome:check` gives cleaner output than lefthook for debugging

### Testing Patterns (Added 2025-12-04)

6. **Testing Interface Pattern** - When testing classes with private fields (#field), expose a `__testing` object with controlled setters:
   ```typescript
   class AuthState {
     #loading = $state(true);

     // Testing interface - DO NOT USE IN PRODUCTION
     __testing = {
       setLoading: (v: boolean) => { this.#loading = v; },
       reset: () => { /* reset all private fields */ }
     };
   }
   ```

7. **Mock Type Pattern** - Define mock interfaces that reflect actual mock structure, not production types:
   ```typescript
   // ❌ Wrong: Forces cast gymnastics
   type MockClient = Pick<SupabaseClient, 'auth' | 'from'>;

   // ✅ Right: Mock methods retain Mock interface
   interface MockAuthMethods {
     signInAnonymously: Mock;
     signOut: Mock;
   }
   interface MockClient {
     auth: MockAuthMethods;
     from: Mock;
   }
   // Cast only when passing to production code:
   auth.init(mockClient as unknown as SupabaseClient<Database>, ...);
   ```

8. **Empty Block Comment Pattern** - Intentionally empty blocks need comments to satisfy `noEmptyBlockStatements`:
   ```typescript
   // ❌ Error: empty block
   vi.spyOn(console, 'warn').mockImplementation(() => {});

   // ✅ Fixed: explicit intent
   vi.spyOn(console, 'warn').mockImplementation(() => {
     /* Suppress console output in tests */
   });
   ```

9. **Never-Resolving Promise Pattern** - For testing loading states, same rule applies:
   ```typescript
   mockFn.mockImplementation(() =>
     new Promise(() => {
       /* Never resolves - simulates hanging async operation */
     })
   );
   ```

10. **Complexity Reduction Pattern** - Extract helpers when `noExcessiveCognitiveComplexity` triggers (max 15):
    ```typescript
    // ❌ Before: complexity 19
    function handleKeyDown(event: KeyboardEvent) {
      if (!enabled) return;
      if (isInput(target)) return;
      switch (key) {
        case 'r': if (canRoll()) { ... } break;
        case 'a': if (canKeep()) { ... } break;
        // more cases...
      }
    }

    // ✅ After: extract helpers
    function isTypingInInput(target: EventTarget | null): boolean { ... }
    function getKeyAction(key: string): (() => void) | null { ... }
    function handleKeyDown(event: KeyboardEvent) {
      if (!enabled || isTypingInInput(event.target)) return;
      const action = getKeyAction(event.key);
      if (action) { event.preventDefault(); action(); }
    }
    ```

11. **Non-null Assertion Avoidance** - Replace `!` with proper checks:
    ```typescript
    // ❌ Risky: non-null assertion
    if (cache.has(key)) return cache.get(key)!;

    // ✅ Safe: undefined check
    const cached = cache.get(key);
    if (cached !== undefined) return cached;
    ```

---

## Sources

- [Biome v2 Announcement](https://biomejs.dev/blog/biome-v2/)
- [Biome Upgrade Guide](https://biomejs.dev/guides/upgrade-to-biome-v2/)
- [TypeScript 5.8 Release Notes](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-8.html)
- [TypeScript 5.9 Announcement](https://devblogs.microsoft.com/typescript/announcing-typescript-5-9/)
