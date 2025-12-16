# Animation Research Report
## Dicee Multiplayer Game UI — Phase 5 Task game-4

**Date**: December 4, 2025  
**Author**: Windsurf/Cascade  
**Task**: game-4 (Interaction Feedback)  
**Status**: Research Complete — Ready for Implementation

---

## Executive Summary

This report documents the current animation implementation, design system constraints, and planned enhancements for the Dicee multiplayer game UI. The goal is to provide tactile, satisfying feedback that reinforces game state changes without overwhelming the Neo-Brutalist aesthetic.

**Key Findings**:
- Current animations are minimal (10 keyframe definitions across codebase)
- Design system provides 4 transition speeds (50ms–500ms)
- Reduced motion support already implemented
- game-4 requires 6 new animation deliverables

---

## Table of Contents

1. [Current Animation Inventory](#current-animation-inventory)
2. [Design System Constraints](#design-system-constraints)
3. [game-4 Deliverables](#game-4-deliverables)
4. [Animation Specifications](#animation-specifications)
5. [Implementation Approach](#implementation-approach)
6. [Accessibility Considerations](#accessibility-considerations)
7. [Performance Budget](#performance-budget)
8. [Recommended Libraries](#recommended-libraries)

---

## Current Animation Inventory

### Existing Keyframe Animations (10 total)

| Component | Animation | Duration | Purpose |
|-----------|-----------|----------|---------|
| `Die.svelte` | `roll` | 100ms infinite | Dice wobble during roll |
| `GameOverModal.svelte` | `modal-enter` | 300ms | Modal slide-in |
| `MultiplayerGameOverModal.svelte` | `modal-enter` | 300ms | Modal slide-in |
| `TurnIndicator.svelte` | `pulse-warning` | 1s infinite | AFK warning pulse |
| `KeyboardHelp.svelte` | `panel-enter` | 150ms | Panel slide-up |
| `RoomLobby.svelte` | `pulse` | 1s infinite | Loading indicator |
| `PlayerListItem.svelte` | `pulse` | 1.5s infinite | Connection status |
| `GameHistory.svelte` | `spin` | 1s infinite | Loading spinner |
| `StatsDashboard.svelte` | `spin` | 1s infinite | Loading spinner |
| `+page.svelte` (home) | `pulse` | 1s infinite | Loading indicator |

### Current Die Animation

```css
/* Die.svelte - Current implementation */
.die.rolling {
    animation: roll 0.1s ease-in-out infinite;
}

@keyframes roll {
    0%, 100% { transform: rotate(-3deg); }
    50% { transform: rotate(3deg); }
}
```

**Assessment**: Very basic wobble. Effective but lacks visual impact. No stagger between dice, no anticipation/settle phases.

### Current Transition Tokens

```css
/* tokens.css */
--transition-instant: 50ms ease;
--transition-fast: 150ms ease;
--transition-medium: 300ms ease;
--transition-slow: 500ms ease;
```

---

## Design System Constraints

### Neo-Brutalist Animation Principles

Per RFC-002 and UI-UX-DESIGN-REPORT.md:

1. **Hard, Decisive Motion** — No soft bounces or elastic easing
2. **Functional Feedback** — Animation serves purpose, not decoration
3. **Instant Acknowledgment** — User actions get immediate visual response
4. **Reduced Motion Respect** — All animations must honor `prefers-reduced-motion`

### Allowed Easing Functions

| Name | CSS | Use Case |
|------|-----|----------|
| `ease` | `ease` | General transitions |
| `ease-out` | `ease-out` | Elements entering |
| `ease-in` | `ease-in` | Elements exiting |
| `linear` | `linear` | Continuous motion (spinners) |
| `snap` | `cubic-bezier(0, 0.9, 0.1, 1)` | Decisive state changes |

### Forbidden Patterns

- ❌ Elastic/bouncy easing (`cubic-bezier` with overshoot)
- ❌ Long animations (>800ms except loading states)
- ❌ Decorative motion (confetti, particles)
- ❌ Continuous animation when idle
- ❌ Animation blocking user interaction

---

## game-4 Deliverables

From `current-phase.json`:

| # | Deliverable | Priority | Complexity |
|---|-------------|----------|------------|
| 1 | ROLLING state animation (dice shake) | High | Medium |
| 2 | RESOLVED state animation (dice land) | High | Medium |
| 3 | Opponent turn indicator (avatar highlight) | Medium | Low |
| 4 | Score animation (number count-up) | Medium | Medium |
| 5 | Turn transition animation | Medium | Low |
| 6 | AFK warning indicator | Low | Done ✅ |

**Note**: AFK warning indicator already implemented in `TurnIndicator.svelte` with `pulse-warning` animation.

---

## Animation Specifications

### 1. ROLLING State Animation (Dice Shake)

**Trigger**: `uiPhase === 'ROLLING'` (set when roll command sent)

**Current**: Simple ±3° rotation at 100ms

**Enhanced Specification**:

```css
/* Enhanced dice roll animation */
.die.rolling {
    animation: dice-roll 600ms ease-out;
}

@keyframes dice-roll {
    /* Anticipation - slight pull back */
    0% { 
        transform: translateY(0) rotate(0deg); 
    }
    /* Shake phase - rapid oscillation */
    10% { transform: translateY(-4px) rotate(-8deg); }
    20% { transform: translateY(-2px) rotate(6deg); }
    30% { transform: translateY(-6px) rotate(-6deg); }
    40% { transform: translateY(-3px) rotate(8deg); }
    50% { transform: translateY(-5px) rotate(-4deg); }
    60% { transform: translateY(-2px) rotate(4deg); }
    /* Settle phase */
    80% { transform: translateY(-1px) rotate(-1deg); }
    100% { transform: translateY(0) rotate(0deg); }
}

/* Staggered animation per die */
.die:nth-child(1).rolling { animation-delay: 0ms; }
.die:nth-child(2).rolling { animation-delay: 40ms; }
.die:nth-child(3).rolling { animation-delay: 80ms; }
.die:nth-child(4).rolling { animation-delay: 120ms; }
.die:nth-child(5).rolling { animation-delay: 160ms; }
```

**Duration**: 600ms total (400ms shake + 200ms settle)  
**Stagger**: 40ms between dice  
**Total Animation Time**: ~760ms

---

### 2. RESOLVED State Animation (Dice Land)

**Trigger**: `uiPhase` transitions from `ROLLING` to `RESOLVED`

**Specification**:

```css
/* Dice landing animation */
.die.resolved {
    animation: dice-land 200ms ease-out;
}

@keyframes dice-land {
    0% { 
        transform: translateY(-8px) scale(1.05);
        box-shadow: 0 8px 0 rgba(0,0,0,0.2);
    }
    60% { 
        transform: translateY(2px) scale(0.98);
        box-shadow: 0 0 0 rgba(0,0,0,0.1);
    }
    100% { 
        transform: translateY(0) scale(1);
        box-shadow: none;
    }
}
```

**Duration**: 200ms  
**Easing**: ease-out (decisive landing)

---

### 3. Opponent Turn Indicator

**Trigger**: `currentPlayerId` changes to opponent

**Current**: Static highlight in `OpponentPanel.svelte`

**Enhanced Specification**:

```css
/* Opponent card when it's their turn */
.opponent-card.current-turn {
    background: var(--color-accent-light);
    animation: turn-highlight 400ms ease-out;
}

@keyframes turn-highlight {
    0% { 
        background: var(--color-surface);
        border-left-width: 0;
    }
    100% { 
        background: var(--color-accent-light);
        border-left: 4px solid var(--color-accent);
    }
}

/* Avatar pulse for active player */
.opponent-card.current-turn .avatar-img {
    animation: avatar-pulse 2s ease-in-out infinite;
}

@keyframes avatar-pulse {
    0%, 100% { box-shadow: 0 0 0 0 var(--color-accent); }
    50% { box-shadow: 0 0 0 4px var(--color-accent); }
}
```

**Duration**: 400ms initial + 2s continuous pulse  
**Note**: Continuous pulse only during opponent's turn

---

### 4. Score Animation (Number Count-Up)

**Trigger**: Score value changes after category selection

**Approach**: Animated number transition using CSS or Svelte tweened store

**Option A: CSS Counter Animation**

```css
/* Score value with transition */
.score-value {
    transition: transform var(--transition-fast);
}

.score-value.updating {
    animation: score-pop 300ms ease-out;
}

@keyframes score-pop {
    0% { transform: scale(1); }
    50% { transform: scale(1.2); color: var(--color-accent); }
    100% { transform: scale(1); }
}
```

**Option B: Svelte Tweened Store (Recommended)**

```typescript
import { tweened } from 'svelte/motion';
import { cubicOut } from 'svelte/easing';

const displayScore = tweened(0, {
    duration: 300,
    easing: cubicOut
});

// When score updates:
$effect(() => {
    displayScore.set(actualScore);
});
```

```svelte
<span class="score-value">{Math.round($displayScore)}</span>
```

**Duration**: 300ms  
**Easing**: `cubicOut` (fast start, smooth end)

---

### 5. Turn Transition Animation

**Trigger**: Turn changes to new player

**Specification**:

```css
/* Turn indicator transition */
.turn-indicator {
    transition: 
        background var(--transition-medium),
        border-color var(--transition-medium);
}

.turn-indicator.my-turn {
    animation: my-turn-start 400ms ease-out;
}

@keyframes my-turn-start {
    0% { 
        background: var(--color-surface);
        transform: scale(1);
    }
    50% { 
        background: var(--color-accent);
        transform: scale(1.02);
    }
    100% { 
        background: var(--color-accent-light);
        transform: scale(1);
    }
}
```

**Duration**: 400ms  
**Visual**: Brief gold flash when turn starts

---

### 6. AFK Warning Indicator ✅ (Already Implemented)

**Current Implementation** in `TurnIndicator.svelte`:

```css
.turn-indicator.afk-warning {
    animation: pulse-warning 1s ease-in-out infinite;
}

@keyframes pulse-warning {
    0%, 100% { background: var(--color-surface); }
    50% { background: var(--color-warning); }
}
```

**Status**: Complete — no changes needed

---

## Implementation Approach

### Recommended Strategy

1. **CSS-First**: Use CSS animations for simple state transitions
2. **Svelte Motion**: Use `tweened`/`spring` for numeric values
3. **Class-Based Triggers**: Toggle animation classes based on `uiPhase`
4. **No External Libraries**: Keep bundle size minimal

### UIPhase State Machine for Animations

```typescript
// In MultiplayerGameView.svelte
const diceAnimationClass = $derived(() => {
    switch (uiPhase) {
        case 'ROLLING': return 'rolling';
        case 'RESOLVED': return 'resolved';
        default: return '';
    }
});
```

### Animation Timing Coordination

```
User clicks "Roll"
    ↓ (0ms)
uiPhase → ROLLING
    ↓ (0ms)
Dice start shake animation
    ↓ (~600ms)
Server responds with dice values
    ↓ (variable, typically <200ms)
uiPhase → RESOLVED
    ↓ (0ms)
Dice play landing animation
    ↓ (200ms)
uiPhase → IDLE
```

---

## Accessibility Considerations

### Reduced Motion Support

All animations must be disabled when user prefers reduced motion:

```css
@media (prefers-reduced-motion: reduce) {
    .die.rolling,
    .die.resolved,
    .opponent-card.current-turn,
    .score-value.updating,
    .turn-indicator.my-turn {
        animation: none !important;
        transition: none !important;
    }
}
```

### Screen Reader Announcements

Animations should not replace text announcements:

```svelte
<div class="sr-only" aria-live="polite">
    {#if uiPhase === 'ROLLING'}
        Rolling dice...
    {:else if uiPhase === 'RESOLVED'}
        Rolled: {dice.join(', ')}
    {/if}
</div>
```

### Focus Management

Animations should not interfere with focus:
- No `pointer-events: none` during animations
- Focus indicators remain visible
- Tab order unchanged

---

## Performance Budget

### Animation Performance Targets

| Metric | Target | Measurement |
|--------|--------|-------------|
| Frame Rate | 60 FPS | Chrome DevTools Performance |
| Paint Time | <16ms | Lighthouse |
| Layout Shift | 0 | CLS metric |
| JS Execution | <50ms | Long task threshold |

### Optimization Guidelines

1. **Use `transform` and `opacity`** — GPU-accelerated, no layout
2. **Avoid `width`, `height`, `top`, `left`** — Trigger layout
3. **Use `will-change` sparingly** — Only on animated elements
4. **Batch DOM reads/writes** — Prevent forced synchronous layout

### CSS Properties by Performance

| Safe (Composite) | Caution (Paint) | Avoid (Layout) |
|------------------|-----------------|----------------|
| `transform` | `background` | `width` |
| `opacity` | `box-shadow` | `height` |
| `filter` | `border-color` | `margin` |
| | | `padding` |

---

## Recommended Libraries

### For This Project: None Required

The animations specified can be implemented with:
- **CSS `@keyframes`** — All visual animations
- **Svelte `tweened`** — Score count-up
- **CSS `transition`** — State changes

### If More Complex Animations Needed (Future)

| Library | Size | Use Case |
|---------|------|----------|
| `svelte/motion` | Built-in | Tweened/spring values |
| `motion` (Framer) | ~16KB | Complex orchestration |
| `animejs` | ~17KB | Timeline animations |
| `gsap` | ~60KB | Professional-grade (overkill) |

**Recommendation**: Stick with CSS + Svelte built-ins for v1.0

---

## Implementation Checklist

### Files to Modify

- [ ] `packages/web/src/lib/components/dice/Die.svelte` — Enhanced roll/land animations
- [ ] `packages/web/src/lib/components/game/MultiplayerGameView.svelte` — Animation class coordination
- [ ] `packages/web/src/lib/components/game/OpponentPanel.svelte` — Turn highlight animation
- [ ] `packages/web/src/lib/components/game/MultiplayerScorecard.svelte` — Score count-up
- [ ] `packages/web/src/lib/components/game/TurnIndicator.svelte` — Turn start animation

### New CSS to Add

1. `@keyframes dice-roll` — Enhanced shake with stagger
2. `@keyframes dice-land` — Landing with settle
3. `@keyframes turn-highlight` — Opponent turn indicator
4. `@keyframes avatar-pulse` — Active player avatar
5. `@keyframes score-pop` — Score update feedback
6. `@keyframes my-turn-start` — Turn transition

### Testing Verification

- [ ] Animations play at 60 FPS (Chrome DevTools)
- [ ] Reduced motion disables all animations
- [ ] Screen reader announces state changes
- [ ] No layout shift during animations
- [ ] Animations don't block interaction

---

## Summary

The game-4 task requires implementing 5 new animations (AFK warning already done):

1. **Dice Roll** — Enhanced shake with stagger (600ms)
2. **Dice Land** — Decisive settle animation (200ms)
3. **Opponent Turn** — Highlight + avatar pulse
4. **Score Update** — Tweened count-up (300ms)
5. **Turn Transition** — Gold flash on turn start (400ms)

All animations follow Neo-Brutalist principles (hard, decisive motion) and respect accessibility requirements. Implementation uses CSS-first approach with Svelte's built-in motion utilities for numeric interpolation.

**Estimated Implementation Time**: 2-3 hours  
**Risk Level**: Low (CSS-only changes, no architectural impact)

---

**Document Version**: 1.0  
**Last Updated**: December 4, 2025  
**Next Step**: Implement animations per specifications above
