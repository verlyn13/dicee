# Implementation Plan: Mobile Viewport & Session Stability Fixes

**Status**: Ready for Implementation  
**Created**: 2025-12-31  
**Based on**: [Investigation Report](./investigation-report.md)

---

## Executive Summary

This plan addresses three critical issues identified in the investigation report, with a revised priority order based on **blast radius** rather than implementation effort:

| Priority | Issue | Rationale |
|----------|-------|-----------|
| **1** | Cascading Disconnection (HOTFIX) | Game-breaking. Deploy a minimal debounce fix within hours. |
| **2** | Cascading Disconnection (FULL FIX) | Proper alarm queue architecture for long-term stability. |
| **3** | Mobile Viewport | Blocks significant user segment on iOS devices. |
| **4** | Emoji Rendering | Cosmetic, fix alongside viewport work. |

---

## Phase 0: Emergency Hotfix for Cascading Disconnections

**Goal**: Stop the bleeding. Deploy within hours, not days.

**Estimated Time**: 2-4 hours  
**Risk Level**: Low (minimal code change, easy rollback)

### 0.1 The Minimal Fix: Debounced Pause Check

Add a debounce to `checkIfRoomShouldPause()` that prevents it from firing during the reconnection window.

```typescript
// GameRoom.ts - Add at class level
private pauseCheckScheduled: boolean = false;
private readonly PAUSE_CHECK_DELAY_MS = 2000; // 2 seconds

// Replace immediate call with debounced version
private async scheduleRoomPauseCheck(): Promise<void> {
  if (this.pauseCheckScheduled) return;
  this.pauseCheckScheduled = true;
  
  // Use storage-based delay instead of alarm (preserves existing alarms)
  await this.ctx.storage.put('pauseCheckAt', Date.now() + this.PAUSE_CHECK_DELAY_MS);
  
  // Check will happen in the existing alarm handler, not a new alarm
}

// In alarm handler, add at the START:
async alarm(): Promise<void> {
  // Check for scheduled pause check first
  const pauseCheckAt = await this.ctx.storage.get<number>('pauseCheckAt');
  if (pauseCheckAt && Date.now() >= pauseCheckAt) {
    await this.ctx.storage.delete('pauseCheckAt');
    this.pauseCheckScheduled = false;
    await this.checkIfRoomShouldPause();
  }
  
  // ... existing alarm logic continues
}
```

### 0.2 Fix: Don't Send 'left' Status When Seat Is Reserved

The current code notifies the lobby that a user "left" even when they have a reserved seat:

```typescript
// In onDisconnect() - BEFORE (wrong):
this.notifyLobbyUserRoomStatus(connState.userId, 'left');

// AFTER (correct):
// Only notify 'left' if they don't have a reserved seat
const seats = await this.getSeats();
const seat = seats.get(connState.userId);
const hasReservedSeat = seat && seat.isConnected === false && 
  seat.reconnectDeadline && seat.reconnectDeadline > Date.now();

if (!hasReservedSeat) {
  // Only notify 'left' if they're actually gone (no seat or expired)
  this.notifyLobbyUserRoomStatus(connState.userId, 'left');
}
// If seat exists and is just 'disconnected' within window, don't send 'left'
```

### 0.3 Testing Before Deploy

| Test | Steps | Expected Result |
|------|-------|-----------------|
| Simultaneous refresh | Open game in 3 browser tabs, refresh all 3 within 1 second | All 3 can rejoin |
| Room pause check | After triple refresh, verify room status | Room does NOT enter PAUSED state during 2s window |
| Single refresh | 1 player refreshes while others stay | Reconnects without affecting others |
| Actual disconnect | Close browser entirely | Seat marked disconnected, others unaffected |

### 0.4 Rollback Plan

If issues occur:
1. Revert the two changes (debounce + 'left' notification fix)
2. Deploy previous version
3. Cascading disconnection returns but game is at least playable

---

