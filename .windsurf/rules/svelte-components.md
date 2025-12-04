# Svelte 5 Component Patterns

**Activation**: Glob - `**/*.svelte`
**Purpose**: Svelte 5 runes syntax and component best practices

## Svelte 5 Runes (Critical)

```svelte
<script lang="ts">
// State - use $state rune, NOT writable stores
let count = $state(0);
let user = $state<User | null>(null);

// Derived - use $derived rune, NOT derived stores
let doubled = $derived(count * 2);
let displayName = $derived(user?.display_name ?? 'Guest');

// Effects - use $effect rune
$effect(() => {
  console.log('Count changed:', count);
});

// Props - destructure with defaults
interface Props {
  title: string;
  optional?: number;
}

let { title, optional = 0 }: Props = $props();
</script>
```

## Component Structure

```svelte
<script lang="ts">
// 1. Imports
import { ComponentName } from '$lib/components';
import type { TypeName } from '$lib/types';

// 2. Props interface
interface Props {
  required: string;
  optional?: boolean;
}

// 3. Props destructuring
let { required, optional = false }: Props = $props();

// 4. Local state
let loading = $state(false);
let error = $state<string | null>(null);

// 5. Derived values
let isDisabled = $derived(loading || !required);

// 6. Functions
async function handleAction() {
  loading = true;
  try {
    // action logic
  } catch (e) {
    error = e.message;
  } finally {
    loading = false;
  }
}

// 7. Effects (if needed)
$effect(() => {
  // side effects
});
</script>

<div class="component-name">
  <!-- Template -->
</div>

<style>
/* Scoped styles */
</style>
```

## Database Types

Import from generated types:
```typescript
import type { Tables } from '$lib/types/database';

type Profile = Tables<'profiles'>;
type PlayerStats = Tables<'player_stats'>;
```

## Supabase Client

```typescript
import { createSupabaseBrowserClient } from '$lib/supabase';

const supabase = createSupabaseBrowserClient();
```

## Testing

Co-locate tests: `ComponentName.svelte` → `__tests__/ComponentName.test.ts`

```typescript
import { render, fireEvent } from '@testing-library/svelte';
import ComponentName from '../ComponentName.svelte';

describe('ComponentName', () => {
  it('renders correctly', () => {
    const { getByText } = render(ComponentName, {
      props: { title: 'Test' }
    });
    expect(getByText('Test')).toBeInTheDocument();
  });
});
```

## Design Reference

See `docs/UI-UX-DESIGN-REPORT.md` for:
- Color palette
- Typography
- Spacing
- Component specs
