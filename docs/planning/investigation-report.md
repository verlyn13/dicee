# Code Investigation Report

**Generated**: 2025-12-31  
**Investigator**: AI Code Review  
**Priority Order**: (1) Cascading Disconnection - CRITICAL, (2) Viewport Clipping - HIGH, (3) Emoji Rendering - MEDIUM

---

## Investigation 1: Refresh Causing Cascading Disconnections (CRITICAL)

### Files Examined

| File | Lines | Purpose |
|------|-------|---------|
| `packages/cloudflare-do/src/GameRoom.ts` | 356-398 | WebSocket close/error handlers |
| `packages/cloudflare-do/src/GameRoom.ts` | 1857-1957 | `onDisconnect()` - main disconnect handler |
| `packages/cloudflare-do/src/GameRoom.ts` | 996-1018 | `markSeatDisconnected()` - seat reservation |
| `packages/cloudflare-do/src/GameRoom.ts` | 616-651 | `checkIfRoomShouldPause()` - pause logic |
| `packages/cloudflare-do/src/GameRoom.ts` | 1103-1166 | `handleSeatExpiration()` - alarm handler |
| `packages/cloudflare-do/src/GameRoom.ts` | 404-439 | `alarm()` - alarm dispatch |

### Root Cause Analysis

The cascading disconnection issue likely stems from **alarm/state conflicts** in the new pause logic combined with Durable Object's **single-alarm limitation**.

#### Finding 1: Single Alarm Constraint Creates Race Conditions

Cloudflare Durable Objects support **only one pending alarm at a time**. The `scheduleSeatExpirationAlarm()` function attempts to be cooperative:

```typescript
// packages/cloudflare-do/src/GameRoom.ts:1088-1097
private async scheduleSeatExpirationAlarm(deadline: number): Promise<void> {
    const existingAlarm = await this.ctx.storage.getAlarm();

    // Only set if no alarm exists or new deadline is sooner
    if (!existingAlarm || deadline < existingAlarm) {
        const alarmData: AlarmData = { type: 'SEAT_EXPIRATION' };
        await this.ctx.storage.put('alarm_data', alarmData);
        await this.ctx.storage.setAlarm(deadline);
    }
}
```

**Problem**: When `checkIfRoomShouldPause()` schedules a `PAUSE_TIMEOUT` alarm, it **overwrites** any pending `SEAT_EXPIRATION` alarm:

```typescript
// packages/cloudflare-do/src/GameRoom.ts:657-662
private async schedulePauseTimeoutAlarm(): Promise<void> {
    const alarmData: AlarmData = {
        type: 'PAUSE_TIMEOUT',
    };
    await this.ctx.storage.put('alarm_data', alarmData);
    await this.ctx.storage.setAlarm(Date.now() + PAUSE_TIMEOUT_MS); // Overwrites!
}
```

This means if Player A disconnects (scheduling a 5-minute seat expiration), then Player B disconnects (room pauses, scheduling 30-minute PAUSE_TIMEOUT), **Player A's seat expiration alarm is lost**.

#### Finding 2: Pause Check May Race With Reconnection

The `checkIfRoomShouldPause()` function uses `getWebSockets()` which reflects **current** connected sockets:

```typescript
// packages/cloudflare-do/src/GameRoom.ts:627-629
const connectedPlayers = this.ctx.getWebSockets(`player:${roomCode}`);

if (connectedPlayers.length === 0) {
    // All players disconnected - pause the game
```

**Problem**: During a browser refresh, the old WebSocket closes before the new one connects. If multiple players refresh simultaneously (or within milliseconds), the check sees "0 connected players" and triggers room pause even though players are actively rejoining.

#### Finding 3: The `notifyLobbyUserRoomStatus('left')` Call

At the end of `onDisconnect()`:

```typescript
// packages/cloudflare-do/src/GameRoom.ts:1956
this.notifyLobbyUserRoomStatus(connState.userId, 'left');
```

