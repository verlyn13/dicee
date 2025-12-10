# Dicee: PartyKit → Durable Objects Migration Guide

**Document Version:** 1.0  
**Date:** December 7, 2025  
**Target Audience:** Senior developers familiar with TypeScript, Cloudflare Workers, and the Dicee codebase  
**Estimated Effort:** 2-3 days

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Architecture Overview](#2-architecture-overview)
3. [Prerequisites](#3-prerequisites)
4. [Phase 1: Project Scaffold](#4-phase-1-project-scaffold)
5. [Phase 2: Core Durable Object Implementation](#5-phase-2-core-durable-object-implementation)
6. [Phase 3: Hibernatable WebSockets](#6-phase-3-hibernatable-websockets)
7. [Phase 4: Game State Migration](#7-phase-4-game-state-migration)
8. [Phase 5: Authentication Flow](#8-phase-5-authentication-flow)
9. [Phase 6: Client Migration](#9-phase-6-client-migration)
10. [Phase 7: Testing Strategy](#10-phase-7-testing-strategy)
11. [Phase 8: Deployment](#11-phase-8-deployment)
12. [Rollback Plan](#12-rollback-plan)
13. [Post-Migration Checklist](#13-post-migration-checklist)

---

## 1. Executive Summary

### Why Migrate?

| Factor | PartyKit | Raw Durable Objects |
|--------|----------|---------------------|
| **Cost** | Billed for entire connection duration | Hibernation: billed only when processing |
| **Control** | Abstraction layer | Direct primitive access |
| **Future** | Abandoned `partykit/partykit` repo | Core Cloudflare infrastructure |
| **SQLite** | Not available | Free, built-in, better than KV for game state |
| **Dependency Risk** | Single maintainer | Cloudflare-supported |

### Migration Scope

```
Current:                          Target:
packages/partykit/               packages/cloudflare-do/
├── server.ts (Party.Server)  →  ├── src/GameRoom.ts (DurableObject)
├── auth.ts                   →  │   └── auth integrated in fetch()
├── game/*.ts                 →  ├── src/game/*.ts (unchanged logic)
└── partykit.json             →  └── wrangler.toml

packages/web/
└── roomService.svelte.ts     →  ReconnectingWebSocket + same interface
```

### What Changes, What Doesn't

| Component | Changes | Stays Same |
|-----------|---------|------------|
| Game logic (handlers, machine, scoring) | Import paths only | All business logic |
| Storage API | `room.storage` → `this.ctx.storage` | Identical methods |
| Alarms | `room.storage.setAlarm` → `this.ctx.storage.setAlarm` | Identical API |
| Broadcast | `room.broadcast()` → helper function | Same behavior |
| WebSocket lifecycle | `onConnect/onMessage` → `webSocketMessage` | Same patterns |
| Client connection | PartySocket → ReconnectingWebSocket | Same URL structure |

---

## 2. Architecture Overview

### Current PartyKit Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      PartyKit Platform                       │
│  ┌─────────────────────────────────────────────────────────┐│
│  │                    Party.Server                          ││
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ││
│  │  │onBeforeConnect│  │  onConnect   │  │  onMessage   │  ││
│  │  └──────────────┘  └──────────────┘  └──────────────┘  ││
│  │         │                  │                 │          ││
│  │         ▼                  ▼                 ▼          ││
│  │  ┌──────────────────────────────────────────────────┐  ││
│  │  │                   Party.Room                      │  ││
│  │  │  • storage.get/put/delete                         │  ││
│  │  │  • storage.setAlarm/deleteAlarm                   │  ││
│  │  │  • broadcast(msg, [exclude])                      │  ││
│  │  │  • connections (Map)                              │  ││
│  │  └──────────────────────────────────────────────────┘  ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    PartySocket Client                        │
│  • Auto-reconnection      • Message buffering                │
│  • Query params (token)   • Room/party routing               │
└─────────────────────────────────────────────────────────────┘
```

### Target Durable Objects Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   Cloudflare Workers                         │
│  ┌─────────────────────────────────────────────────────────┐│
│  │                    Worker (Entry)                        ││
│  │  export default { fetch(req, env) }                      ││
│  │         │                                                ││
│  │         ▼  Route: /room/:roomCode                        ││
│  │  ┌──────────────────────────────────────────────────┐   ││
│  │  │            env.GAME_ROOM.get(id)                  │   ││
│  │  └──────────────────────────────────────────────────┘   ││
│  └─────────────────────────────────────────────────────────┘│
│                              │                               │
│                              ▼                               │
│  ┌─────────────────────────────────────────────────────────┐│
│  │              GameRoom (DurableObject)                    ││
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ││
│  │  │   fetch()    │  │webSocketMsg()│  │   alarm()    │  ││
│  │  │ (auth + WS)  │  │ (hibernation)│  │ (unchanged)  │  ││
│  │  └──────────────┘  └──────────────┘  └──────────────┘  ││
│  │         │                  │                 │          ││
│  │         ▼                  ▼                 ▼          ││
│  │  ┌──────────────────────────────────────────────────┐  ││
│  │  │              DurableObjectState (ctx)             │  ││
│  │  │  • storage.get/put/delete (identical)             │  ││
│  │  │  • storage.setAlarm (identical)                   │  ││
│  │  │  • acceptWebSocket(ws, tags) ← HIBERNATION        │  ││
│  │  │  • getWebSockets(tag?) ← replaces connections     │  ││
│  │  └──────────────────────────────────────────────────┘  ││
│  │                                                         ││
│  │  ┌──────────────────────────────────────────────────┐  ││
│  │  │              SQLite Storage (Optional)            │  ││
│  │  │  • ctx.storage.sql.exec() ← better than KV        │  ││
│  │  └──────────────────────────────────────────────────┘  ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│               ReconnectingWebSocket Client                   │
│  • Auto-reconnection      • Same API as WebSocket            │
│  • Configurable backoff   • Drop-in replacement              │
└─────────────────────────────────────────────────────────────┘
```

### Hibernation: The Key Benefit

```
Without Hibernation (PartyKit):
┌────────────────────────────────────────────────────────────┐
│  Connection Open                                            │
│  ████████████████████████████████████████████████████████  │
│  ↑ Billed for entire duration (300s = 300 GB-seconds)      │
│    Message│    Idle    │Message│      Idle        │Message │
└────────────────────────────────────────────────────────────┘

With Hibernation (Durable Objects):
┌────────────────────────────────────────────────────────────┐
│  Connection Open (WebSocket maintained by Cloudflare)       │
│  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  │
│  ████       ░░░░░░░░░░  ████      ░░░░░░░░░░░░░░░░░  ████  │
│  ↑ Billed   ↑ Hibernated ↑ Billed  ↑ Hibernated      ↑     │
│  (0.1s)     (FREE)       (0.1s)    (FREE)            (0.1s)│
│                                                             │
│  Total: ~0.3 GB-seconds instead of 300 = 99.9% savings     │
└────────────────────────────────────────────────────────────┘
```

---

## 3. Prerequisites

### Environment Requirements

```bash
# Verify CLI versions
wrangler --version  # Should be 4.51.0+
node --version      # 24+ via mise

# Cloudflare account setup
wrangler login      # Opens browser for OAuth
wrangler whoami     # Verify account access
```

### Required Cloudflare Configuration

1. **Account ID**: Found in Cloudflare Dashboard → Workers & Pages → Overview (right sidebar)
2. **API Token**: Create at dash.cloudflare.com/profile/api-tokens
   - Use template: "Edit Cloudflare Workers"
   - Permissions needed: Workers Scripts (Edit), Durable Objects (Edit)

### Project Dependencies to Add

```bash
# In packages/cloudflare-do/
pnpm add -D wrangler @cloudflare/workers-types

# In packages/web/
pnpm add reconnecting-websocket
```

---

## 4. Phase 1: Project Scaffold

### 4.1 Create Package Structure

```bash
mkdir -p packages/cloudflare-do/src/game
```

### 4.2 Package Configuration

**`packages/cloudflare-do/package.json`**
```json
{
  "name": "@dicee/cloudflare-do",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "wrangler dev",
    "deploy": "wrangler deploy",
    "tail": "wrangler tail",
    "types": "wrangler types"
  },
  "devDependencies": {
    "@cloudflare/workers-types": "^4.20241205.0",
    "wrangler": "^4.51.0"
  },
  "dependencies": {
    "jose": "^5.9.6",
    "zod": "^3.24.1"
  }
}
```

**`packages/cloudflare-do/tsconfig.json`**
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022"],
    "types": ["@cloudflare/workers-types"],
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "allowSyntheticDefaultImports": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules"]
}
```

### 4.3 Wrangler Configuration

**`packages/cloudflare-do/wrangler.toml`**
```toml
name = "gamelobby"
main = "src/worker.ts"
compatibility_date = "2024-12-01"

# Enable Node.js compatibility for jose JWT library
compatibility_flags = ["nodejs_compat"]

# Durable Object bindings
[[durable_objects.bindings]]
name = "GAME_ROOM"
class_name = "GameRoom"

# SQLite-backed storage (better than KV for game state)
[[migrations]]
tag = "v1"
new_sqlite_classes = ["GameRoom"]

# Environment variables (set via wrangler secret or dashboard)
[vars]
# Non-sensitive vars can go here

# For production, use: wrangler secret put SUPABASE_URL
# wrangler secret put SUPABASE_ANON_KEY

# Development overrides
[env.dev]
vars = { ENVIRONMENT = "development" }

[env.production]
vars = { ENVIRONMENT = "production" }
```

### 4.4 Type Definitions

**`packages/cloudflare-do/src/types.ts`**
```typescript
// Environment bindings
export interface Env {
  GAME_ROOM: DurableObjectNamespace;
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  ENVIRONMENT: 'development' | 'production';
}

// Connection state (survives hibernation via serializeAttachment)
export interface ConnectionState {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  connectedAt: number;
  isHost: boolean;
}

// Room state (persisted to storage)
export interface RoomState {
  roomCode: string;
  hostUserId: string;
  createdAt: number;
  settings: RoomSettings;
  playerOrder: string[];  // User IDs in turn order
}

export interface RoomSettings {
  maxPlayers: number;
  turnTimeLimit: number;  // seconds, 0 = unlimited
  spectatorMode: boolean;
}

// Re-export game types (copy from packages/partykit/src/game/types.ts)
export * from './game/types';
```

---

## 5. Phase 2: Core Durable Object Implementation

### 5.1 Worker Entry Point

**`packages/cloudflare-do/src/worker.ts`**
```typescript
import { GameRoom } from './GameRoom';
import type { Env } from './types';

export { GameRoom };

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    
    // Health check endpoint
    if (url.pathname === '/health') {
      return new Response('OK', { status: 200 });
    }

    // Room routing: /room/:roomCode
    const roomMatch = url.pathname.match(/^\/room\/([A-Z0-9]{6})$/i);
    if (!roomMatch) {
      return new Response('Not Found', { status: 404 });
    }

    const roomCode = roomMatch[1].toUpperCase();
    
    // Get or create Durable Object instance by room code
    // idFromName creates deterministic ID - same code = same instance
    const id = env.GAME_ROOM.idFromName(roomCode);
    const stub = env.GAME_ROOM.get(id);

    // Forward request to Durable Object
    return stub.fetch(request);
  },
};
```

### 5.2 Base Durable Object Structure

**`packages/cloudflare-do/src/GameRoom.ts`**
```typescript
import { DurableObject } from 'cloudflare:workers';
import type { Env, ConnectionState, RoomState } from './types';
import { verifySupabaseJWT } from './auth';
import { GameStateManager } from './game/state';
import { handleCommand } from './game/handlers';

export class GameRoom extends DurableObject<Env> {
  private gameManager: GameStateManager;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.gameManager = new GameStateManager(ctx);
  }

  // ─────────────────────────────────────────────────────────
  // HTTP/WebSocket Entry Point
  // ─────────────────────────────────────────────────────────
  
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // WebSocket upgrade request
    if (request.headers.get('Upgrade') === 'websocket') {
      return this.handleWebSocketUpgrade(request, url);
    }

    // HTTP endpoints (room info, etc.)
    if (request.method === 'GET' && url.pathname.endsWith('/info')) {
      return this.handleRoomInfo();
    }

    return new Response('Method Not Allowed', { status: 405 });
  }

  // ─────────────────────────────────────────────────────────
  // WebSocket Upgrade with Authentication
  // ─────────────────────────────────────────────────────────

  private async handleWebSocketUpgrade(
    request: Request, 
    url: URL
  ): Promise<Response> {
    // Extract JWT from query params
    const token = url.searchParams.get('token');
    if (!token) {
      return new Response('Missing token', { status: 401 });
    }

    // Verify JWT against Supabase JWKS
    const authResult = await verifySupabaseJWT(token, this.env.SUPABASE_URL);
    if (!authResult.success) {
      return new Response(authResult.error, { status: 401 });
    }

    // Create WebSocket pair
    const { 0: clientSocket, 1: serverSocket } = new WebSocketPair();

    // Accept with hibernation enabled
    // Tags allow filtering connections later: getWebSockets('user:abc123')
    const userId = authResult.claims.sub;
    this.ctx.acceptWebSocket(serverSocket, [
      `user:${userId}`,
      `room:${this.getRoomCode()}`,
    ]);

    // Attach state that survives hibernation
    const connectionState: ConnectionState = {
      userId,
      displayName: authResult.claims.user_metadata?.display_name ?? 'Player',
      avatarUrl: authResult.claims.user_metadata?.avatar_url ?? null,
      connectedAt: Date.now(),
      isHost: false, // Set after checking room state
    };
    serverSocket.serializeAttachment(connectionState);

    // Handle connection in background (don't block response)
    this.ctx.waitUntil(this.onConnect(serverSocket, connectionState));

    // Return 101 Switching Protocols
    return new Response(null, { status: 101, webSocket: clientSocket });
  }

  // ─────────────────────────────────────────────────────────
  // Hibernatable WebSocket Handlers
  // ─────────────────────────────────────────────────────────

  /**
   * Called when WebSocket receives a message.
   * If DO was hibernated, it wakes up, deserializes state, handles message.
   */
  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    if (typeof message !== 'string') {
      ws.close(1003, 'Binary messages not supported');
      return;
    }

    // Recover connection state after potential hibernation
    const connState = ws.deserializeAttachment() as ConnectionState;
    
    try {
      const parsed = JSON.parse(message);
      await this.handleMessage(ws, connState, parsed);
    } catch (err) {
      this.sendError(ws, 'INVALID_MESSAGE', 'Failed to parse message');
    }
  }

  /**
   * Called when WebSocket closes (client disconnect or error).
   */
  async webSocketClose(
    ws: WebSocket, 
    code: number, 
    reason: string, 
    wasClean: boolean
  ): Promise<void> {
    const connState = ws.deserializeAttachment() as ConnectionState;
    await this.onDisconnect(connState, code, reason);
  }

  /**
   * Called on WebSocket error.
   */
  async webSocketError(ws: WebSocket, error: unknown): Promise<void> {
    const connState = ws.deserializeAttachment() as ConnectionState;
    console.error(`WebSocket error for ${connState.userId}:`, error);
    await this.onDisconnect(connState, 1011, 'Internal error');
  }

  // ─────────────────────────────────────────────────────────
  // Alarm Handler (unchanged from PartyKit)
  // ─────────────────────────────────────────────────────────

  async alarm(): Promise<void> {
    await this.gameManager.handleAlarm();
    
    // Broadcast updated state to all connections
    const state = await this.gameManager.getGameState();
    if (state) {
      this.broadcast({ type: 'GAME_STATE', payload: state });
    }
  }

  // ─────────────────────────────────────────────────────────
  // Helper Methods
  // ─────────────────────────────────────────────────────────

  private getRoomCode(): string {
    // Extract from DO ID (set via idFromName in worker)
    return this.ctx.id.name ?? 'UNKNOWN';
  }

  /**
   * Broadcast message to all connected WebSockets.
   * Replaces: this.room.broadcast(message, [excludeId])
   */
  private broadcast(
    message: object, 
    exclude?: WebSocket
  ): void {
    const payload = JSON.stringify(message);
    for (const ws of this.ctx.getWebSockets()) {
      if (ws !== exclude && ws.readyState === WebSocket.OPEN) {
        ws.send(payload);
      }
    }
  }

  /**
   * Send to specific user by ID.
   */
  private sendToUser(userId: string, message: object): void {
    const payload = JSON.stringify(message);
    // Use tags to find user's connection(s)
    for (const ws of this.ctx.getWebSockets(`user:${userId}`)) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(payload);
      }
    }
  }

  /**
   * Send error response.
   */
  private sendError(ws: WebSocket, code: string, message: string): void {
    ws.send(JSON.stringify({ type: 'ERROR', payload: { code, message } }));
  }

  /**
   * Get all connected user IDs.
   */
  private getConnectedUserIds(): string[] {
    const userIds = new Set<string>();
    for (const ws of this.ctx.getWebSockets()) {
      const state = ws.deserializeAttachment() as ConnectionState;
      userIds.add(state.userId);
    }
    return Array.from(userIds);
  }

  // ─────────────────────────────────────────────────────────
  // Connection Lifecycle (mirrors PartyKit patterns)
  // ─────────────────────────────────────────────────────────

  private async onConnect(
    ws: WebSocket, 
    connState: ConnectionState
  ): Promise<void> {
    // Load or initialize room state
    let roomState = await this.ctx.storage.get<RoomState>('room');
    
    if (!roomState) {
      // First connection creates the room
      roomState = {
        roomCode: this.getRoomCode(),
        hostUserId: connState.userId,
        createdAt: Date.now(),
        settings: {
          maxPlayers: 4,
          turnTimeLimit: 0,
          spectatorMode: false,
        },
        playerOrder: [connState.userId],
      };
      await this.ctx.storage.put('room', roomState);
      
      // Update connection state to mark as host
      connState.isHost = true;
      ws.serializeAttachment(connState);
    } else {
      // Check if rejoining
      connState.isHost = connState.userId === roomState.hostUserId;
      ws.serializeAttachment(connState);
    }

    // Send initial state to new connection
    ws.send(JSON.stringify({
      type: 'CONNECTED',
      payload: {
        roomCode: roomState.roomCode,
        isHost: connState.isHost,
        players: await this.getPlayerList(),
        gameState: await this.gameManager.getGameState(),
      },
    }));

    // Notify others
    this.broadcast(
      {
        type: 'PLAYER_JOINED',
        payload: {
          userId: connState.userId,
          displayName: connState.displayName,
          avatarUrl: connState.avatarUrl,
        },
      },
      ws
    );
  }

  private async handleMessage(
    ws: WebSocket,
    connState: ConnectionState,
    message: { type: string; payload?: unknown }
  ): Promise<void> {
    const { type, payload } = message;

    // Route to appropriate handler
    switch (type) {
      case 'START_GAME':
        await this.handleStartGame(ws, connState);
        break;
      
      case 'GAME_COMMAND':
        await this.handleGameCommand(ws, connState, payload);
        break;
      
      case 'CHAT':
        this.handleChat(ws, connState, payload);
        break;
      
      case 'PING':
        ws.send(JSON.stringify({ type: 'PONG', payload: Date.now() }));
        break;
      
      default:
        this.sendError(ws, 'UNKNOWN_COMMAND', `Unknown message type: ${type}`);
    }
  }

  private async onDisconnect(
    connState: ConnectionState,
    code: number,
    reason: string
  ): Promise<void> {
    // Notify other players
    this.broadcast({
      type: 'PLAYER_LEFT',
      payload: {
        userId: connState.userId,
        displayName: connState.displayName,
        reason: code === 1000 ? 'left' : 'disconnected',
      },
    });

    // Handle game implications (AFK, turn skip, etc.)
    await this.gameManager.handlePlayerDisconnect(connState.userId);
  }

  // ─────────────────────────────────────────────────────────
  // Game Logic Handlers (delegate to existing game modules)
  // ─────────────────────────────────────────────────────────

  private async handleStartGame(
    ws: WebSocket, 
    connState: ConnectionState
  ): Promise<void> {
    if (!connState.isHost) {
      this.sendError(ws, 'NOT_HOST', 'Only the host can start the game');
      return;
    }

    const playerIds = this.getConnectedUserIds();
    if (playerIds.length < 2) {
      this.sendError(ws, 'NOT_ENOUGH_PLAYERS', 'Need at least 2 players');
      return;
    }

    await this.gameManager.initializeGame(playerIds);
    const gameState = await this.gameManager.getGameState();

    this.broadcast({ type: 'GAME_STARTED', payload: gameState });
  }

  private async handleGameCommand(
    ws: WebSocket,
    connState: ConnectionState,
    payload: unknown
  ): Promise<void> {
    const result = await handleCommand(
      this.gameManager,
      connState.userId,
      payload as Record<string, unknown>
    );

    if (!result.success) {
      this.sendError(ws, result.errorCode!, result.errorMessage!);
      return;
    }

    // Broadcast state update
    this.broadcast({
      type: 'GAME_STATE',
      payload: result.gameState,
    });
  }

  private handleChat(
    ws: WebSocket,
    connState: ConnectionState,
    payload: unknown
  ): void {
    const { message } = payload as { message: string };
    
    if (!message || typeof message !== 'string' || message.length > 500) {
      this.sendError(ws, 'INVALID_CHAT', 'Invalid chat message');
      return;
    }

    this.broadcast({
      type: 'CHAT',
      payload: {
        userId: connState.userId,
        displayName: connState.displayName,
        message: message.trim(),
        timestamp: Date.now(),
      },
    });
  }

  private async getPlayerList(): Promise<Array<{
    userId: string;
    displayName: string;
    avatarUrl: string | null;
    isHost: boolean;
    isConnected: boolean;
  }>> {
    const roomState = await this.ctx.storage.get<RoomState>('room');
    const connectedIds = new Set(this.getConnectedUserIds());
    
    const players: Array<{
      userId: string;
      displayName: string;
      avatarUrl: string | null;
      isHost: boolean;
      isConnected: boolean;
    }> = [];

    for (const ws of this.ctx.getWebSockets()) {
      const state = ws.deserializeAttachment() as ConnectionState;
      players.push({
        userId: state.userId,
        displayName: state.displayName,
        avatarUrl: state.avatarUrl,
        isHost: state.userId === roomState?.hostUserId,
        isConnected: true,
      });
    }

    return players;
  }

  private async handleRoomInfo(): Promise<Response> {
    const roomState = await this.ctx.storage.get<RoomState>('room');
    if (!roomState) {
      return new Response('Room not found', { status: 404 });
    }

    return Response.json({
      roomCode: roomState.roomCode,
      playerCount: this.getConnectedUserIds().length,
      maxPlayers: roomState.settings.maxPlayers,
      createdAt: roomState.createdAt,
    });
  }
}
```

---

## 6. Phase 3: Hibernatable WebSockets

### 6.1 Understanding Hibernation

Hibernation allows the Durable Object to be evicted from memory while WebSocket connections remain open at the Cloudflare edge. When a message arrives, the DO wakes up, handles it, and can hibernate again.

**Key Constraints:**

1. **No in-memory state between messages** — use `ctx.storage` or `ws.serializeAttachment()`
2. **Attachment size limit** — ~2KB per WebSocket (use storage for larger state)
3. **Cold start on wake** — constructor runs, but `ctx.storage` is warm
4. **Auto-response for ping/pong** — can handle without waking DO

### 6.2 Connection State Management

```typescript
// In GameRoom.ts

/**
 * Auto-respond to ping without waking the DO.
 * Call this in constructor for efficiency.
 */
private setupAutoResponse(): void {
  // Automatically respond to 'ping' with 'pong' without waking DO
  this.ctx.setWebSocketAutoResponse(
    new WebSocketRequestResponsePair('ping', 'pong')
  );
}

/**
 * Set timeout for event handlers.
 * Default is 0 (handlers must complete in single I/O round).
 * Max is 7 days for long-running games.
 */
private setupEventTimeout(): void {
  // Allow 30 seconds for complex operations
  this.ctx.setHibernatableWebSocketEventTimeout(30_000);
}
```

### 6.3 Tag-Based Connection Filtering

```typescript
// Accept with multiple tags for flexible querying
this.ctx.acceptWebSocket(serverSocket, [
  `user:${userId}`,           // Filter by user
  `room:${roomCode}`,         // Filter by room (if multi-room DO)
  `role:${isHost ? 'host' : 'player'}`,  // Filter by role
]);

// Later, broadcast to specific subset
private broadcastToHost(message: object): void {
  const payload = JSON.stringify(message);
  for (const ws of this.ctx.getWebSockets('role:host')) {
    ws.send(payload);
  }
}

// Get tags for a connection (useful for debugging)
private logConnectionInfo(ws: WebSocket): void {
  const tags = this.ctx.getTags(ws);
  console.log('Connection tags:', tags);
}
```

---

## 7. Phase 4: Game State Migration

### 7.1 Storage API Mapping

The storage API is nearly identical. Main changes:

| PartyKit | Durable Objects | Notes |
|----------|-----------------|-------|
| `this.room.storage.get<T>(key)` | `this.ctx.storage.get<T>(key)` | Same signature |
| `this.room.storage.put(key, val)` | `this.ctx.storage.put(key, val)` | Same signature |
| `this.room.storage.delete(key)` | `this.ctx.storage.delete(key)` | Same signature |
| `this.room.storage.list()` | `this.ctx.storage.list()` | Same signature |
| `this.room.storage.setAlarm(time)` | `this.ctx.storage.setAlarm(time)` | Same signature |
| `this.room.storage.getAlarm()` | `this.ctx.storage.getAlarm()` | Same signature |
| `this.room.storage.deleteAlarm()` | `this.ctx.storage.deleteAlarm()` | Same signature |

### 7.2 Migrate GameStateManager

**`packages/cloudflare-do/src/game/state.ts`**
```typescript
// Changes from partykit version:
// 1. Constructor takes DurableObjectState instead of Party.Room
// 2. this.room.storage → this.ctx.storage
// 3. Everything else stays the same

import type { GameState, PlayerGameState } from './types';

export class GameStateManager {
  constructor(private ctx: DurableObjectState) {}

  async getGameState(): Promise<GameState | null> {
    return this.ctx.storage.get<GameState>('game');
  }

  async saveGameState(state: GameState): Promise<void> {
    await this.ctx.storage.put('game', state);
  }

  async initializeGame(playerIds: string[]): Promise<GameState> {
    const state: GameState = {
      phase: 'ROLLING',
      currentPlayerIndex: 0,
      players: playerIds.map((id, index) => ({
        id,
        turnOrder: index,
        scorecard: this.createEmptyScorecard(),
        rollsRemaining: 3,
        currentDice: [1, 1, 1, 1, 1],
        heldDice: [],
      })),
      round: 1,
      totalRounds: 13,
    };
    
    await this.saveGameState(state);
    return state;
  }

  async handleAlarm(): Promise<void> {
    const alarmData = await this.ctx.storage.get<{
      type: string;
      userId?: string;
    }>('alarm_data');
    
    if (!alarmData) return;

    switch (alarmData.type) {
      case 'TURN_TIMEOUT':
        await this.handleTurnTimeout(alarmData.userId!);
        break;
      case 'AFK_CHECK':
        await this.handleAfkCheck(alarmData.userId!);
        break;
    }

    await this.ctx.storage.delete('alarm_data');
  }

  async setTurnTimer(userId: string, seconds: number): Promise<void> {
    const alarmTime = Date.now() + seconds * 1000;
    await this.ctx.storage.put('alarm_data', { 
      type: 'TURN_TIMEOUT', 
      userId 
    });
    await this.ctx.storage.setAlarm(alarmTime);
  }

  async handlePlayerDisconnect(userId: string): Promise<void> {
    // Set AFK timer (e.g., 60 seconds to reconnect)
    const alarmTime = Date.now() + 60_000;
    await this.ctx.storage.put('alarm_data', { 
      type: 'AFK_CHECK', 
      userId 
    });
    await this.ctx.storage.setAlarm(alarmTime);
  }

  // ... rest of game logic unchanged
  private createEmptyScorecard() { /* ... */ }
  private async handleTurnTimeout(userId: string) { /* ... */ }
  private async handleAfkCheck(userId: string) { /* ... */ }
}
```

### 7.3 Copy Unchanged Modules

These files can be copied directly with only import path changes:

```bash
# From packages/partykit/src/game/ to packages/cloudflare-do/src/game/
cp handlers.ts   # Command handlers
cp machine.ts    # State machine
cp scoring.ts    # Dicee rules
cp schemas.ts    # Zod schemas
cp types.ts      # Type definitions
```

---

## 8. Phase 5: Authentication Flow

### 8.1 JWT Verification Module

**`packages/cloudflare-do/src/auth.ts`**
```typescript
import * as jose from 'jose';

interface JWTClaims {
  sub: string;
  email?: string;
  user_metadata?: {
    display_name?: string;
    avatar_url?: string;
  };
  exp: number;
  iat: number;
}

interface AuthResult {
  success: true;
  claims: JWTClaims;
} | {
  success: false;
  error: string;
}

// Cache JWKS for performance (module-level, persists across requests)
let jwksCache: jose.JWTVerifyGetKey | null = null;
let jwksCacheUrl: string | null = null;

export async function verifySupabaseJWT(
  token: string,
  supabaseUrl: string
): Promise<AuthResult> {
  try {
    // Get JWKS (cached)
    const jwksUrl = `${supabaseUrl}/auth/v1/.well-known/jwks.json`;
    
    if (!jwksCache || jwksCacheUrl !== jwksUrl) {
      jwksCache = jose.createRemoteJWKSet(new URL(jwksUrl));
      jwksCacheUrl = jwksUrl;
    }

    const { payload } = await jose.jwtVerify(token, jwksCache, {
      issuer: `${supabaseUrl}/auth/v1`,
      audience: 'authenticated',
    });

    return {
      success: true,
      claims: payload as unknown as JWTClaims,
    };
  } catch (error) {
    if (error instanceof jose.errors.JWTExpired) {
      return { success: false, error: 'Token expired' };
    }
    if (error instanceof jose.errors.JWTClaimValidationFailed) {
      return { success: false, error: 'Invalid token claims' };
    }
    console.error('JWT verification failed:', error);
    return { success: false, error: 'Authentication failed' };
  }
}
```

### 8.2 Auth Flow Comparison

```
PartyKit:
┌─────────────────────────────────────────────────────────────┐
│ 1. Client connects with ?token=xxx                          │
│ 2. PartyKit calls onBeforeConnect(req, lobby)               │
│ 3. Verify JWT, return 401 or modify request                 │
│ 4. PartyKit calls onConnect(conn, ctx)                      │
│ 5. Access verified claims from ctx                          │
└─────────────────────────────────────────────────────────────┘

Durable Objects:
┌─────────────────────────────────────────────────────────────┐
│ 1. Client connects with ?token=xxx                          │
│ 2. Worker routes to DO.fetch(request)                       │
│ 3. In fetch(): check Upgrade header, verify JWT             │
│ 4. If valid: create WebSocketPair, acceptWebSocket()        │
│ 5. Attach claims via ws.serializeAttachment()               │
│ 6. Return Response with status: 101                         │
└─────────────────────────────────────────────────────────────┘
```

---

## 9. Phase 6: Client Migration

### 9.1 Replace PartySocket

**Current (`packages/web/src/lib/services/roomService.svelte.ts`):**
```typescript
import { PartySocket } from 'partysocket';

this.socket = new PartySocket({
  host: PARTYKIT_HOST,
  room: roomCode,
  query: { token: accessToken }
});
```

**New:**
```typescript
import ReconnectingWebSocket from 'reconnecting-websocket';

const wsUrl = `wss://${WORKER_HOST}/room/${roomCode}?token=${encodeURIComponent(accessToken)}`;

this.socket = new ReconnectingWebSocket(wsUrl, [], {
  maxRetries: 10,
  reconnectionDelayGrowFactor: 1.5,
  maxReconnectionDelay: 30000,
  minReconnectionDelay: 1000,
});
```

### 9.2 Full Client Migration

**`packages/web/src/lib/services/roomService.svelte.ts`**
```typescript
import ReconnectingWebSocket from 'reconnecting-websocket';
import type { 
  ServerMessage, 
  ClientMessage, 
  ConnectionStatus 
} from '$lib/types/multiplayer';

const WORKER_HOST = import.meta.env.PUBLIC_WORKER_HOST ?? 'gamelobby.your-subdomain.workers.dev';

class RoomService {
  private socket: ReconnectingWebSocket | null = null;
  private messageHandlers = new Map<string, Set<(payload: unknown) => void>>();
  
  // Svelte 5 runes for reactive state
  status = $state<ConnectionStatus>('disconnected');
  error = $state<string | null>(null);
  
  async connect(roomCode: string, accessToken: string): Promise<void> {
    if (this.socket) {
      this.disconnect();
    }

    this.status = 'connecting';
    this.error = null;

    const wsUrl = `wss://${WORKER_HOST}/room/${roomCode}?token=${encodeURIComponent(accessToken)}`;

    this.socket = new ReconnectingWebSocket(wsUrl, [], {
      maxRetries: 10,
      reconnectionDelayGrowFactor: 1.5,
      maxReconnectionDelay: 30000,
      minReconnectionDelay: 1000,
    });

    this.socket.onopen = () => {
      this.status = 'connected';
      this.error = null;
    };

    this.socket.onclose = (event) => {
      if (event.code === 1000) {
        this.status = 'disconnected';
      } else {
        this.status = 'error';
        this.error = `Connection closed: ${event.reason || 'Unknown reason'}`;
      }
    };

    this.socket.onerror = () => {
      this.status = 'error';
      this.error = 'Connection error';
    };

    this.socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data) as ServerMessage;
        this.handleMessage(message);
      } catch (err) {
        console.error('Failed to parse message:', err);
      }
    };

    // Wait for connection
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout'));
      }, 10000);

      const onOpen = () => {
        clearTimeout(timeout);
        this.socket?.removeEventListener('open', onOpen);
        resolve();
      };

      const onError = () => {
        clearTimeout(timeout);
        this.socket?.removeEventListener('error', onError);
        reject(new Error('Connection failed'));
      };

      this.socket?.addEventListener('open', onOpen);
      this.socket?.addEventListener('error', onError);
    });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.close(1000, 'Client disconnect');
      this.socket = null;
    }
    this.status = 'disconnected';
  }

  send(message: ClientMessage): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(message));
    } else {
      console.warn('Cannot send: socket not open');
    }
  }

  on<T = unknown>(type: string, handler: (payload: T) => void): () => void {
    if (!this.messageHandlers.has(type)) {
      this.messageHandlers.set(type, new Set());
    }
    this.messageHandlers.get(type)!.add(handler as (payload: unknown) => void);
    
    // Return unsubscribe function
    return () => {
      this.messageHandlers.get(type)?.delete(handler as (payload: unknown) => void);
    };
  }

  private handleMessage(message: ServerMessage): void {
    const handlers = this.messageHandlers.get(message.type);
    if (handlers) {
      handlers.forEach(handler => handler(message.payload));
    }

    // Also emit to 'all' handlers
    const allHandlers = this.messageHandlers.get('*');
    if (allHandlers) {
      allHandlers.forEach(handler => handler(message));
    }
  }
}

