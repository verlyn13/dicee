# Comprehensive Observability Strategy for Dicee State Issues

Let me synthesize everything into a systematic debugging approach that will reveal exactly what's happening with your state persistence, seat management, and connection issues.

---

## The Core Problem Statement

You have three interrelated symptoms:

| Symptom | Likely Root Cause | What We Need to See |
|---------|-------------------|---------------------|
| Game resets on refresh | State not loaded from storage on DO wake | Storage reads on reconnect |
| Players become spectators | Seat reservation not persisting or not checked | Seat lifecycle operations |
| Constant reconnecting | Token expiry, DO hibernation, or network | Close codes and timing |

These are all **state synchronization failures** between:
- Client ↔ WebSocket ↔ Durable Object ↔ Storage

---

## Phase 1: Instrument the Critical Paths

Before you can debug, you need visibility. Here's the minimal instrumentation that will expose your issues:

### 1.1 Create the Instrumentation Layer

**Create:** `packages/cloudflare-do/src/lib/instrumentation.ts`

```typescript
/**
 * Unified instrumentation for Dicee Durable Objects
 * Designed to expose state persistence and WebSocket lifecycle issues
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface BaseLogEntry {
  _ts: number;
  _level: LogLevel;
  _component: 'GameRoom' | 'GlobalLobby';
  _event: string;
  roomCode?: string;
  userId?: string;
}

// Singleton state for request correlation
let requestId = 0;

export function createInstrumentation(component: 'GameRoom' | 'GlobalLobby', roomCode?: string) {
  const baseContext = { _component: component, roomCode };
  const currentRequestId = ++requestId;

  function emit(level: LogLevel, event: string, data?: Record<string, unknown>) {
    const entry: BaseLogEntry & Record<string, unknown> = {
      _ts: Date.now(),
      _level: level,
      _event: event,
      _reqId: currentRequestId,
      ...baseContext,
      ...data,
    };
    
    // Output as JSON for Workers Logs parsing
    console[level === 'debug' ? 'log' : level](JSON.stringify(entry));
  }

  return {
    // === LIFECYCLE EVENTS ===
    
    /** Call on every WebSocket message when DO may have hibernated */
    hibernationWake(storageKeys: string[], connectedClients: number) {
      emit('info', 'lifecycle.wake', {
        storageKeys,
        connectedClients,
        hasGameState: storageKeys.includes('game'),
        hasSeats: storageKeys.includes('seats'),
        hasRoomState: storageKeys.includes('room'),
      });
    },

    /** Call when a new WebSocket connects */
    clientConnect(userId: string, role: 'player' | 'spectator' | 'pending') {
      emit('info', 'lifecycle.connect', { userId, role });
    },

    /** Call when WebSocket closes */
    clientDisconnect(userId: string, code: number, reason: string, wasPlayer: boolean) {
      emit('info', 'lifecycle.disconnect', {
        userId,
        closeCode: code,
        closeReason: reason,
        wasPlayer,
        codeCategory: categorizeCloseCode(code),
      });
    },

    // === STORAGE EVENTS ===

    /** Call BEFORE every storage.get */
    storageReadStart(key: string) {
      emit('debug', 'storage.read.start', { key });
    },

    /** Call AFTER every storage.get */
    storageReadEnd(key: string, found: boolean, valueType?: string, duration?: number) {
      emit('info', 'storage.read.end', {
        key,
        found,
        valueType,
        durationMs: duration,
      });
    },

    /** Call BEFORE every storage.put */
    storageWriteStart(key: string, valueType: string) {
      emit('debug', 'storage.write.start', { key, valueType });
    },

    /** Call AFTER every storage.put completes */
    storageWriteEnd(key: string, success: boolean, duration?: number) {
      emit('info', 'storage.write.end', {
        key,
        success,
        durationMs: duration,
      });
    },

    // === STATE MACHINE EVENTS ===

    /** Call on any game state transition */
    stateTransition(from: string, to: string, trigger: string) {
      emit('info', 'state.transition', { from, to, trigger });
    },

    /** Call when state transition is rejected */
    stateTransitionRejected(current: string, attempted: string, trigger: string, reason: string) {
      emit('warn', 'state.transition.rejected', {
        currentState: current,
        attemptedState: attempted,
        trigger,
        reason,
      });
    },

    // === SEAT MANAGEMENT EVENTS (Critical for your issue) ===

    /** Call when creating/assigning a seat */
    seatAssign(userId: string, turnOrder: number, totalSeats: number) {
      emit('info', 'seat.assign', { userId, turnOrder, totalSeats });
    },

    /** Call when reserving seat for disconnected player */
    seatReserve(userId: string, deadlineMs: number) {
      emit('info', 'seat.reserve', {
        userId,
        deadlineMs,
        deadlineTime: new Date(deadlineMs).toISOString(),
        reservationWindowSec: Math.round((deadlineMs - Date.now()) / 1000),
      });
    },

    /** Call when player attempts to reclaim seat */
    seatReclaimAttempt(userId: string, hasSeat: boolean, isConnected: boolean, deadline: number | null) {
      const now = Date.now();
      emit('info', 'seat.reclaim.attempt', {
        userId,
        hasSeat,
        seatCurrentlyConnected: isConnected,
        deadline,
        now,
        withinDeadline: deadline ? now < deadline : false,
        msUntilDeadline: deadline ? deadline - now : null,
      });
    },

    /** Call with result of seat reclaim */
    seatReclaimResult(userId: string, result: 'reclaimed' | 'spectator', reason?: string) {
      emit('info', 'seat.reclaim.result', { userId, result, reason });
    },

    /** Call when seat is released (timeout or explicit leave) */
    seatRelease(userId: string, reason: 'timeout' | 'leave' | 'kick') {
      emit('info', 'seat.release', { userId, reason });
    },

    // === BROADCAST EVENTS ===

    /** Call BEFORE broadcasting to verify storage-first pattern */
    broadcastPrepare(eventType: string, recipientCount: number) {
      emit('debug', 'broadcast.prepare', { eventType, recipientCount });
    },

    /** Call AFTER broadcast completes */
    broadcastSent(eventType: string, recipientCount: number) {
      emit('debug', 'broadcast.sent', { eventType, recipientCount });
    },

    // === DIAGNOSTIC SNAPSHOTS ===

    /** Full state dump for debugging */
    async stateSnapshot(storage: DurableObjectStorage, reason: string) {
      const allData = await storage.list();
      const snapshot: Record<string, unknown> = {};
      
      for (const [key, value] of allData) {
        // Truncate large values
        const serialized = JSON.stringify(value);
        snapshot[key] = serialized.length > 500 
          ? { _truncated: true, _length: serialized.length, _preview: serialized.slice(0, 200) }
          : value;
      }

      emit('info', 'diagnostic.snapshot', {
        reason,
        keyCount: allData.size,
        keys: [...allData.keys()],
        snapshot,
      });
    },

    // === ERROR TRACKING ===

    error(event: string, error: unknown, context?: Record<string, unknown>) {
      emit('error', event, {
        ...context,
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
      });
    },
  };
}

function categorizeCloseCode(code: number): string {
  switch (code) {
    case 1000: return 'normal';
    case 1001: return 'going_away';
    case 1006: return 'abnormal_no_close_frame';
    case 1008: return 'policy_violation';
    case 1011: return 'server_error';
    case 1012: return 'service_restart';
    case 1013: return 'try_again_later';
    case 1014: return 'bad_gateway';
    default: return `unknown_${code}`;
  }
}

export type Instrumentation = ReturnType<typeof createInstrumentation>;
```