This notifies the GlobalLobby that the user "left" the room. If the lobby removes the room entry based on this (when all users have "left"), the room becomes invisible in the lobby even though seats are reserved.

### Sequence Diagram: Page Refresh Flow

```
Player A: Refresh Page
    │
    ▼
[webSocketClose()] ─────────────────────────────────────────────────────────
    │
    ▼
[onDisconnect()]
    ├── chatManager.clearTyping()
    ├── markSeatDisconnected(A)
    │       └── seat.isConnected = false
    │       └── seat.reconnectDeadline = now + 5min
    │       └── scheduleSeatExpirationAlarm(deadline)  ◄─── Alarm set
    │
    ├── broadcast(PLAYER_DISCONNECTED)
    ├── notifyLobbyOfUpdate() ─────────────────────────────────────────────
    │       └── Lobby shows A as "disconnected" (correct)
    │
    ├── checkIfRoomShouldPause() ◄─── CRITICAL POINT
    │       └── getWebSockets('player:...') returns []
    │       └── IF status === 'playing':
    │           └── status = 'paused'
    │           └── schedulePauseTimeoutAlarm() ◄─── OVERWRITES seat alarm!
    │           └── notifyLobbyOfUpdate() ─────────────────────────────────
    │                   └── Lobby shows room as "PAUSED"
    │
    └── notifyLobbyUserRoomStatus(A, 'left') ◄─── Signals A "left"

    ... 100-500ms later ...

Player A: New Page Loads
    │
    ▼
[New WebSocket connects]
    │
    ▼
[handleReconnection(A)]
    └── seat.isConnected = true
    └── resumeFromPause() ◄─── Tries to cancel PAUSE_TIMEOUT
        └── deleteAlarm() ◄─── But what about seat expirations?
```

### The Cascading Effect: Multiple Players

If **both** players refresh:

1. Player A closes socket → `checkIfRoomShouldPause()` → not yet, B still connected
2. Player B closes socket (milliseconds later) → `checkIfRoomShouldPause()` → **triggers pause**
3. PAUSE_TIMEOUT alarm set, **overwriting** both seat expiration alarms
4. If neither reconnects within 30 minutes, room abandons
5. **But**: If seats were supposed to expire in 5 minutes, they don't get cleaned up properly because the SEAT_EXPIRATION alarm was overwritten

The "other players removed" symptom could occur if:
- The PAUSE_TIMEOUT fires before seat expirations (30 min vs 5 min default)
- The abandoned room triggers cleanup that closes all connections
- Or, there's a bug in `handlePauseTimeout()` that doesn't preserve seats

### Finding 4: Potential State Corruption in `handlePauseTimeout()`

When pause timeout fires:

```typescript
// packages/cloudflare-do/src/GameRoom.ts:575-605
private async handlePauseTimeout(): Promise<void> {
    // ...
    roomState.status = 'abandoned';
    roomState.pausedAt = null;
    await this.ctx.storage.put('room', roomState);

    // Close all spectator connections
    for (const ws of this.ctx.getWebSockets(`spectator:${roomCode}`)) {
        ws.close(1000, 'Game abandoned - all players disconnected');
    }
}
```

**Notice**: This only closes spectator connections, not player connections. However, the room is now "abandoned", and if any player tries to reconnect, they may encounter an abandoned room state with stale seat data.

### Destructive Operations Without Grace Periods

| Operation | Location | Grace Period | Risk |
|-----------|----------|--------------|------|
| `markSeatDisconnected()` | Line 996 | ✅ 5 min reconnect window | Low |
| `schedulePauseTimeoutAlarm()` | Line 657 | ✅ 30 min | Low |
| `notifyLobbyUserRoomStatus('left')` | Line 1956 | ❌ Immediate | Medium |
| `handlePauseTimeout()` → status='abandoned' | Line 585 | ❌ Immediate | High |
| Alarm overwrite in `schedulePauseTimeoutAlarm()` | Line 662 | ❌ Immediate | **Critical** |

