# Dicee Codebase Conventions

**Version**: 1.3.0
**Last Updated**: 2025-12-09
**Scope**: All agents (Claude Code, Windsurf, Codex, Gemini)
**Architecture**: Unified Cloudflare stack (Pages + Workers via Service Bindings)

> **IMPORTANT**: Read this document before modifying any code.
> When uncertain, search the codebase for existing patterns.
> For architecture details, see `docs/unified-cloudflare-stack.md`.

---

## Quick Reference

```
DICEE NAMING QUICK REF:
- Component files: PascalCase.svelte
- Callback props: onVerb (onRoll, onScore, onClose)  ← camelCase!
- DOM events: lowercase (onclick, onkeydown)         ← Svelte 5
- Handlers: handleVerb (handleRoll, handleKeyDown)
- Booleans: is/has/can prefix (isLoading, canScore)
- CSS classes: kebab-case (.game-container)
- CSS vars: --category-name (--color-accent)
- Imports: svelte → $app → $lib → relative → types
```

---

## 1. Event Handlers & Callbacks

### The Core Rule

| Context | Convention | Example |
|---------|------------|---------|
| **Native DOM events** (Svelte 5) | lowercase | `onclick`, `onkeydown`, `oninput` |
| **Component callback props** | camelCase with `on` prefix | `onRoll`, `onClose`, `onScore` |
| **Internal handler functions** | camelCase with `handle` prefix | `handleRoll`, `handleKeyDown` |
| **Store action methods** | camelCase verb | `roll()`, `toggleKeep()`, `startGame()` |

### Why This Matters

Svelte 5 uses **lowercase** for native DOM events to match the HTML spec. But **component callback props** should use **camelCase** to distinguish them as custom handlers and match React/Vue conventions that agents may be familiar with.

```svelte
<!-- CORRECT: Native DOM event (lowercase) -->
<button onclick={handleClick}>Roll</button>

<!-- CORRECT: Component callback prop (camelCase) -->
<DiceTray onRoll={handleRoll} onToggleKeep={handleToggleKeep} />

<!-- WRONG: Don't use lowercase for component props -->
<DiceTray onroll={handleRoll} />  <!-- ❌ -->
```

### Defining Component Props

```svelte
<script lang="ts">
interface Props {
    // Data props: nouns
    dice: number[];
    kept: boolean[];
    rollsRemaining: number;

    // Boolean props: is/has/can prefix
    canRoll: boolean;
    isLoading?: boolean;
    hasError?: boolean;

    // Callback props: onVerb (camelCase)
    onRoll: () => void;
    onToggleKeep: (index: number) => void;
    onScore?: (category: Category) => void;
    onClose?: () => void;  // ✅ Not "onclose"
}

let { dice, kept, onRoll, onToggleKeep }: Props = $props();
</script>
```

### Internal Handlers

```svelte
<script lang="ts">
// Internal handlers use "handle" prefix
function handleClick() {
    // Local logic
    onRoll(); // Call the callback prop
}

function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
        onRoll();
    }
}
</script>

<!-- Use handlers with native events -->
<button onclick={handleClick} onkeydown={handleKeyDown}>
```

---

## 2. Files & Directories

| Type | Convention | Example |
|------|------------|---------|
| Svelte components | PascalCase | `GameGateway.svelte`, `DiceTray.svelte` |
| TypeScript modules | camelCase | `engine.ts`, `authHelpers.ts` |
| Store files | camelCase with `.svelte.ts` | `game.svelte.ts`, `auth.svelte.ts` |
| Route directories | kebab-case | `(protected)/`, `auth/callback/` |
| Route groups | `(groupName)/` | `(protected)/`, `(marketing)/` |
| Dynamic routes | `[param]/` | `[code]/`, `[id]/` |
| Test files | `*.test.ts` suffix | `game.test.ts`, `DiceTray.test.ts` |
| Type definition files | camelCase | `database.ts`, `multiplayer.ts` |
| Schema files (Zod) | camelCase with `.schema.ts` | `multiplayer.schema.ts` |
| Barrel exports | `index.ts` | `components/dice/index.ts` |

### Directory Structure

```
packages/web/src/lib/
├── components/
│   ├── auth/           # Auth-related components
│   ├── chat/           # Chat panel, messages, reactions (do-4b)
│   ├── dice/           # Dice tray and die
│   ├── game/           # Game session components
│   ├── hub/            # Hub landing components
│   ├── hud/            # Heads-up display
│   ├── lobby/          # Lobby components
│   ├── profile/        # Profile management
│   ├── scorecard/      # Scoring components
│   └── ui/             # Reusable UI primitives
├── services/           # API and external services
├── stores/             # Svelte 5 rune stores
├── supabase/           # Supabase client and helpers
├── types/              # TypeScript type definitions
├── hooks/              # Svelte hooks
├── utils/              # Pure utility functions
└── styles/             # Global CSS
```