// Singleton export
export const roomService = new RoomService();
```

### 9.3 Environment Configuration

**`packages/web/.env.local`:**
```bash
# Old
PUBLIC_PARTYKIT_HOST=dicee.verlyn13.partykit.dev

# New (update after deployment)
PUBLIC_WORKER_HOST=gamelobby.your-subdomain.workers.dev
```

**Update in `packages/web/src/lib/services/roomService.svelte.ts`:**
```typescript
const WORKER_HOST = import.meta.env.PUBLIC_WORKER_HOST;
```

---

## 10. Phase 7: Testing Strategy

### 10.1 Local Development

```bash
cd packages/cloudflare-do

# Start local dev server (uses real Cloudflare account for DO)
pnpm dev

# In another terminal, test with wscat
wscat -c "ws://localhost:8787/room/TEST01?token=YOUR_JWT"
```

### 10.2 Unit Tests

**`packages/cloudflare-do/src/game/__tests__/state.test.ts`**
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GameStateManager } from '../state';

// Mock DurableObjectState
const mockStorage = {
  get: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
  setAlarm: vi.fn(),
  getAlarm: vi.fn(),
  deleteAlarm: vi.fn(),
};

const mockCtx = {
  storage: mockStorage,
} as unknown as DurableObjectState;

describe('GameStateManager', () => {
  let manager: GameStateManager;

  beforeEach(() => {
    vi.clearAllMocks();
    manager = new GameStateManager(mockCtx);
  });

  it('initializes game with correct player structure', async () => {
    const playerIds = ['user-1', 'user-2'];
    
    const state = await manager.initializeGame(playerIds);
    
    expect(state.players).toHaveLength(2);
    expect(state.players[0].id).toBe('user-1');
    expect(state.players[0].rollsRemaining).toBe(3);
    expect(mockStorage.put).toHaveBeenCalledWith('game', state);
  });

  it('sets turn timer with correct alarm data', async () => {
    await manager.setTurnTimer('user-1', 30);
    
    expect(mockStorage.put).toHaveBeenCalledWith('alarm_data', {
      type: 'TURN_TIMEOUT',
      userId: 'user-1',
    });
    expect(mockStorage.setAlarm).toHaveBeenCalled();
  });
});
```