### 1.2 Integrate into GameRoom

**Edit:** `packages/cloudflare-do/src/GameRoom.ts`

Here's the critical integration pattern:

```typescript
import { createInstrumentation, type Instrumentation } from './lib/instrumentation';

export class GameRoom implements DurableObject {
  private ctx: DurableObjectState;
  private env: Env;
  
  // Instrumentation
  private instr: Instrumentation | null = null;
  private roomCode: string | null = null;
  private initialized = false;

  constructor(ctx: DurableObjectState, env: Env) {
    this.ctx = ctx;
    this.env = env;
  }

  /**
   * CRITICAL: Call this at the start of EVERY handler
   * Handles hibernation wake and ensures instrumentation is ready
   */
  private async ensureInitialized(): Promise<void> {
    if (this.initialized) return;

    // Load room code from storage (survives hibernation)
    const start = Date.now();
    this.roomCode = await this.ctx.storage.get<string>('room_code') ?? null;
    
    // Create instrumentation with room context
    this.instr = createInstrumentation('GameRoom', this.roomCode ?? undefined);
    
    // Log hibernation wake with full state audit
    const allKeys = [...(await this.ctx.storage.list()).keys()];
    this.instr.hibernationWake(allKeys, this.ctx.getWebSockets().length);
    
    // Diagnostic: Full state snapshot on wake (disable in production for performance)
    if (this.env.DEBUG_MODE) {
      await this.instr.stateSnapshot(this.ctx.storage, 'hibernation_wake');
    }

    this.initialized = true;
  }

  // === WEBSOCKET HANDLERS ===

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    await this.ensureInitialized();
    
    const parsed = JSON.parse(message as string);
    const attachment = ws.deserializeAttachment() as ConnectionState | null;
    
    // Log inbound message
    this.instr?.broadcastPrepare(parsed.type, 1);

    try {
      await this.handleMessage(parsed, ws, attachment);
    } catch (error) {
      this.instr?.error('message.handler.failed', error, {
        messageType: parsed.type,
        userId: attachment?.userId,
      });
      throw error;
    }
  }

  async webSocketOpen(ws: WebSocket): Promise<void> {
    await this.ensureInitialized();
    
    // Parse connection info from URL or attachment
    const url = new URL(ws.url ?? '', 'https://dummy');
    const userId = url.searchParams.get('userId') ?? 'unknown';
    
    this.instr?.clientConnect(userId, 'pending');
    
    // Determine if this is a reconnection
    const role = await this.handleConnection(userId, ws);
    
    // Update log with final role
    this.instr?.clientConnect(userId, role);
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string): Promise<void> {
    await this.ensureInitialized();
    
    const attachment = ws.deserializeAttachment() as ConnectionState | null;
    const userId = attachment?.userId ?? 'unknown';
    const wasPlayer = attachment?.role === 'player';
    
    this.instr?.clientDisconnect(userId, code, reason, wasPlayer);
    
    // Handle seat reservation for players
    if (wasPlayer) {
      await this.handlePlayerDisconnect(userId);
    }
  }

  // === CONNECTION HANDLING (Your Issue Lives Here) ===

  private async handleConnection(userId: string, ws: WebSocket): Promise<'player' | 'spectator'> {
    // Load current game state
    const readStart = Date.now();
    this.instr?.storageReadStart('game');
    const gameState = await this.ctx.storage.get<GameState>('game');
    this.instr?.storageReadEnd('game', !!gameState, typeof gameState, Date.now() - readStart);

    // If no game in progress, this is a normal join (waiting room)
    if (!gameState || gameState.phase === 'waiting') {
      return this.handleWaitingRoomJoin(userId, ws);
    }

    // Game in progress - check for seat reservation
    this.instr?.storageReadStart('seats');
    const seats = await this.ctx.storage.get<Map<string, PlayerSeat>>('seats');
    this.instr?.storageReadEnd('seats', !!seats, 'Map', Date.now() - readStart);

    const seat = seats?.get(userId);
    
    // Log the reclaim attempt with full context
    this.instr?.seatReclaimAttempt(
      userId,
      !!seat,
      seat?.isConnected ?? false,
      seat?.reconnectDeadline ?? null
    );

    // Check if player can reclaim their seat
    if (seat && !seat.isConnected && seat.reconnectDeadline && Date.now() < seat.reconnectDeadline) {
      // Reclaim seat
      seat.isConnected = true;
      seat.disconnectedAt = null;
      seat.reconnectDeadline = null;
      
      // CRITICAL: Persist BEFORE confirming to client
      const writeStart = Date.now();
      this.instr?.storageWriteStart('seats', 'Map');
      await this.ctx.storage.put('seats', seats);
      this.instr?.storageWriteEnd('seats', true, Date.now() - writeStart);
      
      // Set up WebSocket attachment
      ws.serializeAttachment({ userId, role: 'player', turnOrder: seat.turnOrder });
      
      this.instr?.seatReclaimResult(userId, 'reclaimed');
      
      // Send full game state to reconnected player
      await this.sendGameState(ws, gameState, 'player');
      
      return 'player';
    }

    // Cannot reclaim - determine reason for logging
    let reason = 'unknown';
    if (!seat) reason = 'no_seat_found';
    else if (seat.isConnected) reason = 'seat_already_connected';
    else if (!seat.reconnectDeadline) reason = 'no_deadline_set';
    else reason = 'deadline_passed';

    this.instr?.seatReclaimResult(userId, 'spectator', reason);
    
    // Set up as spectator
    ws.serializeAttachment({ userId, role: 'spectator' });
    await this.sendGameState(ws, gameState, 'spectator');
    
    return 'spectator';
  }

  private async handlePlayerDisconnect(userId: string): Promise<void> {
    // Check if game is in progress
    this.instr?.storageReadStart('game');
    const gameState = await this.ctx.storage.get<GameState>('game');
    this.instr?.storageReadEnd('game', !!gameState, typeof gameState);

    if (!gameState || gameState.phase !== 'playing') {
      // No game in progress, no need to reserve seat
      return;
    }

    // Load seats
    this.instr?.storageReadStart('seats');
    const seats = await this.ctx.storage.get<Map<string, PlayerSeat>>('seats');
    this.instr?.storageReadEnd('seats', !!seats, 'Map');

    if (!seats) {
      this.instr?.error('seat.reserve.failed', new Error('No seats map found'), { userId });
      return;
    }

    const seat = seats.get(userId);
    if (!seat) {
      this.instr?.error('seat.reserve.failed', new Error('No seat for user'), { userId });
      return;
    }

    // Reserve seat for reconnection
    const deadline = Date.now() + 5 * 60 * 1000; // 5 minutes
    seat.isConnected = false;
    seat.disconnectedAt = Date.now();
    seat.reconnectDeadline = deadline;

    // CRITICAL: Persist reservation
    const writeStart = Date.now();
    this.instr?.storageWriteStart('seats', 'Map');
    await this.ctx.storage.put('seats', seats);
    this.instr?.storageWriteEnd('seats', true, Date.now() - writeStart);

    this.instr?.seatReserve(userId, deadline);

    // Set alarm for seat expiration
    await this.ctx.storage.setAlarm(deadline);
  }

  // === GAME STATE TRANSITIONS ===

  private async startGame(): Promise<void> {
    // Load current state
    this.instr?.storageReadStart('room');
    const room = await this.ctx.storage.get<RoomState>('room');
    this.instr?.storageReadEnd('room', !!room, typeof room);

    if (!room || room.status !== 'waiting') {
      this.instr?.stateTransitionRejected(
        room?.status ?? 'unknown',
        'playing',
        'START_GAME',
        'Invalid current state'
      );
      return;
    }

    // Build initial game state
    const gameState: GameState = {
      phase: 'playing',
      currentPlayerIndex: 0,
      round: 1,
      // ... rest of game initialization
    };

    // Build seats map
    const seats = new Map<string, PlayerSeat>();
    room.players.forEach((player, index) => {
      seats.set(player.id, {
        oduserId: player.id,
        displayName: player.displayName,
        isConnected: true,
        disconnectedAt: null,
        reconnectDeadline: null,
        turnOrder: index,
      });
      this.instr?.seatAssign(player.id, index, room.players.length);
    });

    // CRITICAL: Storage-first pattern
    // Persist ALL state BEFORE broadcasting
    this.instr?.storageWriteStart('game', 'GameState');
    await this.ctx.storage.put('game', gameState);
    this.instr?.storageWriteEnd('game', true);

    this.instr?.storageWriteStart('seats', 'Map');
    await this.ctx.storage.put('seats', seats);
    this.instr?.storageWriteEnd('seats', true);

    room.status = 'playing';
    this.instr?.storageWriteStart('room', 'RoomState');
    await this.ctx.storage.put('room', room);
    this.instr?.storageWriteEnd('room', true);

    // Log state transition
    this.instr?.stateTransition('waiting', 'playing', 'START_GAME');

    // NOW broadcast (after all storage is confirmed)
    this.instr?.broadcastPrepare('GAME_STARTED', this.ctx.getWebSockets().length);
    this.broadcast({ type: 'GAME_STARTED', payload: gameState });
    this.instr?.broadcastSent('GAME_STARTED', this.ctx.getWebSockets().length);
  }

  // === HELPER METHODS ===

  private broadcast(message: unknown): void {
    const raw = JSON.stringify(message);
    for (const ws of this.ctx.getWebSockets()) {
      try {
        ws.send(raw);
      } catch (error) {
        this.instr?.error('broadcast.send.failed', error);
      }
    }
  }
}
```

