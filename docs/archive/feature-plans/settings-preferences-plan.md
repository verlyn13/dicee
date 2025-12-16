# Settings & User Preferences Plan

> **Status**: Research Complete - Ready for Implementation  
> **Date**: 2025-12-10  
> **Version**: 2.1 (updated for schema consolidation work)  
> **Scope**: Audio/Haptic settings (v1), user preferences persistence, online presence improvement

### Recent Context (2025-12-10)

Schema consolidation work completed in parallel:
- **Shared schemas consolidated**: `multiplayer.schema.ts` now imports from `@dicee/shared`
- **Layer violations fixed**: Components use prop injection, not direct store imports
- **AKG invariants**: 6/6 passing
- **PlayerTypeSchema added**: `z.enum(['human', 'ai'])` in shared validation

**Impact on this plan**: None - preferences schema is new, follows established patterns.

---

## Executive Summary

This document outlines the plan for:
1. **Settings Menu UI** - Master volume, mute, and haptics toggle (v1 scope)
2. **Preferences Persistence** - localStorage for anonymous, Supabase sync for authenticated users
3. **Online Presence Display** - Change to "X others online" for clearer UX

**v1 Scope (this phase):**
- Master volume slider
- Mute toggle  
- Haptics toggle
- Reset to defaults button

**Deferred to v2:**
- Per-category volume sliders
- Coach mode settings
- Chat notification settings
- Theme/reducedMotion/compactMode

---

## Part 1: Current State Analysis

### 1.1 Existing Preference Storage

| Store | Storage Key | Persistence | Synced Across Devices |
|-------|-------------|-------------|----------------------|
| `audioStore` | `dicee_audio_preferences` | localStorage | ❌ No |
| `coachStore` | `dicee_coach_preferences` | localStorage | ❌ No |
| `chatStore` | `dicee_chat_preferences` | localStorage | ❌ No |
| `telemetry` | `dicee_telemetry_consent` | localStorage | ❌ No |

**Current AudioPreferences interface:**
```typescript
interface AudioPreferences {
  masterVolume: number;      // 0-1
  diceVolume: number;        // 0-1 (v2)
  uiVolume: number;          // 0-1 (v2)
  scoreVolume: number;       // 0-1 (v2)
  systemVolume: number;      // 0-1 (v2)
  muted: boolean;
  hapticsEnabled: boolean;   // Android only - iOS doesn't support Vibration API
}
```

### 1.2 Supabase Profiles Table

**Current columns** (no preferences column exists):
- `id`, `username`, `display_name`, `bio`
- `avatar_seed`, `avatar_style`
- `skill_rating`, `rating_deviation`, `rating_volatility`
- `badges` (jsonb)
- `is_anonymous`, `is_public`
- `created_at`, `updated_at`, `last_seen_at`

**Gap**: No `preferences` column for storing user settings.

### 1.3 Shared Package

**Existing infrastructure:**
- `@dicee/shared` package with Zod 4.1.13
- Validation schemas in `packages/shared/src/validation/schemas.ts`
- Pattern established for shared types with runtime validation

### 1.4 Online Presence System

**Current Architecture:**
```
Client → WebSocket → /ws/lobby → Service Binding → GlobalLobby DO
```

**GlobalLobby DO tracks presence via:**
1. WebSocket tags: `user:${userId}` on each connection
2. `getUniqueUserCount()` iterates all WebSockets, extracts userId from attachments, counts unique

**Current display**: "X online" (includes current user)  
**Problem**: "1 online (you)" when alone is awkward

**For anonymous users on multiple devices:**
- Each device gets a different anonymous `user.id` from Supabase
- This is **expected behavior** - they ARE different anonymous users
- Only authenticated users share the same `user.id` across devices

---

## Part 2: Architecture Design

### 2.1 Preferences Schema (Zod in Shared Package)

**Location**: `packages/shared/src/validation/preferences.ts`

> **Note**: Following existing pattern - validation schemas go in `validation/` folder, not `schemas/`