### The Exact Condition for "Other Players Removed"

**Hypothesis**: The "other players removed" occurs when:

1. All players disconnect within a short window (refresh, network blip)
2. Room enters PAUSED state, scheduling PAUSE_TIMEOUT
3. This **overwrites** any pending SEAT_EXPIRATION alarms
4. If players don't reconnect quickly, and some external event (another alarm type, hibernation wake) triggers `handleSeatExpiration()` or similar cleanup
5. Or: The lobby receives `notifyLobbyUserRoomStatus('left')` for all players and marks the room as "empty"

The GlobalLobby's `updateRoomStatus()` receives `playerCount` based on "active" players. If all players are `disconnected` (not `abandoned`), `playerCount` should still reflect them. But if there's a race where seats expire before the lobby update propagates, the lobby could show 0 players.

### Recommended Fix

#### Fix 1: Implement Alarm Queue / Multiple Alarm Types

Since Durable Objects only support one alarm, implement an alarm queue in storage:

```typescript
interface AlarmQueue {
    items: Array<{ type: AlarmType; deadline: number; data?: unknown }>;
    nextAlarmAt: number | null;
}

// When scheduling:
async function scheduleAlarm(type: AlarmType, deadline: number, data?: unknown) {
    const queue = await this.getAlarmQueue();
    queue.items.push({ type, deadline, data });
    queue.items.sort((a, b) => a.deadline - b.deadline); // Soonest first
    
    // Set DO alarm to soonest deadline
    const soonest = queue.items[0];
    if (!queue.nextAlarmAt || soonest.deadline < queue.nextAlarmAt) {
        await this.ctx.storage.setAlarm(soonest.deadline);
        queue.nextAlarmAt = soonest.deadline;
    }
    await this.saveAlarmQueue(queue);
}

// In alarm() handler:
async alarm() {
    const queue = await this.getAlarmQueue();
    const now = Date.now();
    
    // Process all due alarms
    const due = queue.items.filter(a => a.deadline <= now);
    queue.items = queue.items.filter(a => a.deadline > now);
    
    for (const alarm of due) {
        await this.handleAlarmType(alarm);
    }
    
    // Schedule next alarm
    if (queue.items.length > 0) {
        const next = queue.items[0];
        await this.ctx.storage.setAlarm(next.deadline);
        queue.nextAlarmAt = next.deadline;
    } else {
        queue.nextAlarmAt = null;
    }
    await this.saveAlarmQueue(queue);
}
```

#### Fix 2: Add Debounce to `checkIfRoomShouldPause()`

```typescript
private async checkIfRoomShouldPause(): Promise<void> {
    // Wait 2 seconds to allow reconnections during page refresh
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Re-check connected players after delay
    const connectedPlayers = this.ctx.getWebSockets(`player:${roomCode}`);
    if (connectedPlayers.length > 0) {
        return; // Someone reconnected, don't pause
    }
    
    // Continue with pause logic...
}
```

**Caveat**: `setTimeout` in Durable Objects may not survive hibernation. Consider using an alarm-based approach or `waitUntil` with a short-lived promise.

#### Fix 3: Don't Send 'left' Status on Disconnect With Reserved Seat

```typescript
// In onDisconnect(), after markSeatDisconnected():
if (seat) {
    // Don't notify lobby that user "left" - they have a reserved seat
    // Lobby already knows via notifyLobbyOfUpdate() that they're "disconnected"
    // this.notifyLobbyUserRoomStatus(connState.userId, 'left'); // REMOVE
} else {
    // No seat (shouldn't happen) - truly left
    this.notifyLobbyUserRoomStatus(connState.userId, 'left');
}
```

### Risk Assessment

| Fix | Risk | Mitigation |
|-----|------|------------|
| Alarm Queue | Medium - complex state management | Thorough testing, storage-first pattern |
| Debounce | Low - simple delay | May feel slower on legitimate disconnects |
| Don't send 'left' | Low | Audit GlobalLobby logic for 'left' handling |