---

## 3. Variables & State

| Type | Convention | Example |
|------|------------|---------|
| Local variables | camelCase | `rollsRemaining`, `diceValues` |
| Constants | camelCase (NOT SCREAMING_CASE) | `maxRolls = 3` |
| Svelte state | camelCase with `$state` | `let scores = $state([])` |
| Derived values | camelCase with `$derived` | `const canRoll = $derived(...)` |
| Effects | `$effect` block | `$effect(() => { ... })` |
| Boolean variables | `is`/`has`/`can` prefix | `isLoading`, `hasError`, `canScore` |
| Nullable state | explicit type | `let error = $state<string \| null>(null)` |

### State Patterns

```svelte
<script lang="ts">
// ✅ Correct state declarations
let loading = $state(false);
let error = $state<string | null>(null);
let scores = $state<number[]>([]);

// ✅ Correct derived values
const canRoll = $derived(rollsRemaining > 0 && !isGameOver);
const totalScore = $derived(scores.reduce((a, b) => a + b, 0));

// ✅ Effects for side effects
$effect(() => {
    if (isGameOver) {
        saveScore(totalScore);
    }
});
</script>
```

---

## 4. TypeScript Types

| Type | Convention | Example |
|------|------------|---------|
| Interfaces | PascalCase | `GameState`, `ScoringResult` |
| Type aliases | PascalCase | `Category`, `DieValue` |
| Props interface | `Props` (local) | `interface Props { ... }` |
| Const arrays (enums) | UPPER_SNAKE_CASE array | `const CATEGORIES = [...] as const` |
| Generic parameters | Single uppercase | `T`, `K`, `V` |
| Utility types | PascalCase | `Nullable<T>`, `DeepPartial<T>` |

### Preferred Patterns

```typescript
// ✅ Const arrays over enums (better tree-shaking)
export const CATEGORIES = [
    'Ones', 'Twos', 'Threes', 'Fours', 'Fives', 'Sixes',
    'ThreeOfAKind', 'FourOfAKind', 'FullHouse',
    'SmallStraight', 'LargeStraight', 'Dicee', 'Chance'
] as const;
export type Category = typeof CATEGORIES[number];

// ✅ Result pattern for API calls
interface Result<T> {
    data: T | null;
    error: Error | null;
}

// ✅ Explicit nullable types
type ProfileId = string | null;
```

---

## 5. CSS Conventions

| Type | Convention | Example |
|------|------------|---------|
| Class names | kebab-case | `.game-container`, `.dice-tray` |
| CSS custom properties | kebab-case with prefix | `--color-accent`, `--space-2` |
| Component-scoped classes | semantic kebab-case | `.header`, `.action-zone` |
| State classes | adjective | `.loading`, `.disabled`, `.active` |
| Modifier classes | `--modifier` suffix | `.button--primary` |

### Design Token Categories

```css
/* Colors */
--color-text, --color-background, --color-surface
--color-accent, --color-accent-dark, --color-accent-light
--color-border, --color-text-muted

/* Spacing (based on 4px grid) */
--space-0 through --space-6

/* Typography */
--font-sans, --font-mono
--text-tiny, --text-small, --text-body, --text-h3, --text-h2, --text-display
--weight-normal, --weight-medium, --weight-bold, --weight-black

/* Borders */
--border-thin, --border-medium, --border-thick
--radius-sm, --radius-md

/* Effects */
--shadow-brutal, --shadow-brutal-lg
--transition-fast, --transition-medium
```

### Neo-Brutalist Style

```css
/* Standard card style */
.card {
    border: var(--border-thick);
    border-radius: var(--radius-md);
    background: var(--color-surface);
    box-shadow: var(--shadow-brutal);
}

/* Hover interaction */
.card:hover {
    box-shadow: var(--shadow-brutal-lg);
    transform: translate(-2px, -2px);
}

/* Active/pressed state */
.card:active {
    box-shadow: 2px 2px 0 0 var(--color-text);
    transform: translate(2px, 2px);
}
```

---

## 6. SvelteKit Routes & Cloudflare Bindings

### Route Structure (Unified Cloudflare Architecture)