### 10.3 Integration Tests

**`packages/cloudflare-do/src/__tests__/integration.test.ts`**
```typescript
import { unstable_dev } from 'wrangler';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import WebSocket from 'ws';

describe('GameRoom Integration', () => {
  let worker: Awaited<ReturnType<typeof unstable_dev>>;
  let testToken: string;

  beforeAll(async () => {
    worker = await unstable_dev('src/worker.ts', {
      experimental: { disableExperimentalWarning: true },
    });
    
    // Create test JWT (you'd use a test Supabase project or mock)
    testToken = 'test-jwt-token';
  });

  afterAll(async () => {
    await worker.stop();
  });

  it('accepts WebSocket connection with valid token', async () => {
    const ws = new WebSocket(
      `ws://${worker.address}:${worker.port}/room/TEST01?token=${testToken}`
    );

    await new Promise<void>((resolve, reject) => {
      ws.on('open', () => resolve());
      ws.on('error', reject);
    });

    expect(ws.readyState).toBe(WebSocket.OPEN);
    ws.close();
  });

  it('receives CONNECTED message on join', async () => {
    const ws = new WebSocket(
      `ws://${worker.address}:${worker.port}/room/TEST02?token=${testToken}`
    );

    const message = await new Promise<string>((resolve) => {
      ws.on('message', (data) => resolve(data.toString()));
    });

    const parsed = JSON.parse(message);
    expect(parsed.type).toBe('CONNECTED');
    expect(parsed.payload.roomCode).toBe('TEST02');
    
    ws.close();
  });
});
```

### 10.4 E2E Playwright Tests

**`packages/web/e2e/multiplayer.spec.ts`**
```typescript
import { test, expect } from '@playwright/test';