```typescript
import { z } from 'zod';

// Schema version for future migrations
export const PREFERENCES_VERSION = 1;

// v1 - minimal scope
export const audioPreferencesSchema = z.object({
  masterVolume: z.number().min(0).max(100).default(70),
  muted: z.boolean().default(false),
  // Per-category volumes deferred to v2
});

export const hapticsPreferencesSchema = z.object({
  enabled: z.boolean().default(true),
});

export const userPreferencesSchema = z.object({
  _version: z.literal(PREFERENCES_VERSION),
  audio: audioPreferencesSchema,
  haptics: hapticsPreferencesSchema,
});

export type UserPreferences = z.infer<typeof userPreferencesSchema>;

export const DEFAULT_PREFERENCES: UserPreferences = {
  _version: PREFERENCES_VERSION,
  audio: { masterVolume: 70, muted: false },
  haptics: { enabled: true },
};

/**
 * Parse untrusted preferences data (localStorage, Supabase).
 * Returns defaults if parse fails (corrupted data, old version).
 */
export function parsePreferences(data: unknown): UserPreferences {
  const result = userPreferencesSchema.safeParse(data);
  if (result.success) return result.data;
  
  console.warn('[preferences] Parse failed, using defaults:', result.error);
  return DEFAULT_PREFERENCES;
}
```

**Why Zod in shared package:**
- Single source of truth for the schema
- Runtime validation on read (localStorage, Supabase)
- Type safety everywhere
- Future: can be used by Cloudflare DO if needed

### 2.2 Persistence Strategy

```
┌─────────────────────────────────────────────────────────────────────┐
│                    PREFERENCES PERSISTENCE FLOW                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ANONYMOUS USER:                                                     │
│  ┌──────────────┐                                                   │
│  │ localStorage │ ← Single source of truth                          │
│  │ (per device) │                                                   │
│  └──────────────┘                                                   │
│                                                                      │
│  AUTHENTICATED USER:                                                 │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐          │
│  │ localStorage │───▶│ Sync Service │───▶│ Supabase     │          │
│  │ (cache)      │◀───│              │◀───│ profiles.    │          │
│  └──────────────┘    └──────────────┘    │ preferences  │          │
│                                          └──────────────┘          │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.3 Auth State Change Logic

```typescript
async function onAuthStateChange(user: User | null, previousUser: User | null) {
  if (user && !previousUser) {
    // LOGIN: user just authenticated
    const local = loadFromLocalStorage();
    const remote = await fetchFromSupabase(user.id);
    
    if (!remote || !remote._version) {
      // FIRST LOGIN: user has no remote preferences - seed from local
      await saveToSupabase(user.id, local);
    } else {
      // RETURNING USER: merge and apply
      const merged = mergePreferences(local, remote);
      saveToLocalStorage(merged);
      await saveToSupabase(user.id, merged);
      applyToStores(merged);
    }
  } else if (!user && previousUser) {
    // LOGOUT: keep local preferences, stop syncing
    cancelPendingSync();
  }
}
```

### 2.4 Merge Strategy (Per-Field Rules)

```typescript
/**
 * Merge Strategy:
 * - Device-specific settings (volume, haptics): LOCAL wins
 *   Rationale: My laptop speakers ≠ my phone speakers
 * - User-identity settings (mute state): REMOTE wins
 *   Rationale: "I muted on purpose" should sync
 */
function mergePreferences(
  local: UserPreferences, 
  remote: UserPreferences
): UserPreferences {
  return {
    _version: PREFERENCES_VERSION,
    audio: {
      // Volume is per-device - local wins
      masterVolume: local.audio.masterVolume,
      // Mute state follows user intent - remote wins
      muted: remote.audio.muted,
    },
    haptics: {
      // Haptics is per-device - local wins
      enabled: local.haptics.enabled,
    },
  };
}
```

### 2.5 On Preference Change

```typescript
// 1. Update local store (immediate UI feedback)
// 2. Save to localStorage (immediate persistence)
// 3. Debounce sync to Supabase (500ms) if authenticated
```

### 2.6 Settings UI Design

**Location**: Accessible from header/HUD, not buried in profile page

**UI Pattern**: Slide-out panel (like existing `AudioSettingsPanel.svelte`)

**Trigger**: Settings gear icon in header, next to online indicator

```
┌─────────────────────────────────────────────────────────────────────┐
│  DICEE                                    🔊 ⚙️  2 others  [Avatar] │
└─────────────────────────────────────────────────────────────────────┘
                                             │
                                             ▼
                              ┌─────────────────────────┐
                              │ ⚙️ Settings              │
                              ├─────────────────────────┤
                              │ 🔊 Sound                │
                              │   Master [████░░] 70%   │
                              │   [🔇 Mute]             │
                              │                         │
                              │ 📳 Haptics              │
                              │   [✓] Enabled           │
                              │   (Android only)        │
                              │                         │
                              │ ─────────────────────── │
                              │ [↺ Reset to Defaults]   │
                              └─────────────────────────┘