### Tests to Add

1. **Refresh Race Condition Test**: Simulate 2 players refreshing within 100ms, verify both can rejoin
2. **Alarm Coexistence Test**: Trigger seat expiration while pause timeout is pending
3. **Lobby Consistency Test**: Verify lobby shows room with disconnected players (not "empty")
4. **Hibernate Recovery Test**: Pause room, hibernate DO, reconnect player, verify state

---

## Investigation 2: Mobile Viewport/Zoom Clipping (HIGH)

### Files Examined

| File | Purpose |
|------|---------|
| `packages/web/src/app.html` | Viewport meta tag configuration |
| `packages/web/src/lib/styles/global.css` | Dynamic viewport CSS variables |
| `packages/web/src/lib/utils/viewport.ts` | Viewport observer and corruption detection |
| `packages/web/src/lib/components/lobby/LobbyLanding.svelte` | Lobby layout CSS |
| `packages/web/src/lib/components/game/MultiplayerGameView.svelte` | Game layout CSS |
| `packages/web/src/routes/+layout.svelte` | Root layout and viewport init |

### Root Cause Analysis

#### Finding 1: Comprehensive Viewport Meta Tag (Correct)

```html
<!-- packages/web/src/app.html:14 -->
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1.0, user-scalable=no, viewport-fit=cover, interactive-widget=resizes-content" />
```

This meta tag is correctly configured to:
- Prevent pinch-zoom (`maximum-scale=1.0, user-scalable=no`)
- Enable full bleed for notched devices (`viewport-fit=cover`)
- Handle keyboard properly on Chrome 108+ (`interactive-widget=resizes-content`)

#### Finding 2: CSS Dynamic Viewport Units Implementation (Correct)

The `global.css` implements proper fallbacks:

```css
/* packages/web/src/lib/styles/global.css:34-40 */
:root {
    --viewport-height-dynamic: 100dvh;
    --viewport-height-small: 100svh;
    --viewport-height-large: 100lvh;
    --vh-fallback: 1vh;
    --viewport-height: 100vh;
}

@supports not (height: 100dvh) {
    :root {
        --viewport-height-dynamic: calc(var(--vh-fallback) * 100);
    }
}
```

#### Finding 3: Viewport Observer (Correct but Limited)

The `viewport.ts` observer correctly:
- Uses `visualViewport` API when available
- Detects zoom corruption
- Sets CSS custom properties as fallback

```typescript
// packages/web/src/lib/utils/viewport.ts:133-157
private checkForCorruption(): void {
    const isZoomed = Math.abs(currentScale - 1) > 0.01;
    const viewportMismatch =
        vv && Math.abs(vv.height - window.innerHeight) > 50 && currentScale > 1;

    if (isZoomed || viewportMismatch) {
        document.documentElement.classList.add('viewport-corrupted');
    }
}
```

#### Finding 4: Different Layout Strategies Between Lobby and Game

**Lobby (`LobbyLanding.svelte`)**:
```css
.lobby-landing {
    min-height: 100vh;
    min-height: 100svh; /* Fallback */
    touch-action: manipulation;
}
```

**Game (`MultiplayerGameView.svelte`)**:
```css
.multiplayer-game-view {
    min-height: 100vh;
    min-height: 100svh;
    touch-action: manipulation;
}

@media (min-width: 768px) {
    .multiplayer-game-view {
        max-height: 100svh;
        overflow: hidden;
    }
}
```

**Key Difference**: The game view adds `max-height: 100svh; overflow: hidden` on desktop, but on mobile it uses `min-height` without a `max-height` constraint.

#### Finding 5: The Clipping Container

The game layout uses a CSS Grid with complex constraints:

```css
.game-layout {
    display: grid;
    grid-template-rows: auto 1fr auto;
    min-height: 0; /* Allow grid to shrink below content size */
    max-height: 100%;
    overflow: hidden;
}
```