### 1.3 Enable Detailed Logging in Wrangler

**Edit:** `packages/cloudflare-do/wrangler.toml`

```toml
name = "dicee-multiplayer"
main = "src/index.ts"
compatibility_date = "2024-01-01"

# Enable full observability
[observability]
enabled = true
head_sampling_rate = 1  # 100% during debugging

[observability.logs]
invocation_logs = true

# Environment variable for debug mode
[vars]
DEBUG_MODE = "true"

# For production, reduce sampling
[env.production.observability]
head_sampling_rate = 0.1  # 10% in production

[env.production.vars]
DEBUG_MODE = "false"
```

---

## Phase 2: Query and Analyze

Now you have instrumentation. Here's how to extract insights.

### 2.1 Real-Time Debugging with Wrangler Tail

Open a terminal and run:

```bash
# See everything
wrangler tail dicee-multiplayer --format json | jq '.'

# Filter to state transitions only
wrangler tail dicee-multiplayer --format json | jq 'select(.logs[].message[] | contains("state.transition"))'

# Filter to storage operations
wrangler tail dicee-multiplayer --format json | jq 'select(.logs[].message[] | contains("storage."))'

# Filter to seat operations (your main issue)
wrangler tail dicee-multiplayer --format json | jq 'select(.logs[].message[] | contains("seat."))'

# Filter to errors and warnings
wrangler tail dicee-multiplayer --status error
```

