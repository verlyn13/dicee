# Multiplayer Resilience Implementation Specification

**Document Version:** 1.0  
**Date:** 2025-12-11  
**Status:** Approved for Implementation  
**Scope:** Connection lifecycle, state persistence, reconnection protocol

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Architecture Overview](#architecture-overview)
3. [Phase 1: Connection Lifecycle](#phase-1-connection-lifecycle)
4. [Phase 2: Room Directory](#phase-2-room-directory)
5. [Phase 3: Reconnection Protocol](#phase-3-reconnection-protocol)
6. [Phase 4: State Persistence](#phase-4-state-persistence)
7. [Message Protocol Reference](#message-protocol-reference)
8. [Testing Verification](#testing-verification)
9. [Migration Checklist](#migration-checklist)

---

## Executive Summary

### Decisions Confirmed

| Decision | Choice |
|----------|--------|
| Lobby connection | Keep alive during room sessions (Option A) |
| Reconnection window | 5 minutes for both waiting room and active game |
| Chat persistence | Yes, chat history persists through reconnection |
| Spectator handling | Bump to lobby on disconnect (can rejoin easily) |

### Issues Being Fixed

| Issue | Solution |
|-------|----------|
| Can't invite players from room | Lobby WS stays connected |
| Open games not showing | Fix roomCode + broadcast |
| Phone sleep breaks game | Reconnection protocol + state persistence |
| No recovery after disconnect | 5-minute seat reservation + auto-rejoin |

---

## Architecture Overview

### Current Architecture (Broken)

```
┌─────────────────────────────────────────────────────────────────────┐
│                           CURRENT STATE                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  User in Lobby          User Creates Room        User in Room       │
│  ┌─────────────┐       ┌─────────────────┐      ┌─────────────┐    │
│  │ LobbyLanding│       │   Navigation    │      │  RoomLobby  │    │
│  │             │──────▶│                 │─────▶│             │    │
│  │ lobby.connect()     │ lobby.disconnect()     │ room.connect()   │
│  └─────────────┘       └─────────────────┘      └─────────────┘    │
│        │                       │                       │            │
│        ▼                       ▼                       ▼            │
│  ┌─────────────┐         ┌─────────┐          ┌─────────────┐      │
│  │ GlobalLobby │         │ BROKEN  │          │  GameRoom   │      │
│  │     DO      │         │ No lobby│          │     DO      │      │
│  │             │         │ presence│          │             │      │
│  └─────────────┘         └─────────┘          └─────────────┘      │
│                                                                     │
│  Problems:                                                          │
│  • Lobby disconnects on room entry                                  │
│  • No online users available for invites                            │
│  • Room updates don't reach lobby clients (none connected)          │
│  • Phone sleep = permanent disconnection                            │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Target Architecture (Fixed)

```
┌─────────────────────────────────────────────────────────────────────┐
│                          TARGET STATE                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                    ROOT LAYOUT (+layout.svelte)               │  │
│  │                                                                │  │
│  │  lobby.connect() on mount                                      │  │
│  │  lobby.disconnect() NEVER (until browser close)                │  │
│  │                                                                │  │
│  │  ┌────────────────┐    ┌────────────────┐                     │  │
│  │  │  LobbyLanding  │    │   Room View    │                     │  │
│  │  │                │    │                │                     │  │
│  │  │ Uses lobby.*   │    │ Uses lobby.*   │                     │  │
│  │  │ for chat, users│    │ for invites    │                     │  │
│  │  │                │    │                │                     │  │
│  │  │                │    │ room.connect() │                     │  │
│  │  │                │    │ (additional WS)│                     │  │
│  │  └────────────────┘    └────────────────┘                     │  │
│  └──────────────────────────────────────────────────────────────┘  │
│        │                           │                                │
│        │                           │                                │
│        ▼                           ▼                                │
│  ┌─────────────┐            ┌─────────────┐                        │
│  │ GlobalLobby │◀───RPC────│  GameRoom   │                        │
│  │     DO      │            │     DO      │                        │
│  │             │            │             │                        │
│  │ • Presence  │            │ • Game state│                        │
│  │ • Room list │            │ • Players   │                        │
│  │ • Chat      │            │ • Chat hist │                        │
│  │ • Online    │            │ • Seats     │                        │
│  └─────────────┘            └─────────────┘                        │
│                                                                     │
│  Benefits:                                                          │
│  • Lobby presence always available                                  │
│  • Invites work from room                                           │
│  • Room updates broadcast to lobby clients                          │
│  • Reconnection within 5 minutes preserves seat                     │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Dual WebSocket Pattern

```
┌─────────────────────────────────────────────────────────────────────┐
│                    CLIENT CONNECTION MODEL                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Browser Tab                                                        │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                                                              │   │
│  │  ┌────────────────────┐    ┌────────────────────┐           │   │
│  │  │   Lobby WebSocket  │    │   Room WebSocket   │           │   │
│  │  │                    │    │                    │           │   │
│  │  │ Lifecycle: App     │    │ Lifecycle: Room    │           │   │
│  │  │ Connect: On load   │    │ Connect: On enter  │           │   │
│  │  │ Disconnect: Never  │    │ Disconnect: Leave  │           │   │
│  │  │                    │    │                    │           │   │
│  │  │ Purpose:           │    │ Purpose:           │           │   │
│  │  │ • Global presence  │    │ • Game state       │           │   │
│  │  │ • Room directory   │    │ • Room chat        │           │   │
│  │  │ • Online users     │    │ • Player actions   │           │   │
│  │  │ • Lobby chat       │    │ • Reconnection     │           │   │
│  │  └────────────────────┘    └────────────────────┘           │   │
│  │           │                         │                        │   │
│  │           │                         │                        │   │
│  │           ▼                         ▼                        │   │
│  │  wss://host/ws/lobby       wss://host/ws/room/ABC123        │   │
│  │                                                              │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Connection Lifecycle

### 1.1 Problem Statement

Currently, `LobbyLanding.svelte` connects to the lobby on mount and disconnects on destroy. When a user navigates to a room, the lobby connection is severed, making online users unavailable for invites.

### 1.2 Solution: Root-Level Lobby Connection

Move lobby connection management to the root layout so it persists across all navigation.

### 1.3 Files to Modify

#### File: `src/routes/+layout.svelte`

**Current (approximate):**
```svelte
<script lang="ts">
  let { children } = $props();
</script>

{@render children()}
```

**Target:**
```svelte
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { browser } from '$app/environment';
  import { lobby } from '$lib/stores/lobby.svelte';
  
  let { children } = $props();
  
  onMount(() => {
    if (browser) {
      lobby.connect();
    }
  });
  
  // Note: NO onDestroy disconnect
  // Lobby stays connected for entire session
  // Browser close will naturally terminate the WebSocket
</script>

{@render children()}
```

#### File: `src/routes/+page.svelte` (LobbyLanding)

**Current (approximate):**
```svelte
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { lobby } from '$lib/stores/lobby.svelte';
  
  onMount(() => {
    lobby.connect();
  });
  
  onDestroy(() => {
    lobby.disconnect();  // ← REMOVE THIS
  });
</script>
```

**Target:**
```svelte
<script lang="ts">
  import { lobby } from '$lib/stores/lobby.svelte';
  
  // Connection is managed by root layout
  // This component just uses the lobby store
</script>
```

#### File: `src/lib/stores/lobby.svelte.ts`

**Add: Idempotent connection handling**

```typescript
class LobbyState {
  // ... existing state ...
  
  private connectPromise: Promise<void> | null = null;
  
  connect(): Promise<void> {
    // Idempotent: return existing connection or create new
    if (this.ws?.readyState === WebSocket.OPEN) {
      return Promise.resolve();
    }
    
    if (this.ws?.readyState === WebSocket.CONNECTING) {
      return this.connectPromise ?? Promise.resolve();
    }
    
    this.connectPromise = this.doConnect();
    return this.connectPromise;
  }
  
  private async doConnect(): Promise<void> {
    if (!browser) return;
    
    this.connectionState = 'connecting';
    
    return new Promise((resolve, reject) => {
      const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
      this.ws = new WebSocket(`${protocol}//${location.host}/ws/lobby`);
      
      this.ws.onopen = () => {
        this.connectionState = 'connected';
        this.reconnectAttempts = 0;
        this.clearReconnectTimer();
        this.connectPromise = null;
        resolve();
      };
      
      this.ws.onerror = (error) => {
        this.connectPromise = null;
        // Don't reject - let onclose handle reconnection
      };
      
      this.ws.onclose = (event) => {
        this.connectionState = 'disconnected';
        this.connectPromise = null;
        
        // Always attempt reconnection unless explicitly disconnected
        if (!this.intentionalDisconnect) {
          this.scheduleReconnect();
        }
      };
      
      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleMessage(data);
        } catch (e) {
          console.error('[Lobby] Failed to parse message:', e);
        }
      };
    });
  }
  
  // Only called on explicit user action (e.g., logout)
  disconnect(): void {
    this.intentionalDisconnect = true;
    this.clearReconnectTimer();
    this.ws?.close(1000, 'User disconnect');
    this.ws = null;
    this.connectionState = 'disconnected';
  }
  
  // Add: Reset for new session (e.g., after login)
  reset(): void {
    this.intentionalDisconnect = false;
    this.reconnectAttempts = 0;
    this.connect();
  }
}
```

### 1.4 RoomLobby Integration

Now that lobby stays connected, RoomLobby can access online users:

#### File: `src/lib/components/multiplayer/RoomLobby.svelte`

**Add: Derive invitable users from lobby store**

```svelte
<script lang="ts">
  import { lobby } from '$lib/stores/lobby.svelte';
  import { room } from '$lib/stores/room.svelte';
  
  // Get online users from lobby, excluding current room players
  const invitableUsers = $derived(() => {
    const roomPlayerIds = new Set(room.players.map(p => p.userId));
    const selfId = room.currentUserId;
    
    return lobby.onlineUsers.filter(user => 
      user.id !== selfId && !roomPlayerIds.has(user.id)
    );
  });
  
  // ... rest of component
</script>

{#if isHost && invitableUsers.length > 0}
  <section class="invite-section">
    <h3>Invite Players</h3>
    <ul class="online-users-list">
      {#each invitableUsers as user (user.id)}
        <OnlineUserItem 
          {user} 
          onInvite={() => handleInvite(user.id)} 
        />
      {/each}
    </ul>
  </section>
{/if}
```

### 1.5 GlobalLobby: Track Online Users

#### File: `packages/cloudflare-do/src/GlobalLobby.ts`

**Add: Online users tracking with proper broadcasting**

```typescript
interface OnlineUser {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  status: 'available' | 'in_room' | 'in_game';
  currentRoomCode: string | null;
}

class GlobalLobby extends DurableObject {
  // ... existing code ...
  
  // Track online users with their status
  private async getOnlineUsers(): Promise<OnlineUser[]> {
    const users: OnlineUser[] = [];
    
    for (const ws of this.ctx.getWebSockets()) {
      const attachment = ws.deserializeAttachment() as UserPresence;
      if (attachment?.userId) {
        users.push({
          userId: attachment.userId,
          displayName: attachment.username,
          avatarUrl: attachment.avatarUrl ?? null,
          status: attachment.currentRoomCode ? 'in_room' : 'available',
          currentRoomCode: attachment.currentRoomCode ?? null,
        });
      }
    }
    
    // Deduplicate by userId (user may have multiple tabs)
    const uniqueUsers = new Map<string, OnlineUser>();
    for (const user of users) {
      // Prefer 'in_room' status over 'available' for same user
      const existing = uniqueUsers.get(user.userId);
      if (!existing || (user.status === 'in_room' && existing.status === 'available')) {
        uniqueUsers.set(user.userId, user);
      }
    }
    
    return Array.from(uniqueUsers.values());
  }
  
  // Handle user entering a room (update their status)
  async handleUserEnteredRoom(userId: string, roomCode: string): Promise<void> {
    // Update all connections for this user
    for (const ws of this.ctx.getWebSockets(`user:${userId}`)) {
      const attachment = ws.deserializeAttachment() as UserPresence;
      ws.serializeAttachment({
        ...attachment,
        currentRoomCode: roomCode,
      });
    }
    
    // Broadcast updated user list
    await this.broadcastOnlineUsers();
  }
  
  // Handle user leaving a room
  async handleUserLeftRoom(userId: string): Promise<void> {
    for (const ws of this.ctx.getWebSockets(`user:${userId}`)) {
      const attachment = ws.deserializeAttachment() as UserPresence;
      ws.serializeAttachment({
        ...attachment,
        currentRoomCode: null,
      });
    }
    
    await this.broadcastOnlineUsers();
  }
  
  private async broadcastOnlineUsers(): Promise<void> {
    const users = await this.getOnlineUsers();
    
    this.broadcast({
      type: 'online_users',
      payload: { users },
      timestamp: Date.now(),
    });
  }
  
  // HTTP endpoint for fetching online users
  private async handleGetOnlineUsers(): Promise<Response> {
    const users = await this.getOnlineUsers();
    return Response.json({ users });
  }
}
```

### 1.6 Client: Receive Online Users

#### File: `src/lib/stores/lobby.svelte.ts`

**Add: Online users state**

```typescript
class LobbyState {
  // ... existing state ...
  
  onlineUsers = $state<OnlineUser[]>([]);
  
  private handleMessage(data: { type: string; payload: unknown; timestamp: number }) {
    switch (data.type) {
      // ... existing cases ...
      
      case 'online_users': {
        const { users } = data.payload as { users: OnlineUser[] };
        this.onlineUsers = users;
        break;
      }
      
      case 'presence': {
        // Also request full user list on presence change
        // The server will send online_users as a follow-up
        const p = data.payload as { action: string; onlineCount: number };
        this.onlineCount = p.onlineCount;
        break;
      }
    }
  }
}
```

---

## Phase 2: Room Directory

### 2.1 Problem Statement

Room updates show "UNKNOWN" as the room code, and broadcasts may not reach lobby clients (who were disconnected).

### 2.2 Solution: Fix RoomCode + Ensure Broadcast

### 2.3 Files to Modify

#### File: `packages/cloudflare-do/src/GameRoom.ts`

**Fix: Ensure roomCode is always set**

```typescript
class GameRoom extends DurableObject {
  private roomCode: string | null = null;
  
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    
    // Try to restore roomCode from storage on construction
    ctx.blockConcurrencyWhile(async () => {
      const stored = await ctx.storage.get<string>('roomCode');
      if (stored) {
        this.roomCode = stored;
      }
    });
  }
  
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    
    // Extract and persist room code if not set
    if (!this.roomCode) {
      const match = url.pathname.match(/\/room\/([A-Z0-9]{6})/i);
      if (match) {
        this.roomCode = match[1].toUpperCase();
        await this.ctx.storage.put('roomCode', this.roomCode);
      }
    }
    
    // ... rest of fetch handler
  }
  
  private getRoomCode(): string {
    if (!this.roomCode) {
      console.error('[GameRoom] roomCode not set!');
      return 'UNKNOWN';
    }
    return this.roomCode;
  }
  
  // Update notifyLobbyOfUpdate to use getRoomCode()
  private async notifyLobbyOfUpdate(): Promise<void> {
    const gameState = await this.ctx.storage.get<GameState>('gameState');
    const seats = await this.ctx.storage.get<Map<string, PlayerSeat>>('seats');
    
    const update: RoomStatusUpdate = {
      roomCode: this.getRoomCode(),  // ← Use getter
      status: this.getPhaseStatus(gameState),
      playerCount: this.getPlayerCount(seats),
      spectatorCount: this.getSpectatorCount(),
      maxPlayers: 4,
      roundNumber: gameState?.roundNumber ?? 0,
      isPublic: true,  // TODO: make configurable
      hostId: await this.getHostId(),
      players: this.getPlayerSummaries(seats, gameState),
    };
    
    console.log(`[GameRoom] Notifying lobby of update:`, update);
    
    try {
      const response = await this.lobbyStub.fetch(
        new Request('http://internal/room-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(update),
        })
      );
      
      if (!response.ok) {
        console.error(`[GameRoom] Lobby update failed: ${response.status}`);
      }
    } catch (error) {
      console.error(`[GameRoom] Lobby update error:`, error);
    }
  }
  
  private getPhaseStatus(gameState: GameState | undefined): RoomStatus {
    if (!gameState) return 'waiting';
    switch (gameState.phase) {
      case 'waiting': return 'waiting';
      case 'playing': return 'playing';
      case 'game_over': return 'finished';
      default: return 'waiting';
    }
  }
}
```

#### File: `packages/cloudflare-do/src/GlobalLobby.ts`

**Fix: Room status endpoint + reliable broadcast**

```typescript
class GlobalLobby extends DurableObject {
  private rooms = new Map<string, RoomStatusUpdate>();
  
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    
    // ... existing routes ...
    
    // Room status update from GameRoom
    if (url.pathname === '/room-status' && request.method === 'POST') {
      return this.handleRoomStatusUpdate(request);
    }
    
    // Get all rooms (HTTP endpoint)
    if (url.pathname === '/rooms' && request.method === 'GET') {
      return this.handleGetRooms(request);
    }
  }
  
  private async handleRoomStatusUpdate(request: Request): Promise<Response> {
    const update = await request.json() as RoomStatusUpdate;
    
    console.log(`[GlobalLobby] Room status update:`, {
      roomCode: update.roomCode,
      status: update.status,
      playerCount: update.playerCount,
    });
    
    // Validate roomCode
    if (!update.roomCode || update.roomCode === 'UNKNOWN') {
      console.error('[GlobalLobby] Invalid roomCode in update');
      return new Response('Invalid roomCode', { status: 400 });
    }
    
    // Update room directory
    if (update.status === 'finished') {
      // Keep finished games for 60 seconds
      this.rooms.set(update.roomCode, { ...update, updatedAt: Date.now() });
      this.ctx.storage.setAlarm(Date.now() + 60_000);
    } else if (update.status === 'closed') {
      this.rooms.delete(update.roomCode);
    } else {
      this.rooms.set(update.roomCode, { ...update, updatedAt: Date.now() });
    }
    
    // Broadcast to all connected lobby clients
    const sockets = this.ctx.getWebSockets();
    console.log(`[GlobalLobby] Broadcasting to ${sockets.length} clients`);
    
    const message = JSON.stringify({
      type: 'room_update',
      payload: {
        action: update.status === 'closed' ? 'closed' : 'updated',
        room: update,
      },
      timestamp: Date.now(),
    });
    
    let broadcastCount = 0;
    for (const ws of sockets) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(message);
        broadcastCount++;
      }
    }
    
    console.log(`[GlobalLobby] Broadcast sent to ${broadcastCount} clients`);
    
    return new Response('OK');
  }
  
  private handleGetRooms(request: Request): Response {
    const url = new URL(request.url);
    const statusFilter = url.searchParams.get('status');
    
    let rooms = Array.from(this.rooms.values());
    
    if (statusFilter) {
      rooms = rooms.filter(r => r.status === statusFilter);
    }
    
    // Sort: playing first, then waiting, then by player count
    rooms.sort((a, b) => {
      if (a.status !== b.status) {
        const order = { playing: 0, waiting: 1, finished: 2 };
        return (order[a.status] ?? 3) - (order[b.status] ?? 3);
      }
      return b.playerCount - a.playerCount;
    });
    
    return Response.json({ rooms });
  }
  
  // Clean up finished rooms
  async alarm(): Promise<void> {
    const now = Date.now();
    const staleThreshold = 60_000;
    
    for (const [code, room] of this.rooms) {
      if (room.status === 'finished' && (room.updatedAt ?? 0) + staleThreshold < now) {
        this.rooms.delete(code);
        
        // Broadcast removal
        this.broadcast({
          type: 'room_update',
          payload: { action: 'closed', code },
          timestamp: now,
        });
      }
    }
  }
}
```

### 2.4 Client: Handle Room Updates

#### File: `src/lib/stores/lobby.svelte.ts`

**Enhance: Room update handling**

```typescript
class LobbyState {
  rooms = $state<RoomInfo[]>([]);
  
  private handleMessage(data: { type: string; payload: unknown; timestamp: number }) {
    switch (data.type) {
      // ... existing cases ...
      
      case 'room_update': {
        const update = data.payload as { 
          action: 'updated' | 'closed'; 
          room?: RoomStatusUpdate; 
          code?: string;
        };
        
        if (update.action === 'closed' && update.code) {
          this.rooms = this.rooms.filter(r => r.code !== update.code);
        } else if (update.action === 'updated' && update.room) {
          const idx = this.rooms.findIndex(r => r.code === update.room!.roomCode);
          const roomInfo = this.convertToRoomInfo(update.room);
          
          if (idx >= 0) {
            this.rooms[idx] = roomInfo;
          } else {
            this.rooms = [roomInfo, ...this.rooms];
          }
          
          // Re-sort
          this.rooms = this.sortRooms(this.rooms);
        }
        break;
      }
    }
  }
  
  private convertToRoomInfo(update: RoomStatusUpdate): RoomInfo {
    return {
      code: update.roomCode,
      status: update.status,
      playerCount: update.playerCount,
      maxPlayers: update.maxPlayers,
      spectatorCount: update.spectatorCount,
      roundNumber: update.roundNumber,
      players: update.players,
      isPublic: update.isPublic,
      hostId: update.hostId,
      updatedAt: Date.now(),
    };
  }
  
  private sortRooms(rooms: RoomInfo[]): RoomInfo[] {
    return [...rooms].sort((a, b) => {
      // Playing first, then waiting
      if (a.status !== b.status) {
        const order: Record<string, number> = { playing: 0, waiting: 1, finished: 2 };
        return (order[a.status] ?? 3) - (order[b.status] ?? 3);
      }
      // Then by player count
      return b.playerCount - a.playerCount;
    });
  }
}
```

---

## Phase 3: Reconnection Protocol

### 3.1 Problem Statement

When a phone sleeps or network blips, players lose their seat permanently. No mechanism exists to rejoin.

### 3.2 Solution: Seat Reservation System

- 5-minute reconnection window
- Player seat is "reserved" on disconnect
- Reconnecting player reclaims their seat
- Game pauses (optionally) when a player disconnects mid-game
- Spectators are bumped to lobby on disconnect

### 3.3 Data Structures

#### File: `packages/cloudflare-do/src/types.ts`

**Add: Seat and reconnection types**

```typescript
export interface PlayerSeat {
  oderId: string;
  displayName: string;
  avatarUrl: string | null;
  joinedAt: number;
  
  // Connection state
  isConnected: boolean;
  disconnectedAt: number | null;
  reconnectDeadline: number | null;
  
  // Game state
  isHost: boolean;
  turnOrder: number;
}

export interface ReconnectionState {
  canReconnect: boolean;
  deadline: number | null;
  reason: 'seat_available' | 'game_over' | 'expired' | 'kicked';
}

export type ConnectionRole = 'player' | 'spectator';

export interface ConnectionAttachment {
  oderId: string;
  displayName: string;
  avatarUrl: string | null;
  role: ConnectionRole;
  connectedAt: number;
}
```

### 3.4 Server: Seat Management

#### File: `packages/cloudflare-do/src/GameRoom.ts`

**Add: Complete seat management system**

```typescript
const RECONNECT_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

class GameRoom extends DurableObject {
  // ... existing code ...
  
  // ─────────────────────────────────────────────────────────
  // Seat Management
  // ─────────────────────────────────────────────────────────
  
  private async getSeats(): Promise<Map<string, PlayerSeat>> {
    return await this.ctx.storage.get<Map<string, PlayerSeat>>('seats') 
      ?? new Map();
  }
  
  private async saveSeats(seats: Map<string, PlayerSeat>): Promise<void> {
    await this.ctx.storage.put('seats', seats);
  }
  
  private async reserveSeat(
    oderId: string, 
    displayName: string, 
    avatarUrl: string | null
  ): Promise<{ success: boolean; reason?: string }> {
    const seats = await this.getSeats();
    const gameState = await this.ctx.storage.get<GameState>('gameState');
    
    // Check if user already has a seat
    if (seats.has(userId)) {
      const seat = seats.get(userId)!;
      
      // Reconnection case
      if (!seat.isConnected) {
        seat.isConnected = true;
        seat.disconnectedAt = null;
        seat.reconnectDeadline = null;
        await this.saveSeats(seats);
        return { success: true };
      }
      
      // Already connected (maybe different tab)
      return { success: true };
    }
    
    // New player - check capacity
    const activePlayers = Array.from(seats.values())
      .filter(s => s.isConnected || (s.reconnectDeadline && s.reconnectDeadline > Date.now()));
    
    if (activePlayers.length >= 4) {
      return { success: false, reason: 'Room is full' };
    }
    
    // Check if game already started
    if (gameState && gameState.phase !== 'waiting') {
      return { success: false, reason: 'Game already in progress' };
    }
    
    // Create new seat
    const turnOrder = seats.size;
    seats.set(userId, {
      userId,
      displayName,
      avatarUrl,
      joinedAt: Date.now(),
      isConnected: true,
      disconnectedAt: null,
      reconnectDeadline: null,
      isHost: seats.size === 0,  // First player is host
      turnOrder,
    });
    
    await this.saveSeats(seats);
    return { success: true };
  }
  
  private async handleDisconnection(userId: string, role: ConnectionRole): Promise<void> {
    // Spectators: just remove, they can rejoin easily
    if (role === 'spectator') {
      console.log(`[GameRoom] Spectator ${userId} disconnected`);
      await this.notifyLobbyOfUpdate();
      return;
    }
    
    // Players: reserve their seat
    const seats = await this.getSeats();
    const seat = seats.get(userId);
    
    if (!seat) {
      console.warn(`[GameRoom] Disconnected user ${userId} has no seat`);
      return;
    }
    
    const now = Date.now();
    seat.isConnected = false;
    seat.disconnectedAt = now;
    seat.reconnectDeadline = now + RECONNECT_WINDOW_MS;
    
    await this.saveSeats(seats);
    
    // Set alarm to check for reconnection expiry
    const existingAlarm = await this.ctx.storage.getAlarm();
    if (!existingAlarm || existingAlarm > seat.reconnectDeadline) {
      await this.ctx.storage.setAlarm(seat.reconnectDeadline);
    }
    
    // Broadcast disconnection to remaining players
    this.broadcast({
      type: 'PLAYER_DISCONNECTED',
      payload: {
        oderId: seat.userId,
        displayName: seat.displayName,
        reconnectDeadline: seat.reconnectDeadline,
      },
    });
    
    // Update lobby
    await this.notifyLobbyOfUpdate();
  }
  
  private async handleReconnection(
    ws: WebSocket,
    oderId: string,
    displayName: string,
    avatarUrl: string | null
  ): Promise<boolean> {
    const seats = await this.getSeats();
    const seat = seats.get(userId);
    
    if (!seat) {
      return false;  // No seat to reconnect to
    }
    
    if (seat.isConnected) {
      // Already connected (different tab?)
      return true;
    }
    
    if (seat.reconnectDeadline && seat.reconnectDeadline < Date.now()) {
      // Too late
      return false;
    }
    
    // Reconnect!
    seat.isConnected = true;
    seat.disconnectedAt = null;
    seat.reconnectDeadline = null;
    
    // Update display name/avatar in case they changed
    seat.displayName = displayName;
    seat.avatarUrl = avatarUrl;
    
    await this.saveSeats(seats);
    
    // Broadcast reconnection
    this.broadcast({
      type: 'PLAYER_RECONNECTED',
      payload: {
        oderId: seat.userId,
        displayName: seat.displayName,
      },
    });
    
    // Send full state to reconnected player
    await this.sendFullState(ws);
    
    // Update lobby
    await this.notifyLobbyOfUpdate();
    
    return true;
  }
  
  // ─────────────────────────────────────────────────────────
  // Alarm: Handle Reconnection Expiry
  // ─────────────────────────────────────────────────────────
  
  async alarm(): Promise<void> {
    const now = Date.now();
    const seats = await this.getSeats();
    const gameState = await this.ctx.storage.get<GameState>('gameState');
    
    let seatsChanged = false;
    let nextAlarm: number | null = null;
    
    for (const [userId, seat] of seats) {
      if (!seat.isConnected && seat.reconnectDeadline) {
        if (seat.reconnectDeadline <= now) {
          // Reconnection window expired
          console.log(`[GameRoom] Seat expired for ${userId}`);
          
          // If game is waiting, remove the seat
          // If game is playing, mark as forfeited
          if (gameState?.phase === 'waiting') {
            seats.delete(userId);
            seatsChanged = true;
            
            this.broadcast({
              type: 'PLAYER_REMOVED',
              payload: {
                oderId: userId,
                displayName: seat.displayName,
                reason: 'disconnection_timeout',
              },
            });
          } else if (gameState?.phase === 'playing') {
            // Mark as forfeited but keep in game history
            seat.reconnectDeadline = null;
            seatsChanged = true;
            
            this.broadcast({
              type: 'PLAYER_FORFEITED',
              payload: {
                oderId: userId,
                displayName: seat.displayName,
                reason: 'disconnection_timeout',
              },
            });
            
            // If it was their turn, skip to next player
            if (gameState.currentTurnPlayerId === userId) {
              await this.advanceToNextPlayer();
            }
          }
        } else {
          // Still waiting - track next alarm
          if (!nextAlarm || seat.reconnectDeadline < nextAlarm) {
            nextAlarm = seat.reconnectDeadline;
          }
        }
      }
    }
    
    if (seatsChanged) {
      await this.saveSeats(seats);
      await this.notifyLobbyOfUpdate();
    }
    
    // Schedule next alarm if needed
    if (nextAlarm) {
      await this.ctx.storage.setAlarm(nextAlarm);
    }
  }
  
  // ─────────────────────────────────────────────────────────
  // WebSocket Handlers
  // ─────────────────────────────────────────────────────────
  
  async webSocketClose(ws: WebSocket, code: number, reason: string): Promise<void> {
    const attachment = ws.deserializeAttachment() as ConnectionAttachment;
    
    if (!attachment) {
      console.warn('[GameRoom] WebSocket closed without attachment');
      return;
    }
    
    console.log(`[GameRoom] WebSocket closed: ${attachment.userId} (${attachment.role}), code=${code}`);
    
    await this.handleDisconnection(attachment.userId, attachment.role);
  }
  
  // Modify connection handler to support reconnection
  private async handleWebSocketUpgrade(
    request: Request,
    url: URL
  ): Promise<Response> {
    const token = url.searchParams.get('token');
    const isRejoin = url.searchParams.get('rejoin') === 'true';
    
    if (!token) {
      return new Response('Missing token', { status: 401 });
    }
    
    const authResult = await verifySupabaseJWT(token, this.env.SUPABASE_URL);
    if (!authResult.success) {
      return new Response(authResult.error, { status: 401 });
    }
    
    const userId = authResult.claims.sub;
    const displayName = authResult.claims.user_metadata?.display_name ?? 'Player';
    const avatarUrl = authResult.claims.user_metadata?.avatar_url ?? null;
    
    // Check for reconnection
    const seats = await this.getSeats();
    const existingSeat = seats.get(userId);
    
    let role: ConnectionRole = 'player';
    
    if (existingSeat) {
      if (existingSeat.isConnected) {
        // Already connected - could be different tab
        // Allow connection but mark as same user
      } else if (existingSeat.reconnectDeadline && existingSeat.reconnectDeadline > Date.now()) {
        // Valid reconnection
        console.log(`[GameRoom] Player ${userId} reconnecting`);
      } else {
        // Seat expired - join as spectator
        role = 'spectator';
      }
    } else {
      // New connection - try to get a seat
      const reserveResult = await this.reserveSeat(userId, displayName, avatarUrl);
      if (!reserveResult.success) {
        // Room full or game started - join as spectator
        role = 'spectator';
      }
    }
    
    // Create WebSocket pair
    const { 0: clientSocket, 1: serverSocket } = new WebSocketPair();
    
    // Accept with tags
    this.ctx.acceptWebSocket(serverSocket, [
      `user:${userId}`,
      `role:${role}`,
    ]);
    
    // Attach state
    const attachment: ConnectionAttachment = {
      oderId: userId,
      displayName,
      avatarUrl,
      role,
      connectedAt: Date.now(),
    };
    serverSocket.serializeAttachment(attachment);
    
    // Handle connection in background
    this.ctx.waitUntil(this.onConnect(serverSocket, attachment, isRejoin));
    
    return new Response(null, { status: 101, webSocket: clientSocket });
  }
  
  private async onConnect(
    ws: WebSocket,
    attachment: ConnectionAttachment,
    isRejoin: boolean
  ): Promise<void> {
    if (attachment.role === 'player') {
      if (isRejoin) {
        // Reconnection - reclaim seat
        await this.handleReconnection(ws, attachment.userId, attachment.displayName, attachment.avatarUrl);
      } else {
        // New connection - seat already reserved in handleWebSocketUpgrade
        await this.sendFullState(ws);
        
        // Broadcast new player
        this.broadcast({
          type: 'PLAYER_JOINED',
          payload: {
            oderId: attachment.userId,
            displayName: attachment.displayName,
          },
        }, ws);  // Exclude the joining player
      }
    } else {
      // Spectator
      await this.sendSpectatorState(ws);
    }
    
    // Notify lobby of new join
    await this.notifyLobbyOfUpdate();
    
    // Notify GlobalLobby that this user is now in a room
    await this.notifyLobbyUserEnteredRoom(attachment.userId);
  }
  
  private async notifyLobbyUserEnteredRoom(userId: string): Promise<void> {
    await this.lobbyStub.fetch(
      new Request('http://internal/user-entered-room', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          oderId: userId,
          roomCode: this.getRoomCode(),
        }),
      })
    );
  }
}
```

### 3.5 Client: Reconnection Logic

#### File: `src/lib/stores/room.svelte.ts`

**Add: Robust reconnection handling**

```typescript
import ReconnectingWebSocket from 'reconnecting-websocket';