test.describe('Multiplayer Game Flow', () => {
  test('two players can join and play', async ({ browser }) => {
    // Create two browser contexts (separate sessions)
    const player1Context = await browser.newContext();
    const player2Context = await browser.newContext();
    
    const player1 = await player1Context.newPage();
    const player2 = await player2Context.newPage();

    // Player 1 creates room
    await player1.goto('/multiplayer');
    await player1.click('[data-testid="create-room"]');
    
    // Get room code
    const roomCode = await player1.textContent('[data-testid="room-code"]');
    expect(roomCode).toMatch(/^[A-Z0-9]{6}$/);

    // Player 2 joins
    await player2.goto(`/multiplayer/join?code=${roomCode}`);
    await player2.click('[data-testid="join-room"]');

    // Verify both see each other
    await expect(player1.locator('[data-testid="player-list"]')).toContainText('Player 2');
    await expect(player2.locator('[data-testid="player-list"]')).toContainText('Player 1');

    // Player 1 starts game
    await player1.click('[data-testid="start-game"]');

    // Verify game started for both
    await expect(player1.locator('[data-testid="game-board"]')).toBeVisible();
    await expect(player2.locator('[data-testid="game-board"]')).toBeVisible();

    await player1Context.close();
    await player2Context.close();
  });
});
```

---

## 11. Phase 8: Deployment

### 11.1 Set Secrets

```bash
cd packages/cloudflare-do

