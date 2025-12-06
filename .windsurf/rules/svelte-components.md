# Svelte Component Conventions

**Scope**: `*.svelte` files
**Trigger**: Glob pattern

## Svelte 5 Runes Syntax

### State Declaration

```svelte
<script lang="ts">
// ✅ Correct - Svelte 5 runes
let loading = $state(false);
let error = $state<string | null>(null);
let scores = $state<number[]>([]);

// ✅ Derived values
const canRoll = $derived(rollsRemaining > 0 && !isGameOver);

// ✅ Effects
$effect(() => {
    if (isGameOver) saveScore(totalScore);
});
</script>
```

### Props Interface

```svelte
<script lang="ts">
interface Props {
    // Data props: nouns
    dice: number[];
    kept: boolean[];
    
    // Boolean props: is/has/can prefix
    canRoll: boolean;
    isLoading?: boolean;
    
    // Callback props: onVerb (camelCase!)
    onRoll: () => void;
    onToggleKeep: (index: number) => void;
    onClose?: () => void;  // ✅ Not "onclose"
}

let { dice, kept, onRoll, onToggleKeep }: Props = $props();
</script>
```

## Event Handler Pattern

### The Core Rule

| Context | Convention | Example |
|---------|------------|---------|
| **Native DOM events** | lowercase | `onclick`, `onkeydown` |
| **Component callback props** | camelCase | `onRoll`, `onClose` |
| **Internal handlers** | handleVerb | `handleRoll` |

### Example Component

```svelte
<script lang="ts">
interface Props {
    onSubmit: (value: string) => void;  // ✅ camelCase
    onCancel?: () => void;
}

let { onSubmit, onCancel }: Props = $props();

// Internal handlers use "handle" prefix
function handleClick() {
    onSubmit(value);
}

function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Enter') onSubmit(value);
    if (event.key === 'Escape') onCancel?.();
}
</script>

<!-- Native events: lowercase -->
<button onclick={handleClick} onkeydown={handleKeyDown}>
    Submit
</button>
```

## Import Ordering (Biome-enforced)

```svelte
<script lang="ts">
// 1. Svelte core
import { onMount } from 'svelte';

// 2. External packages
import { z } from 'zod';

// 3. SvelteKit app modules
import { goto } from '$app/navigation';

// 4. Internal lib imports
import { game } from '$lib/stores/game.svelte';
import DiceTray from '$lib/components/dice/DiceTray.svelte';

// 5. Relative imports
import { formatScore } from './utils';

// 6. Type-only imports
import type { Category } from '$lib/types';
</script>
```

## CSS Conventions

### Use Design Tokens

```css
/* ✅ Correct - use tokens */
.card {
    border: var(--border-thick);
    background: var(--color-surface);
    box-shadow: var(--shadow-brutal);
    padding: var(--space-3);
}

/* ❌ Wrong - hardcoded values */
.card {
    border: 3px solid black;
    padding: 12px;
}
```

### Neo-Brutalist Interactions

```css
.button:hover {
    transform: translate(-2px, -2px);
    box-shadow: var(--shadow-brutal-lg);
}

.button:active {
    transform: translate(2px, 2px);
    box-shadow: 2px 2px 0 0 var(--color-text);
}
```

## Component Documentation

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

## Verification

After creating/modifying components:

```bash
pnpm check        # TypeScript + Svelte check
pnpm biome:check  # Lint and format check
pnpm web:vitest   # Run tests
```

## References

- Full conventions: `.claude/CONVENTIONS.md`
- Design tokens: `packages/web/src/lib/styles/tokens.css`
- UI/UX guide: `docs/UI-UX-DESIGN-REPORT.md`