const RECONNECT_OPTIONS = {
  maxRetries: 10,
  minReconnectionDelay: 1000,
  maxReconnectionDelay: 30000,
  reconnectionDelayGrowFactor: 1.5,
};

class RoomStore {
  // State
  connectionState = $state<'disconnected' | 'connecting' | 'connected' | 'reconnecting'>('disconnected');
  reconnectDeadline = $state<number | null>(null);
  players = $state<PlayerInfo[]>([]);
  gameState = $state<GameState | null>(null);
  chatMessages = $state<ChatMessage[]>([]);
  currentUserId = $state<string | null>(null);
  role = $state<'player' | 'spectator'>('player');
  
  // Private
  private ws: ReconnectingWebSocket | null = null;
  private roomCode: string | null = null;
  private intentionalClose = false;
  
  async connect(roomCode: string): Promise<void> {
    this.roomCode = roomCode;
    this.intentionalClose = false;
    this.connectionState = 'connecting';
    
    const token = await this.getAuthToken();
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${protocol}//${location.host}/ws/room/${roomCode}?token=${encodeURIComponent(token)}`;
    
    this.ws = new ReconnectingWebSocket(url, [], RECONNECT_OPTIONS);
    
    this.ws.onopen = () => {
      console.log('[Room] Connected');
      this.connectionState = 'connected';
      
      // Request full state sync
      this.send({ type: 'REQUEST_SYNC' });
    };
    
    this.ws.onclose = (event) => {
      if (this.intentionalClose) {
        this.connectionState = 'disconnected';
        return;
      }
      
      console.log(`[Room] Disconnected: ${event.code}`);
      this.connectionState = 'reconnecting';
    };
    
    this.ws.onerror = (error) => {
      console.error('[Room] WebSocket error:', error);
    };
    
    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.handleMessage(data);
      } catch (e) {
        console.error('[Room] Failed to parse message:', e);
      }
    };
  }
  
  disconnect(): void {
    this.intentionalClose = true;
    this.ws?.close();
    this.ws = null;
    this.connectionState = 'disconnected';
    this.roomCode = null;
    
    // Notify lobby that user left room
    // (This happens via GlobalLobby detecting the room WS close)
  }
  
  private handleMessage(data: ServerMessage): void {
    switch (data.type) {
      case 'FULL_STATE': {
        const payload = data.payload as FullStatePayload;
        this.gameState = payload.gameState;
        this.players = payload.players;
        this.chatMessages = payload.chatHistory ?? [];
        this.currentUserId = payload.yourUserId;
        this.role = payload.yourRole;
        break;
      }
      
      case 'GAME_STATE': {
        this.gameState = data.payload as GameState;
        break;
      }
      
      case 'PLAYER_JOINED': {
        const { userId, displayName } = data.payload;
        // Add to players if not already present
        if (!this.players.find(p => p.userId === userId)) {
          this.players = [...this.players, {
            oderId: userId,
            displayName,
            isConnected: true,
            disconnectedAt: null,
            reconnectDeadline: null,
          }];
        }
        break;
      }
      
      case 'PLAYER_DISCONNECTED': {
        const { userId, reconnectDeadline } = data.payload;
        this.players = this.players.map(p => 
          p.userId === userId 
            ? { ...p, isConnected: false, reconnectDeadline }
            : p
        );
        break;
      }
      
      case 'PLAYER_RECONNECTED': {
        const { userId } = data.payload;
        this.players = this.players.map(p =>
          p.userId === userId
            ? { ...p, isConnected: true, disconnectedAt: null, reconnectDeadline: null }
            : p
        );
        break;
      }
      
      case 'PLAYER_REMOVED':
      case 'PLAYER_FORFEITED': {
        const { userId, reason } = data.payload;
        if (reason === 'disconnection_timeout') {
          this.players = this.players.filter(p => p.userId !== userId);
        }
        break;
      }
      
      case 'CHAT_MESSAGE': {
        const message = data.payload as ChatMessage;
        this.chatMessages = [...this.chatMessages, message];
        break;
      }
      
      case 'CHAT_HISTORY': {
        const { messages } = data.payload as { messages: ChatMessage[] };
        this.chatMessages = messages;
        break;
      }
    }
  }
  
  // Actions
  send(message: ClientMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }
  
  sendChat(content: string): void {
    this.send({ type: 'CHAT', payload: { message: content } });
  }
  
  rollDice(): void {
    this.send({ type: 'ROLL_DICE' });
  }
  
  keepDice(indices: number[]): void {
    this.send({ type: 'KEEP_DICE', payload: { indices } });
  }
  
  scoreCategory(category: string): void {
    this.send({ type: 'SCORE_CATEGORY', payload: { category } });
  }
  
  private async getAuthToken(): Promise<string> {
    // Get fresh token from Supabase
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ?? '';
  }
}