### 2.2 Using Cloudflare MCP Observability Server

With the MCP server configured, you can query from your AI assistant:

```
"Using the Cloudflare observability server, query the last 200 logs from 
dicee-multiplayer where the event starts with 'seat.' - show me the 
sequence of seat operations"
```

```
"Find all logs where _event is 'storage.write.end' and show me if any 
have success: false"
```

```
"Show me all 'lifecycle.wake' events from the last hour and tell me 
which storage keys were present on each wake"
```

### 2.3 Dashboard Queries

In **Cloudflare Dashboard → Workers → dicee-multiplayer → Logs**:

**Filter for state persistence issues:**
```
_event:storage.read.end AND found:false
```

**Filter for seat problems:**
```
_event:seat.reclaim.result AND result:spectator
```

**Filter for connection instability:**
```
_event:lifecycle.disconnect AND codeCategory:abnormal_no_close_frame
```

---

## Phase 3: Diagnostic Scenarios

Here's exactly what to look for when debugging each issue:

### Scenario A: Game Resets on Refresh

**What should happen:**
1. Player refreshes → WebSocket closes (1001 "going_away")
2. `seat.reserve` logged with deadline
3. Player reconnects → `lifecycle.wake` shows `hasGameState: true`
4. `seat.reclaim.attempt` with `withinDeadline: true`
5. `seat.reclaim.result` with `result: reclaimed`
6. Player sees game state, continues playing