# Set secrets (interactive prompts)
wrangler secret put SUPABASE_URL
# Enter: https://xxx.supabase.co

wrangler secret put SUPABASE_ANON_KEY
# Enter: your-supabase-anon-key
```

### 11.2 Deploy

```bash
# Deploy to production
pnpm deploy

# Output:
# Uploaded gamelobby
# Published gamelobby
#   https://gamelobby.your-subdomain.workers.dev
```

### 11.3 Custom Domain (Optional)

```bash
# Add custom domain via wrangler
wrangler domains add gamelobby.jefahnierocks.com

# Or configure in Cloudflare Dashboard:
# Workers & Pages → gamelobby → Settings → Domains & Routes
```

### 11.4 Verify Deployment

```bash
# Check health endpoint
curl https://gamelobby.your-subdomain.workers.dev/health

# Test WebSocket connection
wscat -c "wss://gamelobby.your-subdomain.workers.dev/room/TEST01?token=YOUR_JWT"

# View logs
wrangler tail
```

### 11.5 Update Frontend

```bash
# packages/web/.env.production
PUBLIC_WORKER_HOST=gamelobby.jefahnierocks.com

# Redeploy frontend
cd packages/web
pnpm build
vercel --prod
```

---

## 12. Rollback Plan

### 12.1 Keep PartyKit Running

During migration, maintain both systems:

```typescript
// packages/web/src/lib/services/roomService.svelte.ts

