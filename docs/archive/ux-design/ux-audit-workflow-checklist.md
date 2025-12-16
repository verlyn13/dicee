# Dicee Quick Play: Audit Checklist

## Current State Assessment

Based on the debugging session, here's where we stand:

### ✅ Fixed
- AI brain rolls before scoring (null dice check added)
- QUICK_PLAY_STARTED event sends full player state
- START YOUR TURN button is visible and clickable

### 🔴 Broken
- Stuck at "ROLLING..." after clicking START YOUR TURN
- Waiting room still flashes briefly

### 🟡 Unknown
- Does server receive DICE_ROLL command?
- Does validation pass or fail?
- Is error sent back to client?

---

## Immediate Debugging Protocol

### Step 1: Verify the Event Chain

Run Quick Play and capture:

```
Expected chain:
[Client] Click START YOUR TURN
[Client] Send DICE_ROLL command
[Server] handleDiceRoll called for player: xxx
[Server] validation result: pass/fail
[Server] Broadcast DICE_ROLLED (if pass)
[Client] Receive DICE_ROLLED
[Client] Update UI with dice values

Current chain (from logs):
[Server] QUICK_PLAY_STARTED → 1/1 sockets
[Server] ... (nothing after game start)
```

**Gap identified**: No `handleDiceRoll` log appears after game starts.

### Step 2: Check Client-Side Command Sending

In browser console, look for:
```
[RoomService] Sending DICE_ROLL
```

If not present → client isn't sending the command
If present → server isn't receiving or logging

### Step 3: Check WebSocket Connection

After QUICK_PLAY_STARTED, is the WebSocket still connected?
```
// In browser console:
roomService.isConnected()  // or check connection state
```

---

## Root Cause Hypotheses

### Hypothesis A: Client Not Sending DICE_ROLL

**Evidence needed**: No `[RoomService] Sending DICE_ROLL` in browser console

**Likely cause**: `canRoll` is still false because game state wasn't properly initialized from QUICK_PLAY_STARTED

**Check**:
```typescript
// In browser console after game starts:
$gameState  // or however the store is exposed
// Look for: phase, currentPlayerId, players[myId].rollsRemaining
```

### Hypothesis B: Server Not Receiving Command

**Evidence needed**: Browser shows send, server shows no receive

**Likely cause**: WebSocket disconnected, or command type not recognized

**Check**: Add logging to message router:
```typescript
// In GameRoom.handleMessage
console.log(`[GameRoom] Received command: ${data.type}`);
```

### Hypothesis C: Server Validation Failing Silently

**Evidence needed**: Server receives but doesn't respond

**Likely cause**: Validation fails, no error sent back

**Check**: The diagnostic logging we added should show this. If you see:
```
handleDiceRoll validation FAILED: [reason]
```
Then we know the issue.

### Hypothesis D: Broadcast Not Reaching Client

**Evidence needed**: Server logs `Broadcast DICE_ROLLED → 1/1 sockets` but client doesn't receive

**Likely cause**: Event normalization dropping the event

**Check**: Browser console should show raw WebSocket message

---

## Quick Play Contract Verification

### QUICK_PLAY_STARTED Must Provide:

| Field | Expected Value | Verified? |
|-------|----------------|-----------|
| `phase` | `'playing'` | ⬜ |
| `currentPlayerId` | Human's ID | ⬜ |
| `players[humanId].rollsRemaining` | `3` | ⬜ |
| `players[humanId].currentDice` | `null` | ⬜ |
| `turnOrder[0]` | Human's ID | ⬜ |
| `roundNumber` | `1` | ⬜ |

### Client State After QUICK_PLAY_STARTED:

| State Variable | Expected Value | Verified? |
|----------------|----------------|-----------|
| `gameState.phase` | `'playing'` | ⬜ |
| `isMyTurn` | `true` | ⬜ |
| `canRoll` | `true` | ⬜ |
| `uiPhase` | `'IDLE'` or `'ROLLING'` | ⬜ |

---

## Logging Points to Add

### Server: GameRoom.ts

```typescript
// In handleDiceRoll (should already be added)
console.log(`[GameRoom] handleDiceRoll called for player: ${playerId}`);
console.log(`[GameRoom] Game state:`, {
  phase: this.gameState?.phase,
  currentPlayerId: this.gameState?.currentPlayerId,
  playerRollsRemaining: this.gameState?.players[playerId]?.rollsRemaining
});
```

### Server: Message Router

```typescript
// At the START of handleMessage, before the switch
console.log(`[GameRoom] handleMessage: ${data.type} from ${state.playerId}`);
```

### Client: roomService

```typescript
// In sendCommand or wherever DICE_ROLL is sent
console.log(`[RoomService] Sending command:`, command);
```

### Client: Game Store

```typescript
// In handleGameStarted (or equivalent for QUICK_PLAY_STARTED)
console.log(`[GameStore] After game start:`, {
  phase: gameState.phase,
  isMyTurn,
  canRoll,
  myRollsRemaining: gameState.players[myPlayerId]?.rollsRemaining
});
```

---

## Fix Verification Protocol

Once a fix is deployed, verify:

1. **No waiting room flash**
   - [ ] Click Quick Play
   - [ ] See loading spinner (not waiting room)
   - [ ] See game board appear

2. **Human goes first**
   - [ ] Check turn indicator shows your turn
   - [ ] Check START YOUR TURN button is enabled

3. **Dice roll works**
   - [ ] Click START YOUR TURN
   - [ ] See dice animate
   - [ ] See dice results appear
   - [ ] See KEEP buttons and ROLL AGAIN option

4. **Turn cycle works**
   - [ ] Score a category
   - [ ] See AI take their turn
   - [ ] See AI's dice roll and score
   - [ ] See turn return to you

5. **Full game works**
   - [ ] Play through all 13 rounds
   - [ ] See final scores
   - [ ] Game ends properly

---

## Architecture Debt Identified

### Issue: Two Event Systems

```
Server events: UPPERCASE (DICE_ROLLED, CATEGORY_SCORED)
Client expects: lowercase with dots (dice.rolled, category.scored)
Normalizer bridges them but can drop events silently
```

**Recommendation**: Single event naming convention across client and server.

### Issue: Implicit Defaults

```typescript
// Found in controller.ts
dice: player.currentDice ?? [1,1,1,1,1]  // Breaks AI brain
```

**Recommendation**: No defaults for game-critical state. Explicit null checks with explicit behaviors.

### Issue: Silent Validation Failures

```typescript
// Current pattern:
if (!canRollDice(...)) {
  return;  // Silent failure
}

// Should be:
if (!canRollDice(...)) {
  this.sendError(ws, 'DICE_ROLL_FAILED', reason);
  return;
}
```

**Recommendation**: Every command gets a response: success OR error. Never silence.

### Issue: Phase Confusion

```
Room phase: 'waiting' | 'playing' | 'ended'
Game phase: 'turn_roll' | 'turn_score' | ...
UI phase: 'IDLE' | 'ROLLING' | 'KEEPING' | ...
```

**Recommendation**: Document which phase means what, and how they relate. State machine diagram.

---

## Next Steps

1. **Add the logging points** listed above
2. **Deploy and test** Quick Play
3. **Capture the full log trail** from click to stuck
4. **Identify the gap** in the chain
5. **Fix the specific issue**
6. **Verify with the protocol** above
7. **Document the fix** for future reference

The goal is to move from "it's stuck, no idea why" to "the chain breaks at step X because Y."