```
packages/web/src/routes/
├── (marketing)/           # Public pages (landing, about)
├── (protected)/           # Auth-required routes
│   └── profile/          # User profile
├── games/                 # Game hub
│   └── dicee/            # Dicee game routes
│       ├── +page.svelte  # Single-player or game entry
│       └── [code]/       # Room routes (dynamic)
├── ws/                    # WebSocket proxy endpoints
│   ├── lobby/+server.ts  # → GlobalLobby DO
│   └── room/[code]/+server.ts # → GameRoom DO
└── api/                   # API routes
```

### Service Binding Access (SvelteKit + CF Pages)

```typescript
// In +server.ts or +page.server.ts
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ platform }) => {
    // Access Durable Object via Service Binding
    const stub = platform?.env.GAME_WORKER;
    if (!stub) throw new Error('Service binding not available');

    // Forward request to Worker
    const response = await stub.fetch(new Request('https://internal/lobby/rooms'));
    return response;
};
```

### WebSocket Proxy Pattern

```typescript
// src/routes/ws/room/[code]/+server.ts
export const GET: RequestHandler = async ({ request, params, platform }) => {
    const { code } = params;

    // Get DO stub and forward WebSocket upgrade
    const id = platform?.env.GAME_ROOM.idFromName(code);
    const stub = platform?.env.GAME_ROOM.get(id);

    // Forward the WebSocket upgrade request
    return stub.fetch(request);
};
```

### Route Naming Conventions

| Pattern | Example | Purpose |
|---------|---------|---------|
| `/games/[game]` | `/games/dicee` | Game entry points |
| `/games/[game]/[code]` | `/games/dicee/ABC123` | Room-specific routes |
| `/ws/*` | `/ws/lobby`, `/ws/room/[code]` | WebSocket proxies |
| `/api/*` | `/api/rooms`, `/api/leaderboard` | REST API endpoints |
| `(group)` | `(protected)`, `(marketing)` | Route groups |

### Platform Type Declaration (app.d.ts)

```typescript
// packages/web/src/app.d.ts
declare global {
    namespace App {
        interface Platform {
            env: {
                GAME_WORKER: Fetcher;  // Service binding to Worker
            };
            cf: CfProperties;
            ctx: ExecutionContext;
        }
    }
}
```

---

## 7. Import Ordering

Biome enforces import ordering. Follow this sequence:

1. **Side-effect imports** (rare)
2. **External packages** (`svelte`, `zod`)
3. **Svelte app imports** (`$app/navigation`, `$app/stores`)
4. **Internal aliases** (`$lib/stores/game.svelte`)
5. **Relative imports** (`./utils`, `../types`)
6. **Type-only imports** (at end of their category)

```svelte
<script lang="ts">
// 1. Svelte core
import { onMount, onDestroy } from 'svelte';

// 2. External packages
import { z } from 'zod';

// 3. SvelteKit app modules
import { goto } from '$app/navigation';
import { page } from '$app/stores';

// 4. Internal lib imports
import { game } from '$lib/stores/game.svelte';
import { auth } from '$lib/stores/auth.svelte';
import DiceTray from '$lib/components/dice/DiceTray.svelte';

// 5. Relative imports
import { formatScore } from './utils';

// 6. Type-only imports (can be interspersed with their category)
import type { Category, ScoringResult } from '$lib/types';
</script>
```

---

## 8. Component Documentation

Every component should have a JSDoc header:

```svelte
<script lang="ts">
/**
 * ComponentName - Brief description
 *
 * Detailed description of purpose and behavior.
 *
 * @example
 * <ComponentName prop={value} onCallback={handler} />
 */
</script>
```

---

## 9. Agent-Specific Guidance

### Before Modifying Code

1. Read this `CONVENTIONS.md` document
2. Check 2-3 existing similar components for patterns
3. When uncertain, search the codebase:
   ```bash
   grep -r "onRoll\|onclick" --include="*.svelte" | head -20
   ```
4. Match existing patterns; never introduce new conventions without approval

### When Creating New Components

1. Use the component template pattern from existing files
2. Props interface with JSDoc comments
3. camelCase callback props with `on` prefix
4. Internal handlers with `handle` prefix
5. Neo-Brutalist styling using design tokens

### When Reviewing Code

Check for:
- Callback prop naming (camelCase `onVerb`)
- Native event naming (lowercase `onclick`)
- Boolean prop naming (`is`/`has`/`can` prefix)
- Import ordering (Biome will flag issues)
- CSS using design tokens (not hardcoded values)

---

## 10. WebSocket Commands & Events

### The Naming Contract

