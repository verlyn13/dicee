# Quick Play AI Integration - Debug Report

**Date**: 2025-12-09  
**Session**: Windsurf/Cascade  
**Status**: Partially Working - AI Turn Execution Stuck

---

## Objective

Fix the Quick Play flow so that:
1. User selects an AI opponent (e.g., Carmen)
2. Room is created with AI player visible in waiting room
3. Game starts (auto or manual)
4. AI takes its turn (visible to human player)
5. Human takes their turn
6. Game loop continues until completion

---

## What Was Accomplished

### 1. AI Player Display in Waiting Room ✅
- **Files Modified**:
  - `packages/web/src/lib/stores/room.svelte.ts` - Added `aiPlayerCount` to player count calculations
  - `packages/web/src/lib/services/roomService.svelte.ts` - Handle `ai.joined` event, populate `aiPlayers` array
  - `packages/web/src/lib/components/lobby/RoomLobby.svelte` - Render AI players with 🤖 badge
  - `packages/cloudflare-do/src/GameRoom.ts` - Include `aiPlayers` in CONNECTED payload

### 2. Game Start Transition ✅
- **Files Modified**:
  - `packages/web/src/lib/services/roomService.svelte.ts` - Enhanced `GAME_STARTED` event normalization to include `players`, `phase`, `roundNumber`, `roomCode`
  - `packages/web/src/lib/stores/multiplayerGame.svelte.ts` - Fixed `handleGameStarted` to initialize `gameState` (was only updating if already existed)

### 3. Game Event Normalization ✅
- **Files Modified**:
  - `packages/web/src/lib/services/roomService.svelte.ts` - Added handlers for:
    - `DICE_ROLLED` → `dice.rolled`
    - `DICE_KEPT` → `dice.kept`
    - `CATEGORY_SCORED` → `category.scored`
    - `TURN_STARTED` → `turn.started`
    - `TURN_ENDED` → `turn.ended`
    - `GAME_COMPLETED` → `game.completed`

### 4. Client Command Format Fix ✅
- **Files Modified**:
  - `packages/web/src/lib/services/roomService.svelte.ts` - Changed client commands to match server format:
    - `dice.roll` → `DICE_ROLL` with `payload: { kept }`
    - `dice.keep` → `DICE_KEEP` with `payload: { indices }`
    - `category.score` → `CATEGORY_SCORE` with `payload: { category }`

### 5. AI State Refresh Fix ✅
- **Files Modified**:
  - `packages/cloudflare-do/src/ai/controller.ts` - Changed `executeTurn` to accept `getGameState: () => Promise<MultiplayerGameState | null>` instead of static state
  - `packages/cloudflare-do/src/ai/gameroom-integration.ts` - Updated to pass state getter
  - `packages/cloudflare-do/src/GameRoom.ts` - Pass `async () => this.gameStateManager.getState()` to AI turn execution

---

## Current Issues

### Issue 1: Waiting Room Bypassed
**Symptom**: Quick Play immediately transitions to game view, skipping waiting room display.

**Cause**: The Quick Play handler in `+page.svelte` auto-starts the game immediately after AI joins:
```typescript
// +page.svelte lines 100-130
if (eventType === 'ai.joined' && !hasStartedGame) {
  hasStartedGame = true;
  setTimeout(() => {
    roomService.sendStartGame();
  }, 200);  // Only 200ms delay
}
```

**Potential Fix**: Increase delay or add a "Ready to Start" confirmation step.

### Issue 2: AI Turn Not Visible to Human Player
**Symptom**: Console shows AI events (`AI_THINKING`, `AI_ROLLING`, `AI_KEEPING`) but UI doesn't update.

**Root Cause**: The client receives AI events but:
1. `AI_THINKING`, `AI_ROLLING`, `AI_KEEPING` are returned as `null` from normalizer (ignored)
2. The actual game state changes (`DICE_ROLLED`, `DICE_KEPT`, `CATEGORY_SCORED`) from AI actions are NOT being received by the client

**Evidence from Console**:
```
[RoomService] Could not normalize server event: {type: 'AI_THINKING', payload: {…}}
[RoomService] Unknown message type: AI_ROLLING
[RoomService] Unknown message type: AI_KEEPING
```

**Missing**: No `DICE_ROLLED`, `DICE_KEPT`, `CATEGORY_SCORED` events appear in console during AI turn.