```

**v1 Features:**
- Master volume slider (0-100%)
- Mute toggle
- Haptics toggle (with "Not supported" on iOS)
- Reset to defaults button
- Close on click outside or Escape key

**Deferred to v2:**
- Per-category volume sliders
- Advanced settings panel
- Coach mode settings
- Chat notification settings

---

## Part 3: Online Presence Improvement

### 3.1 Current Display Issue

**Current**: "X online" (includes current user)  
**Problem**: "1 online (you)" when alone is awkward

### 3.2 Improved Display

**Change to**: "X others online" (excludes current user)

| Scenario | Current Display | New Display |
|----------|-----------------|-------------|
| Just me | "1 online (you)" | "0 others online" or just hide |
| Me + 2 others | "3 online" | "2 others online" |
| Not connected | "Connecting..." | "Connecting..." |

### 3.3 Implementation

**GlobalLobby DO response change:**
```typescript
// In presence payload
{
  onlineCount: 5,        // Total including me
  othersCount: 4,        // Excluding me (new field)
}
```

**Client display logic:**
```typescript
const onlineDisplay = $derived(
  lobby.connectionState !== 'connected'
    ? 'Connecting...'
    : lobby.othersCount === 0
      ? '' // Hide when alone, or show "Lobby Open"
      : `${lobby.othersCount} others online`
);
```

### 3.4 Anonymous Users on Multiple Devices

**Expected behavior**: Each device gets a different anonymous `user.id`  
**Reason**: Anonymous sign-in creates a new Supabase user per device  
**Result**: Same person on 2 devices = 2 different users in the count

**This is correct behavior** - no bug to fix. Only authenticated users share identity across devices.

---

## Part 4: Implementation Plan

### Phase 1: Shared Schema

**Create**: `packages/shared/src/validation/preferences.ts`

```typescript
import { z } from 'zod';

export const PREFERENCES_VERSION = 1;

export const audioPreferencesSchema = z.object({
  masterVolume: z.number().min(0).max(100).default(70),
  muted: z.boolean().default(false),
});

export const hapticsPreferencesSchema = z.object({
  enabled: z.boolean().default(true),
});

export const userPreferencesSchema = z.object({
  _version: z.literal(PREFERENCES_VERSION),
  audio: audioPreferencesSchema,
  haptics: hapticsPreferencesSchema,
});

export type UserPreferences = z.infer<typeof userPreferencesSchema>;

export const DEFAULT_PREFERENCES: UserPreferences = {
  _version: PREFERENCES_VERSION,
  audio: { masterVolume: 70, muted: false },
  haptics: { enabled: true },
};

export function parsePreferences(data: unknown): UserPreferences {
  const result = userPreferencesSchema.safeParse(data);
  if (result.success) return result.data;
  console.warn('[preferences] Parse failed, using defaults:', result.error);
  return DEFAULT_PREFERENCES;
}
```

**Update**: `packages/shared/src/validation/index.ts` to export the schema (auto-exported via index.ts).

### Phase 2: Database Migration (Supabase)

**Migration**: `supabase/migrations/YYYYMMDDHHMMSS_add_preferences_column.sql`

```sql
-- Add preferences column to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS preferences JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.profiles.preferences IS 
  'User preferences JSON. Schema: packages/shared/src/validation/preferences.ts';
```

**Note**: No index on `_version` - premature optimization. Add if/when needed.

### Phase 3: Preferences Service

**Create**: `packages/web/src/lib/services/preferences.svelte.ts`

```typescript
/**
 * Preferences Service (Svelte 5 Runes)
 * 
 * Handles sync between localStorage and Supabase.
 * - Anonymous: localStorage only
 * - Authenticated: localStorage + Supabase sync
 */

import { parsePreferences, DEFAULT_PREFERENCES, type UserPreferences } from '@dicee/shared';

const STORAGE_KEY = 'dicee_user_preferences';

class PreferencesService {
  // Load from localStorage, validate with Zod
  load(): UserPreferences;
  
  // Save to localStorage, debounce sync to Supabase if authenticated
  save(prefs: Partial<UserPreferences>): void;
  
  // Called on auth state change
  onLogin(userId: string): Promise<void>;
  onLogout(): void;
  