export const room = new RoomStore();
```

---

## Phase 4: State Persistence

### 4.1 Problem Statement

Game state and chat history are lost when DO hibernates or players reconnect.

### 4.2 Solution: Storage-First Pattern

Every state mutation writes to storage FIRST, then broadcasts. This ensures state survives hibernation.

### 4.3 Chat Persistence

#### File: `packages/cloudflare-do/src/GameRoom.ts`

**Add: Persistent chat history**

```typescript
const MAX_CHAT_HISTORY = 100;  // Keep last 100 messages

class GameRoom extends DurableObject {
  // ... existing code ...
  
  // ─────────────────────────────────────────────────────────
  // Chat Persistence
  // ─────────────────────────────────────────────────────────
  
  private async getChatHistory(): Promise<ChatMessage[]> {
    return await this.ctx.storage.get<ChatMessage[]>('chatHistory') ?? [];
  }
  
  private async saveChatMessage(message: ChatMessage): Promise<void> {
    const history = await this.getChatHistory();
    history.push(message);
    
    // Trim to max size
    while (history.length > MAX_CHAT_HISTORY) {
      history.shift();
    }
    
    await this.ctx.storage.put('chatHistory', history);
  }
  
  private async handleChat(
    ws: WebSocket,
    attachment: ConnectionAttachment,
    payload: { message: string }
  ): Promise<void> {
    const content = payload.message?.trim();
    
    if (!content || content.length > 500) {
      this.sendError(ws, 'INVALID_CHAT', 'Invalid message');
      return;
    }
    
    const chatMessage: ChatMessage = {
      id: crypto.randomUUID(),
      oderId: attachment.userId,
      displayName: attachment.displayName,
      content,
      timestamp: Date.now(),
      type: 'user',
    };
    
    // Persist FIRST
    await this.saveChatMessage(chatMessage);
    
    // Then broadcast
    this.broadcast({
      type: 'CHAT_MESSAGE',
      payload: chatMessage,
    });
  }
  