**What's probably happening (bug):**
1. Player refreshes → WebSocket closes
2. ❌ `seat.reserve` never logged (handler not running)
3. Player reconnects → `lifecycle.wake` shows `hasGameState: false` ← **BUG: Game state lost**
4. OR: `seat.reclaim.attempt` with `hasSeat: false` ← **BUG: Seats not persisted**

**Query to diagnose:**
```bash
wrangler tail dicee-multiplayer --format json | jq '
  select(.logs[].message[] | 
    (contains("lifecycle.wake") or contains("seat.reclaim") or contains("storage.read.end"))
  )
'
```

**Look for:**
- `lifecycle.wake` with `hasGameState: false` when it should be true
- `storage.read.end` for key `game` with `found: false` after game started
- `seat.reclaim.attempt` with `hasSeat: false`

### Scenario B: Player Becomes Spectator

**What should happen:**
1. Player disconnects mid-game → `lifecycle.disconnect` with `wasPlayer: true`
2. `seat.reserve` with 5-minute deadline
3. `storage.write.end` for `seats` with `success: true`
4. Player reconnects within deadline
5. `seat.reclaim.attempt` with all flags true
6. `seat.reclaim.result` with `result: reclaimed`

**What's probably happening (bug):**
1. Player disconnects
2. ❌ No `seat.reserve` (disconnect handler not reached)
3. OR: `storage.write.end` for `seats` with `success: false`
4. Player reconnects
5. `seat.reclaim.result` with `result: spectator, reason: no_seat_found`

