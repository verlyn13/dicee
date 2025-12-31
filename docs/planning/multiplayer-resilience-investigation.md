# Multiplayer Resilience Investigation & Implementation Workflow

**Version**: 1.3.0  
**Created**: 2025-01-XX  
**Updated**: 2025-01-01  
**Status**: ALL PHASES COMPLETE (1, 2, 3 & 4)
**Priority**: HIGH - Affects core multiplayer experience

---

## Executive Summary

This document provides a deep technical investigation of five interconnected multiplayer issues, identifies root causes, and proposes architectural improvements. The issues reveal gaps in three key areas:

1. **Mobile Viewport Resilience** - iOS Safari viewport corruption on pinch-zoom
2. **Spectator Data Parity** - Incomplete game state for spectators
3. **Session Continuity** - Reconnection flow failures and state corruption

All issues share a common theme: **insufficient state synchronization across connection lifecycle events**.

---

## Table of Contents

1. [Issue Analysis](#issue-analysis)
2. [Root Cause Investigation](#root-cause-investigation)
3. [Architectural Patterns to Strengthen](#architectural-patterns-to-strengthen)
4. [Implementation Phases](#implementation-phases)
5. [Code Changes](#code-changes)
6. [Testing Strategy](#testing-strategy)
7. [Success Criteria](#success-criteria)

---

## Issue Analysis

### Issue 1: iOS Pinch-to-Zoom Viewport Corruption

**Symptoms**:
- User performs pinch gesture on iOS Safari
- Page renders only fraction of top portion
- Remaining area blank/clipped
- Persists until hard refresh

**Current State**:
```html
<!-- packages/web/src/app.html -->
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content" />
```

**Root Cause**: iOS Safari has a unique Visual Viewport implementation where:
1. Layout viewport ≠ Visual viewport after pinch
2. `viewport-fit=cover` combined with `svh/dvh` units creates render conflicts
3. No zoom restriction or touch-action constraints exist

**Why Current Setup Fails**:
- `interactive-widget=resizes-content` is for keyboard, not pinch gestures
- No `user-scalable` or `maximum-scale` constraints
- No `touch-action: manipulation` on game containers
- No viewport reset mechanism after zoom state

---

### Issue 2: Spectator View Missing Critical Game State

**Symptoms**:
- Spectators cannot see other players' dice values
- Current holdings invisible
- Scoring decisions not visible

**Current Data Flow** (Investigation Results):

```
SPECTATOR CONNECTS
  ↓
SPECTATOR_CONNECTED event sent (GameRoom.ts:1202-1212)
  ├── roomCode ✓
  ├── players (list only, no game state) ✗
  ├── spectators ✓
  ├── roomStatus ✓
  └── spectatorCount ✓
  
GAME EVENTS (DICE_ROLLED, DICE_KEPT, etc.)
  ↓
broadcastToSpectators() ✓ (line 2810-2820)
  └── Full payload with dice, kept, etc. ✓
```

**Root Cause**: Spectators connecting mid-game receive:
1. ✓ Real-time game events (broadcasts work correctly)
2. ✗ Full game state snapshot on connect
3. ✗ Other players' current dice/scorecards
4. ✗ Current turn information

**Missing**: `SPECTATOR_CONNECTED` doesn't include the equivalent of `GAME_STARTED` payload with full `MultiplayerGameState`.

---

### Issue 3: Spectator Chat Engagement Features

**Symptoms**:
- Spectator "rooting" messages not surfaced to players
- No toast/notification for supportive messages
- Players unaware of audience engagement

**Current State**:
- Chat messages from spectators go through standard ChatManager
- `ROOTING_UPDATE`, `SPECTATOR_REACTION` events exist but only go to spectators
- No player-facing notification system for spectator engagement

**Root Cause**: Design gap - spectator engagement features (D6-D9 in Gallery spec) were built for spectator-to-spectator visibility, not player awareness.

---

### Issue 4: Rejoin Flow Broken — Player Becomes Stuck as Spectator

**Symptoms** (Reproduction):
1. Player (host) creates game, starts playing
2. Host refreshes mid-game
3. Returns to waiting room (unexpected - should return to active game)
4. Cannot rejoin from waiting room
5. Navigates to main lobby, attempts rejoin
6. Host's screen: player shows "disconnected" with timer
7. Rejoining player: shows as spectator, cannot interact
8. Scorecard displays "1 player" after rejoin attempt

**Root Cause Investigation**:

```typescript
// GameRoom.ts:1246-1308 - onConnect flow for players
if (!roomState) {
  // First connection creates room ✓
} else {
  // Check for reconnection
  const reconnectionResult = await this.handleReconnection(connState.userId);
  
  if (reconnectionResult.success && reconnectionResult.seat) {
    // Successful reconnection ✓
    isReconnection = true;
    reconnectedSeat = reconnectionResult.seat;
  } else {
    // NEW PLAYER OR SEAT EXPIRED
    // This is where the bug occurs!
    const seatReserved = await this.reserveSeat(...);
    
    if (!seatReserved) {
      // Room is full - CLOSE CONNECTION
      ws.close(4003, 'Room is full');  // ← Player becomes stuck
      return;
    }
  }
}
```

**Critical Bug #1**: `handleReconnection()` returns `{ success: false }` if:
- Seat exists but `seat.reconnectDeadline < now` (expired)
- Then `reserveSeat()` is called which counts "active seats" including the disconnected seat with expired deadline

```typescript
// GameRoom.ts:797-804
const activeSeats = [...seats.values()].filter(
  (seat) =>
    seat.isConnected || (seat.reconnectDeadline !== null && seat.reconnectDeadline > now),
);

if (activeSeats.length >= maxPlayers) {
  return false; // Room full - but the expired seat still counts!
}
```

**Critical Bug #2**: The expired seat is never cleaned up before the reconnection check, so:
1. Player disconnects → seat marked with 5min deadline
2. Player waits > 5 minutes (or deadline check has race condition)
3. Player reconnects → `handleReconnection()` fails (deadline expired)
4. `reserveSeat()` called → sees expired seat in storage → counts as "active"? 

Actually wait - the filter should exclude expired seats. Let me re-examine...

**Critical Bug #2 (Revised)**: The seat is NOT deleted when expired - it's only marked. When checking seat count:
```typescript
seat.isConnected || (seat.reconnectDeadline !== null && seat.reconnectDeadline > now)
```

If `reconnectDeadline` is in the past, the seat is NOT counted. But wait - in `handleReconnection()`:
```typescript
// Line 869-871
seat.isConnected = true;
seat.disconnectedAt = null;
seat.reconnectDeadline = null;
```

This clears the deadline! So if reconnection succeeds, deadline is null. But if it fails...

**Actual Bug Found**: The check at line 863:
```typescript
if (!seat.isConnected && seat.reconnectDeadline !== null && seat.reconnectDeadline < now) {
  // Seat expired
  return { success: false, seat: null };
}
```

This returns WITHOUT deleting the expired seat. Then `reserveSeat()` is called, which should NOT count this seat since:
- `seat.isConnected = false`
- `seat.reconnectDeadline < now` → NOT active

So the counting logic looks correct. Let me look at another angle...

**Bug #3 - State Inconsistency**: The `playerOrder` in `RoomState` is NOT updated when reconnection fails:
```typescript
// onConnect:1304-1307
if (!roomState.playerOrder.includes(connState.userId)) {
  roomState.playerOrder.push(connState.userId);
  await this.ctx.storage.put('room', roomState);
}
```

But if the original seat expired, the user IS in playerOrder but has no valid seat. Then:
- They're not added again (already in list)
- But they have no seat
- Result: Player in `playerOrder` but disconnected/stuck

**Bug #4 - Critical Client-Side**: When player reconnects:
```typescript
// CONNECTED event sent (line 1311-1326)
type: 'CONNECTED',
payload: {
  roomCode: roomState.roomCode,
  isHost: connState.isHost,
  players: await this.getPlayerList(),
  aiPlayers: roomState.aiPlayers ?? [],
  spectators: this.getSpectatorList(),
  roomStatus: roomState.status,  // "playing" during active game
  spectatorCount: this.getSpectatorCount(),
  reconnected: isReconnection,
}
```

**MISSING**: The game state! If `roomStatus === 'playing'`, the client needs:
- Full `MultiplayerGameState` (players with scorecards, dice, etc.)
- Current turn info
- Current dice values

Without this, the client shows as connected but has no game state.

---

### Issue 5: Refresh During Active Game Corrupts Session State

**Direct connection to Issue 4**. Same root causes:

1. **Server-side**: Seat/state management on reconnection is incomplete
2. **Client-side**: Missing game state sync on `CONNECTED` event
3. **Recovery path**: No mechanism to request full state resync

---

## Root Cause Investigation

### Pattern 1: Incomplete State Synchronization

**Problem**: Multiple connection events exist but send different data:
- `CONNECTED` (players) - Room info only
- `SPECTATOR_CONNECTED` (spectators) - Room info only
- `GAME_STARTED` - Full game state
- `QUICK_PLAY_STARTED` - Full game state

**Gap**: When `roomStatus === 'playing'`, neither `CONNECTED` nor `SPECTATOR_CONNECTED` includes game state.

### Pattern 2: Seat Lifecycle Not Atomic

**Problem**: Seat state transitions are spread across multiple operations:
1. `markSeatDisconnected()` - Sets deadline
2. `handleReconnection()` - Checks deadline, reclaims seat
3. `handleSeatExpiration()` - Deletes expired seats (alarm-based)
4. `reserveSeat()` - Creates new seat

**Gap**: Between alarm check and reconnection, race conditions exist.

### Pattern 3: Missing Recovery Mechanisms

**Problem**: No client-initiated state recovery:
- No `REQUEST_GAME_STATE` command
- No `REQUEST_FULL_SYNC` mechanism
- Client relies entirely on server push

---

## Architectural Patterns to Strengthen

### 1. Connection State Machine

Current: Ad-hoc state checks
Proposed: Explicit state machine

```
                    ┌─────────────┐
                    │ CONNECTING  │
                    └──────┬──────┘
                           │
             ┌─────────────┴─────────────┐
             │                           │
       PLAYER PATH                 SPECTATOR PATH
             │                           │
    ┌────────▼────────┐        ┌────────▼────────┐
    │  CHECK_SEAT     │        │ VALIDATE_ROOM   │
    └────────┬────────┘        └────────┬────────┘
             │                           │
    ┌────────▼────────┐        ┌────────▼────────┐
    │ RECONNECTING?   │        │  SPECTATING     │
    │  vs NEW_JOIN    │        └────────┬────────┘
    └────────┬────────┘                 │
             │                           │
    ┌────────▼────────┐        ┌────────▼────────┐
    │   SYNC_STATE    │        │   SYNC_STATE    │
    │  (if playing)   │        │  (if playing)   │
    └────────┬────────┘        └────────┬────────┘
             │                           │
             └─────────────┬─────────────┘
                           │
                    ┌──────▼──────┐
                    │  CONNECTED  │
                    └─────────────┘
```

### 2. Full State Sync Protocol

Add explicit state synchronization:

```typescript
// New event types
GAME_STATE_SYNC: {
  gameState: MultiplayerGameState;
  timestamp: number;
  seqNumber: number;  // For ordering
}

REQUEST_STATE_SYNC: {
  // Client can request full state
}
```

### 3. Viewport Resilience Layer

Add mobile-specific viewport handling:

```typescript
// New: ViewportManager.ts
export class ViewportManager {
  private lastValidState: ViewportState;
  
  detectCorruption(): boolean;
  repair(): void;
  preventZoom(): void;
}
```

### 4. Spectator Engagement Notification System

Add player-facing notifications:

```typescript
// New event
SPECTATOR_ENGAGEMENT: {
  type: 'rooting' | 'reaction' | 'chat';
  spectatorName: string;
  message: string;
  targetPlayerId?: string;  // Who is being rooted for
}
```

---

## Implementation Phases

### Phase 1: Critical Fixes (Issues 4 & 5) - Session Continuity ✅ COMPLETED

**Goal**: Players can reliably reconnect to active games

**Implemented Changes**:
1. ✅ Added `GAME_STATE_SYNC` event sent on reconnection when game is active
2. ✅ Fixed seat cleanup in `handleReconnection()` - expired seats now properly deleted
3. ✅ Updated client to handle `GAME_STATE_SYNC` with full state restoration
4. ✅ Added game state sync for spectators joining mid-game

**Files Modified**:
- `packages/cloudflare-do/src/GameRoom.ts` - Added `sendGameStateSync()`, fixed `handleReconnection()`
- `packages/web/src/lib/types/multiplayer.schema.ts` - Added `GameStateSyncEventSchema`
- `packages/web/src/lib/types/multiplayer.ts` - Added `GameStateSyncEvent` type export
- `packages/web/src/lib/stores/multiplayerGame.svelte.ts` - Added `handleGameStateSync()` handler

**Key Improvements**:
- Reconnecting players now receive complete game state (all player scorecards, dice, turn info)
- Expired seats are cleaned up on reconnect attempt (not just on alarm)
- Spectators joining mid-game receive full game state snapshot
- UI phase correctly restored based on game state

**Testing**: All quality checks pass (TypeScript, Biome, AKG invariants, unit tests)

### Phase 2: Spectator State Parity (Issue 2) ✅ COMPLETED

**Goal**: Spectators see full game state

**Implemented Changes**:
1. ✅ Added `SpectatorGameState` type and `gameState` to `SpectatorState` interface
2. ✅ Added `GAME_STATE_SYNC` handler to `spectatorService.svelte.ts`
3. ✅ Added incremental game event handlers (`DICE_ROLLED`, `DICE_KEPT`, `CATEGORY_SCORED`, `TURN_STARTED`)
4. ✅ Updated `SpectatorStore` to expose `gameState` 
5. ✅ Updated `AllScorecards.svelte` to accept and display `PlayerGameState` with scorecards
6. ✅ Updated `SpectatorView.svelte` to handle `GAME_STATE_SYNC` and pass game state to components

**Files Modified**:
- `packages/web/src/lib/services/spectatorService.svelte.ts` - Added `SpectatorGameState`, handlers
- `packages/web/src/lib/stores/spectator.svelte.ts` - Added `gameState` to store
- `packages/web/src/lib/components/spectator/SpectatorView.svelte` - `GAME_STATE_SYNC` handler
- `packages/web/src/lib/components/spectator/AllScorecards.svelte` - Full scorecard rendering

**Testing**: All quality checks pass (TypeScript, Biome, AKG invariants, unit tests)

### Phase 3: Mobile Viewport Fix (Issue 1) ✅ COMPLETED

**Goal**: iOS pinch-zoom doesn't corrupt viewport

**Implemented Changes**:
1. ✅ Created `packages/web/src/lib/utils/viewport.ts` - ViewportObserver utility
   - Tracks `visualViewport` API for accurate mobile measurements
   - Handles resize, orientation change, and touch events
   - Detects pinch-zoom corruption and provides repair mechanism
   - Sets `--vh-fallback` and `--viewport-height` CSS variables
   - Adds `.viewport-corrupted` class when zoom corruption detected

2. ✅ Extended `packages/web/src/lib/styles/global.css`
   - Added dynamic viewport CSS variables: `--viewport-height-dynamic`, `--viewport-height-small`, etc.
   - Added safe area inset variables: `--safe-top`, `--safe-bottom`, etc.
   - Added `.h-screen-dynamic` class with dvh fallback
   - Added `.app-shell`, `.app-shell__header`, `.app-shell__content`, `.app-shell__footer` layout classes
   - Added `.touch-action-manipulation`, `.touch-action-pan-x`, `.touch-action-none` utility classes
   - Added viewport corruption recovery CSS (`.viewport-corrupted`, `.viewport-repair`)

3. ✅ Updated `packages/web/src/app.html` viewport meta
   - Added `maximum-scale=1.0, user-scalable=no` to prevent pinch-zoom
   - Added `apple-mobile-web-app-capable` and `apple-mobile-web-app-status-bar-style` meta tags

4. ✅ Updated `packages/web/src/routes/+layout.svelte`
   - Added `initViewportFix()` call in onMount
   - Added cleanup in return function

5. ✅ Added `touch-action: manipulation` to game containers:
   - `packages/web/src/lib/components/game/MultiplayerGameView.svelte`
   - `packages/web/src/lib/components/spectator/SpectatorView.svelte`
   - `packages/web/src/lib/components/lobby/LobbyLanding.svelte`
   - `packages/web/src/lib/components/hub/Hub.svelte`
   - `packages/web/src/routes/game/[code]/+page.svelte`
   - `packages/web/src/routes/games/dicee/+page.svelte`

6. ✅ Fixed outdated engine.test.ts (console.warn test updated for silent catch behavior)

**Testing**: All quality checks pass (TypeScript, Biome, AKG invariants, unit tests)

### Phase 4: Spectator Chat Engagement (Issue 3) ✅ COMPLETED

**Goal**: Surface spectator engagement (reactions, rooting) to players in the game UI

**Implemented Changes**:
1. ✅ Added `SpectatorEngagement` type and state tracking to `multiplayerGame.svelte.ts`
   - Tracks spectator reactions with auto-dismiss after 4 seconds
   - Supports combo count for burst reactions
   - Max 5 concurrent notifications

2. ✅ Added `SPECTATOR_REACTION` event handler to multiplayer game store
   - Receives reactions from server (already broadcast to players)
   - Extracts spectator name, emoji, target player, and combo count

3. ✅ Created `SpectatorReactionEventSchema` in `multiplayer.schema.ts`
   - Full Zod schema for type-safe event validation
   - Added to `ServerEventSchema` discriminated union

4. ✅ Created `SpectatorEngagementBanner.svelte` component
   - Displays ephemeral pill-style notifications
   - Shows spectator name + emoji + optional combo badge
   - Animated pop-in and fade-out
   - Accessibility: `role="status"` and `aria-live="polite"`

5. ✅ Integrated into `MultiplayerGameView.svelte`
   - Banner appears below scoring notifications
   - Conditionally renders when engagements exist

**Files Created**:
- `packages/web/src/lib/components/game/SpectatorEngagementBanner.svelte`

**Files Modified**:
- `packages/web/src/lib/stores/multiplayerGame.svelte.ts` - Added state + handler
- `packages/web/src/lib/types/multiplayer.schema.ts` - Added event schema
- `packages/web/src/lib/components/game/MultiplayerGameView.svelte` - Integrated banner
- `packages/web/src/lib/components/game/index.ts` - Export new component

**Testing**: All quality checks pass (TypeScript, Biome, AKG invariants, unit tests)

### Cleanup Task: Console.log Statements ✅ COMPLETED

**Goal**: Remove raw console.log statements from production code

**Implemented Changes**:
1. ✅ Created `packages/web/src/lib/utils/logger.ts` - Structured logging utility
2. ✅ Updated 14 files to use `createServiceLogger()` instead of raw console statements
3. ✅ Converted 54 console statements to use proper logger
4. ✅ Logger respects dev/prod environments (dev: formatted logs, prod: only errors)

**Files Modified**:
- `packages/web/src/lib/utils/logger.ts` (new)
- `packages/web/src/lib/services/spectatorService.svelte.ts`
- `packages/web/src/lib/services/roomService.svelte.ts`
- `packages/web/src/lib/services/preferences.svelte.ts`
- `packages/web/src/lib/services/telemetry.ts`
- `packages/web/src/lib/services/audio.ts`
- `packages/web/src/lib/services/engine.ts`
- `packages/web/src/lib/stores/lobby.svelte.ts`
- `packages/web/src/lib/stores/game.svelte.ts`
- `packages/web/src/lib/stores/profile.svelte.ts`
- `packages/web/src/lib/stores/joinRequests.svelte.ts`
- `packages/web/src/lib/stores/chat.svelte.ts`
- `packages/web/src/lib/stores/scorecard.svelte.ts`
- `packages/web/src/lib/stores/flags.svelte.ts`
- `packages/web/src/lib/stores/auth.svelte.ts`

**Note**: The `packages/cloudflare-do/src` directory has its own logging infrastructure (`lib/logger.ts`, `lib/observability/instrumentation.ts`) which is intentional and correct. The quality gate warning about 20 console statements there is expected.

### Phase 4: Spectator Engagement Notifications (Issue 3)

**Goal**: Players see when spectators engage

**Changes**:
1. Add `SPECTATOR_ENGAGEMENT` event type
2. Broadcast engagement events to players
3. Add notification toast component
4. Add sound effect (optional)

**Files**:
- `packages/cloudflare-do/src/GameRoom.ts`
- `packages/cloudflare-do/src/types.ts`
- `packages/web/src/lib/components/game/SpectatorNotification.svelte` (new)
- `packages/web/src/lib/stores/multiplayerGame.svelte.ts`

**Effort**: 4-6 hours

---

## Code Changes

### Phase 1: Session Continuity

#### 1.1 Add GAME_STATE_SYNC Event

```typescript
// packages/cloudflare-do/src/GameRoom.ts - onConnect()

// After sending CONNECTED, if game is active, send game state
if (roomState.status === 'playing') {
  const gameState = await this.gameStateManager.getState();
  if (gameState) {
    ws.send(JSON.stringify({
      type: 'GAME_STATE_SYNC',
      payload: {
        gameState,
        timestamp: Date.now(),
        isReconnection,
      },
    }));
  }
}
```

#### 1.2 Fix Seat Cleanup

```typescript
// packages/cloudflare-do/src/GameRoom.ts - handleReconnection()

private async handleReconnection(
  userId: string,
): Promise<{ success: boolean; seat: PlayerSeat | null }> {
  const seats = await this.getSeats();
  const seat = seats.get(userId);

  if (!seat) {
    return { success: false, seat: null };
  }

  const now = Date.now();

  // Check if reconnect window is still valid
  if (!seat.isConnected && seat.reconnectDeadline !== null && seat.reconnectDeadline < now) {
    // Seat expired - CLEAN UP the expired seat
    seats.delete(userId);
    await this.saveSeats(seats);
    
    // Also remove from playerOrder
    const roomState = await this.ctx.storage.get<RoomState>('room');
    if (roomState) {
      roomState.playerOrder = roomState.playerOrder.filter(id => id !== userId);
      await this.ctx.storage.put('room', roomState);
    }
    
    this.instr?.seatRelease(userId, seat.turnOrder, 'expired_on_reconnect');
    return { success: false, seat: null };
  }

  // Reclaim seat...
  // (rest of existing code)
}
```

#### 1.3 Client-Side GAME_STATE_SYNC Handler

```typescript
// packages/web/src/lib/stores/multiplayerGame.svelte.ts

function handleServerEvent(event: ServerEvent): void {
  switch (event.type) {
    // ... existing cases ...
    
    case 'GAME_STATE_SYNC':
      handleGameStateSync(event as unknown as Parameters<typeof handleGameStateSync>[0]);
      break;
  }
}

function handleGameStateSync(event: {
  gameState?: GameState;
  timestamp?: number;
  isReconnection?: boolean;
  payload?: {
    gameState?: GameState;
    timestamp?: number;
    isReconnection?: boolean;
  };
}): void {
  const data = event.payload ?? event;
  const syncedState = data.gameState;
  
  if (!syncedState) return;
  
  // Full state replacement
  gameState = syncedState;
  
  // Set UI phase based on current state
  const currentId = syncedState.playerOrder[syncedState.currentPlayerIndex];
  uiPhase = currentId === myPlayerId ? 'IDLE' : 'WAITING';
  
  // Show reconnection banner if applicable
  if (data.isReconnection) {
    didReconnect = true;
    setTimeout(() => { didReconnect = false; }, 5000);
  }
}
```

### Phase 2: Spectator State Parity

#### 2.1 Include Game State for Spectators

```typescript
// packages/cloudflare-do/src/GameRoom.ts - onConnect() spectator branch

if (connState.role === 'spectator') {
  if (!roomState) {
    ws.close(4004, 'Room not found');
    return;
  }

  // Get game state if game is active
  let gameState: MultiplayerGameState | null = null;
  if (roomState.status === 'playing') {
    gameState = await this.gameStateManager.getState();
  }

  // Send initial state to spectator
  ws.send(
    JSON.stringify({
      type: 'SPECTATOR_CONNECTED',
      payload: {
        roomCode: roomState.roomCode,
        players: await this.getPlayerList(),
        spectators: this.getSpectatorList(),
        roomStatus: roomState.status,
        spectatorCount: this.getSpectatorCount(),
        // NEW: Include game state if active
        gameState: gameState ?? undefined,
        currentPlayerId: gameState 
          ? gameState.playerOrder[gameState.currentPlayerIndex] 
          : undefined,
      },
    }),
  );
  
  // ... rest of spectator setup
}
```

### Phase 3: Viewport Fix

#### 3.1 Update Viewport Meta

```html
<!-- packages/web/src/app.html - Game-specific viewport handling -->
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=1, user-scalable=no, interactive-widget=resizes-content" />
```

**Note**: This is aggressive. Alternative: dynamic viewport via JavaScript for game views only.

#### 3.2 Add CSS Touch Action

```css
/* packages/web/src/lib/styles/global.css */

/* Prevent pinch-zoom corruption on game views */
.game-viewport-lock {
  touch-action: pan-x pan-y;
  -webkit-touch-callout: none;
  -webkit-user-select: none;
  user-select: none;
}

/* Allow normal behavior on scrollable content */
.game-viewport-lock .scrollable {
  touch-action: pan-y;
}
```

#### 3.3 Viewport Reset Utility

```typescript
// packages/web/src/lib/utils/viewport.ts

/**
 * Reset viewport after iOS Safari zoom corruption.
 * Call on visibilitychange or after suspected corruption.
 */
export function resetViewport(): void {
  if (typeof window === 'undefined') return;
  
  // Force layout recalculation
  const viewport = document.querySelector('meta[name="viewport"]');
  if (viewport) {
    const content = viewport.getAttribute('content');
    viewport.setAttribute('content', 'width=device-width');
    // Force reflow
    void document.body.offsetHeight;
    viewport.setAttribute('content', content ?? '');
  }
}

/**
 * Detect if viewport appears corrupted.
 * Returns true if visual viewport significantly smaller than window.
 */
export function isViewportCorrupted(): boolean {
  if (typeof window === 'undefined' || !window.visualViewport) return false;
  
  const vv = window.visualViewport;
  const ratio = vv.width / window.innerWidth;
  
  // If visual viewport is < 90% of window, likely zoomed/corrupted
  return ratio < 0.9 || ratio > 1.1;
}

/**
 * Initialize viewport monitoring for game views.
 */
export function initViewportMonitor(): () => void {
  if (typeof window === 'undefined') return () => {};
  
  const handler = () => {
    if (isViewportCorrupted()) {
      resetViewport();
    }
  };
  
  window.visualViewport?.addEventListener('resize', handler);
  document.addEventListener('visibilitychange', handler);
  
  return () => {
    window.visualViewport?.removeEventListener('resize', handler);
    document.removeEventListener('visibilitychange', handler);
  };
}
```

### Phase 4: Spectator Engagement Notifications

#### 4.1 Add SPECTATOR_ENGAGEMENT Event

```typescript
// packages/cloudflare-do/src/GameRoom.ts

private notifyPlayersOfSpectatorEngagement(
  type: 'rooting' | 'reaction' | 'chat',
  spectatorName: string,
  message: string,
  targetPlayerId?: string,
): void {
  // Only send to players, not spectators
  this.broadcastToPlayers({
    type: 'SPECTATOR_ENGAGEMENT',
    payload: {
      type,
      spectatorName,
      message,
      targetPlayerId,
      timestamp: Date.now(),
    },
  });
}

// Call this when spectator roots for player
private handleRootForPlayer(...) {
  // ... existing code ...
  
  // Notify players
  this.notifyPlayersOfSpectatorEngagement(
    'rooting',
    connState.displayName,
    `${connState.displayName} is rooting for ${targetPlayerName}!`,
    payload.playerId,
  );
}
```

---

## Testing Strategy

### Unit Tests

1. **Seat lifecycle tests** (`seat-lifecycle.test.ts`)
   - Reconnection within window succeeds
   - Reconnection after expiry cleans up seat
   - Concurrent reconnection attempts handled

2. **State sync tests** (`state-sync.test.ts`)
   - GAME_STATE_SYNC sent on reconnection when playing
   - Spectator receives game state on mid-game connect
   - Client correctly applies state sync

### Integration Tests

1. **Reconnection flow** (Playwright)
   - Player creates game, starts, refreshes mid-turn
   - Verify game state restored on both clients
   - Verify can continue playing

2. **Spectator mid-game join** (Playwright)
   - Game in progress, spectator joins
   - Verify spectator sees all player states
   - Verify spectator sees dice, scorecards

3. **iOS viewport** (Manual on device)
   - Pinch zoom during game
   - Verify viewport not corrupted
   - Verify can continue playing

---

## Success Criteria

### Issue 1: iOS Viewport ✓ when:
- [ ] Pinch-zoom on iOS Safari doesn't corrupt viewport
- [ ] Game remains playable after zoom gesture
- [ ] Touch interactions work correctly

### Issue 2: Spectator State ✓ when:
- [ ] Spectators joining mid-game see all player dice
- [ ] Spectators see current holdings (kept dice)
- [ ] Spectators see scoring decisions in real-time
- [ ] Spectators see all player scorecards

### Issue 3: Spectator Engagement ✓ when:
- [ ] Players see toast/notification when spectator roots
- [ ] Players see notification for spectator reactions
- [ ] Notifications don't disrupt gameplay

### Issue 4: Rejoin Flow ✓ when:
- [ ] Host can refresh and rejoin as host
- [ ] Player can refresh and rejoin as player
- [ ] Rejoining player sees correct game state
- [ ] Other players see rejoined player correctly

### Issue 5: Refresh Resilience ✓ when:
- [ ] Any player can refresh during active game
- [ ] Game state fully restored after refresh
- [ ] Turn order maintained
- [ ] No duplicate players in game

---

## Appendix A: Event Type Reference

| Event | Sender | Recipients | When | Contains Game State? |
|-------|--------|------------|------|---------------------|
| `CONNECTED` | Server | Player | On connect | ❌ No |
| `SPECTATOR_CONNECTED` | Server | Spectator | On connect | ❌ No (❌ Bug) |
| `GAME_STARTED` | Server | All players | Game starts | ✅ Yes |
| `GAME_STATE_SYNC` | Server | Reconnecting | On reconnect if playing | ✅ Yes (NEW) |
| `DICE_ROLLED` | Server | All | On roll | Partial (dice only) |
| `CATEGORY_SCORED` | Server | All | On score | Partial (score only) |

---

## Appendix B: State Flow Diagrams

### Current Reconnection Flow (Buggy)

```
Player Disconnects
     ↓
markSeatDisconnected()
     ↓
5min window starts
     ↓
Player Reconnects
     ↓
handleReconnection()
     ├── Seat exists? 
     │   └── No → reserveSeat() → May fail if seat not cleaned
     │   └── Yes → Deadline passed?
     │            └── Yes → Return failure (seat NOT cleaned!)
     │            └── No → Reclaim seat ✓
     ↓
Send CONNECTED (no game state)
     ↓
Client has no game state ❌
```

### Fixed Reconnection Flow

```
Player Disconnects
     ↓
markSeatDisconnected()
     ↓
5min window starts
     ↓
Player Reconnects
     ↓
handleReconnection()
     ├── Seat exists? 
     │   └── No → reserveSeat() → Creates new seat
     │   └── Yes → Deadline passed?
     │            └── Yes → CLEAN UP seat → reserveSeat()
     │            └── No → Reclaim seat ✓
     ↓
Send CONNECTED
     ↓
If status === 'playing':
  Send GAME_STATE_SYNC with full state ✓
     ↓
Client applies state, shows game ✓
```

---

## Implementation Order

1. **Week 1**: Phase 1 (Session Continuity) - Most critical
2. **Week 2**: Phase 2 (Spectator State) - High impact
3. **Week 3**: Phase 3 (Viewport) + Phase 4 (Engagement) - Polish

---

## References

- `docs/architecture/MULTIPLAYER_PERSISTENCE_ARCHITECTURE.md` - Seat system design
- `docs/architecture/GAME_ROOM_TECHNICAL_REPORT.md` - GameRoom internals
- `.claude/CONVENTIONS.md` - Event naming conventions
- iOS Safari Visual Viewport documentation
