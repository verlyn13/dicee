# Game Room Technical Report

> **Document Type**: Architecture Reference
> **Last Updated**: 2025-12-15
> **Scope**: Game room lifecycle, state management, UI/UX, and persistence

---

## Table of Contents

1. [Overview](#overview)
2. [Room Display in Main Lobby](#room-display-in-main-lobby)
3. [RoomInfo Data Structure](#roominfo-data-structure)
4. [Waiting Room Design](#waiting-room-design)
5. [In-Game Room Experience](#in-game-room-experience)
6. [State Persistence Architecture](#state-persistence-architecture)
7. [WebSocket Protocol](#websocket-protocol)
8. [UX Considerations](#ux-considerations)

---

## Overview

Game rooms in Dicee are the fundamental multiplayer unit. A room progresses through distinct phases:

```
WAITING → STARTING → PLAYING → COMPLETED/ABANDONED
```

The system uses a **dual Durable Object architecture**:

| Component | Type | Purpose |
|-----------|------|---------|
| `GlobalLobby` | Singleton | Room directory, global chat, presence, room browser |
| `GameRoom` | Per-room | Game state, multiplayer sync, room chat |

---

## Room Display in Main Lobby

### Visual Presentation (RoomCard.svelte)

Room cards in the lobby follow Neo-Brutalist design principles:

```
┌─────────────────────────────────────────────────────────────┐
│  [STATUS]    HOST NAME                          [JOIN BTN] │
│  ─────────────────────────────────────────────────────────  │
│  🎮 dicee    ●● 2/4 players    ⭕ 3 watching                │
│  ─────────────────────────────────────────────────────────  │
│  Round 5/13                                                 │
│  [Avatar1] [Avatar2] [Empty] [Empty]                        │
└─────────────────────────────────────────────────────────────┘
    └── 4px 4px hard shadow (Neo-Brutalist)
```

### Card States

| State | Badge Color | Badge Text | Border |
|-------|-------------|------------|--------|
| `waiting` | `--color-signal-live` (#059669) | OPEN | Normal |
| `playing` | `--color-accent` (#ffd700) | LIVE | Normal |
| `finished` | `--color-disabled` (#9ca3af) | DONE | Faded |

### Room Card Styling (from RoomCard.svelte:120-258)

```css
.room-card {
  background: var(--color-surface);       /* #ffffff */
  border: var(--border-thick);            /* 3px solid #000 */
  box-shadow: var(--lobby-card-shadow);   /* 4px 4px 0 0 #000 */
  transition: transform 150ms, box-shadow 150ms;
}

.room-card:hover {
  transform: translate(-2px, -2px);
  box-shadow: var(--lobby-card-shadow-hover);  /* 6px 6px 0 0 #000 */
}

.room-card.error-flash {
  border-color: var(--color-signal-busy);  /* #dc2626 */
  animation: shake 0.3s ease-in-out;
}
```

### Status Badge Styling

```css
.status-badge {
  font-size: var(--text-tiny);        /* 12px */
  font-weight: var(--weight-bold);    /* 700 */
  text-transform: uppercase;
  letter-spacing: var(--tracking-wide);
  padding: var(--space-0) var(--space-1);
  border: var(--border-thin);
}

.status-badge.open  { background: var(--color-signal-live); }
.status-badge.live  { background: var(--color-accent); }
.status-badge.done  { background: var(--color-disabled); }
```

### Join Button States

```css
.join-button {
  background: var(--color-text);      /* Black bg */
  color: var(--color-surface);        /* White text */
  border: var(--border-medium);
}

.join-button:hover {
  background: var(--color-accent);    /* Gold on hover */
  color: var(--color-text);
}

.join-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
```

---

## RoomInfo Data Structure

### Core Type Definition (room-directory.ts:31-53)

```typescript
interface RoomInfo {
  // Identification
  code: string;                 // 6-char uppercase (e.g., "FFDVNG")
  game: string;                 // "dicee"

  // Host Information
  hostId: string;               // Supabase user ID
  hostName: string;             // Display name

  // Capacity
  playerCount: number;          // Current players (including AI)
  spectatorCount: number;       // Viewers watching
  maxPlayers: number;           // 2-4

  // Visibility
  isPublic: boolean;            // Listed in lobby?
  allowSpectators: boolean;     // Can others watch?

  // Game Progress
  status: 'waiting' | 'playing' | 'finished';
  roundNumber: number;          // 0 if not started, 1-13 during game
  totalRounds: number;          // Always 13 for Dicee

  // Player List (for avatars)
  players: Array<{
    userId: string;
    displayName: string;
    avatarSeed: string;
    score: number;
    isHost: boolean;
  }>;

  // Timestamps
  createdAt: number;            // Unix ms
  updatedAt: number;            // Unix ms
}
```

### Fields Used for Display

| Display Element | Source Field | Component |
|-----------------|--------------|-----------|
| Status badge | `status` | RoomCard.svelte:88-97 |
| Host name | `hostName` | RoomCard.svelte:62 |
| Player count | `playerCount/maxPlayers` | RoomCard.svelte:71 |
| Spectator count | `spectatorCount` | RoomCard.svelte:73 |
| Round info | `roundNumber/totalRounds` | RoomCard.svelte:76-78 |
| Player avatars | `players[].avatarSeed` | RoomCard.svelte:104-112 |
| Join disabled | `playerCount >= maxPlayers` | RoomCard.svelte:115 |

---

## Waiting Room Design

### Component: RoomLobby.svelte

The waiting room is displayed when `room.state === 'waiting'`.

### Layout Structure

```
┌───────────────────────────────────────────────────────────────┐
│  [← LEAVE]       WAITING ROOM                       [💬 Chat] │
├───────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────── Welcome Banner (Host Only) ─────────────┐ │
│  │  Welcome to Dicee!                                       │ │
│  │  Room FFDVNG is ready. Invite friends or add AI.         │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                               │
│  ┌─────────────┐  ┌─────────────┐                            │
│  │  👥 Invite  │  │  🤖 Add AI  │   ← Action Buttons (Host)  │
│  └─────────────┘  └─────────────┘                            │
│                                                               │
│  ┌────── Join Requests (Host Only, if pending) ─────────────┐│
│  │ ⚠️ player123 wants to join     [✓ Accept] [✕ Decline]    ││
│  └──────────────────────────────────────────────────────────┘│
│                                                               │
│  Players (2/4)                                                │
│  ┌──────────────────────────────────────────────────────────┐│
│  │ [Avatar] Player1Name              [HOST] [CONNECTED]     ││
│  │ [Avatar] Player2Name                     [CONNECTED]     ││
│  │ [🤖] AIPlayer1                           [AI]            ││
│  │ [👤] Waiting for player...        ← Dashed border        ││
│  └──────────────────────────────────────────────────────────┘│
│                                                               │
│  ▶ Share externally  (collapsed by default)                  │
│                                                               │
├───────────────────────────────────────────────────────────────┤
│                  [    START GAME    ]  ← Green success color │
│                    Keys: C chat  ESC close                   │
└───────────────────────────────────────────────────────────────┘
```

### Waiting Room Styling (from RoomLobby.svelte:383-957)

#### Header
```css
.lobby-header {
  display: flex;
  justify-content: space-between;
  padding: var(--space-3);
  background: var(--color-surface);    /* White */
  border: var(--border-thick);         /* 3px solid black */
}

.lobby-title {
  font-size: var(--text-h3);
  font-weight: var(--weight-bold);
  text-transform: uppercase;
  letter-spacing: var(--tracking-wide);
}

.leave-button {
  color: var(--color-danger);          /* Red text */
  border: var(--border-medium);
}
```

#### Welcome Banner (Host Alone)
```css
.welcome-banner {
  background: var(--color-primary);    /* #0a0a0a or white */
  border: var(--border-thick);
  text-align: center;
  padding: var(--space-3);
}

.welcome-title {
  font-size: var(--text-h2);
  font-weight: var(--weight-black);
  text-transform: uppercase;
}
```

#### Action Buttons
```css
.action-buttons {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-2);
}

.action-btn.invite-btn {
  background: var(--color-primary);    /* Primary action */
}

.action-btn.ai-btn {
  background: var(--color-success);    /* #10b981 green */
}

.action-btn:hover {
  transform: translate(-2px, -2px);
  box-shadow: 4px 4px 0 var(--color-border);
}
```

#### Player List Items
```css
.player-item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2);
  background: var(--color-surface);
  border: var(--border-medium);
}

.empty-slot {
  border: var(--border-thin);
  border-style: dashed;              /* Dashed = waiting */
  opacity: 0.6;
}

.player-badge.ai-badge {
  background: var(--color-primary);
  font-size: var(--text-tiny);
}
```

#### Start Button
```css
.start-button {
  width: 100%;
  min-height: var(--touch-target-comfortable);  /* 56px */
  background: var(--color-success);             /* Green */
  border: var(--border-thick);
  font-size: var(--text-h3);
  font-weight: var(--weight-bold);
  text-transform: uppercase;
}

.start-button:hover {
  transform: translate(-2px, -2px);
  box-shadow: 4px 4px 0 var(--color-border);
}
```

#### Countdown Overlay
```css
.countdown {
  background: var(--color-accent);     /* Gold */
  border: var(--border-thick);
  width: 100%;
}

.countdown-number {
  font-family: var(--font-mono);
  font-size: var(--text-h1);           /* 38px */
  animation: pulse 1s ease-in-out infinite;
}
```

---

## In-Game Room Experience

### Game State Flow

```
WAITING
    ↓ host clicks START
STARTING (3s countdown)
    ↓ countdown ends
PLAYING
    ↓ 13 rounds complete
COMPLETED
    ↓ host clicks REMATCH
WAITING (loop)
```

### In-Game Data Synchronization

The game room maintains synchronization through these events:

| Event | Direction | Purpose |
|-------|-----------|---------|
| `CONNECTED` | Server → Client | Initial full state sync |
| `GAME_STARTING` | Server → All | Countdown initiated |
| `GAME_STARTED` | Server → All | Game begins, turn order set |
| `TURN_STARTED` | Server → All | New turn begins |
| `DICE_ROLLED` | Server → All | Dice values after roll |
| `DICE_KEPT` | Server → All | Updated kept mask |
| `CATEGORY_SCORED` | Server → All | Score recorded, turn ends |
| `TURN_CHANGED` | Server → All | Next player's turn |
| `GAME_OVER` | Server → All | Final rankings, scores |

### Player States During Game

```typescript
interface PlayerGameState {
  scorecard: Record<Category, number | null>;
  dice: [number, number, number, number, number];
  kept: [boolean, boolean, boolean, boolean, boolean];
  rollsRemaining: 0 | 1 | 2 | 3;
  isActive: boolean;
}
```

---

## State Persistence Architecture

### Storage Layers

```
┌─────────────────────────────────────────────────────────────┐
│                    CLIENT (Browser)                         │
├─────────────────────────────────────────────────────────────┤
│  Svelte 5 Stores ($state runes)                             │
│  ├── lobby.svelte.ts   → rooms, onlineCount, connectionState│
│  ├── room.svelte.ts    → current room, game state           │
│  └── chat.svelte.ts    → messages, typing, reactions        │
├─────────────────────────────────────────────────────────────┤
│               WebSocket (ReconnectingWebSocket)             │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              CLOUDFLARE DURABLE OBJECTS                     │
├─────────────────────────────────────────────────────────────┤
│  GlobalLobby (Singleton)                                    │
│  ├── ctx.storage (SQLite)                                   │
│  │   ├── lobby:activeRooms → Map<code, RoomInfo>            │
│  │   └── lobby:chatHistory → ChatMessage[]                  │
│  ├── WebSocket attachments (UserPresence)                   │
│  └── In-memory (rate limits - ephemeral)                    │
├─────────────────────────────────────────────────────────────┤
│  GameRoom (Per-room)                                        │
│  ├── ctx.storage (SQLite)                                   │
│  │   ├── room → RoomState                                   │
│  │   ├── seats → Map<userId, PlayerSeat>                    │
│  │   ├── game → MultiplayerGameState                        │
│  │   ├── chat → ChatMessage[]                               │
│  │   └── room_code → string (hibernation recovery)          │
│  ├── WebSocket attachments (ConnectionState)                │
│  ├── Alarm data (turn timeouts, seat expiration)            │
│  └── In-memory (predictions, kibitz - ephemeral)            │
└─────────────────────────────────────────────────────────────┘
```

### Hibernation-Safe Patterns

Cloudflare Durable Objects hibernate when idle. The codebase uses these patterns to survive:

#### 1. Storage-First Pattern
```typescript
// CORRECT: Persist before broadcast
await roomDirectory.upsert(roomInfo);    // Storage first
this.broadcast({ type: 'ROOM_UPDATE' }); // Then broadcast

// WRONG: Would lose data on hibernation
this.inMemoryRooms.set(code, room);      // Lost on hibernate
this.broadcast({ type: 'ROOM_UPDATE' });
```

#### 2. WebSocket Tags for Query
```typescript
// Tags survive hibernation
ctx.acceptWebSocket(ws, [`user:${userId}`, `room:${code}`]);

// Query by tag (works after wake)
const roomPlayers = ctx.getWebSockets(`player:${roomCode}`);
```

#### 3. WebSocket Attachments
```typescript
// Attachment survives hibernation
ws.serializeAttachment({
  userId: 'abc123',
  displayName: 'Player1',
  role: 'player',
});

// Recover after wake
const state = ws.deserializeAttachment() as ConnectionState;
```

#### 4. Lazy Loading from Storage
```typescript
private chatHistoryLoaded = false;

async loadChatHistory(): Promise<ChatMessage[]> {
  if (!this.chatHistoryLoaded) {
    const stored = await ctx.storage.get<ChatMessage[]>('chat');
    this.chatHistory = stored ?? [];
    this.chatHistoryLoaded = true;
  }
  return this.chatHistory;
}
```

### Room Directory Persistence (room-directory.ts)

The room directory uses a storage-first abstraction:

```typescript
interface RoomDirectory {
  getAll(): Promise<RoomInfo[]>;        // Lazy load from storage
  getPublic(): Promise<RoomInfo[]>;     // Filtered view
  get(code: string): Promise<RoomInfo | null>;
  upsert(room: RoomInfo): Promise<Result>;  // Persist immediately
  remove(code: string): Promise<void>;      // Persist immediately
  invalidateCache(): void;              // Force reload
}
```

### Seat Reservation System (Reconnection)

Players have a 5-minute window to reconnect:

```typescript
interface PlayerSeat {
  userId: string;
  displayName: string;
  isConnected: boolean;
  disconnectedAt: number | null;      // Set on disconnect
  reconnectDeadline: number | null;   // 5 min from disconnect
  turnOrder: number;                  // Preserved position
}
```

**Flow:**
1. Player disconnects → `disconnectedAt` + `reconnectDeadline` set
2. Alarm scheduled for deadline
3. Player reconnects before deadline → seat reclaimed
4. Deadline passes → seat released, player becomes spectator

---

## WebSocket Protocol

### Connection Flow

```
Client                              Server (GameRoom DO)
   │                                        │
   │──────── WS Upgrade + JWT ─────────────→│
   │                                        │ verifySupabaseJWT()
   │←─────── 101 Switching ────────────────│
   │                                        │
   │←─────── CONNECTED (full state) ───────│
   │                                        │
   │←─────── CHAT_HISTORY ─────────────────│
   │                                        │
   │←─────── room updates... ──────────────│
```

### Message Format (UPPERCASE Protocol)

```typescript
// Client → Server (Commands)
{ type: 'START_GAME' }
{ type: 'DICE_ROLL', payload: { kept: [false, true, false, true, false] } }
{ type: 'CATEGORY_SCORE', payload: { category: 'threeOfAKind' } }
{ type: 'CHAT', payload: { content: 'Nice roll!' } }

// Server → Client (Events)
{ type: 'CONNECTED', payload: { roomCode, players, aiPlayers, ... } }
{ type: 'DICE_ROLLED', payload: { dice: [3, 3, 5, 2, 6], playerId } }
{ type: 'TURN_CHANGED', payload: { currentPlayerId, phase } }
{ type: 'CHAT_MESSAGE', payload: { id, userId, displayName, content, ... } }
```

### Event Types

| Category | Events |
|----------|--------|
| Room | `CONNECTED`, `PLAYER_JOINED`, `PLAYER_LEFT`, `AI_PLAYER_JOINED` |
| Game | `GAME_STARTING`, `GAME_STARTED`, `TURN_CHANGED`, `GAME_OVER` |
| Dice | `DICE_ROLLED`, `DICE_KEPT` |
| Score | `CATEGORY_SCORED`, `TURN_SKIPPED` |
| Chat | `CHAT_MESSAGE`, `CHAT_HISTORY`, `REACTION_UPDATE`, `TYPING_UPDATE` |
| Invite | `INVITE_SENT`, `INVITE_ACCEPTED`, `INVITE_DECLINED`, `INVITE_RECEIVED` |
| Join | `JOIN_REQUEST_RECEIVED`, `JOIN_APPROVED`, `JOIN_DECLINED` |

---

## UX Considerations

### Connection State Indicators

| State | Visual | Location |
|-------|--------|----------|
| Connecting | Pulsing dot | Lobby header |
| Connected | Green dot + "X online" | Lobby header |
| Reconnecting | Yellow flash | Toast/banner |
| Error | Red flash + message | Error banner |

### Room Join Patterns

#### 1. Direct Join (Public Room)
```
Lobby → Click JOIN → WebSocket connect → CONNECTED event → RoomLobby
```

#### 2. Request to Join (Private Room)
```
Lobby → REQUEST_JOIN → Host sees notification → APPROVE/DECLINE → WebSocket connect
```

#### 3. Invite Flow
```
Host sends invite → GlobalLobby delivers → Target sees toast → Accept → WebSocket connect
```

### Mobile Responsiveness

| Breakpoint | Layout Change |
|------------|---------------|
| < 640px | Mode cards stack vertically |
| < 768px | Keyboard hints hidden |
| < 768px | Tab toggle for games/chat in lobby |
| < 480px | Simplified room cards |

### Keyboard Shortcuts (Desktop)

| Key | Action | Context |
|-----|--------|---------|
| `C` | Toggle chat panel | Waiting room |
| `ESC` | Close chat panel | When chat open |
| `Enter` | Send message | Chat input focused |

### Accessibility

- All buttons meet `--touch-target-minimum` (44px)
- Interactive elements have visible focus states
- Error messages use `role="alert"` for screen readers
- Color is never the only indicator (icons + text)

### Error Handling

| Error | User Feedback | Recovery |
|-------|---------------|----------|
| Room full | "Room is full" toast | Redirect to lobby |
| Network drop | Auto-reconnect (10 retries) | Exponential backoff |
| Token expired | "Session expired" | Redirect to login |
| Rate limited | "Slow down" message | Auto-clears after window |

### Optimistic Updates vs Server Authority

| Action | Pattern | Reason |
|--------|---------|--------|
| Typing indicator | Optimistic | Immediate feedback, ephemeral |
| Chat message | Server-authoritative | Prevents duplicates |
| Dice roll | Server-authoritative | Must be cryptographically fair |
| Keep dice | Server-authoritative | Game integrity |
| Score category | Server-authoritative | Game integrity |

---

## Appendix: Key Files

| File | Purpose |
|------|---------|
| `packages/cloudflare-do/src/GameRoom.ts` | Server-side room logic |
| `packages/cloudflare-do/src/GlobalLobby.ts` | Room directory, presence |
| `packages/cloudflare-do/src/lib/room-directory.ts` | Storage-first room management |
| `packages/cloudflare-do/src/types.ts` | All type definitions |
| `packages/web/src/lib/stores/room.svelte.ts` | Client room state |
| `packages/web/src/lib/stores/lobby.svelte.ts` | Client lobby state |
| `packages/web/src/lib/services/roomService.svelte.ts` | WebSocket management |
| `packages/web/src/lib/components/lobby/RoomCard.svelte` | Room card UI |
| `packages/web/src/lib/components/lobby/RoomLobby.svelte` | Waiting room UI |
| `packages/web/src/lib/components/lobby/LobbyLanding.svelte` | Main lobby UI |
| `packages/web/src/lib/styles/tokens.css` | Design system tokens |