  // System messages (join/leave/etc)
  private async addSystemMessage(text: string): Promise<void> {
    const message: ChatMessage = {
      id: crypto.randomUUID(),
      oderId: 'system',
      displayName: 'System',
      content: text,
      timestamp: Date.now(),
      type: 'system',
    };
    
    await this.saveChatMessage(message);
    
    this.broadcast({
      type: 'CHAT_MESSAGE',
      payload: message,
    });
  }
  
  // Send full state including chat history
  private async sendFullState(ws: WebSocket): Promise<void> {
    const gameState = await this.ctx.storage.get<GameState>('gameState');
    const seats = await this.getSeats();
    const chatHistory = await this.getChatHistory();
    const attachment = ws.deserializeAttachment() as ConnectionAttachment;
    
    const players = Array.from(seats.values()).map(seat => ({
      oderId: seat.userId,
      displayName: seat.displayName,
      avatarUrl: seat.avatarUrl,
      isHost: seat.isHost,
      isConnected: seat.isConnected,
      disconnectedAt: seat.disconnectedAt,
      reconnectDeadline: seat.reconnectDeadline,
      turnOrder: seat.turnOrder,
    }));
    
    ws.send(JSON.stringify({
      type: 'FULL_STATE',
      payload: {
        gameState,
        players,
        chatHistory,
        yourUserId: attachment.userId,
        yourRole: attachment.role,
        roomCode: this.getRoomCode(),
      },
    }));
  }
}
```

### 4.4 Game State Persistence

#### File: `packages/cloudflare-do/src/GameRoom.ts`

**Add: Storage-first game state updates**

```typescript
class GameRoom extends DurableObject {
  // ... existing code ...
  
