# Dicee Game Modes — Architectural Specification

## Core Principle

**The waiting room exists for human coordination, not AI.**

AI players don't need to "wait" for anything. They're instantiated on demand. The waiting room is a human social feature—a place where friends gather before playing.

---

## Game Mode Definitions

### 1. Quick Play (Solo vs AI)

**Purpose**: Fastest path to gameplay. Zero friction.

**Flow**:
```
Lobby → Select AI opponent(s) → Game starts immediately
```

**Behavior**:
- No waiting room displayed
- Room created with human as Player 1
- AI players instantiated directly into game
- **Human always takes first turn**
- Game begins in `playing` phase, not `waiting` phase

**Implementation**:
```typescript
// Server-side: Quick Play room creation
createQuickPlayRoom(humanPlayer, aiProfiles[]) {
  const room = new GameRoom({
    mode: 'quick_play',
    phase: 'playing',  // Skip 'waiting' entirely
    players: [
      humanPlayer,     // Seat 0 - goes first
      ...aiProfiles.map(p => createAIPlayer(p))  // Seats 1-3
    ],
    turnOrder: [humanPlayer.id, ...aiPlayerIds],
    currentPlayerId: humanPlayer.id,  // Human starts
  });
  
  // No startGame() needed - already playing
  return room;
}
```

**Client routing**:
```typescript
// Quick Play button click
async function quickPlay(aiProfile: string) {
  const roomCode = await api.createQuickPlayRoom([aiProfile]);
  goto(`/games/dicee/room/${roomCode}`);  // Direct to game view
}
```

---

### 2. Custom Game (Host Creates, Configures, Starts)

**Purpose**: Full control over game setup.

**Flow**:
```
Lobby → Create Room → Waiting Room → [Add AI / Invite Humans] → Start Game
```

**Sub-modes**:

#### 2a. Solo with AI (Custom)
```
Create Room → Add AI players in waiting room → Press Start → Game begins
```
- Host sees waiting room with their avatar + AI avatars
- Host can adjust AI players before starting
- Once started, identical to Quick Play gameplay

#### 2b. Multiplayer with Humans
```
Create Room → Share invite link → Humans join → Press Start → Game begins
```
- Waiting room is essential here
- Shows who has joined, who is ready
- Host controls when to start
- Can mix human and AI players

#### 2c. Multiplayer with AI Fill
```
Create Room → 2 humans join → Add 2 AI to fill → Press Start → Game begins
```
- Common pattern: "Let's play but we only have 2 people"
- AI fills remaining seats

**Waiting Room Purpose**:
| Feature | Humans | AI |
|---------|--------|-----|
| Needs to "join" | ✅ Yes | ❌ No (instantiated) |
| Shows in waiting room | ✅ Yes | ✅ Yes (visual only) |
| Can leave/rejoin | ✅ Yes | ❌ No |
| Ready status | ✅ Yes | Always ready |
| Chat in waiting room | ✅ Yes | ❌ Silent |

---

### 3. Spectator Mode (In-Game)

**This is NOT about spectators joining from lobby.** This is about what you see when it's not your turn.

**Core Concept**: When it's not your turn, you are a spectator of the current player's turn—whether that player is human or AI.