## Phase 1: Proper Alarm Queue Architecture

**Goal**: Support multiple concurrent timeout types without overwriting.

**Estimated Time**: 1-2 days  
**Risk Level**: Medium (changes fundamental DO behavior)

### 1.1 Alarm Queue Data Structure

```typescript
// packages/cloudflare-do/src/types.ts

interface ScheduledAlarm {
  type: 'SEAT_EXPIRATION' | 'PAUSE_TIMEOUT' | 'ROOM_CLEANUP' | 'TURN_TIMEOUT' | 'AFK_CHECK' | 'AI_TURN_TIMEOUT' | 'JOIN_REQUEST_EXPIRATION';
  targetId?: string;      // e.g., odal for seat expiration, odal for turn timeout
  scheduledFor: number;   // timestamp when alarm should fire
  createdAt: number;      // timestamp when alarm was scheduled
  metadata?: Record<string, unknown>; // Additional context (e.g., retry counts)
}

// Storage key: 'alarmQueue'
type AlarmQueue = ScheduledAlarm[];
```

### 1.2 Alarm Queue Manager

Create new file: `packages/cloudflare-do/src/lib/alarm-queue.ts`

```typescript
/**
 * AlarmQueue - Multi-alarm support for Durable Objects
 *
 * Cloudflare DOs only support one pending alarm at a time. This manager
 * implements a queue in storage that allows scheduling multiple alarms
 * of different types, with the DO alarm always set to the soonest item.
 *
 * Storage-first pattern: persist BEFORE setting DO alarm.
 */

import type { DurableObjectState } from '@cloudflare/workers-types';

export interface ScheduledAlarm {
  type: string;
  targetId?: string;
  scheduledFor: number;
  createdAt: number;
  metadata?: Record<string, unknown>;
}

type AlarmQueue = ScheduledAlarm[];

const STORAGE_KEY = 'alarmQueue';

export class AlarmQueueManager {
  constructor(private ctx: DurableObjectState) {}

  /**
   * Schedule a new alarm. If an alarm of the same type+targetId exists,
   * it will be replaced.
   */
  async schedule(alarm: Omit<ScheduledAlarm, 'createdAt'>): Promise<void> {
    const queue = await this.getQueue();
    
    // Remove any existing alarm of same type+target (upsert behavior)
    const filtered = queue.filter(a => 
      !(a.type === alarm.type && a.targetId === alarm.targetId)
    );
    
    // Add new alarm
    filtered.push({ ...alarm, createdAt: Date.now() });
    
    // Sort by scheduledFor (soonest first)
    filtered.sort((a, b) => a.scheduledFor - b.scheduledFor);
    
    // Storage-first: persist before setting DO alarm
    await this.ctx.storage.put(STORAGE_KEY, filtered);
    
    // Set DO alarm to earliest item
    if (filtered.length > 0) {
      await this.ctx.storage.setAlarm(filtered[0].scheduledFor);
    }
  }

  /**
   * Cancel a scheduled alarm by type and optional targetId.
   */
  async cancel(type: string, targetId?: string): Promise<boolean> {
    const queue = await this.getQueue();
    const originalLength = queue.length;
    
    const filtered = queue.filter(a => 
      !(a.type === type && (targetId === undefined || a.targetId === targetId))
    );
    
    if (filtered.length === originalLength) {
      return false; // Nothing was cancelled
    }
    
    await this.ctx.storage.put(STORAGE_KEY, filtered);
    await this.rescheduleNextAlarm(filtered);
    
    return true;
  }

  /**
   * Process all due alarms and return them for handling.
   * Removes processed alarms from the queue.
   */
  async processAlarms(): Promise<ScheduledAlarm[]> {
    const queue = await this.getQueue();
    const now = Date.now();
    
    // Split into due and remaining
    const due = queue.filter(a => a.scheduledFor <= now);
    const remaining = queue.filter(a => a.scheduledFor > now);
    
    // Storage-first: persist remaining before returning due
    await this.ctx.storage.put(STORAGE_KEY, remaining);
    await this.rescheduleNextAlarm(remaining);
    
    return due;
  }

  /**
   * Get all pending alarms (for debugging/inspection).
   */
  async getPending(): Promise<ScheduledAlarm[]> {
    return await this.getQueue();
  }

  /**
   * Check if an alarm of the given type+targetId is scheduled.
   */
  async has(type: string, targetId?: string): Promise<boolean> {
    const queue = await this.getQueue();
    return queue.some(a => 
      a.type === type && (targetId === undefined || a.targetId === targetId)
    );
  }

  private async getQueue(): Promise<AlarmQueue> {
    return await this.ctx.storage.get<AlarmQueue>(STORAGE_KEY) ?? [];
  }

  private async rescheduleNextAlarm(queue: AlarmQueue): Promise<void> {
    if (queue.length > 0) {
      await this.ctx.storage.setAlarm(queue[0].scheduledFor);
    } else {
      // No alarms left - delete any pending DO alarm
      await this.ctx.storage.deleteAlarm();
    }
  }
}
```