  // Reset to defaults (both local and remote)
  reset(): Promise<void>;
}
```

### Phase 4: Settings UI Components

**Files to create:**

| File | Purpose |
|------|--------|
| `packages/web/src/lib/components/settings/SettingsPanel.svelte` | Main panel with all controls |
| `packages/web/src/lib/components/settings/SettingsButton.svelte` | Header trigger (gear icon) |
| `packages/web/src/lib/components/settings/VolumeSlider.svelte` | Reusable slider component |
| `packages/web/src/lib/components/settings/index.ts` | Barrel export |

**Integration:**
- Add `SettingsButton` to header
- Wire to existing `audioStore` for immediate effect
- Connect to preferences service for persistence

### Phase 5: Online Presence Update

1. Add `othersCount` field to GlobalLobby presence payload
2. Update `lobby.svelte.ts` to use `othersCount`
3. Update display to "X others online"

### Phase 6: Testing

**Unit tests:**
- `parsePreferences()` with valid/invalid/corrupted data
- Merge logic (local vs remote)
- Reset to defaults

**Integration tests:**
- Login → preferences sync
- Preference change → Supabase update within 1s
- Logout → preferences retained locally

**Manual tests:**
- Anonymous user: preferences persist across page refresh
- Authenticated user: preferences sync across devices
- Settings panel: opens/closes correctly

---

## Part 5: Files to Modify/Create

### New Files

| File | Purpose |
|------|---------|
| `packages/shared/src/validation/preferences.ts` | Zod schema + defaults |
| `supabase/migrations/YYYYMMDDHHMMSS_add_preferences_column.sql` | Add preferences column |
| `packages/web/src/lib/services/preferences.svelte.ts` | Sync service (Svelte 5 runes) |
| `packages/web/src/lib/components/settings/SettingsPanel.svelte` | Main settings UI |
| `packages/web/src/lib/components/settings/SettingsButton.svelte` | Header button |
| `packages/web/src/lib/components/settings/VolumeSlider.svelte` | Reusable slider |
| `packages/web/src/lib/components/settings/index.ts` | Barrel export |
| `packages/web/src/lib/services/__tests__/preferences.test.ts` | Unit tests |

### Modified Files

| File | Changes |
|------|---------|
| `packages/shared/src/validation/index.ts` | Export preferences schema |
| `packages/web/src/lib/stores/audio.svelte.ts` | Wire to preferences service |
| `packages/web/src/routes/+layout.svelte` | Add SettingsButton to header |
| `packages/web/src/lib/stores/lobby.svelte.ts` | Use `othersCount` for display |
| `packages/cloudflare-do/src/GlobalLobby.ts` | Add `othersCount` to presence payload |

---

## Part 6: Error Handling

### Supabase Sync Failures

- **On save failure**: Log error, keep local state, retry on next change
- **On load failure**: Use localStorage as fallback, warn in console
- **Never block UI on sync** - localStorage is immediate, Supabase is eventual

### Corrupted Preferences

- Use Zod `safeParse` - invalid data returns defaults
- Log corruption for debugging
- Don't throw - graceful degradation

### Version Migrations

- Check `_version` on load
- If old version, run migration function (future)
- If unknown version (future client?), use defaults + warn

---

## Part 7: Acceptance Criteria

### Must Have (v1)

- [ ] Gear icon in header opens settings panel
- [ ] Volume slider updates audio immediately (no save button)
- [ ] Mute toggle stops all sound immediately
- [ ] Haptics toggle works on Android, shows "Not supported" on iOS
- [ ] Reset to Defaults button restores all settings
- [ ] Settings persist after page refresh (localStorage)
- [ ] Authenticated user: settings sync to Supabase within 1s of change
- [ ] Authenticated user: settings load from Supabase on login
- [ ] Panel closes on click outside or Escape key

### Nice to Have (defer to v2)

- [ ] Per-category volume sliders
- [ ] "X others online" instead of "X online"
- [ ] Settings sync conflict resolution UI
- [ ] Advanced settings panel

---

## Part 8: Implementation Order

1. **Create shared schema** (`packages/shared/src/schemas/preferences.ts`)
2. **Create Supabase migration** (add preferences column)
3. **Implement preferences service** (`preferences.svelte.ts`)
4. **Build settings UI** (SettingsPanel, SettingsButton, VolumeSlider)
5. **Wire to audio store** (immediate effect on change)
6. **Wire to auth store** (sync on login/logout)
7. **Update online presence display** (othersCount)
8. **Test thoroughly**
9. **Deploy**

---

## Appendix: Resolved Questions

| Question | Decision |
|----------|----------|
| Merge strategy | Per-field: volume/haptics = local wins, mute = remote wins |
| Anonymous → Auth upgrade | First login seeds remote from local |
| Settings location | Header icon (always accessible) |
| Online presence | Change to "X others online" (deferred to v2) |
