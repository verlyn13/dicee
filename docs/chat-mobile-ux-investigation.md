# Chat & Mobile Keyboard UX Enhancement Plan

**Date**: 2025-12-10  
**Status**: Planning Complete - Ready for Implementation  
**Priority**: High (user-reported mobile UX issues)  
**Estimated Effort**: 12-15 hours  
**Phase**: Maintenance / UX Polish

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Current Architecture](#current-architecture)
3. [Problem Analysis](#problem-analysis)
4. [Task Breakdown](#task-breakdown)
5. [Implementation Details](#implementation-details)
6. [Testing Strategy](#testing-strategy)
7. [Risk Assessment](#risk-assessment)
8. [Success Criteria](#success-criteria)

---

## Executive Summary

### The Problem

The project has **three distinct chat contexts** with inconsistent mobile keyboard handling. The **global lobby chat works well** on mobile (Pixel confirmed), but **in-game, waiting room, and spectator chats** have alignment and usability issues when the mobile keyboard opens.

### Root Cause

The global lobby chat is an **inline component** that flows naturally with the page. The other chats use a **fixed-position bottom sheet** that requires precise coordination with the Visual Viewport API - and this coordination has gaps.

### Solution Overview

| Priority | Task | Effort | Impact |
|----------|------|--------|--------|
| **P0** | Add keyboard awareness to MultiplayerGameView | 2h | High |
| **P0** | Fix ChatPanel positioning strategy | 2h | High |
| **P0** | Improve ChatInput focus behavior | 1.5h | High |
| **P1** | Fix waiting room container sizing | 1h | Medium |
| **P1** | Add keyboard awareness to SpectatorView | 1h | Medium |
| **P2** | Add swipe-to-close gesture | 2h | Medium |
| **P2** | Unify chat toggle UX across contexts | 1.5h | Low |
| **P3** | Extract shared keyboard-aware CSS utilities | 2h | Low |

---

## Current Architecture

### Chat Components Map

```
packages/web/src/lib/components/
├── chat/                          # Multiplayer/game chat
│   ├── ChatPanel.svelte           # Fixed bottom sheet (406 lines)
│   │   └── Uses: getChatStore(), keyboard-aware CSS
│   ├── ChatInput.svelte           # Textarea with focus handling (216 lines)
│   │   └── Uses: getChatStore(), scrollIntoView on focus
│   ├── QuickChatBar.svelte        # Auto-hides when keyboard open (113 lines)
│   │   └── Uses: :global(html.keyboard-open) CSS
│   ├── ChatMessage.svelte
│   ├── ReactionBar.svelte
│   ├── ReactionFloat.svelte
│   └── TypingIndicator.svelte
│
└── lobby/                         # Global lobby chat (DIFFERENT)
    └── ChatPanel.svelte           # Inline panel (202 lines)
        └── Uses: lobby store directly, NO keyboard handling
```

### Where Chat is Used

| Route/Component | Chat Component | Store | Keyboard Handling |
|-----------------|----------------|-------|-------------------|
| `LobbyLanding.svelte` | `lobby/ChatPanel` | `lobby.svelte` | ❌ None (inline) |
| `RoomLobby.svelte` | `chat/ChatPanel` | `chat.svelte` | ✅ Has CSS rules |
| `MultiplayerGameView.svelte` | `chat/ChatPanel` | `chat.svelte` | ⚠️ Incomplete |
| `SpectatorView.svelte` | `chat/ChatPanel` | `chat.svelte` | ⚠️ Incomplete |

### Keyboard Infrastructure

**File**: `packages/web/src/lib/utils/keyboard.ts` (155 lines)

```typescript
// Initialized in +layout.svelte onMount
initKeyboardHandler()
  ├── Listens to: visualViewport.resize, visualViewport.scroll
  ├── Updates: --keyboard-height CSS variable
  ├── Adds: html.keyboard-open class when height > 150px
  └── Uses: RAF throttling to prevent layout thrashing
```

**CSS Variables** (defined in `global.css`):
```css
:root {
  --keyboard-height: 0px;  /* Updated by keyboard.ts */
}

/* Utility classes available */
.h-screen-safe { height: 100svh; }
.h-screen-keyboard { height: calc(100svh - var(--keyboard-height, 0px)); }
.keyboard-aware-bottom { padding-bottom: env(keyboard-inset-height, var(--keyboard-height, 0px)); }
```

**Z-Index Stack** (from `tokens.css`):
```css
--z-game: 100;
--z-hud: 300;
--z-tooltip: 400;
--z-modal: 500;
--z-bottomsheet: 600;  /* ChatPanel uses this */
--z-alert: 1000;
```

---

## Problem Analysis

### Issue 1: MultiplayerGameView Has NO Keyboard Awareness (P0)

**Current State** (`MultiplayerGameView.svelte` lines 350-686):
- `.multiplayer-game-view` uses `min-height: 100svh` ✅
- `.game-layout` has no keyboard-open rules ❌
- `.mobile-player-bar` has no keyboard-open rules ❌
- No `:global(html.keyboard-open)` selectors anywhere ❌

**Impact**: When keyboard opens, the game view doesn't shrink, causing:
- Chat panel overlaps game content
- User can't see dice/scorecard while typing
- Scroll conflicts between game and chat

**Evidence**: Compare to `QuickChatBar.svelte` which correctly hides:
```css
@media (max-width: 768px) {
  :global(html.keyboard-open) .quick-chat-bar {
    display: none;
  }
}
```

### Issue 2: ChatPanel Fixed Positioning Strategy (P0)

**Current State** (`ChatPanel.svelte` lines 204-246):
```css
@media (max-width: 768px) {
  .chat-panel {
    position: fixed;
    bottom: var(--keyboard-height, 0px);  /* Moves up with keyboard */
    max-height: 60svh;
    z-index: var(--z-bottomsheet, 100);
  }
  
  :global(html.keyboard-open) .chat-panel {
    max-height: min(40svh, calc(100svh - var(--keyboard-height, 0px) - 60px));
  }
  
  :global(html.keyboard-open) .messages-container {
    max-height: 120px;  /* Hard limit */
  }
}
```

**Problems**:
1. `bottom: var(--keyboard-height)` animates with `transition: bottom` but this can cause jank
2. The 60px offset in max-height calculation is arbitrary - doesn't account for game header height
3. `max-height: 120px` for messages is too restrictive on larger phones
4. No consideration for safe-area-inset-bottom when keyboard is open

**Better Approach**: Use `transform: translateY()` instead of `bottom` for smoother animation:
```css
.chat-panel {
  position: fixed;
  bottom: 0;
  transform: translateY(calc(-1 * var(--keyboard-height, 0px)));
  will-change: transform;  /* GPU acceleration hint */
}
```

### Issue 3: ChatInput Focus Behavior (P0)

**Current State** (`ChatInput.svelte` lines 44-53):
```typescript
function handleFocus(): void {
  // Delay to allow keyboard animation to complete (typically 250-300ms)
  setTimeout(() => {
    inputElement?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, 300);
}
```

**Problems**:
1. Fixed 300ms delay is a guess - keyboard animation varies by device
2. `block: 'center'` may scroll too much, pushing content off screen
3. No integration with Visual Viewport API for precise timing
4. No handling for when scrollIntoView fails or is interrupted

**Better Approach**: Listen for Visual Viewport resize event:
```typescript
function handleFocus(): void {
  if (!window.visualViewport) {
    // Fallback for older browsers
    setTimeout(() => {
      inputElement?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }, 300);
    return;
  }
  
  let resizeCount = 0;
  const handleResize = () => {
    resizeCount++;
    // Wait for second resize (keyboard fully open)
    if (resizeCount >= 2) {
      inputElement?.scrollIntoView({ behavior: 'smooth', block: 'end' });
      window.visualViewport?.removeEventListener('resize', handleResize);
    }
  };
  
  window.visualViewport.addEventListener('resize', handleResize);
  
  // Cleanup after 600ms if resize never fires
  setTimeout(() => {
    window.visualViewport?.removeEventListener('resize', handleResize);
  }, 600);
}
```

### Issue 4: Waiting Room Container Sizing (P1)

**Current State** (`MultiplayerGameView.svelte` lines 352-360):
```css
.waiting-room-container {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  min-height: 100svh;
  padding: var(--space-3);
  background: var(--color-background);
}
```

**Problems**:
1. Uses `min-height` not `max-height` - container can grow beyond viewport
2. No keyboard-open rules
3. `RoomLobby` inside has its own layout that doesn't account for keyboard
4. Chat panel (fixed position) overlaps the waiting room content

**Fix Required**:
```css
.waiting-room-container {
  min-height: 100svh;
  max-height: 100svh;
  overflow-y: auto;
}

:global(html.keyboard-open) .waiting-room-container {
  max-height: calc(100svh - var(--keyboard-height, 0px));
}
```

### Issue 5: SpectatorView Missing Keyboard Awareness (P1)

**Current State** (`SpectatorView.svelte` lines 280-489):
- `.spectator-view` uses `min-height: 100svh` ✅
- No `:global(html.keyboard-open)` selectors ❌
- Same problems as MultiplayerGameView

### Issue 6: No Swipe-to-Close Gesture (P2)

**Current State**: Chat panel can only be closed by:
- Tapping the header toggle button
- Pressing Escape key (desktop only)

**Mobile UX Expectation**: Bottom sheets should support swipe-down to close.

### Issue 7: Inconsistent Chat Toggle UX (P2)

| Context | Open Method | Close Method | Keyboard Shortcut |
|---------|-------------|--------------|-------------------|
| Global Lobby | Tab toggle | Tab toggle | None |
| Waiting Room | Header button | Header button, Escape | None |
| In-Game | Header button | Header button, Escape | 'C' key |
| Spectator | Header button | Header button, Escape | 'C' key |

**Inconsistencies**:
- Global lobby has no keyboard shortcuts
- 'C' key only works in game/spectator, not waiting room
- No visual indication of keyboard shortcuts on mobile

---

## Task Breakdown

### Task 1: Add Keyboard Awareness to MultiplayerGameView (P0)

**File**: `packages/web/src/lib/components/game/MultiplayerGameView.svelte`

**Changes Required**:

1. Add keyboard-open CSS rules for mobile layout:
```css
/* Add after line 477 (after .mobile-player-bar desktop hide rule) */
@media (max-width: 767px) {
  :global(html.keyboard-open) .mobile-player-bar {
    display: none;
  }
  
  :global(html.keyboard-open) .game-layout {
    max-height: calc(100svh - var(--keyboard-height, 0px) - 48px);
    overflow: hidden;
  }
  
  :global(html.keyboard-open) .scorecard-area {
    display: none;
  }
  
  :global(html.keyboard-open) .dice-area {
    max-height: 150px;
    overflow: hidden;
  }
  
  :global(html.keyboard-open) .turn-status {
    display: none;
  }
}
```

2. Update `.multiplayer-game-view` to use max-height:
```css
.multiplayer-game-view {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  min-height: 100svh;
  max-height: 100svh;  /* ADD THIS */
  overflow: hidden;     /* ADD THIS */
  background: var(--color-background);
}
```

**Considerations**:
- Hiding scorecard when keyboard open is aggressive but necessary for space
- User can close chat to see scorecard
- Dice area shrink ensures user can still see their dice while typing

**Testing**:
- Open game on mobile
- Tap chat input
- Verify: mobile player bar hides, scorecard hides, dice area shrinks
- Verify: chat input is visible and usable
- Close chat, verify everything returns to normal

---

### Task 2: Fix ChatPanel Positioning Strategy (P0)

**File**: `packages/web/src/lib/components/chat/ChatPanel.svelte`

**Changes Required**:

1. Replace `bottom` positioning with `transform`:
```css
/* Replace lines 204-246 with: */
@media (max-width: 768px) {
  .chat-panel {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    /* Use transform for smoother animation */
    transform: translateY(calc(-1 * var(--keyboard-height, 0px)));
    /* Dynamic max-height based on available space */
    max-height: min(60svh, calc(100svh - var(--keyboard-height, 0px) - 80px));
    border-radius: var(--radius-md) var(--radius-md) 0 0;
    z-index: var(--z-bottomsheet);
    transition: transform var(--transition-medium) ease,
                max-height var(--transition-medium) ease;
    box-shadow: var(--shadow-brutal-lg);
    /* Safe area for notched devices */
    padding-bottom: env(safe-area-inset-bottom, 0px);
    /* GPU acceleration */
    will-change: transform, max-height;
  }

  .chat-panel.collapsed {
    transform: translateY(calc(100% - 48px - var(--keyboard-height, 0px)));
  }

  /* When keyboard is open, further reduce height */
  :global(html.keyboard-open) .chat-panel {
    max-height: min(45svh, calc(100svh - var(--keyboard-height, 0px) - 60px));
  }

  /* Reduce messages container when keyboard is open */
  :global(html.keyboard-open) .messages-container {
    max-height: 100px;
    min-height: 60px;
  }
  
  /* Hide quick chat when keyboard open (already exists in QuickChatBar) */
}
```

2. Add transition for collapsed state transform:
```css
.chat-panel.collapsed {
  transform: translateY(calc(100% - 48px));
}

/* When keyboard open AND collapsed, account for keyboard */
:global(html.keyboard-open) .chat-panel.collapsed {
  transform: translateY(calc(100% - 48px - var(--keyboard-height, 0px)));
}
```

**Considerations**:
- `will-change: transform` hints GPU acceleration
- 80px offset accounts for game header (~48px) + buffer
- `min()` function ensures we don't exceed reasonable height
- Collapsed state needs keyboard offset too

**Testing**:
- Open chat on mobile
- Tap input to open keyboard
- Verify: chat smoothly animates up
- Verify: no jank or flicker during animation
- Verify: messages container is scrollable
- Close keyboard, verify smooth animation down

---

### Task 3: Improve ChatInput Focus Behavior (P0)

**File**: `packages/web/src/lib/components/chat/ChatInput.svelte`

**Changes Required**:

1. Replace `handleFocus` function (lines 44-53):
```typescript
/**
 * Scroll input into view when focused on mobile.
 * Uses Visual Viewport API for precise timing instead of fixed delay.
 */
function handleFocus(): void {
  // Skip on desktop (no virtual keyboard)
  if (window.innerWidth > 768) return;
  
  if (!window.visualViewport) {
    // Fallback for older browsers
    setTimeout(() => {
      inputElement?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }, 350);
    return;
  }
  
  // Track resize events to detect keyboard fully open
  let resizeCount = 0;
  let timeoutId: ReturnType<typeof setTimeout>;
  
  const handleResize = () => {
    resizeCount++;
    // Keyboard animation typically fires 2-3 resize events
    // Wait for stabilization (no resize for 100ms)
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      inputElement?.scrollIntoView({ behavior: 'smooth', block: 'end' });
      cleanup();
    }, 100);
  };
  
  const cleanup = () => {
    window.visualViewport?.removeEventListener('resize', handleResize);
    clearTimeout(timeoutId);
  };
  
  window.visualViewport.addEventListener('resize', handleResize);
  
  // Cleanup after 800ms if resize never fires (keyboard already open)
  setTimeout(() => {
    if (resizeCount === 0) {
      // Keyboard was already open, just scroll
      inputElement?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
    cleanup();
  }, 800);
}
```

2. Add blur handler to reset scroll position (optional enhancement):
```typescript
function handleBlur(): void {
  chat.setTyping(false);
  // Optional: scroll game view back to top when keyboard closes
  // This prevents the view from being stuck in a scrolled state
}
```

**Considerations**:
- `block: 'end'` is better than `block: 'center'` - keeps more content visible
- Debouncing resize events prevents multiple scroll calls
- 800ms timeout handles case where keyboard is already open
- Desktop check prevents unnecessary work

**Testing**:
- Open chat on mobile
- Tap input
- Verify: input scrolls into view after keyboard opens
- Verify: no double-scroll or jank
- Tap input when keyboard already open
- Verify: no scroll (already visible)

---

### Task 4: Fix Waiting Room Container Sizing (P1)

**File**: `packages/web/src/lib/components/game/MultiplayerGameView.svelte`

**Changes Required**:

1. Update `.waiting-room-container` CSS (lines 352-360):
```css
.waiting-room-container {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  min-height: 100svh;
  max-height: 100svh;  /* ADD: prevent overflow */
  overflow-y: auto;     /* ADD: allow scroll if needed */
  padding: var(--space-3);
  background: var(--color-background);
}

/* ADD: keyboard awareness */
@media (max-width: 768px) {
  :global(html.keyboard-open) .waiting-room-container {
    max-height: calc(100svh - var(--keyboard-height, 0px));
    align-items: flex-start;  /* Align to top when keyboard open */
    padding-top: var(--space-2);
  }
}
```

**Considerations**:
- `align-items: flex-start` when keyboard open prevents content from being centered off-screen
- `overflow-y: auto` allows scrolling if RoomLobby content is taller than available space
- Reduced padding when keyboard open saves space

**Testing**:
- Join a room (waiting room phase)
- Open chat
- Tap input to open keyboard
- Verify: waiting room content is visible above chat
- Verify: can scroll waiting room if needed
- Verify: chat input is usable

---

### Task 5: Add Keyboard Awareness to SpectatorView (P1)

**File**: `packages/web/src/lib/components/spectator/SpectatorView.svelte`

**Changes Required**:

1. Add keyboard-open CSS rules (add after line 489):
```css
/* Keyboard awareness for mobile */
@media (max-width: 767px) {
  :global(html.keyboard-open) .spectator-view {
    max-height: calc(100svh - var(--keyboard-height, 0px));
    overflow: hidden;
  }
  
  :global(html.keyboard-open) .spectator-layout {
    max-height: calc(100svh - var(--keyboard-height, 0px) - 100px);
    overflow: hidden;
  }
  
  :global(html.keyboard-open) .scorecards-area {
    display: none;
  }
  
  :global(html.keyboard-open) .dice-display {
    max-height: 120px;
    overflow: hidden;
  }
  
  :global(html.keyboard-open) .spectator-status {
    display: none;
  }
  
  :global(html.keyboard-open) .keyboard-hint {
    display: none;
  }
}
```

**Considerations**:
- Similar approach to MultiplayerGameView
- Hide scorecards and status when keyboard open
- Keep dice visible but smaller

**Testing**:
- Join as spectator
- Open chat
- Tap input
- Verify: scorecards hide, dice shrink
- Verify: chat is usable
- Close chat, verify everything returns

---

### Task 6: Add Swipe-to-Close Gesture (P2)

**File**: `packages/web/src/lib/components/chat/ChatPanel.svelte`

**Changes Required**:

1. Add touch handling state and functions (add to script section):
```typescript
// Swipe-to-close state
let touchStartY = 0;
let touchDeltaY = 0;
let isSwiping = false;

function handleTouchStart(e: TouchEvent): void {
  // Only track swipes on the header
  touchStartY = e.touches[0].clientY;
  touchDeltaY = 0;
  isSwiping = true;
}

function handleTouchMove(e: TouchEvent): void {
  if (!isSwiping) return;
  touchDeltaY = e.touches[0].clientY - touchStartY;
  
  // Only allow downward swipes
  if (touchDeltaY < 0) {
    touchDeltaY = 0;
  }
  
  // Apply visual feedback (optional: translate panel)
  if (panelElement && touchDeltaY > 0) {
    panelElement.style.transform = `translateY(${touchDeltaY}px)`;
  }
}

function handleTouchEnd(): void {
  if (!isSwiping) return;
  isSwiping = false;
  
  // Reset transform
  if (panelElement) {
    panelElement.style.transform = '';
  }
  
  // If swiped down more than 80px, close the panel
  if (touchDeltaY > 80) {
    onToggle?.();
    chatInputRef?.blur();
  }
  
  touchDeltaY = 0;
}
```

2. Add touch handlers to chat header (update lines 115-128):
```svelte
<button
  type="button"
  class="chat-header"
  onclick={onToggle}
  ontouchstart={handleTouchStart}
  ontouchmove={handleTouchMove}
  ontouchend={handleTouchEnd}
  aria-expanded={!collapsed}
  aria-controls="chat-body"
>
```

3. Add CSS for swipe visual feedback:
```css
.chat-panel {
  /* ... existing styles ... */
  touch-action: pan-y;  /* Allow vertical touch gestures */
}

.chat-header {
  /* ... existing styles ... */
  touch-action: pan-y;
  user-select: none;  /* Prevent text selection during swipe */
}
```

**Considerations**:
- 80px threshold feels natural for "intentional close"
- Visual feedback (translate) makes gesture feel responsive
- Only header is swipeable (not messages, which need scroll)
- Reset transform on touch end to prevent stuck state

**Testing**:
- Open chat on mobile
- Swipe down on header
- Verify: panel follows finger
- Verify: panel closes if swipe > 80px
- Verify: panel snaps back if swipe < 80px
- Verify: messages still scrollable

---

### Task 7: Unify Chat Toggle UX (P2)

**Files**: 
- `packages/web/src/lib/components/lobby/RoomLobby.svelte`
- `packages/web/src/lib/components/lobby/LobbyLanding.svelte`

**Changes Required**:

1. Add 'C' key shortcut to RoomLobby (add to script section):
```typescript
import { onMount } from 'svelte';

onMount(() => {
  function handleKeydown(e: KeyboardEvent): void {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
      return;
    }
    
    if (e.key.toLowerCase() === 'c' && chatStore) {
      e.preventDefault();
      handleChatToggle();
    }
  }
  
  document.addEventListener('keydown', handleKeydown);
  return () => document.removeEventListener('keydown', handleKeydown);
});
```

2. Add keyboard hint to RoomLobby chat toggle button:
```svelte
<button
  type="button"
  class="chat-toggle"
  onclick={handleChatToggle}
  aria-label="Toggle chat (C)"
  title="Toggle chat (C)"
>
```

3. Consider adding 'C' key to LobbyLanding for global lobby chat (optional - different UX pattern)

**Considerations**:
- Waiting room should have same shortcuts as in-game
- Global lobby is different (tab-based) - may not need 'C' key
- Keyboard hints should be hidden on mobile (no physical keyboard)

**Testing**:
- Join waiting room
- Press 'C' key
- Verify: chat toggles
- Press Escape
- Verify: chat closes

---

### Task 8: Extract Shared Keyboard-Aware CSS Utilities (P3)

**File**: `packages/web/src/lib/styles/global.css`

**Changes Required**:

1. Add keyboard-aware utility classes:
```css
/* ==========================================================================
 * Keyboard-Aware Layout Utilities
 * ========================================================================== */

/* Hide element when keyboard is open (mobile only) */
@media (max-width: 768px) {
  :global(html.keyboard-open) .hide-on-keyboard {
    display: none !important;
  }
  
  /* Reduce element height when keyboard is open */
  :global(html.keyboard-open) .shrink-on-keyboard {
    max-height: 120px !important;
    overflow: hidden !important;
  }
  
  /* Limit container to available space above keyboard */
  :global(html.keyboard-open) .keyboard-aware-container {
    max-height: calc(100svh - var(--keyboard-height, 0px)) !important;
    overflow: hidden !important;
  }
}
```

2. Refactor components to use utility classes instead of component-specific CSS (optional, reduces duplication)

**Considerations**:
- `!important` needed for utility classes to override component styles
- Could use CSS layers instead of !important in future
- Utility classes are optional - components can still use inline :global() rules

---

## Testing Strategy

### Manual Testing Matrix

| Test Case | Lobby | Waiting Room | In-Game | Spectator |
|-----------|-------|--------------|---------|-----------|
| Chat opens/closes | ✓ | ✓ | ✓ | ✓ |
| Keyboard opens, chat moves up | N/A | ✓ | ✓ | ✓ |
| Input visible when keyboard open | ✓ | ✓ | ✓ | ✓ |
| Messages scrollable when keyboard open | ✓ | ✓ | ✓ | ✓ |
| Quick chat hides when keyboard open | N/A | ✓ | ✓ | ✓ |
| Game content adjusts when keyboard open | N/A | ✓ | ✓ | ✓ |
| Escape closes chat | N/A | ✓ | ✓ | ✓ |
| 'C' key toggles chat | N/A | ✓ | ✓ | ✓ |
| Swipe-to-close works | N/A | ✓ | ✓ | ✓ |
| No layout shift on keyboard close | ✓ | ✓ | ✓ | ✓ |

### Devices to Test

| Device | OS | Browser | Priority |
|--------|----|---------|---------| 
| Pixel 7 | Android 14 | Chrome | High (user's device) |
| iPhone 14 | iOS 17 | Safari | High |
| iPhone SE | iOS 17 | Safari | Medium (small screen) |
| iPad | iPadOS 17 | Safari | Low |
| Galaxy S23 | Android 14 | Samsung Internet | Medium |

### Automated Tests

1. **Unit Tests** (Vitest):
   - `keyboard.ts` functions with mocked visualViewport
   - ChatInput focus behavior with mocked DOM

2. **Component Tests** (Vitest + Testing Library):
   - ChatPanel collapsed/expanded states
   - Swipe gesture detection

3. **E2E Tests** (Playwright):
   - Mobile viewport chat flow
   - Keyboard simulation (limited support)

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| iOS Safari behaves differently | Medium | High | Test on real iOS device, not just simulator |
| Transform animation causes repaint | Low | Medium | Use `will-change`, test on low-end devices |
| Swipe gesture conflicts with scroll | Medium | Medium | Only enable on header, not messages |
| Keyboard height detection fails | Low | High | Fallback to fixed delay, test edge cases |
| Z-index conflicts with modals | Low | Medium | Document z-index stack, test modal + chat |

---

## Success Criteria

### Must Have (P0/P1)
- [ ] In-game chat is fully usable on Pixel phone
- [ ] Waiting room chat is fully usable on Pixel phone
- [ ] Spectator chat is fully usable on Pixel phone
- [ ] Keyboard opens/closes without layout jank
- [ ] Input is always visible when keyboard is open
- [ ] Messages are scrollable when keyboard is open

### Should Have (P2)
- [ ] Swipe-to-close gesture works on chat panel
- [ ] 'C' key works in all chat contexts
- [ ] Consistent UX across all chat contexts

### Nice to Have (P3)
- [ ] Shared CSS utilities reduce code duplication
- [ ] Automated tests cover keyboard scenarios

---

## Files to Modify

| File | Priority | Changes |
|------|----------|---------|
| `components/game/MultiplayerGameView.svelte` | P0, P1 | Add keyboard-open CSS, fix waiting room container |
| `components/chat/ChatPanel.svelte` | P0, P2 | Fix positioning, add swipe gesture |
| `components/chat/ChatInput.svelte` | P0 | Improve focus behavior |
| `components/spectator/SpectatorView.svelte` | P1 | Add keyboard-open CSS |
| `components/lobby/RoomLobby.svelte` | P2 | Add 'C' key shortcut |
| `styles/global.css` | P3 | Add utility classes |

---

## Implementation Order

1. **Sprint 1 (P0)**: Core keyboard fixes
   - Task 1: MultiplayerGameView keyboard awareness
   - Task 2: ChatPanel positioning
   - Task 3: ChatInput focus behavior
   - **Test on Pixel after each task**

2. **Sprint 2 (P1)**: Secondary fixes
   - Task 4: Waiting room container
   - Task 5: SpectatorView keyboard awareness
   - **Full regression test**

3. **Sprint 3 (P2)**: UX polish
   - Task 6: Swipe-to-close
   - Task 7: Unified shortcuts
   - **User acceptance testing**

4. **Sprint 4 (P3)**: Cleanup
   - Task 8: Shared CSS utilities
   - Documentation updates

---

## References

- `packages/web/src/lib/utils/keyboard.ts` - Visual Viewport API implementation
- `packages/web/src/lib/styles/global.css` - Keyboard utility classes
- `packages/web/src/lib/styles/tokens.css` - Z-index stack
- `docs/references/keyboard-layout-research.md` - Browser research
- MCP Memory: `MobileKeyboardChatPattern` - Previous implementation notes
- MCP Memory: `ChatPanelKeyboardPattern` - Escape handling pattern