### 1.3 Updated Alarm Handler

```typescript
// GameRoom.ts - Replace existing alarm() method

private alarmQueue: AlarmQueueManager;

constructor(ctx: DurableObjectState, env: Env) {
  super(ctx, env);
  this.alarmQueue = new AlarmQueueManager(ctx);
  // ... rest of constructor
}

async alarm(): Promise<void> {
  // Load room code from storage if not cached (hibernation recovery)
  if (!this._roomCode) {
    this._roomCode = (await this.ctx.storage.get<string>('room_code')) ?? 'UNKNOWN';
  }

  // Process all due alarms from the queue
  const dueAlarms = await this.alarmQueue.processAlarms();
  
  for (const alarm of dueAlarms) {
    try {
      switch (alarm.type) {
        case 'TURN_TIMEOUT':
          await this.handleTurnTimeout(alarm.targetId);
          break;
        case 'AFK_CHECK':
          await this.handleAfkCheck(alarm.targetId);
          break;
        case 'ROOM_CLEANUP':
          await this.handleRoomCleanup();
          break;
        case 'SEAT_EXPIRATION':
          await this.handleSeatExpiration(alarm.targetId);
          break;
        case 'JOIN_REQUEST_EXPIRATION':
          await this.handleJoinRequestExpiration(alarm.metadata?.requestId as string);
          break;
        case 'AI_TURN_TIMEOUT':
          await this.handleAITurnTimeout(alarm);
          break;
        case 'PAUSE_TIMEOUT':
          await this.handlePauseTimeout();
          break;
        default:
          console.warn(`Unknown alarm type: ${alarm.type}`);
      }
    } catch (error) {
      await this.ensureInstrumentation();
      this.instr?.errorHandlerFailed(`alarm:${alarm.type}`, error);
    }
  }
}
```

### 1.4 Update All Alarm Scheduling Calls

Find and replace all direct `setAlarm()` calls:

```typescript
// BEFORE (seat expiration):
await this.ctx.storage.setAlarm(seat.reconnectDeadline);
await this.ctx.storage.put('alarm_data', { type: 'SEAT_EXPIRATION' });

// AFTER:
await this.alarmQueue.schedule({
  type: 'SEAT_EXPIRATION',
  targetId: odal,
  scheduledFor: seat.reconnectDeadline
});

// BEFORE (pause timeout):
await this.ctx.storage.setAlarm(Date.now() + PAUSE_TIMEOUT_MS);
await this.ctx.storage.put('alarm_data', { type: 'PAUSE_TIMEOUT' });

// AFTER:
await this.alarmQueue.schedule({
  type: 'PAUSE_TIMEOUT',
  scheduledFor: Date.now() + PAUSE_TIMEOUT_MS
});

// BEFORE (turn timeout):
await this.ctx.storage.setAlarm(Date.now() + timeoutMs);
await this.ctx.storage.put('alarm_data', { type: 'TURN_TIMEOUT', odal });

// AFTER:
await this.alarmQueue.schedule({
  type: 'TURN_TIMEOUT',
  targetId: odal,
  scheduledFor: Date.now() + timeoutMs
});
```