  // ─────────────────────────────────────────────────────────
  // Game State Management (Storage-First Pattern)
  // ─────────────────────────────────────────────────────────
  
  private async getGameState(): Promise<GameState | null> {
    return await this.ctx.storage.get<GameState>('gameState') ?? null;
  }
  
  private async updateGameState(
    mutation: (state: GameState) => GameState
  ): Promise<GameState | null> {
    const current = await this.getGameState();
    if (!current) return null;
    
    const updated = mutation(current);
    
    // Storage FIRST - this is the source of truth
    await this.ctx.storage.put('gameState', updated);
    
    // Then broadcast to all connected clients
    this.broadcast({ type: 'GAME_STATE', payload: updated });
    
    return updated;
  }
  
  private async handleRollDice(
    ws: WebSocket,
    attachment: ConnectionAttachment
  ): Promise<void> {
    const state = await this.getGameState();
    
    if (!state || state.phase !== 'playing') {
      this.sendError(ws, 'INVALID_ACTION', 'Game not in progress');
      return;
    }
    
    if (state.currentTurnPlayerId !== attachment.userId) {
      this.sendError(ws, 'NOT_YOUR_TURN', 'Not your turn');
      return;
    }
    
    if (state.rollsRemaining <= 0) {
      this.sendError(ws, 'NO_ROLLS', 'No rolls remaining');
      return;
    }
    
    // Perform roll (using your existing dice engine)
    const newDice = this.rollDice(state.dice, state.keptIndices);
    
    await this.updateGameState(s => ({
      ...s,
      dice: newDice,
      rollsRemaining: s.rollsRemaining - 1,
      keptIndices: [],
    }));
  }
  
