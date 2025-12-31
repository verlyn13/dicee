# Game Session & Reconnection UX Design Guide
## A Foundational Framework for Family-Style Multiplayer Games

*Last Updated: December 31, 2025*

---

## Executive Summary

This document establishes a foundational design framework for handling player presence, session state, and reconnection flows in casual/family multiplayer games. The patterns here are distilled from industry best practices (Jackbox Games, Board Game Arena, Among Us, Unity/Nakama frameworks) and adapted for simplicity and family-friendliness.

**Core Principle**: *"Never punish the player for life getting in the way."*

In a family game context, someone's phone dies, the doorbell rings, a kid needs attention. The system should gracefully handle these interruptions without destroying the game experience for everyone.

---

## Part 1: The Mental Model

### 1.1 Three Distinct Entities

Think of your system as managing three separate but linked entities:

| Entity | Description | Persistence |
|--------|-------------|-------------|
| **Player Identity** | Who the person is (persistent across all games) | Long-lived (account or device ID) |
| **Player Session** | Current connection to your server | Ephemeral (tied to socket/connection) |
| **Game Room** | The shared game instance | Medium-lived (one game's duration) |

The **key insight**: These three things have different lifecycles and should be managed independently. Your bug stems from conflating session state with room membership.

### 1.2 The Player Presence State Machine

Every player in relation to a room should be in exactly ONE of these states:

```
                    ┌─────────────┐
                    │   NOT IN    │
                    │    ROOM     │
                    └──────┬──────┘
                           │ join
                           ▼
                    ┌─────────────┐
          ┌────────▶│  CONNECTED  │◀────────┐
          │         │   (active)  │         │
          │         └──────┬──────┘         │
          │                │                │
          │ reconnect      │ disconnect     │ reconnect
          │ (within grace) │ (socket lost)  │ (within grace)
          │                ▼                │
          │         ┌─────────────┐         │
          └─────────│ DISCONNECTED│─────────┘
                    │ (grace period)│
                    └──────┬──────┘
                           │ grace period expires
                           ▼
                    ┌─────────────┐
                    │  ABANDONED  │
                    │ (slot held) │
                    └──────┬──────┘
                           │ room timeout OR explicit leave
                           ▼
                    ┌─────────────┐
                    │   REMOVED   │
                    │ (slot freed)│
                    └─────────────┘
```

### 1.3 The Room State Machine

```
                    ┌─────────────┐
                    │   CREATED   │
                    │ (empty room)│
                    └──────┬──────┘
                           │ first player joins
                           ▼
                    ┌─────────────┐
         ◀──────────│   WAITING   │──────────▶
    players leave   │  (lobby)    │   host starts game
                    └──────┬──────┘
                           │ 
                           ▼
                    ┌─────────────┐
          ┌────────▶│ IN-PROGRESS │◀────────┐
          │         │  (playing)  │         │
          │         └──────┬──────┘         │
          │                │                │
          │ player         │ all players    │ enough players
          │ reconnects     │ disconnect     │ reconnect
          │                ▼                │
          │         ┌─────────────┐         │
          └─────────│   PAUSED    │─────────┘
                    │ (awaiting)  │
                    └──────┬──────┘
                           │ pause timeout expires
                           ▼
                    ┌─────────────┐
                    │  ABANDONED  │
                    └──────┬──────┘
                           │
              ┌────────────┴────────────┐
              ▼                         ▼
       ┌─────────────┐           ┌─────────────┐
       │  COMPLETED  │           │   EXPIRED   │
       │ (game over) │           │ (cleanup)   │
       └─────────────┘           └─────────────┘
```

---

## Part 2: The Ideal UX Flow

### 2.1 Scenario: Game Abandoned, Player Returns

**Setup**: Three players (Alice, Bob, Carol) start a game. Everyone leaves (closes browser, phone dies, etc.). 15 minutes later, Alice comes back.

#### What Alice Should See

**Step 1: Reconnecting to Server**
```
┌────────────────────────────────────────────┐
│                                            │
│         Reconnecting to game...            │
│         ████████░░░░░░░░░░░░               │
│                                            │
└────────────────────────────────────────────┘
```
*Duration: 1-3 seconds max*

**Step 2: Game Status Screen**
```
┌────────────────────────────────────────────┐
│                                            │
│   ⚠️  Your game is waiting for you!        │
│                                            │
│   "Fun Family Game" • Started 20 min ago   │
│   ─────────────────────────────────────    │
│                                            │
│   Players:                                 │
│   • Alice (you)          ✅ Connected      │
│   • Bob                  ⏳ Away           │
│   • Carol                ⏳ Away           │
│                                            │
│   Game will remain open for: 42:15         │
│                                            │
│   ┌────────────────┐  ┌────────────────┐   │
│   │   Return to    │  │   Leave Game   │   │
│   │     Game       │  │                │   │
│   └────────────────┘  └────────────────┘   │
│                                            │
│   💡 Invite others back:                   │
│   Room Code: FUNKY-BEAR                    │
│   [Copy Link] [Share]                      │
│                                            │
└────────────────────────────────────────────┘
```

**Step 3: If Alice Returns to Game**
- Show the game board as it was when abandoned
- Display "Waiting for other players..." overlay
- Show who's connected vs. away
- Allow Alice to take actions if it was her turn (game doesn't HAVE to pause)

#### What Bob and Carol Should See

**When They Return to the App/Site (Main Lobby)**
```
┌────────────────────────────────────────────┐
│                                            │
│   🎮 Your Games                            │
│   ─────────────────────────────────────    │
│                                            │
│   ┌────────────────────────────────────┐   │
│   │ 🔔 "Fun Family Game"               │   │
│   │    with Alice, Carol               │   │
│   │    Waiting for you • 22 min ago    │   │
│   │    [REJOIN]                        │   │
│   └────────────────────────────────────┘   │
│                                            │
│   ─────────────────────────────────────    │
│   Public Games                             │
│   • Trivia Night (3/6 players) [JOIN]      │
│   • Word Scramble (2/4 players) [JOIN]     │
│                                            │
└────────────────────────────────────────────┘
```

### 2.2 Why "Rejoin" vs "Join" Matters

Your bug showed Axel seeing "Join" instead of "Rejoin". This happens when:

1. **Axel's session expired** - His player-to-room mapping was cleared
2. **Room still exists** - Listed as joinable to everyone
3. **State mismatch** - Room thinks Axel left; lobby treats him as a new player

**The Fix**: The room should track players by **persistent identity** (user ID, device ID), not by **session ID** (socket ID). When Axel reconnects:

```javascript
// WRONG: Checking by session
if (room.sessions.has(socket.id)) { // Always false after reconnect
  showRejoin();
}

// RIGHT: Checking by player identity  
if (room.playerIdentities.has(user.persistentId)) {
  showRejoin();
}
```

### 2.3 Notifications & Messaging

**In-App Notifications (When Players Are Connected)**

| Event | Who Sees It | Message |
|-------|-------------|---------|
| Player disconnects | Other players in room | "Bob disconnected. Waiting for them to return..." |
| Player reconnects | Other players in room | "Bob is back!" |
| Grace period warning | All players | "Game will close in 5 minutes if no one returns" |
| Game paused | All players | "Game paused. Waiting for players..." |

**Push Notifications (When Players Are Away)**

| Trigger | Message | Timing |
|---------|---------|--------|
| Other player returns | "Alice is back in your game! Tap to rejoin." | Immediate |
| It's your turn | "It's your turn in Fun Family Game!" | When turn changes to them |
| Room expiring soon | "Your game is about to expire. Rejoin to save it!" | 5 min before expiry |

---

## Part 3: Implementation Architecture

### 3.1 Data Model

```typescript
// Player Identity (persistent, stored in DB/localStorage)
interface PlayerIdentity {
  id: string;                    // UUID, persisted across sessions
  displayName: string;
  deviceFingerprint?: string;    // Fallback if no account
}

// Player Session (ephemeral, in-memory)
interface PlayerSession {
  sessionId: string;             // Socket ID or connection ID
  identityId: string;            // Link to PlayerIdentity
  connectedAt: Date;
  lastHeartbeat: Date;
}

// Room Membership (medium persistence, Redis/DB)
interface RoomMember {
  identityId: string;            // NOT session ID!
  displayName: string;
  joinedAt: Date;
  presenceState: 'connected' | 'disconnected' | 'abandoned' | 'removed';
  lastSeenAt: Date;
  currentSessionId?: string;     // Null when disconnected
  isHost: boolean;
  gameState: any;                // Player-specific game data
}

// Room (medium persistence)
interface Room {
  id: string;
  code: string;                  // Human-readable join code
  state: 'waiting' | 'in-progress' | 'paused' | 'completed' | 'abandoned';
  members: Map<string, RoomMember>;  // Keyed by identityId
  createdAt: Date;
  gameStartedAt?: Date;
  lastActivityAt: Date;
  gameSnapshot: any;             // Serialized game state
  settings: RoomSettings;
}
```

### 3.2 Timeout Configuration (Family-Friendly Defaults)

```typescript
const TIMEOUTS = {
  // How long to wait before marking player as "disconnected"
  HEARTBEAT_INTERVAL: 5_000,      // 5 seconds
  HEARTBEAT_TIMEOUT: 15_000,      // 15 seconds (3 missed heartbeats)
  
  // Grace periods before escalating presence state
  DISCONNECT_GRACE_WAITING: 300_000,    // 5 min in lobby
  DISCONNECT_GRACE_PLAYING: 120_000,    // 2 min during game
  
  // Room cleanup
  ROOM_EMPTY_TIMEOUT_WAITING: 600_000,  // 10 min empty lobby
  ROOM_EMPTY_TIMEOUT_PLAYING: 3600_000, // 1 hour abandoned game
  ROOM_PAUSED_TIMEOUT: 1800_000,        // 30 min paused
  
  // Maximum room lifetime
  ROOM_MAX_LIFETIME: 86400_000,         // 24 hours absolute max
};
```

### 3.3 State Transitions

```typescript
// When socket disconnects
function onPlayerDisconnect(sessionId: string, room: Room) {
  const member = findMemberBySession(room, sessionId);
  if (!member) return;
  
  member.currentSessionId = null;
  member.presenceState = 'disconnected';
  member.lastSeenAt = new Date();
  
  // Notify other players
  broadcastToRoom(room, {
    type: 'player_disconnected',
    playerId: member.identityId,
    displayName: member.displayName
  });
  
  // Schedule grace period expiry
  scheduleStateTransition(member.identityId, room.id, {
    from: 'disconnected',
    to: 'abandoned',
    delay: room.state === 'waiting' 
      ? TIMEOUTS.DISCONNECT_GRACE_WAITING 
      : TIMEOUTS.DISCONNECT_GRACE_PLAYING
  });
  
  // Check if room should pause
  checkRoomState(room);
}

// When player reconnects
function onPlayerReconnect(session: PlayerSession, room: Room) {
  const member = room.members.get(session.identityId);
  
  if (!member) {
    // They were fully removed - treat as new join attempt
    return { action: 'new_join_required' };
  }
  
  if (member.presenceState === 'removed') {
    return { action: 'cannot_rejoin', reason: 'You left this game' };
  }
  
  // Restore their connection
  member.currentSessionId = session.sessionId;
  member.presenceState = 'connected';
  member.lastSeenAt = new Date();
  
  // Cancel any pending state transitions
  cancelScheduledTransitions(member.identityId, room.id);
  
  // Notify others
  broadcastToRoom(room, {
    type: 'player_reconnected',
    playerId: member.identityId,
    displayName: member.displayName
  });
  
  // Check if game should unpause
  checkRoomState(room);
  
  return {
    action: 'rejoin_success',
    gameSnapshot: room.gameSnapshot,
    yourState: member.gameState
  };
}
```

### 3.4 Lobby Display Logic

```typescript
function getRoomDisplayForPlayer(room: Room, playerId: string): RoomDisplay {
  const isMember = room.members.has(playerId);
  const member = room.members.get(playerId);
  
  if (!isMember) {
    // Not a member - show standard join option
    return {
      action: 'join',
      canJoin: room.state === 'waiting' && room.members.size < room.settings.maxPlayers
    };
  }
  
  if (member.presenceState === 'removed') {
    // Was removed - treat as non-member
    return { action: 'join', canJoin: room.state === 'waiting' };
  }
  
  // They're a member (connected, disconnected, or abandoned)
  return {
    action: 'rejoin',
    roomState: room.state,
    lastSeen: member.lastSeenAt,
    otherPlayers: getOtherPlayersStatus(room, playerId)
  };
}
```

---

## Part 4: User-Facing States & Copy

### 4.1 Simple Language for Family Games

| Technical State | What Users See | Icon |
|-----------------|----------------|------|
| `connected` | "In Game" or "Ready" | ✅ 🟢 |
| `disconnected` | "Away" or "Reconnecting..." | ⏳ 🟡 |
| `abandoned` | "Left" (but can rejoin) | ⚪ |
| `removed` | (Not shown - slot freed) | — |
| Room `waiting` | "Waiting for players" | — |
| Room `in-progress` | "Game in progress" | 🎮 |
| Room `paused` | "Game paused" | ⏸️ |

### 4.2 User-Facing Messages

**Disconnection (Self)**
> "Connection lost. Reconnecting..."
> *[spinner]*
> "Don't worry, your game is saved!"

**Disconnection (Other Player)**
> "Waiting for Bob to come back..."
> "Game will continue when Bob returns, or you can play without them after 2 minutes."

**Reconnection Success**
> "Welcome back! Here's where you left off."

**Room Expiring**
> "This game will close in 5 minutes. Tap to keep it open!"

**Room Expired**
> "This game has ended. Would you like to start a new one?"

---

## Part 5: Where Players Land on Reconnect

### 5.1 Decision Tree

```
Player opens app/refreshes browser
            │
            ▼
   Do they have a persistent ID?
            │
     ┌──────┴──────┐
     No            Yes
     │              │
     ▼              ▼
  Main Lobby    Check room membership
                    │
              ┌─────┴─────┐
              No          Yes (any state except 'removed')
              │            │
              ▼            ▼
         Main Lobby    Room state?
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
           waiting     in-progress    paused
              │            │            │
              ▼            ▼            ▼
         Waiting Room  Game Screen   Game Screen
         (with others   (with         (with "Waiting
          shown)        reconnect     for others"
                        animation)     overlay)
```

### 5.2 Landing Pages by Context

| Player Was In... | They Reconnect... | They Land On... |
|------------------|-------------------|-----------------|
| Main Lobby | N/A | Main Lobby |
| Waiting Room | Within grace period | Waiting Room (same room) |
| Waiting Room | After grace (room still exists) | Main Lobby with "Rejoin" prompt |
| Waiting Room | After room expired | Main Lobby |
| Active Game | Within grace period | Game Screen (with catch-up) |
| Active Game | After grace (game still exists) | Main Lobby with "Rejoin" prompt |
| Active Game | After room expired | Main Lobby with "Game ended" message |

---

## Part 6: Handling Edge Cases

### 6.1 Host Disconnection

**Option A: Floating Host (Recommended for Casual Games)**
- Any connected player can take host actions
- UI shows "(Acting Host)" indicator
- Original host regains control on reconnect

**Option B: Host Migration**
- Assign host to next connected player
- Inform all players of host change
- Original host becomes regular player on return

### 6.2 All Players Disconnect

```
All players disconnect
         │
         ▼
   Room enters PAUSED state
         │
         ▼
   Start pause timer (30-60 min)
         │
    ┌────┴────┐
    │         │
    ▼         ▼
  Timer    Any player
  expires  reconnects
    │         │
    ▼         ▼
  Room      Resume game
  archived  (with current
  to DB     player list)
```

### 6.3 Partial Reconnection

When some players reconnect but others don't:

```typescript
function checkIfGameCanContinue(room: Room): GameContinuation {
  const connected = countConnectedPlayers(room);
  const total = room.members.size;
  const disconnectedTime = getMaxDisconnectedTime(room);
  
  if (connected >= room.settings.minPlayers) {
    return { 
      canContinue: true, 
      action: 'continue_with_present_players'
    };
  }
  
  if (disconnectedTime > TIMEOUTS.DISCONNECT_GRACE_PLAYING) {
    return {
      canContinue: true,
      action: 'remove_absent_players_and_continue',
      suggestion: 'Some players have been away too long. Continue without them?'
    };
  }
  
  return {
    canContinue: false,
    action: 'wait_for_players',
    waitingFor: getDisconnectedPlayers(room)
  };
}
```

---

## Part 7: Diagnosing Your Current Bug

Based on your description:

> "Two of the three have the option to 'rejoin' the room. Axel has the game listed as 'join' not 'rejoin'"

**Root Cause Analysis:**

1. **Session ID vs. Identity ID**: Axel's browser likely created a new session ID on reconnect, and your system uses session ID to determine room membership.

2. **Inconsistent TTL**: The mapping of player-to-room may have different expiration than the room itself. Axel's mapping expired while the room persisted.

3. **Missing persistent identifier**: Without a stable identifier (localStorage UUID, account ID), each reconnection is treated as a new player.

**Fix Checklist:**
- [ ] Generate UUID on first visit, store in localStorage
- [ ] Map room membership by this UUID, not socket ID
- [ ] When listing rooms in lobby, check membership by UUID
- [ ] On reconnect, lookup existing membership before creating new

---

## Appendix A: Industry Patterns Reference

| Platform | Reconnection During Game | Session Persistence | Grace Period |
|----------|-------------------------|---------------------|--------------|
| **Jackbox** | Yes (refresh + reconnect button) | Cookie-based | Game pauses for host disconnect |
| **Among Us** | No (cannot rejoin mid-game) | Session only | N/A |
| **Board Game Arena** | Yes (with kick option) | Account-based | Configurable timer |
| **Tabletop Simulator** | Yes | Steam ID | Host controls |

---

## Appendix B: Recommended Tech Stack Components

For implementing this pattern:

- **Player Identity**: LocalStorage UUID + optional account system
- **Session Management**: Socket.io with Redis adapter for reconnection
- **Room State**: Redis with pub/sub for real-time sync
- **Game State Snapshots**: PostgreSQL or Redis with periodic saves
- **Push Notifications**: Firebase Cloud Messaging or similar

---

*This document provides a foundation. Specific implementations will vary based on your game's mechanics, platform constraints, and user expectations.*