### 1.5 Update Seat Expiration Handler

The current handler processes ALL expired seats. Update to handle specific targetId:

```typescript
// BEFORE:
private async handleSeatExpiration(): Promise<void> {
  const seats = await this.getSeats();
  // ... processes all expired seats
}

// AFTER:
private async handleSeatExpiration(targetUserId?: string): Promise<void> {
  const seats = await this.getSeats();
  const now = Date.now();
  
  if (targetUserId) {
    // Handle specific user's seat expiration
    const seat = seats.get(targetUserId);
    if (seat && !seat.isConnected && seat.reconnectDeadline && seat.reconnectDeadline <= now) {
      await this.expireSeat(seat, seats);
    }
  } else {
    // Fallback: process all expired seats (for backwards compatibility)
    for (const [odal, seat] of seats) {
      if (!seat.isConnected && seat.reconnectDeadline && seat.reconnectDeadline <= now) {
        await this.expireSeat(seat, seats);
      }
    }
  }
}

private async expireSeat(seat: PlayerSeat, seats: Map<string, PlayerSeat>): Promise<void> {
  this.instr?.seatRelease(seat.odal, seat.turnOrder, 'timeout');
  seats.delete(seat.odal);
  await this.saveSeats(seats);
  
  this.broadcast({
    type: 'PLAYER_SEAT_EXPIRED',
    payload: {
      odal: seat.odal,
      displayName: seat.displayName,
    },
  });
  
  // Update room playerOrder
  const roomState = await this.ctx.storage.get<RoomState>('room');
  if (roomState) {
    roomState.playerOrder = roomState.playerOrder.filter(id => id !== seat.odal);
    await this.ctx.storage.put('room', roomState);
  }
  
  await this.notifyLobbyOfUpdate();
}
```

### 1.6 Migration Strategy

For rooms created before the alarm queue deployment:

```typescript
// In alarm() handler, add migration check at the start:
async alarm(): Promise<void> {
  // MIGRATION: Check for legacy alarm_data and convert to queue
  const legacyAlarmData = await this.ctx.storage.get<AlarmData>('alarm_data');
  if (legacyAlarmData) {
    // Convert legacy alarm to queue format
    await this.alarmQueue.schedule({
      type: legacyAlarmData.type,
      targetId: legacyAlarmData.odal,
      scheduledFor: Date.now(), // It's due now (alarm fired)
      metadata: legacyAlarmData.metadata,
    });
    await this.ctx.storage.delete('alarm_data');
    // Fall through to process the queue
  }
  
  // ... rest of alarm handler
}
```

---

## Phase 2: Mobile Viewport Fixes

**Goal**: Fix viewport clipping on iOS Safari during zoom/keyboard interactions.

**Estimated Time**: 4-8 hours  
**Risk Level**: Low-Medium (CSS changes, may affect desktop layout)

### 2.1 Viewport Meta Tag (Already Correct)

The current meta tag in `app.html` is correctly configured:

```html
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1.0, user-scalable=no, viewport-fit=cover, interactive-widget=resizes-content" />
```

No changes needed here.

### 2.2 Game Layout CSS Changes

Update `packages/web/src/lib/components/game/MultiplayerGameView.svelte`:

```css
/* BEFORE */
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

/* AFTER */
.multiplayer-game-view {
  min-height: 100vh;
  min-height: 100dvh; /* Dynamic viewport - responds to browser chrome AND zoom */
  min-height: -webkit-fill-available; /* iOS Safari fallback */
  touch-action: manipulation;
}

/* Mobile: allow content to scroll */
@media (max-width: 767px) {
  .multiplayer-game-view {
    max-height: var(--viewport-height, 100dvh);
    overflow-y: auto;
    overflow-x: hidden;
    -webkit-overflow-scrolling: touch;
    
    /* Safe area handling for notched devices */
    padding-bottom: env(safe-area-inset-bottom, 0);
  }
}

/* Desktop: fixed height with hidden overflow (current behavior) */
@media (min-width: 768px) {
  .multiplayer-game-view {
    max-height: 100svh;
    overflow: hidden;
  }
}
```

### 2.3 Chat Panel Touch Action

Update `packages/web/src/lib/components/lobby/ChatPanel.svelte`:

```css
.chat-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--color-surface);
  touch-action: manipulation; /* ADD: Prevents double-tap zoom */
  -webkit-overflow-scrolling: touch; /* ADD: Smooth scrolling on iOS */
}
```

### 2.4 Visual Viewport Resize Handler Enhancement

The existing `viewport.ts` is good but can be enhanced for mobile:

```typescript
// Add to packages/web/src/lib/utils/viewport.ts

/**
 * Get current visual viewport dimensions
 * Falls back to window dimensions if VisualViewport API not available
 */
export function getVisualViewport(): { width: number; height: number } {
  if (browser && window.visualViewport) {
    return {
      width: window.visualViewport.width,
      height: window.visualViewport.height,
    };
  }
  return {
    width: browser ? window.innerWidth : 0,
    height: browser ? window.innerHeight : 0,
  };
}

/**
 * Setup viewport handler for a specific container
 * Updates --viewport-height CSS variable on the container when visual viewport changes
 */
export function setupContainerViewportHandler(container: HTMLElement): () => void {
  if (!browser || !window.visualViewport) {
    return () => {};
  }

  const updateHeight = () => {
    const vh = window.visualViewport!.height;
    container.style.setProperty('--viewport-height', `${vh}px`);
  };

  window.visualViewport.addEventListener('resize', updateHeight);
  window.visualViewport.addEventListener('scroll', updateHeight);
  updateHeight();

  return () => {
    window.visualViewport?.removeEventListener('resize', updateHeight);
    window.visualViewport?.removeEventListener('scroll', updateHeight);
  };
}
```

### 2.5 Svelte Component Integration

Update `packages/web/src/lib/components/game/MultiplayerGameView.svelte`:

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { setupContainerViewportHandler } from '$lib/utils/viewport';
  
  // ... existing imports and code
  
  let gameContainer: HTMLElement;
  
  onMount(() => {
    // Setup viewport handler for mobile
    const cleanupViewport = setupContainerViewportHandler(gameContainer);
    
    return () => {
      cleanupViewport();
    };
  });
</script>

<div 
  bind:this={gameContainer} 
  class="multiplayer-game-view"
  class:waiting={roomStatus === 'waiting'}
>
  <!-- ... existing content -->
</div>
```

---

## Phase 3: Emoji Rendering Fix

**Goal**: Fix emojis not rendering until pinch-zoom on iOS Safari.

**Estimated Time**: 2-4 hours  
**Risk Level**: Low (CSS changes, isolated to emoji components)

### 3.1 Force GPU Layer Creation

Update `packages/web/src/lib/components/gallery/SpectatorReactionFloat.svelte`:

```css
/* BEFORE */
.spectator-reaction-float {
  position: absolute;
  left: calc(50% + var(--x));
  bottom: var(--y);
  transform: translateX(-50%);
  pointer-events: none;
  z-index: 100;
  /* ... */
}