  private async handleKeepDice(
    ws: WebSocket,
    attachment: ConnectionAttachment,
    payload: { indices: number[] }
  ): Promise<void> {
    const state = await this.getGameState();
    
    if (!state || state.currentTurnPlayerId !== attachment.userId) {
      return;
    }
    
    // Validate indices
    const validIndices = payload.indices.filter(i => i >= 0 && i < 5);
    
    await this.updateGameState(s => ({
      ...s,
      keptIndices: validIndices,
    }));
  }
  
  private async handleScoreCategory(
    ws: WebSocket,
    attachment: ConnectionAttachment,
    payload: { category: string }
  ): Promise<void> {
    const state = await this.getGameState();
    
    if (!state || state.currentTurnPlayerId !== attachment.userId) {
      return;
    }
    
    // Calculate score (using your existing scoring engine)
    const score = this.calculateScore(state.dice, payload.category);
    
    // Update player's scorecard
    const playerState = state.players.get(attachment.userId);
    if (!playerState || playerState.scorecard[payload.category] !== null) {
      this.sendError(ws, 'INVALID_CATEGORY', 'Category already used');
      return;
    }
    
    await this.updateGameState(s => {
      const players = new Map(s.players);
      const player = { ...players.get(attachment.userId)! };
      player.scorecard = { ...player.scorecard, [payload.category]: score };
      players.set(attachment.userId, player);
      
      return {
        ...s,
        players,
        // Advance to next turn
        ...this.advanceTurn(s, players),
      };
    });
    
    // Check for game end
    const updated = await this.getGameState();
    if (updated && this.isGameComplete(updated)) {
      await this.endGame();
    }
  }
  