const USE_DO = import.meta.env.PUBLIC_USE_DURABLE_OBJECTS === 'true';

const PARTYKIT_HOST = 'dicee.verlyn13.partykit.dev';
const WORKER_HOST = 'gamelobby.your-subdomain.workers.dev';

function createConnection(roomCode: string, token: string) {
  if (USE_DO) {
    return new ReconnectingWebSocket(
      `wss://${WORKER_HOST}/room/${roomCode}?token=${encodeURIComponent(token)}`
    );
  } else {
    return new PartySocket({
      host: PARTYKIT_HOST,
      room: roomCode,
      query: { token }
    });
  }
}
```

### 12.2 Feature Flag Control

```bash
# Enable DO (packages/web/.env.production)
PUBLIC_USE_DURABLE_OBJECTS=true

# Rollback to PartyKit
PUBLIC_USE_DURABLE_OBJECTS=false
```

### 12.3 Rollback Procedure

1. Set `PUBLIC_USE_DURABLE_OBJECTS=false` in Vercel env vars
2. Trigger redeploy: `vercel --prod`
3. Verify PartyKit connections working
4. Debug DO issues
5. Re-enable when fixed

---

## 13. Post-Migration Checklist

### 13.1 Functional Verification

- [ ] Room creation works
- [ ] Player join with valid JWT succeeds
- [ ] Player join with invalid JWT rejected (401)
- [ ] Host can start game
- [ ] Non-host cannot start game
- [ ] Dice rolling works
- [ ] Score submission works
- [ ] Turn transitions work
- [ ] Game completion works
- [ ] Chat messages broadcast correctly
- [ ] Player disconnect handled (AFK timer)
- [ ] Player reconnection restores state
- [ ] Alarm-based turn timeouts work

### 13.2 Performance Verification

- [ ] WebSocket connection time < 500ms
- [ ] Message latency < 100ms
- [ ] No memory leaks (check `wrangler tail` over time)
- [ ] Hibernation working (check DO billing)

### 13.3 Cleanup

- [ ] Remove `packages/partykit/` directory
- [ ] Remove `partysocket` from `packages/web/package.json`
- [ ] Update README.md tech stack
- [ ] Update `.claude/cli-reference.yaml`
- [ ] Archive `partykit.json`

### 13.4 Documentation Updates

- [ ] Update `docs/architecture/` diagrams
- [ ] Create ADR for migration decision
- [ ] Update developer onboarding docs
- [ ] Document new deployment process

---

## Appendix A: API Quick Reference

### Storage API (Identical)

```typescript
// Read
const value = await this.ctx.storage.get<Type>('key');
const values = await this.ctx.storage.get<Type>(['key1', 'key2']);
const all = await this.ctx.storage.list<Type>();