/* AFTER */
.spectator-reaction-float {
  position: absolute;
  left: calc(50% + var(--x));
  bottom: var(--y);
  transform: translateX(-50%) translateZ(0); /* Force compositing layer */
  pointer-events: none;
  z-index: 100;
  
  /* Force GPU layer creation on mount */
  will-change: transform, opacity;
  backface-visibility: hidden;
  /* ... */
}
```

### 3.2 Replace overflow: hidden with clip-path

Update `packages/web/src/lib/components/gallery/SpectatorReactionContainer.svelte`:

```css
/* BEFORE */
.spectator-reaction-container {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 200px;
  pointer-events: none;
  overflow: hidden; /* This can cause compositing issues on iOS */
  z-index: 50;
}

/* AFTER */
.spectator-reaction-container {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 200px;
  pointer-events: none;
  /* Replace overflow:hidden with clip-path - allows GPU compositing */
  clip-path: inset(0);
  z-index: 50;
}
```

### 3.3 Same Changes for Chat Reactions

Update `packages/web/src/lib/components/chat/ReactionFloat.svelte`:

```css
.reaction-float {
  position: absolute;
  left: calc(50% + var(--x));
  top: var(--y);
  transform: translateX(-50%) translateZ(0); /* ADD: Force compositing */
  pointer-events: none;
  z-index: 100;
  animation: floatUp var(--duration) ease-out forwards;
  display: flex;
  align-items: center;
  gap: var(--space-1);
  
  /* ADD: Force GPU layer creation */
  will-change: transform, opacity;
  backface-visibility: hidden;
}
```

### 3.4 Alternative: CSS Animation Delay

If the above doesn't fully resolve the issue, add a small animation delay to allow initial paint:

```css
.spectator-reaction-float {
  opacity: 0;
  animation: floatUp var(--duration) ease-out forwards;
  animation-delay: 16ms; /* One frame delay for initial paint */
}
```

### 3.5 Double RAF for Programmatic Animations (If Needed)

If animations are triggered programmatically:

```typescript
// In component that creates emoji reactions
function showReaction(emoji: SpectatorReactionEmoji) {
  const reaction = createReactionElement(emoji);
  
  // Double RAF ensures paint before animation
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      reaction.classList.add('animate');
    });
  });
}
```

---

## Testing Matrix

### Phase 0 (Hotfix)

| Test | Steps | Expected |
|------|-------|----------|
| Simultaneous refresh | 3 players refresh within 500ms | All can rejoin, room not paused |
| Single refresh | 1 player refreshes | Reconnects without affecting others |
| Actual disconnect | Close browser entirely | Seat marked disconnected, others unaffected |
| Lobby display | After refresh, check lobby | Room shows correct player count |

### Phase 1 (Alarm Queue)

| Test | Steps | Expected |
|------|-------|----------|
| Multiple seat expirations | 3 players disconnect staggered (30s apart) | Each seat expires at correct time |
| Pause + seat expiration | All disconnect, 1 seat expires during pause | Both events fire correctly |
| Alarm cancellation | Player reconnects before expiry | Seat expiration cancelled |
| Concurrent alarm types | Turn timeout + seat expiration both pending | Both fire at correct times |
| Migration | Trigger alarm on room with legacy `alarm_data` | Legacy alarm converted and processed |

### Phase 2 (Viewport)

| Test | Device | Steps | Expected |
|------|--------|-------|----------|
| Zoom clip | iPhone Chrome | Pinch zoom in game | Full content visible |
| Keyboard push | iPhone Safari | Open chat, type | Content adjusts, not clipped |
| Safe area | iPhone (notch) | View in landscape | Bottom not cut off |
| Desktop unchanged | Chrome Desktop | Play full game | No layout changes |
| Scroll on mobile | iPhone Safari | Scroll game content | Smooth, content accessible |

### Phase 3 (Emoji)

| Test | Device | Steps | Expected |
|------|--------|-------|----------|
| Initial render | iPhone Safari | Send emoji reaction | Emoji visible immediately |
| Rapid emojis | Any | Send 5 emojis quickly | All render, animate smoothly |
| No zoom required | iPhone Safari | Send emoji, don't zoom | Emoji animates correctly |
| Memory usage | Chrome DevTools | Send 50 emojis | Memory stable, no leaks |

---

## Deployment Order

```
Day 1:  Phase 0 (Hotfix)
        └── Deploy immediately after testing
        └── Monitor for cascading disconnections
        