On iOS Safari, when:
1. User zooms in (even accidentally)
2. The `visualViewport` becomes smaller than `innerHeight`
3. `100svh` still refers to the original small viewport height
4. But content overflows because zoom increased content size

### Side-by-Side Comparison

| Property | Lobby | Game | Chat |
|----------|-------|------|------|
| `min-height` | `100svh` | `100svh` | `100%` |
| `max-height` | None | `100svh` (desktop only) | `100%` |
| `overflow` | `visible` | `hidden` (desktop) | `hidden` |
| `touch-action` | `manipulation` | `manipulation` | None |
| `position` | `relative` | `relative` | `relative` |

### Why Lobby Works But Game Doesn't

The lobby uses **flexible height** (`min-height` only), allowing content to expand beyond the viewport. On zoom, the page simply scrolls.

The game uses **constrained height** with `overflow: hidden` on desktop. On mobile, without `max-height`, content can grow, but nested containers with `max-height: 100%` clip to their parent's height, which may not account for zoom.

### The Container Causing Clipping

The most likely culprit is the chat panel or scorecard area within the game layout:

```css
/* packages/web/src/lib/components/lobby/ChatPanel.svelte */
.chat-container {
    display: flex;
    flex-direction: column;
    height: 100%;  /* ◄─── This inherits from parent, doesn't account for zoom */
}
```

When the parent's height is `100svh` but the visual viewport is zoomed (smaller), child elements with `height: 100%` render correctly but get clipped by parent's `overflow: hidden`.

### Recommended Fix

#### Fix 1: Use Dynamic Viewport Units Consistently

Replace `100svh` with `100dvh` (with fallback) for mobile game containers:

```css
.multiplayer-game-view {
    min-height: 100vh;
    min-height: 100dvh; /* Dynamic, responds to browser chrome AND zoom */
}
```

#### Fix 2: Remove `overflow: hidden` on Mobile

```css
@media (max-width: 767px) {
    .multiplayer-game-view {
        overflow: visible; /* Allow content to scroll on zoom */
    }
}
```

#### Fix 3: Apply `touch-action: manipulation` to Chat

The chat panel doesn't have `touch-action` set, which may allow accidental zooming:

```css
.chat-container {
    touch-action: manipulation;
}
```

#### Fix 4: Listen to `visualViewport` Resize for Dynamic Adjustment

In game components, subscribe to viewport changes:

```typescript
import { getViewportObserver } from '$lib/utils/viewport';

onMount(() => {
    const observer = getViewportObserver();
    const unsubscribe = observer?.subscribe((height) => {
        // Adjust container max-height based on actual visual viewport
        gameContainer.style.maxHeight = `${height}px`;
    });
    return unsubscribe;
});
```

### Risk Assessment

| Fix | Risk | Mitigation |
|-----|------|------------|
| Use `100dvh` | Low | Already have fallback CSS |
| Remove `overflow: hidden` | Medium | May cause layout shift on scroll |
| `touch-action` on chat | Low | Standard mobile practice |
| Dynamic height via JS | Low | Observer already exists |

---

## Investigation 3: Emoji Rendering on Pinch (MEDIUM)

### Files Examined

| File | Purpose |
|------|---------|
| `packages/web/src/lib/components/chat/ReactionFloat.svelte` | Chat reaction floating emoji |
| `packages/web/src/lib/components/gallery/SpectatorReactionFloat.svelte` | Spectator reaction floating emoji |
| `packages/web/src/lib/components/gallery/SpectatorReactionContainer.svelte` | Container managing floats |
| `packages/web/src/lib/components/chat/ChatMessage.svelte` | Message display with reactions |
| `packages/web/src/routes/+layout.svelte` | Font loading (no emoji font) |
| `packages/web/src/lib/styles/global.css` | No `@font-face` for emojis |

### Root Cause Analysis

#### Finding 1: Native Unicode Emoji Rendering

