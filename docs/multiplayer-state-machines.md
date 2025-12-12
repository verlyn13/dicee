# Multiplayer Connection State Machines

**Companion to:** multiplayer-resilience-spec.md  
**Purpose:** Visual state machines and sequence diagrams for implementation

---

## 1. Player Connection State Machine

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       PLAYER CONNECTION STATE MACHINE                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│                              ┌──────────────┐                               │
│                              │              │                               │
│                    ┌────────▶│   NO_SEAT    │◀────────┐                    │
│                    │         │              │         │                    │
│                    │         └──────┬───────┘         │                    │
│                    │                │                 │                    │
│                    │         reserve_seat()           │                    │
│                    │         [room has space]         │                    │
│                    │                │                 │                    │
│             expire │                ▼                 │ kick/leave         │
│             [5min] │         ┌──────────────┐        │                    │
│                    │         │              │        │                    │
│                    │         │   SEATED     │────────┘                    │
│                    │         │  CONNECTED   │                              │
│                    │         │              │                              │
│                    │         └──────┬───────┘                              │
│                    │                │                                      │
│                    │         ws.close()                                    │
│                    │         [unclean]                                     │
│                    │                │                                      │
│                    │                ▼                                      │
│                    │         ┌──────────────┐                              │
│                    │         │              │                              │
│                    └─────────│   SEATED     │                              │
│                              │ DISCONNECTED │                              │
│                              │              │                              │
│                              └──────┬───────┘                              │
│                                     │                                      │
│                              reconnect()                                   │
│                              [within 5min]                                 │
│                                     │                                      │
│                                     ▼                                      │
│                              ┌──────────────┐                              │
│                              │              │                              │
│                              │   SEATED     │                              │
│                              │  CONNECTED   │                              │
│                              │              │                              │
│                              └──────────────┘                              │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

State Transitions:

┌────────────────────┬──────────────────┬─────────────────────┬──────────────┐
│ From               │ Event            │ To                  │ Action       │
├────────────────────┼──────────────────┼─────────────────────┼──────────────┤
│ NO_SEAT            │ reserve_seat()   │ SEATED_CONNECTED    │ Add to seats │
│ SEATED_CONNECTED   │ ws.close()       │ SEATED_DISCONNECTED │ Set deadline │
│ SEATED_DISCONNECTED│ reconnect()      │ SEATED_CONNECTED    │ Clear deadline│
│ SEATED_DISCONNECTED│ alarm() [expired]│ NO_SEAT             │ Remove seat  │
│ SEATED_*           │ kick() / leave() │ NO_SEAT             │ Remove seat  │
└────────────────────┴──────────────────┴─────────────────────┴──────────────┘
```

---

## 2. Spectator Connection State Machine

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      SPECTATOR CONNECTION STATE MACHINE                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│                              ┌──────────────┐                               │
│                              │              │                               │
│              ┌──────────────▶│  NOT_WATCHING│◀──────────────┐              │
│              │               │              │               │              │
│              │               └──────┬───────┘               │              │
│              │                      │                       │              │
│              │               connect()                      │              │
│              │               [as spectator]                 │              │
│              │                      │                       │              │
│              │                      ▼                       │              │
│              │               ┌──────────────┐               │              │
│              │               │              │               │              │
│              └───────────────│   WATCHING   │───────────────┘              │
│                 ws.close()   │              │   ws.close()                 │
│                              └──────────────┘                              │
│                                                                             │
│  Note: Spectators have NO reconnection window.                             │
│  They are simply removed on disconnect and can rejoin at will.             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Lobby Connection Lifecycle

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         LOBBY CONNECTION LIFECYCLE                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Browser Tab Opens                                                          │
│        │                                                                    │
│        ▼                                                                    │
│  ┌─────────────┐                                                            │
│  │ Root Layout │                                                            │
│  │   Mount     │                                                            │
│  └──────┬──────┘                                                            │
│         │                                                                   │
│         │ lobby.connect()                                                   │
│         ▼                                                                   │
│  ┌─────────────┐     network error      ┌─────────────┐                    │
│  │             │───────────────────────▶│             │                    │
│  │  CONNECTED  │                        │RECONNECTING │                    │
│  │             │◀───────────────────────│             │                    │
│  └─────────────┘     reconnect ok       └─────────────┘                    │
│         │                                      │                            │
│         │                                      │ max retries                │
│         │                                      ▼                            │
│         │                               ┌─────────────┐                    │
│         │                               │             │                    │
│         │                               │   FAILED    │                    │
│         │                               │             │                    │
│         │                               └─────────────┘                    │
│         │                                                                   │
│         │ User navigates: / → /games/dicee/room/ABC123                     │
│         │                                                                   │
│         │ LOBBY STAYS CONNECTED ← This is the key change                   │
│         │                                                                   │
│         ▼                                                                   │
│  ┌─────────────┐                                                            │
│  │ Room View   │                                                            │
│  │             │                                                            │
│  │ lobby: ✓    │ ← Still has lobby connection                              │
│  │ room:  ✓    │ ← Also has room connection                                │
│  └─────────────┘                                                            │
│         │                                                                   │
│         │ Browser Tab Closes / logout                                       │
│         ▼                                                                   │
│  ┌─────────────┐                                                            │
│  │   CLOSED    │                                                            │
│  └─────────────┘                                                            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Room Join Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              ROOM JOIN FLOW                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Client                        GameRoom DO                    GlobalLobby   │
│    │                               │                               │        │
│    │  1. WebSocket upgrade         │                               │        │
│    │  ?token=JWT&rejoin=false      │                               │        │
│    │──────────────────────────────▶│                               │        │
│    │                               │                               │        │
│    │                     2. Verify JWT                             │        │
│    │                               │                               │        │
│    │                     3. Check seats                            │        │
│    │                        - Has seat? → Reconnect                │        │
│    │                        - Room full? → Spectator               │        │
│    │                        - Game started? → Spectator            │        │
│    │                        - Otherwise → New seat                 │        │
│    │                               │                               │        │
│    │  4. 101 Switching Protocols   │                               │        │
│    │◀──────────────────────────────│                               │        │
│    │                               │                               │        │
│    │                               │  5. POST /user-entered-room   │        │
│    │                               │──────────────────────────────▶│        │
│    │                               │                               │        │
│    │                               │                     6. Update user     │
│    │                               │                        status         │
│    │                               │                               │        │
│    │                               │                     7. Broadcast       │
│    │                               │                        online_users   │
│    │                               │◀──────────────────────────────│        │
│    │                               │                               │        │
│    │                               │  8. POST /room-status         │        │
│    │                               │──────────────────────────────▶│        │
│    │                               │                               │        │
│    │                               │                     9. Broadcast       │
│    │                               │                        room_update    │
│    │                               │                               │        │
│    │  10. FULL_STATE               │                               │        │
│    │◀──────────────────────────────│                               │        │
│    │                               │                               │        │
│    │  11. Broadcast PLAYER_JOINED  │                               │        │
│    │  (to other players)           │                               │        │
│    │                               │                               │        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Disconnection & Reconnection Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     DISCONNECTION & RECONNECTION FLOW                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Player A          GameRoom DO           Other Players      GlobalLobby     │
│    │                    │                      │                 │          │
│    │                    │                      │                 │          │
│    ╳ Phone sleeps       │                      │                 │          │
│    │ (WS closes)        │                      │                 │          │
│    │                    │                      │                 │          │
│    │  1. webSocketClose │                      │                 │          │
│    │───────────────────▶│                      │                 │          │
│    │                    │                      │                 │          │
│    │          2. Mark seat disconnected        │                 │          │
│    │             Set reconnectDeadline         │                 │          │
│    │             = now + 5 minutes             │                 │          │
│    │                    │                      │                 │          │
│    │          3. Set alarm(deadline)           │                 │          │
│    │                    │                      │                 │          │
│    │                    │  4. PLAYER_DISCONNECTED                │          │
│    │                    │─────────────────────▶│                 │          │
│    │                    │                      │                 │          │
│    │                    │                      │  Show "Player A │          │
│    │                    │                      │  disconnected,  │          │
│    │                    │                      │  waiting..."    │          │
│    │                    │                      │                 │          │
│    │                    │  5. POST /room-status│                 │          │
│    │                    │────────────────────────────────────────▶          │
│    │                    │                      │                 │          │
│    │                    │                      │        6. Broadcast        │
│    │                    │                      │           room_update      │
│    │                    │                      │                 │          │
│    │                    │                      │                 │          │
│    │  ═══════════════ 2 minutes pass ═══════════════             │          │
│    │                    │                      │                 │          │
│    │                    │                      │                 │          │
│    │  Phone wakes       │                      │                 │          │
│    │                    │                      │                 │          │
│    │  7. WebSocket upgrade                     │                 │          │
│    │  ?token=JWT&rejoin=true                   │                 │          │
│    │───────────────────▶│                      │                 │          │
│    │                    │                      │                 │          │
│    │          8. Find existing seat            │                 │          │
│    │             Check deadline (still valid)  │                 │          │
│    │             Restore connection            │                 │          │
│    │                    │                      │                 │          │
│    │  9. 101 Switching  │                      │                 │          │
│    │◀───────────────────│                      │                 │          │
│    │                    │                      │                 │          │
│    │  10. FULL_STATE    │                      │                 │          │
│    │  (with game state, │                      │                 │          │
│    │   chat history)    │                      │                 │          │
│    │◀───────────────────│                      │                 │          │
│    │                    │                      │                 │          │
│    │                    │  11. PLAYER_RECONNECTED                │          │
│    │                    │─────────────────────▶│                 │          │
│    │                    │                      │                 │          │
│    │                    │                      │  Clear warning  │          │
│    │                    │                      │  Resume game    │          │
│    │                    │                      │                 │          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 6. Seat Expiration Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          SEAT EXPIRATION FLOW                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  (Player A still disconnected)                                              │
│                                                                             │
│              GameRoom DO           Other Players          GlobalLobby       │
│                   │                      │                     │            │
│                   │                      │                     │            │
│  ═══════════════ 5 minutes pass (deadline reached) ═══════════════         │
│                   │                      │                     │            │
│                   │                      │                     │            │
│        1. alarm() triggers               │                     │            │
│                   │                      │                     │            │
│        2. Check seats for expired        │                     │            │
│           deadlines                      │                     │            │
│                   │                      │                     │            │
│        3. If WAITING phase:              │                     │            │
│           Remove seat entirely           │                     │            │
│                   │                      │                     │            │
│           If PLAYING phase:              │                     │            │
│           Mark as forfeited              │                     │            │
│           Skip their turn                │                     │            │
│                   │                      │                     │            │
│                   │  4. PLAYER_REMOVED   │                     │            │
│                   │  or PLAYER_FORFEITED │                     │            │
│                   │─────────────────────▶│                     │            │
│                   │                      │                     │            │
│                   │                      │  Update UI:         │            │
│                   │                      │  Remove player      │            │
│                   │                      │  or show forfeit    │            │
│                   │                      │                     │            │
│                   │  5. POST /room-status│                     │            │
│                   │──────────────────────────────────────────▶│            │
│                   │                      │                     │            │
│                   │                      │          6. Broadcast            │
│                   │                      │             room_update          │
│                   │                      │                     │            │
│                                                                             │
│  If Player A tries to reconnect now:                                        │
│                                                                             │
│  Player A         GameRoom DO                                               │
│    │                   │                                                    │
│    │  WebSocket upgrade│                                                    │
│    │──────────────────▶│                                                    │
│    │                   │                                                    │
│    │         7. Check seats                                                 │
│    │            No seat found                                               │
│    │            Game in progress                                            │
│    │            → Assign spectator role                                     │
│    │                   │                                                    │
│    │  8. 101 (as spectator)                                                 │
│    │◀──────────────────│                                                    │
│    │                   │                                                    │
│    │  9. FULL_STATE    │                                                    │
│    │  (yourRole: 'spectator')                                               │
│    │◀──────────────────│                                                    │
│    │                   │                                                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 7. Storage Schema

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           DURABLE OBJECT STORAGE                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  GameRoom DO Storage Keys:                                                  │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                      │   │
│  │  'roomCode'     → string                                            │   │
│  │                    "ABC123"                                          │   │
│  │                                                                      │   │
│  │  'seats'        → Map<string, PlayerSeat>                           │   │
│  │                    {                                                 │   │
│  │                      "user_abc": {                                   │   │
│  │                        oderId: "user_abc",                           │   │
│  │                        displayName: "Alice",                         │   │
│  │                        avatarUrl: "...",                             │   │
│  │                        joinedAt: 1702300000000,                      │   │
│  │                        isConnected: true,                            │   │
│  │                        disconnectedAt: null,                         │   │
│  │                        reconnectDeadline: null,                      │   │
│  │                        isHost: true,                                 │   │
│  │                        turnOrder: 0                                  │   │
│  │                      },                                              │   │
│  │                      "user_def": { ... }                             │   │
│  │                    }                                                 │   │
│  │                                                                      │   │
│  │  'gameState'    → GameState | null                                  │   │
│  │                    {                                                 │   │
│  │                      phase: "playing",                               │   │
│  │                      currentTurnPlayerId: "user_abc",                │   │
│  │                      dice: [3, 5, 2, 6, 1],                          │   │
│  │                      rollsRemaining: 2,                              │   │
│  │                      keptIndices: [1, 3],                            │   │
│  │                      roundNumber: 5,                                 │   │
│  │                      players: Map<string, PlayerState>              │   │
│  │                    }                                                 │   │
│  │                                                                      │   │
│  │  'chatHistory'  → ChatMessage[]                                     │   │
│  │                    [                                                 │   │
│  │                      {                                               │   │
│  │                        id: "msg_001",                                │   │
│  │                        oderId: "user_abc",                           │   │
│  │                        displayName: "Alice",                         │   │
│  │                        content: "Good luck!",                        │   │
│  │                        timestamp: 1702300001000,                     │   │
│  │                        type: "user"                                  │   │
│  │                      },                                              │   │
│  │                      { ... }                                         │   │
│  │                    ]                                                 │   │
│  │                    (max 100 messages)                                │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  GlobalLobby DO Storage Keys:                                               │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                      │   │
│  │  'lobbyChatHistory' → ChatMessage[]                                 │   │
│  │                       (same structure as room chat)                  │   │
│  │                                                                      │   │
│  │  Note: Room directory is held in memory (this.rooms Map)            │   │
│  │        and rebuilt from GameRoom updates on DO restart.             │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  WebSocket Attachment (survives hibernation):                               │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                      │   │
│  │  serializeAttachment({                                              │   │
│  │    oderId: string,                                                   │   │
│  │    displayName: string,                                              │   │
│  │    avatarUrl: string | null,                                        │   │
│  │    role: 'player' | 'spectator',                                    │   │
│  │    connectedAt: number                                              │   │
│  │  })                                                                  │   │
│  │                                                                      │   │
│  │  Note: ~2KB limit. Keep minimal. Use storage for larger state.      │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 8. Client State Model

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CLIENT STATE MODEL                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  lobby.svelte.ts (Singleton - App Lifetime)                                 │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                      │   │
│  │  connectionState: 'disconnected' | 'connecting' | 'connected'       │   │
│  │                   | 'reconnecting'                                   │   │
│  │                                                                      │   │
│  │  onlineCount: number                                                 │   │
│  │                                                                      │   │
│  │  onlineUsers: OnlineUser[]          ← NEW: Full user list           │   │
│  │    [{                                                                │   │
│  │      oderId: string,                                                 │   │
│  │      displayName: string,                                            │   │
│  │      status: 'available' | 'in_room' | 'in_game',                   │   │
│  │      currentRoomCode: string | null                                  │   │
│  │    }]                                                                │   │
│  │                                                                      │   │
│  │  rooms: RoomInfo[]                  ← Room directory                 │   │
│  │    [{                                                                │   │
│  │      code: string,                                                   │   │
│  │      status: 'waiting' | 'playing' | 'finished',                    │   │
│  │      playerCount: number,                                            │   │
│  │      spectatorCount: number,                                         │   │
│  │      players: PlayerSummary[]                                        │   │
│  │    }]                                                                │   │
│  │                                                                      │   │
│  │  messages: ChatMessage[]            ← Lobby chat                     │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  room.svelte.ts (Per-Room - Room Lifetime)                                  │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                      │   │
│  │  connectionState: 'disconnected' | 'connecting' | 'connected'       │   │
│  │                   | 'reconnecting' | 'failed'                        │   │
│  │                                                                      │   │
│  │  roomCode: string | null                                             │   │
│  │                                                                      │   │
│  │  role: 'player' | 'spectator'                                       │   │
│  │                                                                      │   │
│  │  currentUserId: string | null                                        │   │
│  │                                                                      │   │
│  │  players: PlayerInfo[]                                               │   │
│  │    [{                                                                │   │
│  │      oderId: string,                                                 │   │
│  │      displayName: string,                                            │   │
│  │      isHost: boolean,                                                │   │
│  │      isConnected: boolean,          ← Shows connection status        │   │
│  │      disconnectedAt: number | null, ← When they disconnected         │   │
│  │      reconnectDeadline: number | null ← When they'll be removed     │   │
│  │    }]                                                                │   │
│  │                                                                      │   │
│  │  gameState: GameState | null                                         │   │
│  │    {                                                                 │   │
│  │      phase: string,                                                  │   │
│  │      currentTurnPlayerId: string,                                    │   │
│  │      dice: number[],                                                 │   │
│  │      rollsRemaining: number,                                         │   │
│  │      roundNumber: number,                                            │   │
│  │      ...                                                             │   │
│  │    }                                                                 │   │
│  │                                                                      │   │
│  │  chatMessages: ChatMessage[]        ← Room chat (persisted)          │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 9. Error States & Recovery

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         ERROR STATES & RECOVERY                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Error: Room Full                                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  Trigger: User tries to join room with 4 players                    │   │
│  │  Server:  Returns 101 with role='spectator'                         │   │
│  │  Client:  Shows spectator UI, option to queue for next game         │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  Error: Game Already Started                                                │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  Trigger: User tries to join after game started                     │   │
│  │  Server:  Returns 101 with role='spectator'                         │   │
│  │  Client:  Shows spectator UI                                        │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  Error: Auth Expired                                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  Trigger: JWT expired during long session                           │   │
│  │  Server:  Returns 401                                               │   │
│  │  Client:  Refresh token, retry connection                           │   │
│  │           If refresh fails, redirect to login                       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  Error: Room Not Found                                                      │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  Trigger: Invalid room code or room closed                          │   │
│  │  Server:  Returns 404                                               │   │
│  │  Client:  Show error, offer to return to lobby                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  Error: Connection Failed (Network)                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  Trigger: Network unavailable                                       │   │
│  │  Client:  ReconnectingWebSocket retries with backoff               │   │
│  │           Show "Reconnecting..." UI                                 │   │
│  │           After 10 attempts, show "Connection failed" with retry   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  Error: Seat Expired                                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  Trigger: Reconnect after 5 minute window                           │   │
│  │  Server:  No seat found, assigns spectator role                     │   │
│  │  Client:  Show message "Your seat expired. Watching as spectator."  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 10. UI States for Player Connection

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     UI STATES FOR PLAYER CONNECTION                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Player List Item - Connected                                               │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  [Avatar]  Alice            [HOST]                                  │   │
│  │            ● Online                                                 │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  Player List Item - Disconnected (within window)                            │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  [Avatar]  Bob              [RECONNECTING]                          │   │
│  │  (dimmed)  ○ Disconnected                                           │   │
│  │            Returns in 4:32                                          │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  Player List Item - Seat Expired                                            │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  [Avatar]  Charlie          [LEFT]                                  │   │
│  │  (crossed) × Removed                                                │   │
│  │            (Disconnection timeout)                                  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  Waiting Room - Player Disconnected Banner                                  │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  ⚠️  Bob disconnected. Waiting for reconnection (4:32 remaining)    │   │
│  │                                                                      │   │
│  │  [Continue without Bob]  (host only, removes them immediately)       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  Game View - Current Player Disconnected                                    │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  ⏸️  Game paused - Alice is reconnecting (4:32 remaining)           │   │
│  │                                                                      │   │
│  │  If they don't return, their turn will be skipped.                  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  Self Reconnecting Overlay                                                  │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                      │   │
│  │                   🔄 Reconnecting...                                │   │
│  │                                                                      │   │
│  │              Connection lost. Attempting to rejoin.                 │   │
│  │                                                                      │   │
│  │                      Attempt 3 of 10                                │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  Reconnection Failed                                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                      │   │
│  │                   ❌ Connection Failed                              │   │
│  │                                                                      │   │
│  │              Unable to reconnect to the game.                       │   │
│  │                                                                      │   │
│  │              [Return to Lobby]    [Try Again]                       │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

*End of State Machines Document*