| Layer | Format | Example |
|-------|--------|---------|
| **Server Commands** (client → server) | UPPER_SNAKE_CASE | `DICE_ROLL`, `DICE_KEEP`, `CATEGORY_SCORE` |
| **Server Events** (server → client) | UPPER_SNAKE_CASE | `DICE_ROLLED`, `CATEGORY_SCORED`, `GAME_STARTED` |
| **Client Normalized Events** (after normalization) | lowercase.dot | `dice.rolled`, `category.scored`, `game.started` |

### Why This Matters

The server (GameRoom Durable Object) uses a switch statement that expects **UPPERCASE** command types. If the client sends lowercase.dot format commands, the server silently drops them (no match in the switch).

**Root cause of bugs**: Stores sending raw commands with wrong format.

```typescript
// ❌ WRONG: Store sending raw command with lowercase type
roomService.send({ type: 'dice.roll', kept: [false, false, false, false, false] });
// Server switch never matches 'dice.roll' → command silently dropped

// ✅ CORRECT: Use dedicated roomService methods
roomService.sendRollDice([false, false, false, false, false]);
// Method sends { type: 'DICE_ROLL', kept: [...] } → server handles it
```

### Command Reference

| Command | roomService Method | Server Handler |
|---------|-------------------|----------------|
| `DICE_ROLL` | `sendRollDice(kept)` | `handleDiceRoll()` |
| `DICE_KEEP` | `sendKeepDice(indices)` | `handleDiceKeep()` |
| `CATEGORY_SCORE` | `sendScoreCategory(category)` | `handleCategoryScore()` |
| `CHAT_MESSAGE` | `sendChat(content)` | `handleChatMessage()` |
| `START_GAME` | `sendStartGame()` | `handleStartGame()` |
| `QUICK_PLAY_START` | `startQuickPlay(aiProfiles)` | `handleQuickPlayStart()` |

### Event Normalization

The client's `normalizeServerEvent()` function converts server UPPERCASE events to lowercase.dot format for store consumption:

```typescript
// Server broadcasts:
{ type: 'DICE_ROLLED', payload: { playerId, dice, rollNumber, rollsRemaining } }

// Client normalizes to:
{ type: 'dice.rolled', playerId, dice, rollNumber, rollsRemaining }
```

### Store Pattern

Stores should **never** construct raw commands. Always use the dedicated roomService methods:

```typescript
// In multiplayerGame.svelte.ts
function rollDice(kept: KeptMask): void {
    if (!canRoll) return;
    uiPhase = 'ROLLING';
    pending = true;
    error = null;

    // ✅ Use dedicated method (sends correct UPPERCASE type)
    roomService.sendRollDice(kept);

    // ❌ Never do this (wrong format)
    // roomService.send({ type: 'dice.roll', kept });
}
```

### Adding New Commands

When adding new WebSocket commands:

1. **Server (GameRoom.ts)**: Add case to `handleMessage()` switch with UPPERCASE type
2. **roomService**: Add dedicated `send[CommandName]()` method that sends UPPERCASE type
3. **Store**: Call the dedicated method, never raw `send()`
4. **Types**: Add to `Command` union type in `multiplayer.ts`

### Technical Debt Note

The `Command` type definitions in `multiplayer.ts` currently use mixed formats:
- Game commands: lowercase.dot (`dice.roll`, `category.score`)
- Chat commands: UPPERCASE (`CHAT`, `REACTION`)

The server expects UPPERCASE. The dedicated `roomService.send*()` methods work around this by hardcoding the correct format. A future cleanup could align all type definitions to UPPERCASE, but using dedicated methods is the recommended pattern regardless.

---

## 11. Verification Commands

```bash
# Check for naming violations
pnpm lint

# Format and organize imports
cd packages/web && pnpm exec biome check --write .

# Run tests after changes
pnpm web:vitest -- --run

# Type check
pnpm web:sync && pnpm --filter @dicee/web exec svelte-check
```

---

## 12. References

### Architecture
- [Unified Cloudflare Stack](../docs/unified-cloudflare-stack.md) - CF Pages migration
- [Lobby UX/UI Refactor](../docs/lobby-ux-ui-refactor.md) - Lobby-first UI

### External Docs
- [Svelte 5 Runes Documentation](https://svelte.dev/docs/svelte/what-are-runes)
- [SvelteKit Routing](https://svelte.dev/docs/kit/routing)
- [SvelteKit Cloudflare Adapter](https://kit.svelte.dev/docs/adapter-cloudflare)
- [Biome Linter Rules](https://biomejs.dev/linter/rules/)

### Project Files
- `.claude/typescript-biome-strategy.md` - TypeScript patterns
- `.claude/cli-reference.yaml` - Wrangler, Supabase commands