### Issue 3: AI Turn Appears Stuck
**Symptom**: After AI events, the game shows "Carmen's Turn" but nothing happens visually.

**Possible Causes**:
1. AI commands execute but broadcasts don't reach the human player's WebSocket
2. Game state updates but `TURN_ENDED` event not sent after AI scores
3. AI brain decision loop not completing (stuck in thinking)

---

## Architecture Understanding

### Message Flow (Server → Client)

```
GameRoom.ts (DO)
    ↓ broadcast({ type: 'DICE_ROLLED', payload: {...} })
    ↓
WebSocket
    ↓
roomService.svelte.ts
    ↓ normalizeServerEvent() - converts DICE_ROLLED → dice.rolled
    ↓ handleMessage() - dispatches to event handlers
    ↓
multiplayerGame.svelte.ts
    ↓ handleServerEvent() - updates gameState
    ↓
MultiplayerGameView.svelte
    ↓ Renders based on phase and gameState
```

### AI Turn Flow (Server-Side)

```
triggerAITurnIfNeeded(playerId)
    ↓
AIRoomManager.executeAITurn(playerId, getGameState, executeCommand, broadcast)
    ↓
AIController.executeTurn() - loops until score
    ↓ For each step:
    ↓   1. getGameState() - fetch fresh state
    ↓   2. brain.decide(context) - AI decision
    ↓   3. executeDecision() - calls executeCommand callback
    ↓
executeAICommand(playerId, command)
    ↓ case 'roll': gameStateManager.rollDice() → broadcast DICE_ROLLED
    ↓ case 'keep': gameStateManager.keepDice() → broadcast DICE_KEPT
    ↓ case 'score': gameStateManager.scoreCategory() → broadcast CATEGORY_SCORED
```

### Spectator Mode Architecture

The project has a spectator system designed for:
1. **Non-players watching games** - Join as spectator, see game state
2. **Players watching opponent's turn** - "Spectator mode" within game

Key files:
- `packages/web/src/lib/services/spectatorService.svelte.ts`
- `packages/web/src/lib/components/gallery/` - Gallery UI components
- `packages/cloudflare-do/src/GameRoom.ts` - `broadcastToSpectators()` method

The spectator architecture should inform how we display AI turns to the human player.

---

## What Hasn't Worked

1. **Adding game event handlers** - Events are normalized but not received during AI turn
2. **Fixing state getter** - AI gets fresh state but broadcasts may not be reaching client
3. **Quick patches** - Multiple incremental fixes without understanding full flow

---

## Recommended Next Steps

### 1. Add Server-Side Logging
Add detailed logging in `GameRoom.ts` to verify:
- AI commands are being executed
- `broadcast()` is being called with correct data
- WebSocket connections are active

### 2. Verify WebSocket Broadcast
Check if `this.broadcast()` in `executeAICommand` actually sends to all connected clients:
```typescript
// In GameRoom.ts executeAICommand
console.log('[GameRoom] Broadcasting DICE_ROLLED to', this.connections.size, 'connections');
```

### 3. Check AI Turn Completion
Verify the AI turn loop completes and triggers turn advancement:
- Does `scoreCategory` return `nextPlayerId`?
- Is `triggerAITurnIfNeeded` called after AI scores?
- Does turn advance to human player?

### 4. Review Spectator Mode Integration
The spectator architecture may have patterns for displaying opponent actions that should be reused for AI turns.

### 5. Consider Architectural Alignment
Use AKG tools to verify:
- Import relationships are correct
- No circular dependencies
- Layer boundaries respected

---

## Files Modified This Session

| File | Changes |
|------|---------|
| `packages/web/src/lib/stores/room.svelte.ts` | AI player count in canStart |
| `packages/web/src/lib/services/roomService.svelte.ts` | Event normalization, command format |
| `packages/web/src/lib/stores/multiplayerGame.svelte.ts` | Initialize gameState on game start |
| `packages/web/src/lib/components/lobby/RoomLobby.svelte` | Render AI players |
| `packages/cloudflare-do/src/GameRoom.ts` | aiPlayers in CONNECTED, state getter |
| `packages/cloudflare-do/src/ai/controller.ts` | State getter function |
| `packages/cloudflare-do/src/ai/gameroom-integration.ts` | State getter function |

---

## Test Commands