**Query to diagnose:**
```bash
wrangler tail dicee-multiplayer --format json | jq '
  select(.logs[].message[] | 
    (contains("seat.reserve") or contains("seat.reclaim"))
  )
' | jq -r '.logs[].message[]' | jq '.'
```

**Look for:**
- Missing `seat.reserve` after `lifecycle.disconnect`
- `seat.reclaim.result` with reason other than `reclaimed`
- Time gap between reserve and reclaim (is deadline passing?)

### Scenario C: Constant Reconnecting

**What should happen:**
1. Stable connection with occasional `lifecycle.disconnect` code 1000/1001
2. Reconnection succeeds
3. Minutes or hours between disconnects

**What's probably happening:**
1. Frequent `lifecycle.disconnect` with code 1006 (abnormal)
2. Rapid `lifecycle.wake` events (DO hibernating frequently)
3. OR: `lifecycle.disconnect` with code 1008 (auth failure)

**Query to diagnose:**
```bash
# Count close codes
wrangler tail dicee-multiplayer --format json | jq '
  select(.logs[].message[] | contains("lifecycle.disconnect"))
' | jq -r '.logs[].message[]' | jq -s 'group_by(.closeCode) | map({code: .[0].closeCode, count: length})'
```

**Look for:**
- High count of code 1006 → DO hibernation or network issues
- High count of code 1008 → Token expiration
- Rapid sequence of wake → disconnect → wake

---

## Phase 4: Client-Side Correlation

The server logs tell you what the DO is doing. The client inspector tells you what the browser sees.

### 4.1 Enable the Debug Panel

Make sure the debug panel from the earlier implementation is active. In dev mode, it should auto-enable.

### 4.2 Correlation Workflow