**What you see during another player's turn**:
```
┌─────────────────────────────────────────────────────────────────┐
│  Carmen's Turn                                    Round 3/13    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  🤖 Carmen is thinking...                               │   │
│  │                                                         │   │
│  │     ⚀  ⚂  ⚄  ⚁  ⚅                                      │   │
│  │                                                         │   │
│  │  Roll 2 of 3                                            │   │
│  │                                                         │   │
│  │  [Keeping: 5, 6]  [Re-rolling: 1, 3, 2]                │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Scorecards:  You (142)  •  Carmen (138)  •  Mike (156)        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**AI Turn Visibility**:
- See AI's dice after each roll
- See which dice AI keeps
- See AI "thinking" indicator with personality flavor
- See AI's scoring decision
- Full animation of dice rolls (same as human)

**Human Opponent Turn Visibility** (multiplayer):
- Same as AI—see their rolls, keeps, scoring
- No "thinking" indicator (they're just taking their time)

**Implementation**:
```typescript
// Same rendering logic regardless of player type
{#if currentPlayer.id !== myId}
  <SpectatorTurnView 
    player={currentPlayer}
    dice={gameState.dice}
    keptDice={gameState.keptDice}
    rollsRemaining={gameState.rollsRemaining}
    isAI={currentPlayer.type === 'ai'}
  />
{:else}
  <MyTurnView ... />
{/if}
```

---

## State Machine

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              GAME PHASES                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  QUICK PLAY PATH (no waiting phase):                                        │
│                                                                             │
│    [Create] ──────────────────────────▶ [playing] ──▶ [game_over]          │
│                                             │                               │
│                                        Turn Loop                            │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  CUSTOM GAME PATH (with waiting phase):                                     │
│                                                                             │
│    [Create] ──▶ [waiting] ──▶ [starting] ──▶ [playing] ──▶ [game_over]    │
│                     │              │                                        │
│                  Players        Countdown                                   │
│                  join here      (3, 2, 1...)                                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Phase Definitions**:

| Phase | Quick Play | Custom Game |
|-------|------------|-------------|
| `waiting` | SKIPPED | Host + players gather |
| `starting` | SKIPPED | Brief countdown |
| `playing` | START HERE | Normal gameplay |
| `game_over` | Results | Results |

---

## Turn Order

**Rule**: In Quick Play, human always goes first.

```typescript
// Quick Play turn order
function buildQuickPlayTurnOrder(humanId: string, aiIds: string[]): string[] {
  return [humanId, ...aiIds];  // Human first, AI follows
}

// Custom game turn order (randomized or host-configured)
function buildCustomGameTurnOrder(playerIds: string[]): string[] {
  return shuffle(playerIds);  // Or host-defined order
}
```

**Rationale**: In Quick Play, you want to play immediately. Watching AI go first feels like waiting. Human first → immediate engagement.

---

## Event Flow Comparison

### Quick Play
```
Client                          Server
   │                               │
   │  createQuickPlay(carmen)  ──▶│  Create room in 'playing' phase
   │                               │  Human = seat 0, turn 0
   │                               │  AI = seat 1
   │◀── GAME_STATE ───────────────│  Full game state, your turn
   │                               │
   │  (Human plays turn)           │
   │  ROLL ───────────────────────▶│
   │◀── DICE_ROLLED ──────────────│
   │  SCORE ──────────────────────▶│
   │◀── CATEGORY_SCORED ──────────│
   │◀── TURN_CHANGED ─────────────│  Now AI's turn
   │                               │
   │◀── AI_THINKING ──────────────│  Carmen thinking...
   │◀── DICE_ROLLED ──────────────│  See her roll
   │◀── AI_KEEPING ───────────────│  See her keep
   │◀── DICE_ROLLED ──────────────│  See her re-roll
   │◀── CATEGORY_SCORED ──────────│  See her score
   │◀── TURN_CHANGED ─────────────│  Your turn again
```

### Custom Game (with waiting room)
```
Client                          Server
   │                               │
   │  createRoom() ───────────────▶│  Create room in 'waiting' phase
   │◀── CONNECTED ────────────────│  You're host
   │                               │
   │  (Waiting room UI shown)      │
   │                               │
   │  addAI(carmen) ──────────────▶│  
   │◀── AI_PLAYER_JOINED ─────────│  Carmen appears in waiting room
   │                               │
   │  startGame() ────────────────▶│  Host starts
   │◀── GAME_STARTING ────────────│  Countdown begins
   │◀── GAME_STARTED ─────────────│  Phase → 'playing'
   │                               │
   │  (Same turn flow as above)    │
```

---

## Client Routing

```typescript
// routes/games/dicee/+layout.ts

// Quick Play: Direct to game, no waiting room
'/games/dicee/quick-play'
  → createQuickPlayRoom() 
  → redirect to '/games/dicee/room/[code]'
  → GameView component (not WaitingRoom)

// Custom Game: Show waiting room first
'/games/dicee/room/[code]'
  → if phase === 'waiting' → WaitingRoomView
  → if phase === 'playing' → GameView
  → if phase === 'game_over' → ResultsView
```

**Component Selection**:
```svelte
<!-- /games/dicee/room/[code]/+page.svelte -->

{#if gameState.phase === 'waiting'}
  <WaitingRoomView {roomState} />
{:else if gameState.phase === 'starting'}
  <CountdownOverlay countdown={gameState.countdown} />
  <WaitingRoomView {roomState} />
{:else if gameState.phase === 'playing'}
  <GameView {gameState} />
{:else if gameState.phase === 'game_over'}
  <ResultsView {gameState} />
{/if}
```

---

## API Endpoints

```typescript
// Quick Play - single endpoint, returns room in playing state
POST /api/rooms/quick-play
Body: { aiProfiles: ['carmen'] }
Response: { roomCode: 'ABC123', phase: 'playing', yourTurn: true }

// Custom Game - two-step process
POST /api/rooms/create
Body: { settings: {...} }
Response: { roomCode: 'XYZ789', phase: 'waiting' }

POST /api/rooms/XYZ789/start
Response: { phase: 'playing' }
```

---

## Summary for Implementation

1. **Quick Play = No Waiting Room**
   - Create room directly in `playing` phase
   - Human is always first in turn order
   - Redirect straight to game view

2. **Custom Game = Waiting Room for Humans**
   - Create room in `waiting` phase
   - AI can be added but doesn't "wait"
   - Host presses Start to transition to `playing`

3. **Spectating Your Opponents = Same for AI and Human**
   - When it's not your turn, you watch
   - See dice, keeps, scoring decisions
   - AI gets "thinking" indicator, humans don't
   - Same component, just `isAI` flag for styling

4. **The Waiting Room is a Social Feature**
   - Not a technical requirement
   - Exists for human players to coordinate
   - AI doesn't benefit from it, just appears there for visual consistency

---

## Current Bug Analysis

The current implementation has Quick Play going through waiting room flow:
```
Quick Play → Create Room (waiting) → AI joins → Auto-start (200ms) → Playing
```

Should be:
```
Quick Play → Create Room (playing, human first) → Playing
```

**Fix**: Add a dedicated Quick Play room creation that skips the waiting phase entirely and ensures human is Player 1.