Day 2-3: Phase 3 (Emoji)
        └── Low risk, quick win
        └── Test on iOS devices
        
Day 3-4: Phase 2 (Viewport)
        └── Test on multiple devices (iPhone, iPad, Android)
        └── Verify desktop unchanged
        
Day 5-7: Phase 1 (Alarm Queue)
        └── Most complex, needs thorough testing
        └── Consider feature flag for gradual rollout
        └── Monitor DO alarm behavior
```

---

## Files to Modify

| Phase | File | Changes |
|-------|------|---------|
| **0** | `packages/cloudflare-do/src/GameRoom.ts` | Add debounce, fix 'left' notification |
| **1** | `packages/cloudflare-do/src/types.ts` | Add `ScheduledAlarm` type |
| **1** | `packages/cloudflare-do/src/lib/alarm-queue.ts` | New file: AlarmQueueManager |
| **1** | `packages/cloudflare-do/src/GameRoom.ts` | Integrate alarm queue, update all scheduling calls |
| **2** | `packages/web/src/lib/components/game/MultiplayerGameView.svelte` | Update height/overflow CSS, add viewport handler |
| **2** | `packages/web/src/lib/components/lobby/ChatPanel.svelte` | Add touch-action |
| **2** | `packages/web/src/lib/utils/viewport.ts` | Add `setupContainerViewportHandler()` |
| **3** | `packages/web/src/lib/components/gallery/SpectatorReactionFloat.svelte` | Add will-change, translateZ(0) |
| **3** | `packages/web/src/lib/components/gallery/SpectatorReactionContainer.svelte` | Replace overflow:hidden with clip-path |
| **3** | `packages/web/src/lib/components/chat/ReactionFloat.svelte` | Add will-change, translateZ(0) |

---

## Risk Notes

1. **Phase 0 hotfix** is intentionally minimal—don't scope creep it. The goal is to stop game-breaking behavior, not fix everything.

2. **Phase 1 alarm queue** changes fundamental DO behavior:
   - Consider feature flag for gradual rollout
   - Test migration from legacy `alarm_data` format
   - Monitor for alarm timing drift

3. **Phase 2 viewport** changes may affect desktop layout:
   - Test on multiple screen sizes
   - Verify `max-height: 100svh` still works on desktop
   - Watch for scroll behavior changes

4. **Phase 3 emoji** `will-change` can increase memory:
   - Limit to visible elements
   - Don't apply to elements that won't animate
   - Monitor memory usage in DevTools

---

## Rollback Procedures

### Phase 0 Rollback
```bash
# Revert debounce changes
git revert <commit-hash>
pnpm deploy
```

### Phase 1 Rollback
```bash
# Revert alarm queue changes
git revert <commit-hash>
# Legacy alarm_data format will still work
pnpm deploy
```

### Phase 2 Rollback
```bash
# Revert CSS changes
git revert <commit-hash>
pnpm deploy
```

### Phase 3 Rollback
```bash
# Revert emoji CSS changes
git revert <commit-hash>
pnpm deploy
```

---

## Success Metrics

| Phase | Metric | Target |
|-------|--------|--------|
| 0 | Cascading disconnection reports | 0 after deploy |
| 1 | Alarm timing accuracy | Within 100ms of scheduled time |
| 2 | iOS viewport bug reports | 0 after deploy |
| 3 | Emoji visibility bug reports | 0 after deploy |

---

## Related Documentation

- [Investigation Report](./investigation-report.md) - Root cause analysis
- [Connection UX Implementation Plan](./connection-ux-implementation-plan.md) - Previous connection work
- [Multiplayer Resilience Investigation](./multiplayer-resilience-investigation.md) - Previous resilience work