  private advanceTurn(
    state: GameState,
    players: Map<string, PlayerState>
  ): Partial<GameState> {
    const seats = Array.from(this.ctx.storage.get<Map<string, PlayerSeat>>('seats')?.values() ?? [])
      .filter(s => s.isConnected || (s.reconnectDeadline && s.reconnectDeadline > Date.now()))
      .sort((a, b) => a.turnOrder - b.turnOrder);
    
    const currentIndex = seats.findIndex(s => s.userId === state.currentTurnPlayerId);
    const nextIndex = (currentIndex + 1) % seats.length;
    const nextPlayer = seats[nextIndex];
    
    const isNewRound = nextIndex <= currentIndex;
    
    return {
      currentTurnPlayerId: nextPlayer.userId,
      dice: [0, 0, 0, 0, 0],
      rollsRemaining: 3,
      keptIndices: [],
      roundNumber: isNewRound ? state.roundNumber + 1 : state.roundNumber,
    };
  }
}
```

---

## Message Protocol Reference

### Client → Server Messages

| Type | Payload | Description |
|------|---------|-------------|
| `REQUEST_SYNC` | none | Request full state |
| `CHAT` | `{ message: string }` | Send chat message |
| `ROLL_DICE` | none | Roll dice |
| `KEEP_DICE` | `{ indices: number[] }` | Select dice to keep |
| `SCORE_CATEGORY` | `{ category: string }` | Score in category |
| `START_GAME` | none | Host starts game |
| `LEAVE_ROOM` | none | Leave room |
| `PING` | none | Keep-alive |

### Server → Client Messages

| Type | Payload | Description |
|------|---------|-------------|
| `FULL_STATE` | `{ gameState, players, chatHistory, yourUserId, yourRole }` | Complete state |
| `GAME_STATE` | `GameState` | Updated game state |
| `PLAYER_JOINED` | `{ userId, displayName }` | New player |
| `PLAYER_DISCONNECTED` | `{ userId, displayName, reconnectDeadline }` | Player lost connection |
| `PLAYER_RECONNECTED` | `{ userId, displayName }` | Player returned |
| `PLAYER_REMOVED` | `{ userId, displayName, reason }` | Player removed |
| `PLAYER_FORFEITED` | `{ userId, displayName, reason }` | Player forfeited |
| `CHAT_MESSAGE` | `ChatMessage` | New chat message |
| `ERROR` | `{ code, message }` | Error |
| `PONG` | none | Keep-alive response |

---

## Testing Verification

### Manual Test Matrix

| # | Scenario | Steps | Expected Result |
|---|----------|-------|-----------------|
| 1 | Invite from room | Create room → Open invite section | See online users from lobby |
| 2 | Room appears in lobby | Create room | Other users see room in list |
| 3 | Room status updates | Start game | Lobby shows "playing" status |
| 4 | 30s phone sleep | Lock phone 30s → Unlock | Auto-reconnect, game continues |
| 5 | 2min phone sleep | Lock phone 2min → Unlock | Reconnect within deadline |
| 6 | 6min phone sleep | Lock phone 6min → Unlock | Seat expired, join as spectator |
| 7 | Tab close + rejoin | Close tab → Reopen URL within 5min | Rejoin as player |
| 8 | Network blip | Toggle airplane mode | Auto-reconnect |
| 9 | Chat persistence | Send chat → Disconnect → Reconnect | Chat history preserved |
| 10 | Spectator disconnect | Spectator closes tab → Reopens | Joins as spectator again |
| 11 | Mid-turn disconnect | Current player disconnects | Others see "waiting for reconnection" |
| 12 | Turn timeout | Current player doesn't reconnect in 5min | Turn skipped or forfeited |

### Automated Test Cases

```typescript
// tests/reconnection.test.ts