```bash
# Build and type check
pnpm check

# Run tests
pnpm web:vitest
pnpm -F cloudflare-do test

# Deploy
cd packages/cloudflare-do && npx wrangler deploy
cd packages/web && npx wrangler pages deploy .svelte-kit/cloudflare --project-name=dicee --branch=main

# Watch worker logs
cd packages/cloudflare-do && npx wrangler tail --format=pretty
```

---

## Session Context

This debug session revealed a mismatch between:
1. **Client expectations** (PartyKit-style events like `dice.rolled`)
2. **Server format** (DO-style events like `DICE_ROLLED`)

The normalization layer in `roomService.svelte.ts` bridges this gap, but the AI turn broadcasts may not be reaching the client at all, suggesting a WebSocket or broadcast issue rather than a parsing issue.

The core game loop works for human players (tested previously), so the issue is specific to AI turn execution and broadcast.

---

## Session 2: Diagnostic Instrumentation (2025-12-09)

### Changes Made

#### 1. Server-Side Boundary Logging
**File**: `packages/cloudflare-do/src/GameRoom.ts`

Added logging to `broadcast()` method to track what's being sent:
```typescript
private broadcast(message: object, exclude?: WebSocket): void {
    const allSockets = this.ctx.getWebSockets();
    const msgType = (message as { type?: string }).type ?? 'unknown';
    let sentCount = 0;
    // ... sends to sockets ...
    console.log(`[Broadcast] ${msgType} → ${sentCount}/${allSockets.length} sockets`);
}
```

#### 2. Client-Side Raw Message Logging
**File**: `packages/web/src/lib/services/roomService.svelte.ts`

Added raw WebSocket message logging:
```typescript
private handleMessage(event: MessageEvent): void {
    const raw = JSON.parse(event.data);
    console.log('[RoomService] RAW WS message:', raw.type ?? 'unknown', raw);
    // ... rest of handler
}
```

#### 3. TURN_CHANGED Handler
**File**: `packages/web/src/lib/services/roomService.svelte.ts`

Added missing handler for `TURN_CHANGED` event (server sends this, client expected `turn.started`):
```typescript
case 'TURN_CHANGED': {
    const payload = raw.payload as Record<string, unknown>;
    return {
        type: 'turn.started',
        playerId: payload?.currentPlayerId as string,
        turnNumber: payload?.turnNumber as number,
        roundNumber: payload?.roundNumber as number,
    } as ServerEvent;
}
```

#### 4. AI Event Logging
**File**: `packages/web/src/lib/services/roomService.svelte.ts`

Changed AI events from silent drop to logged drop:
```typescript
case 'AI_THINKING':
case 'AI_ROLLING':
case 'AI_KEEPING':
case 'AI_SCORING':
    console.log(`[RoomService] AI event: ${type}`, raw.payload);
    return null;
```

### Diagnostic Commands

```bash
# Watch server logs (run in cloudflare-do directory)
npx wrangler tail --format=pretty | grep "\[Broadcast\]"

# Expected output during AI turn:
# [Broadcast] AI_THINKING → 1/1 sockets
# [Broadcast] AI_ROLLING → 1/1 sockets
# [Broadcast] DICE_ROLLED → 1/1 sockets
# [Broadcast] AI_KEEPING → 1/1 sockets
# [Broadcast] DICE_KEPT → 1/1 sockets
# [Broadcast] AI_SCORING → 1/1 sockets
# [Broadcast] CATEGORY_SCORED → 1/1 sockets
# [Broadcast] TURN_CHANGED → 1/1 sockets

# If you see "→ 0/0 sockets" or "→ 0/1 sockets":
# - WebSocket connection tracking issue
# - DO hibernation dropped connections
```

### Next Steps

1. **Deploy and test** with `wrangler tail` watching
2. **Check client console** for `[RoomService] RAW WS message:` logs
3. **If broadcasts show 0 sockets**: WebSocket connection management bug
4. **If broadcasts show 1+ sockets but client doesn't receive**: Transport issue
5. **If client receives but doesn't process**: Normalizer/handler bug

### Architectural Insight

The analysis revealed **two parallel event systems** that were never unified:
- Server broadcasts uppercase events (`DICE_ROLLED`, `TURN_CHANGED`)
- Client expects lowercase events (`dice.rolled`, `turn.started`)
- Normalizer bridges the gap but is a symptom, not a solution

**Strategic fix** (future): Create shared event types package, make AI use same code paths as humans.