// Write
await this.ctx.storage.put('key', value);
await this.ctx.storage.put({ key1: val1, key2: val2 });

// Delete
await this.ctx.storage.delete('key');
await this.ctx.storage.delete(['key1', 'key2']);
await this.ctx.storage.deleteAll();
```

### Alarm API (Identical)

```typescript
// Set alarm (absolute timestamp)
await this.ctx.storage.setAlarm(Date.now() + 30_000);

// Get scheduled alarm
const alarmTime = await this.ctx.storage.getAlarm();

// Cancel alarm
await this.ctx.storage.deleteAlarm();

// Handler (class method)
async alarm(): Promise<void> {
  // Handle alarm
}
```

### WebSocket API (New)

```typescript
// Accept (enables hibernation)
this.ctx.acceptWebSocket(ws, ['tag1', 'tag2']);

// Get connections
const all = this.ctx.getWebSockets();
const tagged = this.ctx.getWebSockets('tag1');

// Get tags
const tags = this.ctx.getTags(ws);

// Attachment (survives hibernation)
ws.serializeAttachment({ userId: '...' });
const state = ws.deserializeAttachment();

// Auto-response (no wake)
this.ctx.setWebSocketAutoResponse(
  new WebSocketRequestResponsePair('ping', 'pong')
);

// Event timeout
this.ctx.setHibernatableWebSocketEventTimeout(30_000);
```

---

## Appendix B: Troubleshooting

### Connection Issues

**Error: "Missing token"**
- Client not sending `?token=` query param
- Token is empty string

**Error: "Token expired"**
- Supabase session expired
- Client needs to refresh token before connecting

**Error: "WebSocket upgrade failed"**
- Missing `Upgrade: websocket` header
- Client using HTTP instead of WS

### Hibernation Issues

**State lost between messages**
- Using instance variables instead of `ctx.storage`
- Not calling `serializeAttachment()` after modifying state

**Attachment too large**
- Attachment exceeds ~2KB limit
- Move large state to `ctx.storage`

### Deployment Issues

**Durable Object not found**
- Missing `[[durable_objects.bindings]]` in wrangler.toml
- Missing `[[migrations]]` entry
- Need to run `wrangler deploy` to create migration

**JWT verification failing in production**
- SUPABASE_URL secret not set
- JWKS endpoint not accessible (check network rules)

---

*End of Migration Guide*