Emojis are rendered using **native Unicode characters**, not image sprites or custom fonts:

```svelte
<!-- packages/web/src/lib/components/chat/ReactionFloat.svelte:45 -->
<span class="emoji">{emoji}</span>

<!-- packages/web/src/lib/components/gallery/SpectatorReactionFloat.svelte:72 -->
<span class="float-emoji">{emoji}</span>
```

No emoji font is loaded—the system emoji font is used (Apple Color Emoji on iOS).

#### Finding 2: No Visibility/Opacity Conditions

The emoji CSS has no conditional visibility based on viewport or zoom:

```css
/* ReactionFloat.svelte */
.emoji {
    font-size: 2rem;
    filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2));
}

/* SpectatorReactionFloat.svelte */
.float-emoji {
    filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3));
    transition: font-size 0.1s ease;
}
```

No `opacity: 0`, `visibility: hidden`, or `transform: scale(0)` that would hide emojis.

#### Finding 3: Container Uses `position: absolute` with `overflow: hidden`

```svelte
<!-- SpectatorReactionContainer.svelte:70-82 -->
<div class="spectator-reaction-container">
    {#each activeReactions as reaction (reaction.key)}
        <SpectatorReactionFloat ... />
    {/each}
</div>

<style>
.spectator-reaction-container {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 200px;
    pointer-events: none;
    overflow: hidden;  /* ◄─── Clips emojis outside this box */
    z-index: 50;
}
</style>
```

**Key Observation**: The container is `200px` tall with `overflow: hidden`. Emojis that float above this 200px boundary get clipped.

#### Finding 4: Float Animation Can Exit Container Bounds

```css
/* SpectatorReactionFloat.svelte */
@keyframes floatUp {
    0% {
        transform: translateX(-50%) translateY(0) scale(1);
    }
    30% {
        transform: translateX(-50%) translateY(-40px) scale(1.15);
    }
    100% {
        opacity: 0;
        transform: translateX(-50%) translateY(-100px) scale(0.8);
    }
}
```

Emojis translate up to `-100px` from their starting position. If the container is only 200px and the emoji starts at `y: 20px` from bottom, the emoji travels from `20px → 120px` height, which is within bounds. However...

#### Finding 5: Potential iOS Safari Rendering Bug with `position: absolute` + `overflow: hidden` + Zoom

iOS Safari has known issues where **absolutely positioned elements inside an `overflow: hidden` container** may not render correctly after zoom gestures. The compositing layer can become stale.

The symptom "invisible until pinch-zoom, then immediately retract" suggests:
1. Initially, the emoji layer is not painted (GPU compositing issue)
2. Pinch-zoom forces a repaint, revealing the emoji
3. "Retract" might be the animation completing (opacity → 0)

#### Finding 6: No Intersection Observer or Lazy Loading

The emoji components do not use Intersection Observer or lazy loading—they render immediately when added to `activeReactions`. This rules out "not in viewport" issues.

### The Rendering Pipeline

```
Emoji Rendering Pipeline:

1. User clicks reaction button
       │
       ▼
2. spectatorService.sendReaction(emoji)
       │
       ▼
3. Server broadcasts SPECTATOR_REACTION
       │
       ▼
4. spectatorService.addReactionListener() fires
       │
       ▼
5. SpectatorReactionContainer.handleReaction()
       ├── Creates ActiveReaction object
       └── Adds to activeReactions[] (reactive)
              │
              ▼
6. Svelte re-renders {#each activeReactions}
       │
       ▼
7. SpectatorReactionFloat component mounts
       ├── <span class="float-emoji">{emoji}</span>
       └── CSS animation: floatUp starts
              │
              ▼
8. Browser paints emoji (POTENTIALLY FAILS ON iOS)
       │
       ▼
9. After duration (2s), onComplete() fires
       │
       ▼
10. Component removed from DOM
```

### Hypothesis: GPU Layer Compositing Issue