describe('Reconnection Protocol', () => {
  it('reserves seat on disconnect', async () => {
    const room = await createTestRoom();
    const player = await joinRoom(room.code);
    
    // Disconnect
    player.ws.close();
    
    // Verify seat reserved
    const seats = await room.getSeats();
    expect(seats.get(player.id)?.isConnected).toBe(false);
    expect(seats.get(player.id)?.reconnectDeadline).toBeGreaterThan(Date.now());
  });
  
  it('restores seat on reconnect within window', async () => {
    const room = await createTestRoom();
    const player = await joinRoom(room.code);
    
    player.ws.close();
    await wait(1000);
    
    // Reconnect
    const newWs = await reconnectToRoom(room.code, player.token);
    
    const seats = await room.getSeats();
    expect(seats.get(player.id)?.isConnected).toBe(true);
  });
  
  it('expires seat after 5 minutes', async () => {
    const room = await createTestRoom();
    const player = await joinRoom(room.code);
    
    player.ws.close();
    
    // Fast-forward time
    await advanceTime(5 * 60 * 1000 + 1000);
    await room.triggerAlarm();
    
    const seats = await room.getSeats();
    expect(seats.has(player.id)).toBe(false);
  });
  
  it('preserves chat history through reconnection', async () => {
    const room = await createTestRoom();
    const player = await joinRoom(room.code);
    
    // Send chat
    player.send({ type: 'CHAT', payload: { message: 'Hello' } });
    await wait(100);
    
    // Disconnect and reconnect
    player.ws.close();
    await wait(500);
    const newWs = await reconnectToRoom(room.code, player.token);
    
    // Verify chat history received
    const fullState = await waitForMessage(newWs, 'FULL_STATE');
    expect(fullState.chatHistory).toContainEqual(
      expect.objectContaining({ content: 'Hello' })
    );
  });
});
```

---

## Migration Checklist

### Phase 1: Connection Lifecycle

- [ ] Modify `src/routes/+layout.svelte` - add lobby.connect() on mount
- [ ] Modify `src/routes/+page.svelte` - remove lobby lifecycle management
- [ ] Modify `src/lib/stores/lobby.svelte.ts` - add idempotent connect, online users tracking
- [ ] Modify `packages/cloudflare-do/src/GlobalLobby.ts` - add online users endpoint, user status tracking
- [ ] Test: Create room, verify invite section shows online users

### Phase 2: Room Directory

- [ ] Modify `packages/cloudflare-do/src/GameRoom.ts` - fix roomCode initialization
- [ ] Modify `packages/cloudflare-do/src/GlobalLobby.ts` - fix room-status endpoint, broadcast
- [ ] Modify `src/lib/stores/lobby.svelte.ts` - enhance room_update handling
- [ ] Test: Create room, verify appears in lobby for other users

### Phase 3: Reconnection Protocol

- [ ] Add types to `packages/cloudflare-do/src/types.ts`
- [ ] Modify `packages/cloudflare-do/src/GameRoom.ts` - add seat management, reconnection handling
- [ ] Modify `src/lib/stores/room.svelte.ts` - add ReconnectingWebSocket, state handling
- [ ] Test: Phone sleep → wake → verify reconnection

### Phase 4: State Persistence

- [ ] Modify `packages/cloudflare-do/src/GameRoom.ts` - add chat persistence, storage-first game state
- [ ] Test: Send chat → disconnect → reconnect → verify history

### Final Verification

- [ ] All 12 test scenarios pass
- [ ] No console errors during normal gameplay
- [ ] Multiplayer game completes successfully with intentional disconnections
- [ ] Lobby shows correct room status throughout game lifecycle

---

## Appendix: Type Definitions

```typescript
// packages/cloudflare-do/src/types.ts

export interface PlayerSeat {
  oderId: string;
  displayName: string;
  avatarUrl: string | null;
  joinedAt: number;
  isConnected: boolean;
  disconnectedAt: number | null;
  reconnectDeadline: number | null;
  isHost: boolean;
  turnOrder: number;
}

export interface OnlineUser {
  oderId: string;
  displayName: string;
  avatarUrl: string | null;
  status: 'available' | 'in_room' | 'in_game';
  currentRoomCode: string | null;
}

export interface RoomStatusUpdate {
  roomCode: string;
  status: 'waiting' | 'playing' | 'finished' | 'closed';
  playerCount: number;
  spectatorCount: number;
  maxPlayers: number;
  roundNumber: number;
  isPublic: boolean;
  hostId: string;
  players: PlayerSummary[];
  updatedAt?: number;
}

export interface PlayerSummary {
  oderId: string;
  displayName: string;
  score: number;
  isConnected: boolean;
}

export interface ChatMessage {
  id: string;
  oderId: string;
  displayName: string;
  content: string;
  timestamp: number;
  type: 'user' | 'system' | 'quick';
}

export interface ConnectionAttachment {
  oderId: string;
  displayName: string;
  avatarUrl: string | null;
  role: 'player' | 'spectator';
  connectedAt: number;
}

export interface FullStatePayload {
  gameState: GameState | null;
  players: PlayerInfo[];
  chatHistory: ChatMessage[];
  yourUserId: string;
  yourRole: 'player' | 'spectator';
  roomCode: string;
}
```

---

*End of Specification*