1. **Open browser DevTools console** + **Debug Panel**
2. **Open terminal with `wrangler tail`**
3. **Trigger the bug** (refresh during game)
4. **Correlate:**
   - Client debug panel: What close code? What was the last message received?
   - Server logs: What storage operations happened? What was the seat state?

### 4.3 Key Client-Side Indicators

| Debug Panel Shows | Meaning |
|-------------------|---------|
| Close code 1006 | Server closed without proper handshake (hibernation or crash) |
| Close code 1000 | Clean close (intentional) |
| No `CONNECTED` event after reconnect | Server didn't send initial state |
| `CONNECTED` with wrong game state | State loaded incorrectly |
| Multiple rapid reconnects | Network instability or token issue |

---

## Phase 5: Root Cause Patterns

Based on the logging, here are the most likely root causes:

### Pattern 1: Storage Not Awaited

**Symptom:** `storage.write.end` appears AFTER `broadcast.sent` in logs

**Fix:**
```typescript
// WRONG
this.ctx.storage.put('game', gameState);  // Fire and forget!
this.broadcast({ type: 'GAME_STARTED' });

// RIGHT
await this.ctx.storage.put('game', gameState);  // Wait for persistence
this.broadcast({ type: 'GAME_STARTED' });       // Then broadcast
```

### Pattern 2: Seats Not Serializing as Map

**Symptom:** `storage.read.end` for `seats` shows `found: true` but `seat.reclaim.attempt` shows `hasSeat: false`

**Fix:** Maps don't serialize properly to DO storage. Use a plain object:
```typescript
// WRONG
const seats = new Map<string, PlayerSeat>();
await this.ctx.storage.put('seats', seats);  // Map serializes incorrectly!

// RIGHT
const seats: Record<string, PlayerSeat> = {};
seats[userId] = { ... };
await this.ctx.storage.put('seats', seats);
```

### Pattern 3: Initialization Race Condition

**Symptom:** `lifecycle.wake` shows `hasGameState: false` immediately after game was started

**Fix:** Ensure room code is stored so DO can reinitialize:
```typescript
// In room creation
await this.ctx.storage.put('room_code', roomCode);  // MUST persist for hibernation recovery
```

### Pattern 4: WebSocket Close Handler Not Running

**Symptom:** No `seat.reserve` log after `lifecycle.disconnect` for a player

**Fix:** Ensure `webSocketClose` is properly async and awaited:
```typescript
async webSocketClose(ws: WebSocket, code: number, reason: string): Promise<void> {
  await this.ensureInitialized();  // MUST await - DO might have hibernated
  // ... rest of handler
}
```

### Pattern 5: Token Expiration Loop

**Symptom:** `lifecycle.disconnect` with code 1008, followed immediately by reconnect attempt

**Fix:** Implement token refresh on client before expiration:
```typescript
// Client-side
const tokenExpiresAt = decodeJWT(token).exp * 1000;
const refreshAt = tokenExpiresAt - 60000;  // Refresh 1 min before expiry

setTimeout(async () => {
  const newToken = await refreshToken();
  roomService.reconnect(newToken);
}, refreshAt - Date.now());
```

---

## Quick Reference: Debug Commands

```bash
# Full verbose logging
wrangler tail dicee-multiplayer --format pretty

# JSON for parsing
wrangler tail dicee-multiplayer --format json

# Filter by content
wrangler tail dicee-multiplayer --search "seat.reclaim"

# Parse specific events
wrangler tail dicee-multiplayer --format json | jq -r '
  .logs[].message[] | 
  select(type == "string") | 
  fromjson? | 
  select(._event | startswith("seat."))
'

# Count events by type
wrangler tail dicee-multiplayer --format json | jq -r '
  .logs[].message[] | 
  select(type == "string") | 
  fromjson? | 
  ._event
' | sort | uniq -c | sort -rn
```

---

This gives you complete visibility into the state lifecycle. Deploy the instrumentation, reproduce your issues, and the logs will tell you exactly where the chain breaks.