iOS Safari sometimes fails to paint absolutely positioned animated elements until a recomposite is triggered (scroll, zoom, touch). The `drop-shadow` filter requires GPU compositing, which may not initialize correctly.

**Evidence Supporting This**:
- Only affects iOS (Chrome on iPhone uses Safari's WebKit engine)
- Pinch-zoom forces a full recomposite, "fixing" the rendering
- "Retract" is actually the emoji becoming visible for the first time, then immediately fading (animation already 80% complete)

### Viewport-Dependent Logic: None Found

No code conditionally shows/hides emojis based on viewport size or zoom level.

### Recommended Fix

#### Fix 1: Force GPU Layer Creation on Mount

Add `will-change` or `translateZ(0)` to force GPU compositing immediately:

```css
.spectator-reaction-float {
    /* ... existing styles ... */
    will-change: transform, opacity;
    /* Or */
    transform: translateZ(0) translateX(-50%);
}
```

#### Fix 2: Remove `overflow: hidden` from Reaction Container

```css
.spectator-reaction-container {
    /* overflow: hidden; */ /* REMOVE */
    overflow: visible;
    /* Emojis will clip naturally via opacity → 0 animation */
}
```

**Note**: This may cause emojis to appear outside intended bounds briefly. Use `clip-path` instead if needed:

```css
.spectator-reaction-container {
    clip-path: inset(0 0 0 0); /* Clips content but allows GPU compositing */
}
```

#### Fix 3: Add a Tiny Delay Before Starting Animation

Force the browser to paint before animation starts:

```typescript
// In SpectatorReactionFloat.svelte
onMount(() => {
    // Force initial paint
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            // Now start animation
            element.classList.add('animate');
        });
    });
});
```

With CSS:
```css
.spectator-reaction-float {
    opacity: 0;
}
.spectator-reaction-float.animate {
    animation: floatUp var(--duration) ease-out forwards;
}
```

#### Fix 4: Use CSS `content-visibility: auto` (Experimental)

```css
.spectator-reaction-container {
    content-visibility: auto;
    contain-intrinsic-size: auto 200px;
}
```

This hints to the browser that the container's content may change, encouraging proper compositing.

### Risk Assessment

| Fix | Risk | Mitigation |
|-----|------|------------|
| `will-change` | Low | Standard GPU hint |
| Remove `overflow: hidden` | Low | Animation already fades out |
| Double rAF | Low | Minor delay (1-2 frames) |
| `content-visibility` | Medium | Not supported on all browsers |

### Tests to Add

1. **iOS Safari Emoji Render Test**: Manual test on physical iOS device (simulator may not reproduce)
2. **Zoom Interaction Test**: Test emoji rendering after various zoom levels
3. **Animation Timing Test**: Verify animation starts at frame 0, not frame N

---

## Summary of Findings

| Investigation | Root Cause | Severity | Fix Complexity |
|---------------|------------|----------|----------------|
| Cascading Disconnection | Single-alarm overwrite + pause race condition | **Critical** | High |
| Viewport Clipping | `overflow: hidden` + incorrect viewport unit on mobile | High | Medium |
| Emoji Invisible | iOS Safari GPU compositing + `overflow: hidden` | Medium | Low |

## Recommended Priority Order for Fixes

1. **Immediate**: Fix emoji visibility (Low effort, noticeable UX improvement)
2. **Short-term**: Fix viewport clipping (Medium effort, blocks mobile users)
3. **Medium-term**: Implement alarm queue for cascading disconnection (High effort, game-breaking bug)

---

## Appendix: Test Commands

```bash
# Run existing tests
pnpm web:vitest

# Type check
pnpm check

# Lint
pnpm biome:check

# Build (catches import errors)
pnpm build
```

## Appendix: Related Documentation

- `docs/architecture/akg/` - Architecture knowledge graph
- `docs/planning/connection-ux-implementation-plan.md` - Recent connection UX work
- `docs/planning/multiplayer-resilience-investigation.md` - Previous resilience investigation
